from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.schemas.uploads import AssetKind


class AnalysisRunStatus(str, Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class PredictionArtifactType(str, Enum):
    bold_npz = "bold_npz"
    bold_npy = "bold_npy"
    segments_parquet = "segments_parquet"
    metrics_json = "metrics_json"


class AnalysisRunCreate(BaseModel):
    organization_id: UUID
    experiment_id: UUID
    asset_id: UUID = Field(default_factory=uuid4)
    preprocessing_job_id: UUID | None = None
    asset_name: str
    asset_kind: AssetKind
    model_id: str = "facebook/tribev2"
    derivative_keys: list[str] = Field(default_factory=list)


class PredictionArtifactRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    analysis_run_id: UUID
    asset_id: UUID
    artifact_type: PredictionArtifactType
    storage_bucket: str
    storage_key: str
    mime_type: str
    shape: dict[str, int | str | float | None] = Field(default_factory=dict)
    metadata: dict[str, int | str | float | bool | None] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TribeCallbackArtifact(BaseModel):
    artifact_type: PredictionArtifactType
    storage_bucket: str
    storage_key: str
    mime_type: str = "application/octet-stream"
    byte_size: int = 0
    sha256: str | None = None
    shape: dict[str, int | str | float | None] = Field(default_factory=dict)
    metadata: dict[str, int | str | float | bool | None] = Field(default_factory=dict)


class TribeCallbackPayload(BaseModel):
    run_id: UUID
    asset_id: UUID
    organization_id: UUID
    status: AnalysisRunStatus
    provider_job_id: str | None = None
    n_timesteps: int | None = None
    n_vertices: int | None = None
    gpu_seconds: float | None = None
    gpu_vram_mb: float | None = None
    duration_seconds: float | None = None
    error_message: str | None = None
    logs: list[str] = Field(default_factory=list)
    artifacts: list[TribeCallbackArtifact] = Field(default_factory=list)


class AnalysisRunRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    experiment_id: UUID
    asset_id: UUID
    preprocessing_job_id: UUID | None = None
    asset_name: str
    asset_kind: AssetKind
    status: AnalysisRunStatus
    progress: int = Field(ge=0, le=100)
    model_id: str
    model_revision: str | None = None
    worker_image: str = "praevia/tribe-worker:local"
    compute_provider: str = "local_mock"
    provider_job_id: str | None = None
    n_timesteps: int | None = None
    n_vertices: int | None = None
    gpu_seconds: float | None = None
    gpu_vram_mb: float | None = None
    duration_seconds: float | None = None
    logs: list[str] = Field(default_factory=list)
    artifacts: list[PredictionArtifactRead] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None


class AnalysisRunBatchRead(BaseModel):
    runs: list[AnalysisRunRead]


def build_mock_analysis_run(payload: AnalysisRunCreate, bucket: str = "neuroimpact-local") -> AnalysisRunRead:
    run_id = uuid4()
    base_key = f"predictions/org/{payload.organization_id}/experiment/{payload.experiment_id}/asset/{payload.asset_id}/run/{run_id}"
    n_timesteps = 12
    n_vertices = 20484
    artifacts = [
        PredictionArtifactRead(
            analysis_run_id=run_id,
            asset_id=payload.asset_id,
            artifact_type=PredictionArtifactType.bold_npz,
            storage_bucket=bucket,
            storage_key=f"{base_key}/bold_predictions.npz",
            mime_type="application/octet-stream",
            shape={"n_timesteps": n_timesteps, "n_vertices": n_vertices, "mesh": "fsaverage5"},
            metadata={"mode": "mock_contract", "dtype": "float32"},
        ),
        PredictionArtifactRead(
            analysis_run_id=run_id,
            asset_id=payload.asset_id,
            artifact_type=PredictionArtifactType.segments_parquet,
            storage_bucket=bucket,
            storage_key=f"{base_key}/segments.parquet",
            mime_type="application/vnd.apache.parquet",
            shape={"rows": n_timesteps},
            metadata={"source": "TRIBE segments"},
        ),
        PredictionArtifactRead(
            analysis_run_id=run_id,
            asset_id=payload.asset_id,
            artifact_type=PredictionArtifactType.metrics_json,
            storage_bucket=bucket,
            storage_key=f"{base_key}/run_metrics.json",
            mime_type="application/json",
            shape={},
            metadata={"gpu_seconds": 0.0, "gpu_vram_mb": 0.0, "local_mode": True},
        ),
    ]
    return AnalysisRunRead(
        id=run_id,
        organization_id=payload.organization_id,
        experiment_id=payload.experiment_id,
        asset_id=payload.asset_id,
        preprocessing_job_id=payload.preprocessing_job_id,
        asset_name=payload.asset_name,
        asset_kind=payload.asset_kind,
        status=AnalysisRunStatus.done,
        progress=100,
        model_id=payload.model_id,
        model_revision="main",
        compute_provider="local_mock",
        provider_job_id=None,
        n_timesteps=n_timesteps,
        n_vertices=n_vertices,
        gpu_seconds=0.0,
        gpu_vram_mb=0.0,
        duration_seconds=0.8,
        logs=[
            "analysis run accepted",
            f"model={payload.model_id}",
            "worker mode=mock_contract",
            "prediction artifact registered",
            "status=done",
        ],
        artifacts=artifacts,
        completed_at=datetime.now(timezone.utc),
    )
