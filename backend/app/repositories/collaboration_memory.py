from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.schemas.collaboration import (
    CollaborationCommentCreate,
    CollaborationCommentRead,
    CollaborationSnapshotRead,
    ShareLinkCreate,
    ShareLinkRead,
    SharedViewerRead,
    WorkflowHistoryEventRead,
    WorkflowRecommendationCreate,
    WorkflowRecommendationRead,
    WorkflowTaskCreate,
    WorkflowTaskRead,
)


class CollaborationMemoryRepository:
    def __init__(self) -> None:
        self.comments: dict[UUID, CollaborationCommentRead] = {}
        self.recommendations: dict[UUID, WorkflowRecommendationRead] = {}
        self.tasks: dict[UUID, WorkflowTaskRead] = {}
        self.share_links: dict[str, ShareLinkRead] = {}
        self.history: dict[UUID, WorkflowHistoryEventRead] = {}

    def _record(self, event: WorkflowHistoryEventRead) -> WorkflowHistoryEventRead:
        self.history[event.id] = event
        return event

    def create_recommendation(self, payload: WorkflowRecommendationCreate, *_args) -> WorkflowRecommendationRead:
        existing = next(
            (
                item
                for item in self.recommendations.values()
                if item.experiment_id == payload.experiment_id
                and item.source_type == payload.source_type
                and item.source_id == payload.source_id
            ),
            None,
        )
        if existing:
            return existing
        recommendation = WorkflowRecommendationRead(
            **payload.model_dump(exclude={"actor_name"}),
        )
        self.recommendations[recommendation.id] = recommendation
        self._record(
            WorkflowHistoryEventRead(
                organization_id=payload.organization_id,
                experiment_id=payload.experiment_id,
                actor_name=payload.actor_name,
                action="recommendation.created",
                entity_type="recommendation",
                entity_id=str(recommendation.id),
                description=f"Recomendacion creada para {payload.timecode}.",
                metadata={"source_type": payload.source_type, "impact": payload.impact},
            )
        )
        return recommendation

    def update_recommendation_status(self, recommendation_id: UUID, status: str, actor_name: str, *_args) -> WorkflowRecommendationRead | None:
        recommendation = self.recommendations.get(recommendation_id)
        if not recommendation:
            return None
        updated = recommendation.model_copy(update={"status": status, "updated_at": datetime.now(timezone.utc)})
        self.recommendations[recommendation_id] = updated
        self._record(
            WorkflowHistoryEventRead(
                organization_id=updated.organization_id,
                experiment_id=updated.experiment_id,
                actor_name=actor_name,
                action=f"recommendation.{status}",
                entity_type="recommendation",
                entity_id=str(recommendation_id),
                description=f"{actor_name} marco la recomendacion {updated.timecode} como {status}.",
                metadata={"status": status, "timecode": updated.timecode},
            )
        )
        return updated

    def create_comment(self, payload: CollaborationCommentCreate, *_args) -> CollaborationCommentRead:
        comment = CollaborationCommentRead(**payload.model_dump())
        self.comments[comment.id] = comment
        self._record(
            WorkflowHistoryEventRead(
                organization_id=payload.organization_id,
                experiment_id=payload.experiment_id,
                actor_name=payload.author_name,
                action="comment.created",
                entity_type="comment",
                entity_id=str(comment.id),
                description=f"{payload.author_name} comento {payload.timecode}.",
                metadata={"timecode": payload.timecode, "source_type": payload.source_type},
            )
        )
        return comment

    def create_task(self, payload: WorkflowTaskCreate, *_args) -> WorkflowTaskRead:
        task = WorkflowTaskRead(**payload.model_dump())
        self.tasks[task.id] = task
        self._record(
            WorkflowHistoryEventRead(
                organization_id=payload.organization_id,
                experiment_id=payload.experiment_id,
                actor_name=payload.assignee,
                action="task.created",
                entity_type="task",
                entity_id=str(task.id),
                description=f"Tarea creada para {payload.timecode}: {payload.title}",
                metadata={"timecode": payload.timecode, "layer": payload.layer},
            )
        )
        return task

    def update_task_status(self, task_id: UUID, status: str, actor_name: str, *_args) -> WorkflowTaskRead | None:
        task = self.tasks.get(task_id)
        if not task:
            return None
        updated = task.model_copy(update={"status": status, "updated_at": datetime.now(timezone.utc)})
        self.tasks[task_id] = updated
        self._record(
            WorkflowHistoryEventRead(
                organization_id=updated.organization_id,
                experiment_id=updated.experiment_id,
                actor_name=actor_name,
                action=f"task.{status}",
                entity_type="task",
                entity_id=str(task_id),
                description=f"{actor_name} marco la tarea como {status}.",
                metadata={"status": status, "timecode": updated.timecode},
            )
        )
        return updated

    def create_share_link(self, payload: ShareLinkCreate, *_args) -> ShareLinkRead:
        share = ShareLinkRead(
            **payload.model_dump(),
            expires_at=datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days),
        )
        self.share_links[share.token] = share
        self._record(
            WorkflowHistoryEventRead(
                organization_id=payload.organization_id,
                experiment_id=payload.experiment_id,
                actor_name=payload.created_by,
                action="share.created",
                entity_type="share_link",
                entity_id=share.token,
                description=f"Enlace externo creado para {payload.title}.",
                metadata={"expires_in_days": payload.expires_in_days},
            )
        )
        return share

    def snapshot(self, organization_id: UUID, experiment_id: UUID, *_args) -> CollaborationSnapshotRead:
        return CollaborationSnapshotRead(
            organization_id=organization_id,
            experiment_id=experiment_id,
            recommendations=[item for item in self.recommendations.values() if item.organization_id == organization_id and item.experiment_id == experiment_id],
            comments=[item for item in self.comments.values() if item.organization_id == organization_id and item.experiment_id == experiment_id],
            tasks=[item for item in self.tasks.values() if item.organization_id == organization_id and item.experiment_id == experiment_id],
            share_links=[item for item in self.share_links.values() if item.organization_id == organization_id and item.experiment_id == experiment_id],
            history=[item for item in self.history.values() if item.organization_id == organization_id and item.experiment_id == experiment_id],
        )

    def shared_viewer(self, token: str) -> SharedViewerRead | None:
        share = self.share_links.get(token)
        if not share or share.status != "active" or share.expires_at < datetime.now(timezone.utc):
            return None
        snapshot = self.snapshot(share.organization_id, share.experiment_id)
        return SharedViewerRead(
            share=share,
            recommendations=snapshot.recommendations,
            comments=snapshot.comments,
            tasks=snapshot.tasks,
            history=snapshot.history,
        )


collaboration_repository = CollaborationMemoryRepository()
