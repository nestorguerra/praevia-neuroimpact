from __future__ import annotations

from uuid import UUID

from app.schemas.admin import (
    AdminLimitsRead,
    AdminMonthlyUsageExportRead,
    AdminSnapshotRead,
    AuditLogCreate,
    AuditLogRead,
    BackupSnapshotCreate,
    BackupSnapshotRead,
    SecureDeleteCreate,
    SecureDeleteRead,
    UsageEventCreate,
    UsageEventRead,
)


class AdminMemoryRepository:
    def __init__(self) -> None:
        self.usage_events: dict[UUID, UsageEventRead] = {}
        self.audit_logs: dict[UUID, AuditLogRead] = {}
        self.deletions: dict[UUID, SecureDeleteRead] = {}
        self.backups: dict[UUID, BackupSnapshotRead] = {}
        self.exports: dict[str, AdminMonthlyUsageExportRead] = {}

    def create_usage_event(self, payload: UsageEventCreate, *_args) -> UsageEventRead:
        event = UsageEventRead(**payload.model_dump())
        self.usage_events[event.id] = event
        return event

    def create_audit_log(self, payload: AuditLogCreate, *_args) -> AuditLogRead:
        log = AuditLogRead(**payload.model_dump())
        self.audit_logs[log.id] = log
        return log

    def create_backup_snapshot(self, payload: BackupSnapshotCreate, *_args) -> BackupSnapshotRead:
        backup = BackupSnapshotRead(**payload.model_dump())
        self.backups[backup.id] = backup
        return backup

    def create_monthly_usage_export(self, organization_id: UUID, month: str, *_args) -> AdminMonthlyUsageExportRead:
        snapshot = self.snapshot(organization_id)
        export = AdminMonthlyUsageExportRead(
            organization_id=organization_id,
            month=month,
            credits_used=snapshot.credits_used,
            estimated_cost_eur=snapshot.total_cost_eur,
            gpu_seconds=snapshot.gpu_seconds,
            input_tokens=snapshot.input_tokens,
            output_tokens=snapshot.output_tokens,
            storage_bytes=snapshot.storage_bytes,
            usage_event_count=len(snapshot.usage_events),
        )
        self.exports[f"{organization_id}:{month}"] = export
        return export

    def create_deletion(self, payload: SecureDeleteCreate, *_args) -> SecureDeleteRead:
        deletion = SecureDeleteRead(
            organization_id=payload.organization_id,
            asset_id=payload.asset_id,
            asset_name=payload.asset_name,
            storage_keys=payload.storage_keys,
            removed_counts={
                key: int(value)
                for key, value in payload.scope.items()
                if isinstance(value, int)
            },
        )
        self.deletions[deletion.id] = deletion
        self.create_audit_log(
            AuditLogCreate(
                organization_id=payload.organization_id,
                action="secure_delete.completed",
                entity_type="asset",
                entity_id=payload.asset_id,
                severity="warning",
                metadata={"asset_name": payload.asset_name, "storage_keys": len(payload.storage_keys)},
            )
        )
        self.create_usage_event(
            UsageEventCreate(
                organization_id=payload.organization_id,
                event_type="secure_delete",
                asset_id=payload.asset_id,
                storage_bytes_delta=-sum(len(key) for key in payload.storage_keys),
                metadata={"asset_name": payload.asset_name, "storage_keys": len(payload.storage_keys)},
            )
        )
        return deletion

    def snapshot(self, organization_id: UUID, *_args) -> AdminSnapshotRead:
        usage_events = [
            event for event in self.usage_events.values()
            if event.organization_id == organization_id
        ]
        audit_logs = [
            log for log in self.audit_logs.values()
            if log.organization_id == organization_id
        ]
        deletions = [
            deletion for deletion in self.deletions.values()
            if deletion.organization_id == organization_id
        ]
        credits_used = sum(event.credits_delta for event in usage_events)
        estimated_cost = sum(event.estimated_cost_eur for event in usage_events)
        gpu_seconds = sum(event.gpu_seconds for event in usage_events)
        input_tokens = sum(event.input_tokens for event in usage_events)
        output_tokens = sum(event.output_tokens for event in usage_events)
        storage_bytes = max(0, sum(event.storage_bytes_delta for event in usage_events))
        limits = AdminLimitsRead(
            monthly_credit_limit=50,
            hard_credit_limit=60,
            monthly_cost_limit_eur=50,
            monthly_gpu_seconds_limit=600,
            storage_byte_limit=107374182400,
            run_rate_limit_per_hour=20,
            report_rate_limit_per_hour=30,
            retention_days=30,
            can_analyze=credits_used < 60,
            block_reasons=["hard_credit_limit"] if credits_used >= 60 else [],
        )
        return AdminSnapshotRead(
            organization_id=organization_id,
            credits_allocated=limits.monthly_credit_limit,
            credits_used=credits_used,
            credits_remaining=max(0, limits.monthly_credit_limit - credits_used),
            estimated_cost_eur=estimated_cost,
            gpu_seconds=gpu_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            storage_bytes=storage_bytes,
            storage_cost_eur=0,
            total_cost_eur=estimated_cost,
            limits=limits,
            monthly_exports=[
                export for export in self.exports.values()
                if export.organization_id == organization_id
            ],
            usage_events=usage_events,
            audit_logs=audit_logs,
            error_events=[],
            backup_snapshots=[
                backup for backup in self.backups.values()
                if backup.organization_id == organization_id
            ],
            deletions=deletions,
        )


admin_repository = AdminMemoryRepository()
