from __future__ import annotations

import hmac
from time import perf_counter
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.auth import require_auth
from app.routes.admin import router as admin_router
from app.routes.benchmarks import router as benchmarks_router
from app.routes.collaboration import router as collaboration_router
from app.routes.comparisons import router as comparisons_router
from app.routes.enterprise import router as enterprise_router
from app.routes.inference import router as inference_router
from app.routes.marketing import router as marketing_router
from app.routes.preprocessing import router as preprocessing_router
from app.routes.projects import router as projects_router
from app.routes.reports import router as reports_router
from app.routes.runtime_settings import router as runtime_settings_router
from app.routes.scoring import router as scoring_router
from app.routes.tribe_internal import router as tribe_internal_router
from app.services.observability import (
    check_rate_limit,
    configure_logging,
    init_sentry,
    log_structured,
    organization_from_request,
    record_exception,
    record_rate_limit_event,
)
from app.services.readiness import dependencies_readiness
from app.routes.uploads import router as uploads_router
from app.settings import settings

configure_logging()
init_sentry()

app = FastAPI(title="PraevIA NeuroImpact Analyzer API", version="0.1.0")

if settings.allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

if settings.force_https:
    app.add_middleware(HTTPSRedirectMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Organization-ID"],
)


@app.middleware("http")
async def observability_and_security(request: Request, call_next) -> Response:
    request_id = request.headers.get("x-request-id") or str(uuid4())
    started = perf_counter()
    decision = check_rate_limit(request)
    if not decision.allowed:
        record_rate_limit_event(request, decision)
        response = JSONResponse(
            status_code=429,
            content={
                "detail": "Rate limit alcanzado.",
                "request_id": request_id,
                "retry_after_seconds": decision.retry_after_seconds,
            },
        )
        response.headers["Retry-After"] = str(decision.retry_after_seconds)
    else:
        try:
            response = await call_next(request)
        except Exception as exc:
            organization_id = organization_from_request(request)
            record_exception(
                exc,
                source="api",
                organization_id=organization_id,
                metadata={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "query": str(request.url.query),
                },
            )
            response = JSONResponse(
                status_code=500,
                content={"detail": "Error interno registrado.", "request_id": request_id},
            )
    elapsed_ms = round((perf_counter() - started) * 1000, 2)
    log_structured(
        "http_request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        elapsed_ms=elapsed_ms,
        rate_limited=not decision.allowed,
    )
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.force_https:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str | int | float | bool | list[str]]:
    return {
        "status": "ready",
        "env": settings.app_env,
        "allowed_origins": settings.allowed_origins,
        "signed_url_ttl_seconds": settings.signed_url_ttl_seconds,
        "retention_days": settings.retention_days,
        "monthly_cost_cap_eur": settings.monthly_cost_cap_eur,
        "monthly_gpu_cap_seconds": settings.monthly_gpu_cap_seconds,
        "sentry_configured": settings.sentry_dsn_configured,
        "structured_logs": settings.structured_logs,
        "rate_limit_window_seconds": settings.rate_limit_window_seconds,
        "rate_limit_requests": settings.rate_limit_requests,
        "cost_alert_threshold_eur": settings.cost_alert_threshold_eur,
        "readiness_token_configured": settings.readiness_token_configured,
        "auth_mode": settings.auth_mode,
        "persistence_mode": settings.persistence_mode,
        "supabase_configured": bool(settings.supabase_url and settings.supabase_anon_key_configured),
        "supabase_service_role_configured": settings.supabase_service_role_configured,
        "storage_mode": settings.storage_mode,
        "s3_bucket": settings.s3_bucket,
        "s3_endpoint_configured": bool(settings.s3_endpoint),
        "s3_access_key_configured": settings.s3_access_key_id_configured,
        "s3_secret_configured": settings.s3_secret_access_key_configured,
        "gpu_provider": settings.gpu_provider,
        "gpu_provider_api_key_configured": settings.gpu_provider_api_key_configured,
        "tribe_worker_mode": settings.tribe_worker_mode,
        "tribe_worker_endpoint_configured": settings.tribe_worker_endpoint_configured,
        "tribe_worker_image": settings.tribe_worker_image,
        "tribe_callback_configured": bool(settings.tribe_callback_url and settings.tribe_callback_secret_configured),
        "huggingface_token_configured": settings.huggingface_token_configured,
        "openai_api_key_configured": settings.openai_api_key_configured,
        "llm_interpreter_model": settings.llm_interpreter_model,
        "llm_writer_model": settings.llm_writer_model,
        "llm_prompt_version": settings.llm_prompt_version,
        "report_renderer_mode": settings.report_renderer_mode,
    }


def _verify_readiness_token(x_readiness_token: str | None) -> None:
    if not settings.readiness_token:
        return
    if not x_readiness_token or not hmac.compare_digest(x_readiness_token, settings.readiness_token):
        raise HTTPException(status_code=401, detail="Readiness no autorizado.")


@app.get("/ready/dependencies")
def ready_dependencies(
    strict: bool = True,
    require_remote_worker: bool = False,
    x_readiness_token: str | None = Header(default=None),
) -> dict:
    _verify_readiness_token(x_readiness_token)
    result = dependencies_readiness(strict=strict, require_remote_worker=require_remote_worker)
    if strict and not result["ok"]:
        raise HTTPException(status_code=503, detail=result)
    return result


private_dependencies = [Depends(require_auth)]

app.include_router(projects_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(uploads_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(preprocessing_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(inference_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(scoring_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(reports_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(comparisons_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(admin_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(marketing_router, prefix="/v1")
app.include_router(collaboration_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(benchmarks_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(enterprise_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(runtime_settings_router, prefix="/v1", dependencies=private_dependencies)
app.include_router(tribe_internal_router, prefix="/v1")
