from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_auth
from app.repositories.uploads_repository import uploads_repository
from app.schemas.uploads import (
    AssetDownloadRead,
    AssetRead,
    AssetKind,
    UploadCompleteCreate,
    UploadCompleteRead,
    UploadIntentCreate,
    UploadIntentRead,
)
from app.services.asset_validation import validate_upload_payload

router = APIRouter(tags=["assets-uploads"])

MAX_BYTES_BY_KIND = {
    AssetKind.video: 500 * 1024 * 1024,
    AssetKind.audio: 150 * 1024 * 1024,
    AssetKind.text: 5 * 1024 * 1024,
}


@router.post("/upload-intents", response_model=UploadIntentRead)
def create_upload_intent(payload: UploadIntentCreate, current_user: CurrentUser = Depends(require_auth)) -> UploadIntentRead:
    max_bytes = MAX_BYTES_BY_KIND[payload.kind]
    if payload.byte_size > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds max size for {payload.kind.value}")
    validate_upload_payload(payload)
    return uploads_repository().create_upload_intent(payload, current_user)


@router.post("/upload-sessions/complete", response_model=UploadCompleteRead)
def complete_upload_session(payload: UploadCompleteCreate, current_user: CurrentUser = Depends(require_auth)) -> UploadCompleteRead:
    return uploads_repository().complete_upload_session(payload, current_user)


@router.get("/experiments/{experiment_id}/assets", response_model=list[AssetRead])
def list_experiment_assets(experiment_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[AssetRead]:
    return uploads_repository().list_experiment_assets(experiment_id, current_user)


@router.get("/assets/{asset_id}/download-url", response_model=AssetDownloadRead)
def create_asset_download_url(asset_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> AssetDownloadRead:
    return uploads_repository().create_asset_download_url(asset_id, current_user)
