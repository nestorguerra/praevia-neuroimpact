from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_auth
from app.repositories.collaboration_repository import collaboration_repository
from app.schemas.collaboration import (
    CollaborationCommentCreate,
    CollaborationCommentRead,
    CollaborationSnapshotRead,
    ShareLinkCreate,
    ShareLinkRead,
    SharedViewerRead,
    WorkflowTaskCreate,
    WorkflowTaskRead,
    WorkflowRecommendationCreate,
    WorkflowRecommendationRead,
    WorkflowRecommendationStatusUpdate,
    WorkflowTaskStatusUpdate,
)

router = APIRouter(tags=["collaboration"])


@router.get("/collaboration/{organization_id}/{experiment_id}", response_model=CollaborationSnapshotRead)
def get_collaboration_snapshot(
    organization_id: UUID,
    experiment_id: UUID,
    current_user: CurrentUser = Depends(require_auth),
) -> CollaborationSnapshotRead:
    return collaboration_repository().snapshot(organization_id, experiment_id, current_user)


@router.post("/collaboration/comments", response_model=CollaborationCommentRead)
def create_comment(payload: CollaborationCommentCreate, current_user: CurrentUser = Depends(require_auth)) -> CollaborationCommentRead:
    return collaboration_repository().create_comment(payload, current_user)


@router.post("/collaboration/recommendations", response_model=WorkflowRecommendationRead)
def create_recommendation(payload: WorkflowRecommendationCreate, current_user: CurrentUser = Depends(require_auth)) -> WorkflowRecommendationRead:
    return collaboration_repository().create_recommendation(payload, current_user)


@router.patch("/collaboration/recommendations/{recommendation_id}/status", response_model=WorkflowRecommendationRead)
def update_recommendation_status(
    recommendation_id: UUID,
    payload: WorkflowRecommendationStatusUpdate,
    current_user: CurrentUser = Depends(require_auth),
) -> WorkflowRecommendationRead:
    recommendation = collaboration_repository().update_recommendation_status(
        recommendation_id,
        payload.status,
        payload.actor_name,
        current_user,
    )
    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found.")
    return recommendation


@router.post("/collaboration/tasks", response_model=WorkflowTaskRead)
def create_task(payload: WorkflowTaskCreate, current_user: CurrentUser = Depends(require_auth)) -> WorkflowTaskRead:
    return collaboration_repository().create_task(payload, current_user)


@router.patch("/collaboration/tasks/{task_id}/status", response_model=WorkflowTaskRead)
def update_task_status(task_id: UUID, payload: WorkflowTaskStatusUpdate, current_user: CurrentUser = Depends(require_auth)) -> WorkflowTaskRead:
    task = collaboration_repository().update_task_status(task_id, payload.status, payload.actor_name, current_user)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@router.post("/collaboration/share-links", response_model=ShareLinkRead)
def create_share_link(payload: ShareLinkCreate, current_user: CurrentUser = Depends(require_auth)) -> ShareLinkRead:
    return collaboration_repository().create_share_link(payload, current_user)


@router.get("/share/{token}", response_model=SharedViewerRead)
def get_shared_viewer(token: str) -> SharedViewerRead:
    viewer = collaboration_repository().shared_viewer(token)
    if not viewer:
        raise HTTPException(status_code=404, detail="Share link not found or expired.")
    return viewer
