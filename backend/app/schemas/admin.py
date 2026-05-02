from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


UsageEventType = Literal[
    "asset_upload",
    "preprocessing",
    "tribe_run",
    "scoring",
    "report_generation",
    "comparison_generation",
    "secure_delete",
    "storage_retention",
    "manual_adjustment",
]


class UsageEventCreate(BaseModel):
    organization_id: UUID
    event_type: UsageEventType
    source_id: UUID | None = None
    experiment_id: UUID | None = None
    asset_id: UUID | None = None
    analysis_run_id: UUID | None = None
    report_id: UUID | None = None
    comparison_id: UUID | None = None
    credits_delta: float = 0
    estimated_cost_eur: float = 0
    gpu_seconds: float = 0
    input_tokens: int = 0
    output_tokens: int = 0
    storage_bytes_delta: int = 0
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class UsageEventRead(UsageEventCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuditLogCreate(BaseModel):
    organization_id: UUID
    action: str
    entity_type: str
    entity_id: UUID | None = None
    severity: Literal["info", "warning", "error", "critical"] = "info"
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class AuditLogRead(AuditLogCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ErrorEventRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID | None = None
    source: str
    severity: Literal["info", "warning", "error", "critical"] = "error"
    message: str
    entity_type: str | None = None
    entity_id: UUID | None = None
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    resolved_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BackupSnapshotCreate(BaseModel):
    organization_id: UUID
    environment: str = "production"
    snapshot_type: Literal["db", "storage_manifest", "report_manifest"] = "db"
    storage_bucket: str | None = None
    storage_key: str
    byte_size: int | None = None
    checksum: str | None = None


class BackupSnapshotRead(BackupSnapshotCreate):
    id: UUID = Field(default_factory=uuid4)
    status: str = "completed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SecureDeleteCreate(BaseModel):
    organization_id: UUID
    asset_id: UUID
    asset_name: str
    storage_keys: list[str] = Field(default_factory=list)
    scope: dict[str, int | str | bool | None] = Field(default_factory=dict)


class SecureDeleteRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    asset_id: UUID
    asset_name: str
    status: Literal["completed", "failed"] = "completed"
    storage_keys: list[str]
    removed_counts: dict[str, int] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdminLimitsRead(BaseModel):
    monthly_credit_limit: float
    hard_credit_limit: float
    monthly_cost_limit_eur: float
    monthly_gpu_seconds_limit: float
    storage_byte_limit: int
    run_rate_limit_per_hour: int
    report_rate_limit_per_hour: int
    retention_days: int
    can_analyze: bool
    block_reasons: list[str] = Field(default_factory=list)


class AdminMonthlyUsageExportRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    month: str
    invoice_mode: Literal["manual_beta"] = "manual_beta"
    credits_used: float = 0
    estimated_cost_eur: float = 0
    gpu_seconds: float = 0
    input_tokens: int = 0
    output_tokens: int = 0
    storage_bytes: int = 0
    runs: int = 0
    reports: int = 0
    comparisons: int = 0
    usage_event_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdminSnapshotRead(BaseModel):
    organization_id: UUID
    credits_allocated: float
    credits_used: float
    credits_remaining: float
    estimated_cost_eur: float
    gpu_seconds: float
    input_tokens: int
    output_tokens: int
    storage_bytes: int
    storage_cost_eur: float
    total_cost_eur: float
    limits: AdminLimitsRead
    monthly_exports: list[AdminMonthlyUsageExportRead] = Field(default_factory=list)
    usage_events: list[UsageEventRead]
    audit_logs: list[AuditLogRead]
    error_events: list[ErrorEventRead] = Field(default_factory=list)
    backup_snapshots: list[BackupSnapshotRead] = Field(default_factory=list)
    deletions: list[SecureDeleteRead]
