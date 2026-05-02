from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class BenchmarkCreate(BaseModel):
    organization_id: UUID
    name: str = Field(min_length=3, max_length=180)
    category: str = Field(min_length=2, max_length=120)
    sector: str = Field(min_length=2, max_length=120)
    channel: str = Field(min_length=2, max_length=120)
    duration_label: str = Field(default="30s", max_length=40)
    language: str = Field(default="es", max_length=20)
    owner_name: str = Field(default="PraevIA", max_length=120)


class BenchmarkRead(BenchmarkCreate):
    id: UUID = Field(default_factory=uuid4)
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BenchmarkItemCreate(BaseModel):
    organization_id: UUID
    benchmark_id: UUID
    asset_name: str = Field(min_length=2, max_length=220)
    scoring_result_id: str = Field(default="", max_length=160)
    source_label: str = Field(default="manual", max_length=80)
    scores: dict[str, float] = Field(default_factory=dict)


class BenchmarkItemRead(BenchmarkItemCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExternalKpiCreate(BaseModel):
    organization_id: UUID
    benchmark_id: UUID
    benchmark_item_id: UUID
    kpi_type: str = Field(pattern="^(vtr|ctr|retention|brand_lift|survey|event_feedback)$")
    value: float
    unit: str = Field(default="%", max_length=20)
    source: str = Field(default="manual", max_length=120)
    period: str = Field(default="", max_length=80)
    notes: str = Field(default="", max_length=500)


class ExternalKpiRead(ExternalKpiCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BenchmarkSnapshotRead(BaseModel):
    organization_id: UUID
    benchmarks: list[BenchmarkRead]
    benchmark_items: list[BenchmarkItemRead]
    external_kpis: list[ExternalKpiRead]
