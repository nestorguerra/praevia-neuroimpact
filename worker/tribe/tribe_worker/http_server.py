from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException

from tribe_worker.handler import handler

app = FastAPI(title="PraevIA TRIBE Worker", version="0.1.0")


def _check_worker_secret(
    authorization: Optional[str],
    x_tribe_worker_secret: Optional[str],
) -> None:
    expected = os.getenv("TRIBE_WORKER_BEARER_TOKEN") or os.getenv("TRIBE_CALLBACK_SECRET") or ""
    if not expected:
        return
    bearer = ""
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()
    if x_tribe_worker_secret == expected or bearer == expected:
        return
    raise HTTPException(status_code=401, detail="Invalid worker secret.")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "runtime": "google_cloud_run_gpu",
        "model_id": os.getenv("TRIBE_MODEL_ID", "facebook/tribev2"),
        "mock": os.getenv("TRIBE_MOCK", "").lower() == "true",
    }


@app.post("/run")
def run(
    payload: dict[str, Any],
    authorization: Optional[str] = Header(default=None),
    x_tribe_worker_secret: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    _check_worker_secret(authorization, x_tribe_worker_secret)
    return handler(payload)


@app.post("/runsync")
def runsync(
    payload: dict[str, Any],
    authorization: Optional[str] = Header(default=None),
    x_tribe_worker_secret: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    _check_worker_secret(authorization, x_tribe_worker_secret)
    return handler(payload)
