from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException

from app.services.google_cloud_tasks_client import google_cloud_tasks_client
from app.services.runpod_client import runpod_client
from app.settings import settings


@dataclass(frozen=True)
class GpuWorkerJob:
    job_id: str
    status: str
    raw: dict[str, Any]


class GpuWorkerClient:
    def enqueue(self, payload: dict[str, Any]) -> GpuWorkerJob:
        provider = settings.gpu_provider
        if provider == "google_cloud_run_gpu":
            job = google_cloud_tasks_client.enqueue(payload)
            return GpuWorkerJob(job_id=job.job_id, status=job.status, raw=job.raw)
        if provider in {"runpod_serverless", "runpod"}:
            job = runpod_client.enqueue(payload)
            return GpuWorkerJob(job_id=job.job_id, status=job.status, raw=job.raw)
        raise HTTPException(status_code=503, detail=f"GPU_PROVIDER no soportado: {provider}")

    def ping(self) -> dict[str, Any]:
        provider = settings.gpu_provider
        if provider == "google_cloud_run_gpu":
            return google_cloud_tasks_client.ping()
        if provider in {"runpod_serverless", "runpod"}:
            return runpod_client.ping()
        raise HTTPException(status_code=503, detail=f"GPU_PROVIDER no soportado: {provider}")


gpu_worker_client = GpuWorkerClient()

