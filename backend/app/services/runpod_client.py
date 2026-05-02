from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException

from app.settings import settings


@dataclass(frozen=True)
class RunPodJob:
    job_id: str
    status: str
    raw: dict[str, Any]


class RunPodClient:
    """Thin adapter for RunPod Serverless job operations."""

    @property
    def api_key(self) -> str | None:
        import os

        return os.getenv("RUNPOD_API_KEY") or os.getenv("GPU_PROVIDER_API_KEY")

    def _endpoint_url(self, operation: str) -> str:
        if not settings.tribe_worker_endpoint_url:
            raise HTTPException(status_code=503, detail="TRIBE_WORKER_ENDPOINT_URL no configurado.")
        base = settings.tribe_worker_endpoint_url.rstrip("/")
        if base.endswith("/run") or base.endswith("/runsync"):
            base = base.rsplit("/", 1)[0]
        return f"{base}/{operation.lstrip('/')}"

    def _headers(self) -> dict[str, str]:
        token = self.api_key
        if not token:
            raise HTTPException(status_code=503, detail="RUNPOD_API_KEY/GPU_PROVIDER_API_KEY no configurada.")
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def enqueue(self, payload: dict[str, Any]) -> RunPodJob:
        import httpx

        try:
            response = httpx.post(
                self._endpoint_url("run"),
                headers=self._headers(),
                json=payload,
                timeout=30,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"RunPod rechazo el job: {exc.response.text[:500]}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"No se pudo conectar con RunPod: {exc}") from exc

        data = response.json()
        job_id = str(data.get("id") or data.get("jobId") or data.get("job_id") or "")
        if not job_id:
            raise HTTPException(status_code=502, detail="RunPod no devolvio job id.")
        return RunPodJob(job_id=job_id, status=str(data.get("status") or "IN_QUEUE"), raw=data)

    def status(self, job_id: str) -> RunPodJob:
        import httpx

        try:
            response = httpx.get(
                self._endpoint_url(f"status/{job_id}"),
                headers=self._headers(),
                timeout=30,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"RunPod status fallo: {exc.response.text[:500]}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"No se pudo consultar RunPod: {exc}") from exc
        data = response.json()
        return RunPodJob(job_id=job_id, status=str(data.get("status") or "UNKNOWN"), raw=data)

    def ping(self) -> dict[str, Any]:
        import httpx

        probes = ["health", "status/praevia-healthcheck"]
        last_status = 0
        last_text = ""
        for operation in probes:
            try:
                response = httpx.get(
                    self._endpoint_url(operation),
                    headers=self._headers(),
                    timeout=15,
                )
            except httpx.HTTPError as exc:
                last_text = str(exc)
                continue
            last_status = response.status_code
            last_text = response.text[:500]
            if response.status_code in {200, 204, 400, 404, 405}:
                return {
                    "reachable": True,
                    "operation": operation,
                    "status_code": response.status_code,
                }
            if response.status_code in {401, 403}:
                break
        raise HTTPException(
            status_code=503,
            detail=f"TRIBE worker no disponible o no autorizado. status={last_status} body={last_text}",
        )


runpod_client = RunPodClient()
