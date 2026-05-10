from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


Environment = Literal["local", "staging", "production"]
ComputeProvider = Literal[
    "google_cloud_run_gpu",
    "runpod_serverless",
    "modal_gpu",
    "huggingface_endpoint",
    "colab_manual",
    "local_mock",
]
WorkerMode = Literal["mock", "remote_gpu", "manual_colab"]
ReasoningEffort = Literal["low", "medium", "high", "xhigh"]


class RuntimeSettingsUpdate(BaseModel):
    organization_id: UUID
    environment: Environment = "production"
    compute_provider: ComputeProvider = "google_cloud_run_gpu"
    worker_mode: WorkerMode = "remote_gpu"
    tribe_worker_endpoint_url: str | None = None
    tribe_model_id: str = "facebook/tribev2"
    tribe_max_asset_duration_seconds: int = Field(default=180, gt=0)
    monthly_gpu_cap_seconds: int = Field(default=7200, ge=0)
    monthly_cost_cap_eur: float = Field(default=350, ge=0)
    llm_provider: Literal["openai"] = "openai"
    llm_interpreter_model: str = "gpt-5.5"
    llm_writer_model: str = "gpt-5.5"
    llm_writer_reasoning_effort: ReasoningEffort = "high"
    llm_prompt_version: str = "report-master-v0.1"
    secret_refs: dict[str, str] = Field(default_factory=dict)
    configured_flags: dict[str, bool] = Field(default_factory=dict)


class RuntimeSettingsRead(RuntimeSettingsUpdate):
    id: UUID
    created_at: datetime
    updated_at: datetime
