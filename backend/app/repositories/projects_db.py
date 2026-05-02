from __future__ import annotations

from uuid import UUID

from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection
from app.schemas.projects import (
    ExperimentCreate,
    ExperimentRead,
    ProjectBundleCreate,
    ProjectBundleRead,
    ProjectCreate,
    ProjectRead,
    WorkspaceCreate,
    WorkspaceRead,
)


class ProjectDbRepository:
    def _assert_org_member(self, conn, organization_id: UUID, user: CurrentUser) -> None:
        assert_org_member(conn, organization_id, user)

    def list_workspaces(self, organization_id: UUID, user: CurrentUser) -> list[WorkspaceRead]:
        with connection() as conn:
            self._assert_org_member(conn, organization_id, user)
            rows = conn.execute(
                """
                select id, organization_id, name, client_name, description, created_at, updated_at
                from public.workspaces
                where organization_id = %s
                order by updated_at desc
                """,
                (organization_id,),
            ).fetchall()
            return [WorkspaceRead(**row) for row in rows]

    def create_workspace(self, payload: WorkspaceCreate, user: CurrentUser) -> WorkspaceRead:
        with connection() as conn:
            self._assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.workspaces (organization_id, name, client_name, description, created_by)
                values (%s, %s, %s, %s, %s)
                returning id, organization_id, name, client_name, description, created_at, updated_at
                """,
                (payload.organization_id, payload.name, payload.client_name, payload.description, user.id),
            ).fetchone()
            conn.commit()
            return WorkspaceRead(**row)

    def list_projects(self, organization_id: UUID, user: CurrentUser) -> list[ProjectRead]:
        with connection() as conn:
            self._assert_org_member(conn, organization_id, user)
            rows = conn.execute(
                """
                select id, organization_id, workspace_id, brand, campaign, objective, channel, audience,
                       language, expected_kpi, status, created_at, updated_at
                from public.projects
                where organization_id = %s
                order by updated_at desc
                """,
                (organization_id,),
            ).fetchall()
            return [ProjectRead(**row) for row in rows]

    def create_project(self, payload: ProjectCreate, user: CurrentUser) -> ProjectRead:
        with connection() as conn:
            self._assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.projects (
                  organization_id, workspace_id, brand, campaign, objective, channel, audience,
                  language, expected_kpi, status, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning id, organization_id, workspace_id, brand, campaign, objective, channel, audience,
                          language, expected_kpi, status, created_at, updated_at
                """,
                (
                    payload.organization_id,
                    payload.workspace_id,
                    payload.brand,
                    payload.campaign,
                    payload.objective,
                    payload.channel,
                    payload.audience,
                    payload.language,
                    payload.expected_kpi,
                    payload.status.value,
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return ProjectRead(**row)

    def list_experiments(self, organization_id: UUID, user: CurrentUser) -> list[ExperimentRead]:
        with connection() as conn:
            self._assert_org_member(conn, organization_id, user)
            rows = conn.execute(
                """
                select id, organization_id, workspace_id, project_id, type, name, template,
                       asset_slots, notes, created_at, updated_at
                from public.experiments
                where organization_id = %s
                order by updated_at desc
                """,
                (organization_id,),
            ).fetchall()
            return [ExperimentRead(**row) for row in rows]

    def create_experiment(self, payload: ExperimentCreate, user: CurrentUser) -> ExperimentRead:
        with connection() as conn:
            self._assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.experiments (
                  organization_id, workspace_id, project_id, type, name, template, asset_slots, notes, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning id, organization_id, workspace_id, project_id, type, name, template,
                          asset_slots, notes, created_at, updated_at
                """,
                (
                    payload.organization_id,
                    payload.workspace_id,
                    payload.project_id,
                    payload.type.value,
                    payload.name,
                    payload.template,
                    payload.asset_slots,
                    payload.notes,
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return ExperimentRead(**row)

    def create_project_bundle(self, payload: ProjectBundleCreate, user: CurrentUser) -> ProjectBundleRead:
        if payload.workspace:
            workspace = self.create_workspace(payload.workspace, user)
        else:
            with connection() as conn:
                self._assert_org_member(conn, payload.project.organization_id, user)
                row = conn.execute(
                    """
                    select id, organization_id, name, client_name, description, created_at, updated_at
                    from public.workspaces
                    where id = %s and organization_id = %s
                    """,
                    (payload.project.workspace_id, payload.project.organization_id),
                ).fetchone()
                if not row:
                    from fastapi import HTTPException

                    raise HTTPException(status_code=404, detail="Workspace not found.")
                workspace = WorkspaceRead(**row)

        project = self.create_project(payload.project, user)
        experiment = self.create_experiment(payload.experiment.model_copy(update={"project_id": project.id}), user)
        return ProjectBundleRead(workspace=workspace, project=project, experiment=experiment)


db_repository = ProjectDbRepository()
