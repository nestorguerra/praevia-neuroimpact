from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class CollaborationCommentCreate(BaseModel):
    organization_id: UUID
    experiment_id: UUID
    source_type: str = Field(pattern="^(timeline|recommendation|report|comparison)$")
    source_id: str = Field(min_length=1, max_length=160)
    timecode: str = Field(min_length=1, max_length=40)
    body: str = Field(min_length=3, max_length=1000)
    author_name: str = Field(min_length=2, max_length=120)


class CollaborationCommentRead(CollaborationCommentCreate):
    id: UUID = Field(default_factory=uuid4)
    resolved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WorkflowTaskCreate(BaseModel):
    organization_id: UUID
    experiment_id: UUID
    source_recommendation_id: str = Field(default="", max_length=160)
    title: str = Field(min_length=3, max_length=220)
    timecode: str = Field(min_length=1, max_length=40)
    layer: str = Field(min_length=2, max_length=80)
    assignee: str = Field(min_length=2, max_length=120)
    confidence: str = Field(default="CONF 0.88", max_length=40)
    impact: str = Field(default="Medio", max_length=40)


class WorkflowTaskRead(WorkflowTaskCreate):
    id: UUID = Field(default_factory=uuid4)
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WorkflowTaskStatusUpdate(BaseModel):
    status: str = Field(pattern="^(draft|reviewed|approved|archived)$")
    actor_name: str = Field(min_length=2, max_length=120)


class WorkflowRecommendationCreate(BaseModel):
    organization_id: UUID
    experiment_id: UUID
    source_type: str = Field(pattern="^(timeline|recommendation|report|comparison)$")
    source_id: str = Field(min_length=1, max_length=160)
    timecode: str = Field(min_length=1, max_length=40)
    layer: str = Field(min_length=2, max_length=80)
    action: str = Field(min_length=3, max_length=1000)
    confidence: str = Field(default="CONF 0.88", max_length=40)
    impact: str = Field(default="Medio", pattern="^(Bajo|Medio|Alto)$")
    actor_name: str = Field(default="Sistema", max_length=120)


class WorkflowRecommendationRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    experiment_id: UUID
    source_type: str
    source_id: str
    timecode: str
    layer: str
    action: str
    confidence: str
    impact: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WorkflowRecommendationStatusUpdate(BaseModel):
    status: str = Field(pattern="^(draft|reviewed|approved|archived)$")
    actor_name: str = Field(min_length=2, max_length=120)


class ShareLinkCreate(BaseModel):
    organization_id: UUID
    experiment_id: UUID
    title: str = Field(min_length=3, max_length=180)
    viewer_role: str = Field(default="client_viewer", max_length=80)
    expires_in_days: int = Field(default=14, ge=1, le=90)
    created_by: str = Field(min_length=2, max_length=120)


class ShareLinkRead(ShareLinkCreate):
    id: UUID = Field(default_factory=uuid4)
    token: str = Field(default_factory=lambda: uuid4().hex)
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=14))


class WorkflowHistoryEventRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    experiment_id: UUID
    actor_name: str
    action: str
    entity_type: str
    entity_id: str
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, str | int | float | bool] = Field(default_factory=dict)


class CollaborationSnapshotRead(BaseModel):
    organization_id: UUID
    experiment_id: UUID
    recommendations: list[WorkflowRecommendationRead] = Field(default_factory=list)
    comments: list[CollaborationCommentRead]
    tasks: list[WorkflowTaskRead]
    share_links: list[ShareLinkRead]
    history: list[WorkflowHistoryEventRead]


class SharedViewerRead(BaseModel):
    share: ShareLinkRead
    recommendations: list[WorkflowRecommendationRead] = Field(default_factory=list)
    comments: list[CollaborationCommentRead]
    tasks: list[WorkflowTaskRead]
    history: list[WorkflowHistoryEventRead]
