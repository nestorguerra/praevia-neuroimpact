from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException

from app.settings import settings


@dataclass(frozen=True)
class GoogleCloudTaskJob:
    job_id: str
    status: str
    raw: dict[str, Any]


class GoogleCloudTasksClient:
    """Adapter for Cloud Tasks dispatch into a Cloud Run GPU worker."""

    def _access_token(self) -> str:
        try:
            import google.auth
            from google.auth.transport.requests import Request
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="Dependencias Google Cloud no instaladas en backend.",
            ) from exc

        try:
            credentials, _project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            credentials.refresh(Request())
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"No se pudieron obtener credenciales Google Cloud: {exc}") from exc
        if not credentials.token:
            raise HTTPException(status_code=503, detail="Google Cloud no devolvio access token.")
        return str(credentials.token)

    def _require_queue(self) -> tuple[str, str, str]:
        if not settings.gcp_project_id:
            raise HTTPException(status_code=503, detail="GCP_PROJECT_ID no configurado.")
        if not settings.gcp_tasks_location:
            raise HTTPException(status_code=503, detail="GCP_TASKS_LOCATION no configurado.")
        if not settings.gcp_tasks_queue:
            raise HTTPException(status_code=503, detail="GCP_TASKS_QUEUE no configurado.")
        return settings.gcp_project_id, settings.gcp_tasks_location, settings.gcp_tasks_queue

    def _worker_run_url(self) -> str:
        if not settings.tribe_worker_endpoint_url:
            raise HTTPException(status_code=503, detail="TRIBE_WORKER_ENDPOINT_URL no configurado.")
        base = settings.tribe_worker_endpoint_url.rstrip("/")
        if base.endswith("/run") or base.endswith("/runsync"):
            return base
        return f"{base}/run"

    def _id_token(self, audience: str) -> str | None:
        try:
            from google.auth.transport.requests import Request
            from google.oauth2 import id_token

            return str(id_token.fetch_id_token(Request(), audience))
        except Exception:
            return None

    def enqueue(self, payload: dict[str, Any]) -> GoogleCloudTaskJob:
        import httpx

        project_id, location, queue = self._require_queue()
        url = f"https://cloudtasks.googleapis.com/v2/projects/{project_id}/locations/{location}/queues/{queue}/tasks"
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        worker_secret = settings.tribe_worker_bearer_token or settings.tribe_callback_secret
        if worker_secret:
            headers["X-TRIBE-WORKER-SECRET"] = worker_secret
        http_request: dict[str, Any] = {
            "httpMethod": "POST",
            "url": self._worker_run_url(),
            "headers": headers,
            "body": base64.b64encode(body).decode("ascii"),
        }
        if settings.gcp_tasks_service_account:
            http_request["oidcToken"] = {"serviceAccountEmail": settings.gcp_tasks_service_account}
        task = {"httpRequest": http_request}
        try:
            response = httpx.post(
                url,
                headers={"Authorization": f"Bearer {self._access_token()}", "Content-Type": "application/json"},
                json={"task": task},
                timeout=30,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"Cloud Tasks rechazo el job: {exc.response.text[:500]}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"No se pudo conectar con Cloud Tasks: {exc}") from exc

        data = response.json()
        task_name = str(data.get("name") or "")
        if not task_name:
            raise HTTPException(status_code=502, detail="Cloud Tasks no devolvio task name.")
        return GoogleCloudTaskJob(job_id=task_name, status="QUEUED", raw=data)

    def ping(self) -> dict[str, Any]:
        import httpx

        if not settings.tribe_worker_endpoint_url:
            raise HTTPException(status_code=503, detail="TRIBE_WORKER_ENDPOINT_URL no configurado.")
        base = settings.tribe_worker_endpoint_url.rstrip("/")
        url = f"{base}/health" if not base.endswith("/health") else base
        headers: dict[str, str] = {}
        worker_secret = settings.tribe_worker_bearer_token or settings.tribe_callback_secret
        if worker_secret:
            headers["X-TRIBE-WORKER-SECRET"] = worker_secret
        else:
            token = self._id_token(settings.tribe_worker_endpoint_url.rstrip("/"))
            if token:
                headers["Authorization"] = f"Bearer {token}"
        try:
            response = httpx.get(url, headers=headers, timeout=15)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=503, detail=f"Cloud Run worker no disponible: {exc.response.text[:500]}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail=f"No se pudo consultar Cloud Run worker: {exc}") from exc
        return {"reachable": True, "operation": "health", "status_code": response.status_code}


google_cloud_tasks_client = GoogleCloudTasksClient()
