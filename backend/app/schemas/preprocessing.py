from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.schemas.uploads import AssetKind


class PreprocessingStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class PreprocessingStepStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"


class DerivativeType(str, Enum):
    normalized_media = "normalized_media"
    extracted_audio = "extracted_audio"
    transcript = "transcript"
    metadata = "metadata"
    silence_report = "silence_report"
    normalized_text = "normalized_text"


class AssetPreprocessingInput(BaseModel):
    asset_id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    experiment_id: UUID
    file_name: str
    kind: AssetKind
    mime_type: str = "application/octet-stream"
    byte_size: int = Field(gt=0)
    storage_bucket: str = "neuroimpact-local"
    storage_key: str | None = None
    extension: str | None = None
    duration_label: str | None = None
    text_label: str | None = None
    language_label: str | None = None
    has_srt_timecodes: bool = False


class PreprocessingJobCreate(BaseModel):
    assets: list[AssetPreprocessingInput] = Field(min_length=1, max_length=3)


class PreprocessingStep(BaseModel):
    label: str
    status: PreprocessingStepStatus
    message: str


class AssetDerivativeRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    asset_id: UUID
    preprocessing_job_id: UUID
    derivative_type: DerivativeType
    label: str
    storage_bucket: str
    storage_key: str
    mime_type: str
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PreprocessingJobRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    experiment_id: UUID
    asset_id: UUID
    file_name: str
    status: PreprocessingStatus
    progress: int = Field(ge=0, le=100)
    steps: list[PreprocessingStep]
    logs: list[str]
    derivatives: list[AssetDerivativeRead]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None


class PreprocessingBatchRead(BaseModel):
    jobs: list[PreprocessingJobRead]


def build_mock_job(asset: AssetPreprocessingInput) -> PreprocessingJobRead:
    job_id = uuid4()
    base_key = asset.storage_key or f"org/{asset.organization_id}/experiment/{asset.experiment_id}/{asset.asset_id}"
    derivatives: list[AssetDerivativeRead] = [
        AssetDerivativeRead(
            asset_id=asset.asset_id,
            preprocessing_job_id=job_id,
            derivative_type=DerivativeType.metadata,
            label="metadata.ffprobe.json",
            storage_bucket=asset.storage_bucket,
            storage_key=f"derived/{base_key}/metadata.ffprobe.json",
            mime_type="application/json",
            metadata={"source": "ffprobe_contract", "duration": asset.duration_label},
        )
    ]

    if asset.kind == AssetKind.video:
        derivatives.extend(
            [
                AssetDerivativeRead(
                    asset_id=asset.asset_id,
                    preprocessing_job_id=job_id,
                    derivative_type=DerivativeType.normalized_media,
                    label="normalized_video.mp4",
                    storage_bucket=asset.storage_bucket,
                    storage_key=f"derived/{base_key}/normalized_video.mp4",
                    mime_type="video/mp4",
                    metadata={"codec": "h264/aac", "target": "TRIBE visual stream"},
                ),
                AssetDerivativeRead(
                    asset_id=asset.asset_id,
                    preprocessing_job_id=job_id,
                    derivative_type=DerivativeType.extracted_audio,
                    label="audio_16k_mono.wav",
                    storage_bucket=asset.storage_bucket,
                    storage_key=f"derived/{base_key}/audio_16k_mono.wav",
                    mime_type="audio/wav",
                    metadata={"sample_rate": 16000, "channels": 1},
                ),
                AssetDerivativeRead(
                    asset_id=asset.asset_id,
                    preprocessing_job_id=job_id,
                    derivative_type=DerivativeType.transcript,
                    label="transcript.whisper.json",
                    storage_bucket=asset.storage_bucket,
                    storage_key=f"derived/{base_key}/transcript.whisper.json",
                    mime_type="application/json",
                    metadata={"source": "faster-whisper-or-dev-contract", "language": asset.language_label},
                ),
                AssetDerivativeRead(
                    asset_id=asset.asset_id,
                    preprocessing_job_id=job_id,
                    derivative_type=DerivativeType.silence_report,
                    label="silence_report.json",
                    storage_bucket=asset.storage_bucket,
                    storage_key=f"derived/{base_key}/silence_report.json",
                    mime_type="application/json",
                    metadata={"method": "ffmpeg_silencedetect"},
                ),
            ]
        )
    elif asset.kind == AssetKind.audio:
        derivatives.extend(
            [
                AssetDerivativeRead(
                    asset_id=asset.asset_id,
                    preprocessing_job_id=job_id,
                    derivative_type=DerivativeType.normalized_media,
                    label="audio_16k_mono.wav",
                    storage_bucket=asset.storage_bucket,
                    storage_key=f"derived/{base_key}/audio_16k_mono.wav",
                    mime_type="audio/wav",
                    metadata={"sample_rate": 16000, "channels": 1},
                ),
                AssetDerivativeRead(
                    asset_id=asset.asset_id,
                    preprocessing_job_id=job_id,
                    derivative_type=DerivativeType.transcript,
                    label="transcript.whisper.json",
                    storage_bucket=asset.storage_bucket,
                    storage_key=f"derived/{base_key}/transcript.whisper.json",
                    mime_type="application/json",
                    metadata={"source": "faster-whisper-or-dev-contract", "language": asset.language_label},
                ),
                AssetDerivativeRead(
                    asset_id=asset.asset_id,
                    preprocessing_job_id=job_id,
                    derivative_type=DerivativeType.silence_report,
                    label="silence_report.json",
                    storage_bucket=asset.storage_bucket,
                    storage_key=f"derived/{base_key}/silence_report.json",
                    mime_type="application/json",
                    metadata={"method": "ffmpeg_silencedetect"},
                ),
            ]
        )
    else:
        derivatives.append(
            AssetDerivativeRead(
                asset_id=asset.asset_id,
                preprocessing_job_id=job_id,
                derivative_type=DerivativeType.normalized_text,
                label="normalized_text.json",
                storage_bucket=asset.storage_bucket,
                storage_key=f"derived/{base_key}/normalized_text.json",
                mime_type="application/json",
                metadata={
                    "parser": "srt" if asset.has_srt_timecodes else "plain_text",
                    "text_label": asset.text_label,
                    "language": asset.language_label,
                },
            )
        )

    steps = [
        PreprocessingStep(label="ffprobe / metadata", status=PreprocessingStepStatus.completed, message="Metadatos registrados."),
        PreprocessingStep(label="normalizacion", status=PreprocessingStepStatus.completed, message="Derivado normalizado preparado."),
        PreprocessingStep(label="audio", status=PreprocessingStepStatus.completed if asset.kind != AssetKind.text else PreprocessingStepStatus.skipped, message="Audio extraido o normalizado cuando aplica."),
        PreprocessingStep(label="transcript", status=PreprocessingStepStatus.completed, message="Transcript listo para alineacion temporal."),
        PreprocessingStep(label="storage", status=PreprocessingStepStatus.completed, message="Derivados escritos en storage interno."),
    ]

    return PreprocessingJobRead(
        id=job_id,
        organization_id=asset.organization_id,
        experiment_id=asset.experiment_id,
        asset_id=asset.asset_id,
        file_name=asset.file_name,
        status=PreprocessingStatus.completed,
        progress=100,
        steps=steps,
        logs=[
            f"accepted asset {asset.file_name}",
            "created preprocessing workspace",
            "generated normalized derivatives",
            "registered metadata and transcript contract",
        ],
        derivatives=derivatives,
        completed_at=datetime.now(timezone.utc),
    )
