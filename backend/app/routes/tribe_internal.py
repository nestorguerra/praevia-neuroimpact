from __future__ import annotations

import hmac

from fastapi import APIRouter, Header, HTTPException

from app.repositories.inference_db import inference_db_repository
from app.schemas.inference import AnalysisRunRead, TribeCallbackPayload
from app.settings import settings

router = APIRouter(tags=["tribe-internal"])


def _verify_callback_secret(secret: str | None) -> None:
    expected = settings.tribe_callback_secret
    if not expected:
        raise HTTPException(status_code=503, detail="TRIBE_CALLBACK_SECRET no configurado.")
    if not secret or not hmac.compare_digest(secret, expected):
        raise HTTPException(status_code=401, detail="Callback TRIBE no autorizado.")


@router.post("/internal/tribe/callback", response_model=AnalysisRunRead)
def tribe_worker_callback(
    payload: TribeCallbackPayload,
    x_tribe_callback_secret: str | None = Header(default=None),
) -> AnalysisRunRead:
    _verify_callback_secret(x_tribe_callback_secret)
    return inference_db_repository.apply_callback(payload)
