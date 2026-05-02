from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection, jsonb
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


class CollaborationDbRepository:
    def _record(self, conn, event: WorkflowHistoryEventRead) -> None:
        conn.execute(
            """
            insert into public.workflow_history_events (
              id, organization_id, experiment_id, actor_name, action, entity_type,
              entity_id, description, metadata, created_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                event.id,
                event.organization_id,
                event.experiment_id,
                event.actor_name,
                event.action,
                event.entity_type,
                event.entity_id,
                event.description,
                jsonb(event.metadata),
                event.created_at,
            ),
        )

    def create_recommendation(self, payload: WorkflowRecommendationCreate, user: CurrentUser) -> WorkflowRecommendationRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.workflow_recommendations (
                  organization_id, experiment_id, source_type, source_id, timecode,
                  layer, action, confidence, impact, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (experiment_id, source_type, source_id)
                do update set
                  timecode = excluded.timecode,
                  layer = excluded.layer,
                  action = excluded.action,
                  confidence = excluded.confidence,
                  impact = excluded.impact,
                  updated_at = now()
                returning *
                """,
                (
                    payload.organization_id,
                    payload.experiment_id,
                    payload.source_type,
                    payload.source_id,
                    payload.timecode,
                    payload.layer,
                    payload.action,
                    payload.confidence,
                    payload.impact,
                    user.id,
                ),
            ).fetchone()
            recommendation = WorkflowRecommendationRead(**row)
            self._record(
                conn,
                WorkflowHistoryEventRead(
                    organization_id=payload.organization_id,
                    experiment_id=payload.experiment_id,
                    actor_name=payload.actor_name,
                    action="recommendation.created",
                    entity_type="recommendation",
                    entity_id=str(recommendation.id),
                    description=f"Recomendacion creada para {payload.timecode}.",
                    metadata={"source_type": payload.source_type, "impact": payload.impact},
                ),
            )
            conn.commit()
            return recommendation

    def update_recommendation_status(self, recommendation_id: UUID, status: str, actor_name: str, user: CurrentUser) -> WorkflowRecommendationRead | None:
        with connection() as conn:
            row = conn.execute("select * from public.workflow_recommendations where id = %s", (recommendation_id,)).fetchone()
            if not row:
                return None
            assert_org_member(conn, row["organization_id"], user)
            updated = conn.execute(
                "update public.workflow_recommendations set status = %s, updated_at = now() where id = %s returning *",
                (status, recommendation_id),
            ).fetchone()
            recommendation = WorkflowRecommendationRead(**updated)
            self._record(
                conn,
                WorkflowHistoryEventRead(
                    organization_id=recommendation.organization_id,
                    experiment_id=recommendation.experiment_id,
                    actor_name=actor_name,
                    action=f"recommendation.{status}",
                    entity_type="recommendation",
                    entity_id=str(recommendation_id),
                    description=f"{actor_name} marco la recomendacion {recommendation.timecode} como {status}.",
                    metadata={"status": status, "timecode": recommendation.timecode},
                ),
            )
            conn.commit()
            return recommendation

    def create_comment(self, payload: CollaborationCommentCreate, user: CurrentUser) -> CollaborationCommentRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.workflow_comments (
                  organization_id, experiment_id, source_type, source_id, timecode, body, author_name, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    payload.organization_id,
                    payload.experiment_id,
                    payload.source_type,
                    payload.source_id,
                    payload.timecode,
                    payload.body,
                    payload.author_name,
                    user.id,
                ),
            ).fetchone()
            comment = CollaborationCommentRead(**row)
            self._record(
                conn,
                WorkflowHistoryEventRead(
                    organization_id=payload.organization_id,
                    experiment_id=payload.experiment_id,
                    actor_name=payload.author_name,
                    action="comment.created",
                    entity_type="comment",
                    entity_id=str(comment.id),
                    description=f"{payload.author_name} comento {payload.timecode}.",
                    metadata={"timecode": payload.timecode, "source_type": payload.source_type},
                ),
            )
            conn.commit()
            return comment

    def create_task(self, payload: WorkflowTaskCreate, user: CurrentUser) -> WorkflowTaskRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.workflow_tasks (
                  organization_id, experiment_id, source_recommendation_id, title,
                  timecode, layer, assignee, confidence, impact, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    payload.organization_id,
                    payload.experiment_id,
                    payload.source_recommendation_id,
                    payload.title,
                    payload.timecode,
                    payload.layer,
                    payload.assignee,
                    payload.confidence,
                    payload.impact,
                    user.id,
                ),
            ).fetchone()
            task = WorkflowTaskRead(**row)
            self._record(
                conn,
                WorkflowHistoryEventRead(
                    organization_id=payload.organization_id,
                    experiment_id=payload.experiment_id,
                    actor_name=payload.assignee,
                    action="task.created",
                    entity_type="task",
                    entity_id=str(task.id),
                    description=f"Tarea creada para {payload.timecode}: {payload.title}",
                    metadata={"timecode": payload.timecode, "layer": payload.layer},
                ),
            )
            conn.commit()
            return task

    def update_task_status(self, task_id: UUID, status: str, actor_name: str, user: CurrentUser) -> WorkflowTaskRead | None:
        with connection() as conn:
            row = conn.execute("select * from public.workflow_tasks where id = %s", (task_id,)).fetchone()
            if not row:
                return None
            assert_org_member(conn, row["organization_id"], user)
            updated = conn.execute(
                "update public.workflow_tasks set status = %s, updated_at = now() where id = %s returning *",
                (status, task_id),
            ).fetchone()
            task = WorkflowTaskRead(**updated)
            self._record(
                conn,
                WorkflowHistoryEventRead(
                    organization_id=task.organization_id,
                    experiment_id=task.experiment_id,
                    actor_name=actor_name,
                    action=f"task.{status}",
                    entity_type="task",
                    entity_id=str(task_id),
                    description=f"{actor_name} marco la tarea como {status}.",
                    metadata={"status": status, "timecode": task.timecode},
                ),
            )
            conn.commit()
            return task

    def create_share_link(self, payload: ShareLinkCreate, user: CurrentUser) -> ShareLinkRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
            share = ShareLinkRead(**payload.model_dump(), expires_at=expires_at)
            row = conn.execute(
                """
                insert into public.workflow_share_links (
                  id, organization_id, experiment_id, token, title, viewer_role,
                  created_by_name, created_by, expires_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    share.id,
                    payload.organization_id,
                    payload.experiment_id,
                    share.token,
                    payload.title,
                    payload.viewer_role,
                    payload.created_by,
                    user.id,
                    expires_at,
                ),
            ).fetchone()
            created = ShareLinkRead(
                id=row["id"],
                organization_id=row["organization_id"],
                experiment_id=row["experiment_id"],
                token=row["token"],
                title=row["title"],
                viewer_role=row["viewer_role"],
                created_by=row["created_by_name"],
                status=row["status"],
                created_at=row["created_at"],
                expires_at=row["expires_at"],
            )
            self._record(
                conn,
                WorkflowHistoryEventRead(
                    organization_id=payload.organization_id,
                    experiment_id=payload.experiment_id,
                    actor_name=payload.created_by,
                    action="share.created",
                    entity_type="share_link",
                    entity_id=created.token,
                    description=f"Enlace externo creado para {payload.title}.",
                    metadata={"expires_in_days": payload.expires_in_days},
                ),
            )
            conn.commit()
            return created

    def _snapshot_from_connection(self, conn, organization_id: UUID, experiment_id: UUID) -> CollaborationSnapshotRead:
        recommendations = conn.execute(
            "select * from public.workflow_recommendations where organization_id = %s and experiment_id = %s order by created_at asc",
            (organization_id, experiment_id),
        ).fetchall()
        comments = conn.execute(
            "select * from public.workflow_comments where organization_id = %s and experiment_id = %s order by created_at desc",
            (organization_id, experiment_id),
        ).fetchall()
        tasks = conn.execute(
            "select * from public.workflow_tasks where organization_id = %s and experiment_id = %s order by created_at desc",
            (organization_id, experiment_id),
        ).fetchall()
        share_links = conn.execute(
            "select * from public.workflow_share_links where organization_id = %s and experiment_id = %s order by created_at desc",
            (organization_id, experiment_id),
        ).fetchall()
        history = conn.execute(
            "select * from public.workflow_history_events where organization_id = %s and experiment_id = %s order by created_at desc",
            (organization_id, experiment_id),
        ).fetchall()
        return CollaborationSnapshotRead(
            organization_id=organization_id,
            experiment_id=experiment_id,
            recommendations=[WorkflowRecommendationRead(**row) for row in recommendations],
            comments=[CollaborationCommentRead(**row) for row in comments],
            tasks=[WorkflowTaskRead(**row) for row in tasks],
            share_links=[
                ShareLinkRead(
                    id=row["id"],
                    organization_id=row["organization_id"],
                    experiment_id=row["experiment_id"],
                    token=row["token"],
                    title=row["title"],
                    viewer_role=row["viewer_role"],
                    created_by=row["created_by_name"],
                    status=row["status"],
                    created_at=row["created_at"],
                    expires_at=row["expires_at"],
                )
                for row in share_links
            ],
            history=[WorkflowHistoryEventRead(**row) for row in history],
        )

    def snapshot(self, organization_id: UUID, experiment_id: UUID, user: CurrentUser) -> CollaborationSnapshotRead:
        with connection() as conn:
            assert_org_member(conn, organization_id, user)
            return self._snapshot_from_connection(conn, organization_id, experiment_id)

    def shared_viewer(self, token: str) -> SharedViewerRead | None:
        with connection() as conn:
            share_row = conn.execute(
                "select * from public.workflow_share_links where token = %s and status = 'active'",
                (token,),
            ).fetchone()
            if not share_row or share_row["expires_at"] < datetime.now(timezone.utc):
                return None
            snapshot = self._snapshot_from_connection(conn, share_row["organization_id"], share_row["experiment_id"])
            share = ShareLinkRead(
                id=share_row["id"],
                organization_id=share_row["organization_id"],
                experiment_id=share_row["experiment_id"],
                token=share_row["token"],
                title=share_row["title"],
                viewer_role=share_row["viewer_role"],
                created_by=share_row["created_by_name"],
                status=share_row["status"],
                created_at=share_row["created_at"],
                expires_at=share_row["expires_at"],
            )
            return SharedViewerRead(
                share=share,
                recommendations=snapshot.recommendations,
                comments=snapshot.comments,
                tasks=snapshot.tasks,
                history=snapshot.history,
            )


collaboration_db_repository = CollaborationDbRepository()
