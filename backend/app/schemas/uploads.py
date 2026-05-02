from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class AssetKind(str, Enum):
    video = "video"
    audio = "audio"
    text = "text"


class AssetSlot(str, Enum):
    a = "A"
    b = "B"
    c = "C"


class UploadIntentCreate(BaseModel):
    organization_id: UUID
    workspace_id: UUID
    project_id: UUID
    experiment_id: UUID
    slot: AssetSlot
    file_name: str
    mime_type: str
    byte_size: int = Field(gt=0)
    sha256: str | None = None
    kind: AssetKind


class UploadIntentRead(BaseModel):
    upload_session_id: UUID = Field(default_factory=uuid4)
    asset_id: UUID = Field(default_factory=uuid4)
    method: str = "PUT"
    signed_url: str
    storage_bucket: str
    storage_key: str
    expires_at: datetime
    max_byte_size: int
    headers: dict[str, str]
    is_mock: bool = False


class UploadCompleteCreate(BaseModel):
    upload_session_id: UUID
    sha256: str
    byte_size: int = Field(gt=0)


class UploadCompleteRead(BaseModel):
    upload_session_id: UUID
    status: str = "completed"
    asset_id: UUID | None = None
    storage_bucket: str | None = None
    storage_key: str | None = None
    verified: bool = False


class AssetDownloadRead(BaseModel):
    asset_id: UUID
    method: str = "GET"
    signed_url: str
    storage_bucket: str
    storage_key: str
    expires_at: datetime


class AssetRead(BaseModel):
    id: UUID
    organization_id: UUID
    workspace_id: UUID
    project_id: UUID
    experiment_id: UUID
    slot: AssetSlot
    kind: AssetKind
    original_filename: str
    mime_type: str
    byte_size: int
    sha256: str | None = None
    status: str
    storage_bucket: str | None = None
    storage_key: str | None = None
    health: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


def mock_upload_intent(payload: UploadIntentCreate, bucket: str = "neuroimpact-local") -> UploadIntentRead:
    upload_session_id = uuid4()
    asset_id = uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    storage_key = (
        f"org/{payload.organization_id}/experiment/{payload.experiment_id}/"
        f"{payload.slot.value.lower()}-{asset_id}-{payload.file_name}"
    )
    return UploadIntentRead(
        upload_session_id=upload_session_id,
        asset_id=asset_id,
        signed_url=f"https://storage.local/upload/{upload_session_id}",
        storage_bucket=bucket,
        storage_key=storage_key,
        expires_at=expires_at,
        max_byte_size=payload.byte_size,
        headers={
            "content-type": payload.mime_type,
            "x-amz-meta-sha256": payload.sha256 or "",
        },
        is_mock=True,
    )
