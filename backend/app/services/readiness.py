from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.repositories.db import connection
from app.services.gpu_worker_client import gpu_worker_client
from app.services.storage import storage_service
from app.settings import settings


def _ok_check(name: str, detail: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"name": name, "ok": True, "detail": detail or {}}


def _fail_check(name: str, error: str, detail: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"name": name, "ok": False, "error": error, "detail": detail or {}}


def check_database(strict: bool) -> dict[str, Any]:
    if settings.persistence_mode != "db":
        if strict:
            return _fail_check("database", "PERSISTENCE_MODE debe ser db para produccion.", {"mode": settings.persistence_mode})
        return _ok_check("database", {"mode": settings.persistence_mode, "skipped": True})
    try:
        with connection() as conn:
            row = conn.execute("select 1 as ok").fetchone()
        if not row or row["ok"] != 1:
            return _fail_check("database", "La consulta de readiness no devolvio OK.")
    except Exception as exc:
        return _fail_check("database", str(exc), {"mode": settings.persistence_mode})
    return _ok_check("database", {"mode": settings.persistence_mode})


def check_storage(strict: bool) -> dict[str, Any]:
    if not storage_service.is_configured:
        if strict:
            return _fail_check("storage", "Storage S3/R2 no configurado.", {"mode": settings.storage_mode})
        return _ok_check("storage", {"mode": settings.storage_mode, "skipped": True})
    key = f"readiness/{settings.app_env}/{uuid4()}.txt"
    try:
        signed_url, headers = storage_service.create_presigned_upload_url(
            key=key,
            content_type="text/plain",
            metadata={"purpose": "readiness"},
            expires_in=60,
        )
    except Exception as exc:
        return _fail_check("storage", str(exc), {"bucket": storage_service.bucket, "mode": settings.storage_mode})
    if not signed_url.startswith(("http://", "https://")):
        return _fail_check("storage", "Storage no genero una URL firmada valida.", {"bucket": storage_service.bucket})
    return _ok_check("storage", {"bucket": storage_service.bucket, "signed_upload": True, "headers": sorted(headers)})


def check_worker(strict: bool, require_remote_worker: bool = False) -> dict[str, Any]:
    mode = settings.tribe_worker_mode
    if mode == "remote_gpu":
        try:
            ping = gpu_worker_client.ping()
        except Exception as exc:
            return _fail_check("worker", str(exc), {"mode": mode, "provider": settings.gpu_provider})
        return _ok_check("worker", {"mode": mode, "provider": settings.gpu_provider, **ping})
    if mode == "mock" and not require_remote_worker and (settings.app_env != "production" or settings.allow_mock_worker_in_production_gate):
        return _ok_check("worker", {"mode": mode, "mock_contract": True})
    if strict:
        return _fail_check(
            "worker",
            "Worker TRIBE remoto no disponible para gate estricto.",
            {"mode": mode, "app_env": settings.app_env, "require_remote_worker": require_remote_worker},
        )
    return _ok_check("worker", {"mode": mode, "skipped": True})


def dependencies_readiness(*, strict: bool, require_remote_worker: bool = False) -> dict[str, Any]:
    checks = [
        check_database(strict),
        check_storage(strict),
        check_worker(strict, require_remote_worker=require_remote_worker),
    ]
    ok = all(check["ok"] for check in checks)
    return {
        "ok": ok,
        "strict": strict,
        "app_env": settings.app_env,
        "checks": checks,
    }
