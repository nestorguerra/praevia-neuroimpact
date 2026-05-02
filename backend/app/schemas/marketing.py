from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class DemoRequestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=180)
    company: str = Field(min_length=2, max_length=160)
    role: str = Field(default="", max_length=120)
    use_case: str = Field(min_length=4, max_length=260)
    asset_count: str = Field(default="", max_length=80)
    timeline: str = Field(default="", max_length=120)
    source: str = Field(default="landing", max_length=80)
    consent: bool = False
    metadata: dict[str, str | int | float | bool] = Field(default_factory=dict)


class DemoRequestRead(DemoRequestCreate):
    id: UUID = Field(default_factory=uuid4)
    status: str = "new"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DemoRequestListRead(BaseModel):
    items: list[DemoRequestRead]
