from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth import CurrentUser, require_auth
from app.repositories.projects_repository import project_repository
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

router = APIRouter(tags=["workspaces-projects-experiments"])


@router.get("/organizations/{organization_id}/workspaces", response_model=list[WorkspaceRead])
def list_workspaces(organization_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[WorkspaceRead]:
    return project_repository().list_workspaces(organization_id, current_user)


@router.post("/workspaces", response_model=WorkspaceRead)
def create_workspace(payload: WorkspaceCreate, current_user: CurrentUser = Depends(require_auth)) -> WorkspaceRead:
    return project_repository().create_workspace(payload, current_user)


@router.get("/organizations/{organization_id}/projects", response_model=list[ProjectRead])
def list_projects(organization_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[ProjectRead]:
    return project_repository().list_projects(organization_id, current_user)


@router.post("/projects", response_model=ProjectRead)
def create_project(payload: ProjectCreate, current_user: CurrentUser = Depends(require_auth)) -> ProjectRead:
    return project_repository().create_project(payload, current_user)


@router.get("/organizations/{organization_id}/experiments", response_model=list[ExperimentRead])
def list_experiments(organization_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[ExperimentRead]:
    return project_repository().list_experiments(organization_id, current_user)


@router.post("/experiments", response_model=ExperimentRead)
def create_experiment(payload: ExperimentCreate, current_user: CurrentUser = Depends(require_auth)) -> ExperimentRead:
    return project_repository().create_experiment(payload, current_user)


@router.post("/project-bundles", response_model=ProjectBundleRead)
def create_project_bundle(payload: ProjectBundleCreate, current_user: CurrentUser = Depends(require_auth)) -> ProjectBundleRead:
    return project_repository().create_project_bundle(payload, current_user)
