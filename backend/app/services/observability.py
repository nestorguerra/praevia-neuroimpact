from __future__ import annotations

import json
import logging
import time
import traceback
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from starlette.requests import Request

from app.repositories.db import connection, jsonb
from app.settings import settings


LOGGER_NAME = "praevia"
logger = logging.getLogger(LOGGER_NAME)
_rate_windows: dict[str, deque[float]] = defaultdict(deque)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
        }
        extra = getattr(record, "extra", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["stack"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=True, default=str)


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO)
    if not settings.structured_logs:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


def init_sentry() -> None:
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
    except Exception:
        logger.warning("sentry_sdk_missing", extra={"extra": {"component": "observability"}})
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=settings.sentry_profiles_sample_rate,
        integrations=[
            FastApiIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        send_default_pii=False,
    )


def capture_exception(exc: BaseException, *, tags: dict[str, str] | None = None) -> None:
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk

        with sentry_sdk.push_scope() as scope:
            for key, value in (tags or {}).items():
                scope.set_tag(key, value)
            sentry_sdk.capture_exception(exc)
    except Exception:
        logger.warning("sentry_capture_failed", extra={"extra": {"component": "observability"}})


def _uuid(value: str | None) -> UUID | None:
    if not value:
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def organization_from_request(request: Request) -> UUID | None:
    header = _uuid(request.headers.get("x-organization-id"))
    if header:
        return header
    parts = [part for part in request.url.path.split("/") if part]
    for index, part in enumerate(parts):
        if part in {"organizations", "org"} and index + 1 < len(parts):
            candidate = _uuid(parts[index + 1])
            if candidate:
                return candidate
    return None


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    host = forwarded or (request.client.host if request.client else "unknown")
    return f"{host}:{request.url.path}"


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    request_count: int
    limit_count: int
    retry_after_seconds: int


def check_rate_limit(request: Request) -> RateLimitDecision:
    if settings.rate_limit_requests <= 0:
        return RateLimitDecision(True, 0, settings.rate_limit_requests, 0)
    if request.url.path in {"/health", "/ready"}:
        return RateLimitDecision(True, 0, settings.rate_limit_requests, 0)
    now = time.monotonic()
    window_start = now - settings.rate_limit_window_seconds
    key = client_key(request)
    hits = _rate_windows[key]
    while hits and hits[0] < window_start:
        hits.popleft()
    hits.append(now)
    allowed = len(hits) <= settings.rate_limit_requests
    retry_after = int(settings.rate_limit_window_seconds - (now - hits[0])) if hits else settings.rate_limit_window_seconds
    return RateLimitDecision(allowed, len(hits), settings.rate_limit_requests, max(1, retry_after))


def record_rate_limit_event(request: Request, decision: RateLimitDecision) -> None:
    organization_id = organization_from_request(request)
    if not organization_id:
        return
    try:
        with connection() as conn:
            conn.execute(
                """
                insert into public.rate_limit_events (
                  organization_id, actor_id, route, window_start, window_seconds,
                  request_count, limit_count, blocked, metadata
                )
                values (%s, null, %s, now() - (%s::text || ' seconds')::interval, %s, %s, %s, true, %s)
                """,
                (
                    organization_id,
                    request.url.path,
                    settings.rate_limit_window_seconds,
                    settings.rate_limit_window_seconds,
                    decision.request_count,
                    decision.limit_count,
                    jsonb({"method": request.method, "client": request.client.host if request.client else None}),
                ),
            )
            conn.commit()
    except Exception as exc:
        logger.warning("rate_limit_event_failed", extra={"extra": {"error": str(exc)}})


def record_error_event(
    *,
    source: str,
    message: str,
    severity: str = "error",
    organization_id: UUID | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    stack: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    try:
        with connection() as conn:
            conn.execute(
                """
                insert into public.error_events (
                  organization_id, source, severity, message, stack, entity_type,
                  entity_id, metadata
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    organization_id,
                    source,
                    severity,
                    message[:1000],
                    stack,
                    entity_type,
                    entity_id,
                    jsonb(metadata or {}),
                ),
            )
            conn.commit()
    except Exception as exc:
        logger.error("error_event_insert_failed", extra={"extra": {"original_message": message, "error": str(exc)}})


def record_exception(
    exc: BaseException,
    *,
    source: str,
    organization_id: UUID | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    stack = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    severity = "warning" if isinstance(exc, HTTPException) and exc.status_code < 500 else "error"
    record_error_event(
        source=source,
        message=str(exc),
        severity=severity,
        organization_id=organization_id,
        entity_type=entity_type,
        entity_id=entity_id,
        stack=stack,
        metadata=metadata,
    )
    if severity == "error":
        capture_exception(exc, tags={"source": source})


def log_structured(message: str, **extra: Any) -> None:
    logger.info(message, extra={"extra": extra})
