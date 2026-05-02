from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_auth
from app.repositories.enterprise_repository import enterprise_repository
from app.schemas.enterprise import (
    ApiKeyCreate,
    ApiKeyRead,
    BillingExportCreate,
    BillingExportRead,
    EnterpriseSnapshotRead,
    RetentionPolicyRead,
    RetentionPolicyUpdate,
)

router = APIRouter(tags=["enterprise"])


@router.get("/enterprise/{organization_id}/snapshot", response_model=EnterpriseSnapshotRead)
def get_enterprise_snapshot(organization_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> EnterpriseSnapshotRead:
    return enterprise_repository().snapshot(organization_id, current_user)


@router.post("/enterprise/api-keys", response_model=ApiKeyRead)
def create_api_key(payload: ApiKeyCreate, current_user: CurrentUser = Depends(require_auth)) -> ApiKeyRead:
    return enterprise_repository().create_api_key(payload, current_user)


@router.post("/enterprise/api-keys/{key_id}/rotate", response_model=ApiKeyRead)
def rotate_api_key(key_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> ApiKeyRead:
    key = enterprise_repository().rotate_api_key(key_id, current_user)
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    return key


@router.post("/enterprise/api-keys/{key_id}/revoke", response_model=ApiKeyRead)
def revoke_api_key(key_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> ApiKeyRead:
    key = enterprise_repository().revoke_api_key(key_id, current_user)
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    return key


@router.put("/enterprise/retention-policy", response_model=RetentionPolicyRead)
def update_retention_policy(payload: RetentionPolicyUpdate, current_user: CurrentUser = Depends(require_auth)) -> RetentionPolicyRead:
    return enterprise_repository().upsert_retention(payload, current_user)


@router.post("/enterprise/billing-exports", response_model=BillingExportRead)
def create_billing_export(payload: BillingExportCreate, current_user: CurrentUser = Depends(require_auth)) -> BillingExportRead:
    return enterprise_repository().create_billing_export(payload, current_user)
