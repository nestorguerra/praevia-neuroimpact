from __future__ import annotations

from uuid import UUID

from app.schemas.projects import (
    ExperimentCreate,
    ExperimentRead,
    ProjectCreate,
    ProjectRead,
    WorkspaceCreate,
    WorkspaceRead,
)


class InMemoryProjectRepository:
    def __init__(self) -> None:
        self.workspaces: dict[UUID, WorkspaceRead] = {}
        self.projects: dict[UUID, ProjectRead] = {}
        self.experiments: dict[UUID, ExperimentRead] = {}

    def list_workspaces(self, organization_id: UUID, *_args) -> list[WorkspaceRead]:
        return [item for item in self.workspaces.values() if item.organization_id == organization_id]

    def create_workspace(self, payload: WorkspaceCreate, *_args) -> WorkspaceRead:
        workspace = WorkspaceRead(**payload.model_dump())
        self.workspaces[workspace.id] = workspace
        return workspace

    def list_projects(self, organization_id: UUID, *_args) -> list[ProjectRead]:
        return [item for item in self.projects.values() if item.organization_id == organization_id]

    def create_project(self, payload: ProjectCreate, *_args) -> ProjectRead:
        project = ProjectRead(**payload.model_dump())
        self.projects[project.id] = project
        return project

    def list_experiments(self, organization_id: UUID, *_args) -> list[ExperimentRead]:
        return [item for item in self.experiments.values() if item.organization_id == organization_id]

    def create_experiment(self, payload: ExperimentCreate, *_args) -> ExperimentRead:
        experiment = ExperimentRead(**payload.model_dump())
        self.experiments[experiment.id] = experiment
        return experiment

    def create_project_bundle(self, payload, *_args):
        workspace = self.create_workspace(payload.workspace) if payload.workspace else self.workspaces[payload.project.workspace_id]
        project = self.create_project(payload.project)
        experiment = self.create_experiment(payload.experiment.model_copy(update={"project_id": project.id}))
        from app.schemas.projects import ProjectBundleRead

        return ProjectBundleRead(workspace=workspace, project=project, experiment=experiment)


repository = InMemoryProjectRepository()
