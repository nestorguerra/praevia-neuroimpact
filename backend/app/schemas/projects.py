from __future__ import annotations

from enum import Enum
from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ExperimentType(str, Enum):
    individual = "individual"
    ab = "ab"
    abc = "abc"
    script = "script"
    event = "event"
    training = "training"


class ProjectStatus(str, Enum):
    draft = "draft"
    ready = "ready"
    running = "running"
    report_ready = "report_ready"
    archived = "archived"


class WorkspaceCreate(BaseModel):
    organization_id: UUID
    name: str = Field(min_length=2)
    client_name: str = Field(min_length=2)
    description: str | None = None


class WorkspaceRead(WorkspaceCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectCreate(BaseModel):
    organization_id: UUID
    workspace_id: UUID
    brand: str
    campaign: str
    objective: str
    channel: str
    audience: str
    language: str = "Espanol"
    expected_kpi: str
    status: ProjectStatus = ProjectStatus.draft


class ProjectRead(ProjectCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExperimentCreate(BaseModel):
    organization_id: UUID
    workspace_id: UUID
    project_id: UUID
    type: ExperimentType
    name: str
    template: str
    asset_slots: int = Field(default=1, ge=1, le=3)
    notes: str | None = None


class ExperimentRead(ExperimentCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectBundleCreate(BaseModel):
    workspace: WorkspaceCreate | None = None
    project: ProjectCreate
    experiment: ExperimentCreate


class ProjectBundleRead(BaseModel):
    workspace: WorkspaceRead
    project: ProjectRead
    experiment: ExperimentRead
