from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth import CurrentUser, require_auth
from app.repositories.admin_repository import admin_repository
from app.schemas.admin import (
    AdminSnapshotRead,
    AdminMonthlyUsageExportRead,
    AuditLogCreate,
    AuditLogRead,
    BackupSnapshotCreate,
    BackupSnapshotRead,
    SecureDeleteCreate,
    SecureDeleteRead,
    UsageEventCreate,
    UsageEventRead,
)

router = APIRouter(tags=["admin"])


@router.post("/admin/usage-events", response_model=UsageEventRead)
def create_usage_event(payload: UsageEventCreate, current_user: CurrentUser = Depends(require_auth)) -> UsageEventRead:
    return admin_repository().create_usage_event(payload, current_user)


@router.post("/admin/audit-logs", response_model=AuditLogRead)
def create_audit_log(payload: AuditLogCreate, current_user: CurrentUser = Depends(require_auth)) -> AuditLogRead:
    return admin_repository().create_audit_log(payload, current_user)


@router.post("/admin/backup-snapshots", response_model=BackupSnapshotRead)
def create_backup_snapshot(payload: BackupSnapshotCreate, current_user: CurrentUser = Depends(require_auth)) -> BackupSnapshotRead:
    return admin_repository().create_backup_snapshot(payload, current_user)


@router.post("/admin/secure-delete", response_model=SecureDeleteRead)
def create_secure_delete(payload: SecureDeleteCreate, current_user: CurrentUser = Depends(require_auth)) -> SecureDeleteRead:
    return admin_repository().create_deletion(payload, current_user)


@router.get("/admin/organizations/{organization_id}/snapshot", response_model=AdminSnapshotRead)
def get_admin_snapshot(organization_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> AdminSnapshotRead:
    return admin_repository().snapshot(organization_id, current_user)


@router.post("/admin/organizations/{organization_id}/monthly-usage-exports/{month}", response_model=AdminMonthlyUsageExportRead)
def create_monthly_usage_export(
    organization_id: UUID,
    month: str,
    current_user: CurrentUser = Depends(require_auth),
) -> AdminMonthlyUsageExportRead:
    return admin_repository().create_monthly_usage_export(organization_id, month, current_user)
