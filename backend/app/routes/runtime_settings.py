from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth import CurrentUser, require_auth
from app.repositories.runtime_settings_repository import runtime_settings_repository
from app.schemas.runtime_settings import RuntimeSettingsRead, RuntimeSettingsUpdate

router = APIRouter(tags=["runtime-settings"])


@router.get("/runtime-settings/{organization_id}", response_model=RuntimeSettingsRead | None)
def get_runtime_settings(
    organization_id: UUID,
    environment: str = "production",
    current_user: CurrentUser = Depends(require_auth),
) -> RuntimeSettingsRead | None:
    return runtime_settings_repository().get(organization_id, environment, current_user)


@router.put("/runtime-settings", response_model=RuntimeSettingsRead)
def upsert_runtime_settings(
    payload: RuntimeSettingsUpdate,
    current_user: CurrentUser = Depends(require_auth),
) -> RuntimeSettingsRead:
    return runtime_settings_repository().upsert(payload, current_user)

