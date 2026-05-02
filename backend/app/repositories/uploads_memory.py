from __future__ import annotations

from uuid import UUID

from app.schemas.uploads import (
    AssetDownloadRead,
    AssetRead,
    UploadCompleteCreate,
    UploadCompleteRead,
    UploadIntentCreate,
    UploadIntentRead,
    mock_upload_intent,
)
from datetime import datetime, timedelta, timezone


class UploadsMemoryRepository:
    def __init__(self) -> None:
        self.intents: dict[UUID, UploadIntentRead] = {}

    def create_upload_intent(self, payload: UploadIntentCreate, *_args) -> UploadIntentRead:
        intent = mock_upload_intent(payload)
        self.intents[intent.upload_session_id] = intent
        return intent

    def complete_upload_session(self, payload: UploadCompleteCreate, *_args) -> UploadCompleteRead:
        return UploadCompleteRead(upload_session_id=payload.upload_session_id)

    def list_experiment_assets(self, _experiment_id: UUID, *_args) -> list[AssetRead]:
        return []

    def create_asset_download_url(self, asset_id: UUID, *_args) -> AssetDownloadRead:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        return AssetDownloadRead(
            asset_id=asset_id,
            signed_url=f"https://storage.local/download/{asset_id}",
            storage_bucket="neuroimpact-local",
            storage_key=f"mock/{asset_id}",
            expires_at=expires_at,
        )


uploads_memory_repository = UploadsMemoryRepository()
