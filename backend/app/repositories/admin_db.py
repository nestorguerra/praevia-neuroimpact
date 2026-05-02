from __future__ import annotations

import re
from uuid import UUID

from fastapi import HTTPException

from app.auth import CurrentUser
from app.repositories.db import assert_org_admin, assert_org_member, connection, jsonb
from app.schemas.admin import (
    AdminLimitsRead,
    AdminMonthlyUsageExportRead,
    AdminSnapshotRead,
    AuditLogCreate,
    AuditLogRead,
    BackupSnapshotCreate,
    BackupSnapshotRead,
    ErrorEventRead,
    SecureDeleteCreate,
    SecureDeleteRead,
    UsageEventCreate,
    UsageEventRead,
)
from app.services.storage import storage_service
from app.settings import settings


def _unique(items: list[str]) -> list[str]:
    return sorted({item for item in items if item})


class AdminDbRepository:
    def create_usage_event(self, payload: UsageEventCreate, user: CurrentUser) -> UsageEventRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.usage_events (
                  organization_id, event_type, source_id, experiment_id, asset_id, analysis_run_id,
                  report_id, comparison_id, credits_delta, estimated_cost_eur, gpu_seconds,
                  input_tokens, output_tokens, storage_bytes_delta, metadata, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    payload.organization_id,
                    payload.event_type,
                    payload.source_id,
                    payload.experiment_id,
                    payload.asset_id,
                    payload.analysis_run_id,
                    payload.report_id,
                    payload.comparison_id,
                    payload.credits_delta,
                    payload.estimated_cost_eur,
                    payload.gpu_seconds,
                    payload.input_tokens,
                    payload.output_tokens,
                    payload.storage_bytes_delta,
                    jsonb(payload.metadata),
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return UsageEventRead(**row)

    def create_monthly_usage_export(self, organization_id: UUID, month: str, user: CurrentUser) -> AdminMonthlyUsageExportRead:
        if not re.match(r"^[0-9]{4}-[0-9]{2}$", month):
            raise HTTPException(status_code=400, detail="Month must use YYYY-MM format.")
        with connection() as conn:
            assert_org_admin(conn, organization_id, user)
            stats = self._usage_stats_for_month(conn, organization_id, month)
            row = conn.execute(
                """
                insert into public.monthly_usage_exports (
                  organization_id, month, credits_used, estimated_cost_eur, gpu_seconds,
                  input_tokens, output_tokens, storage_bytes, runs, reports, comparisons,
                  usage_event_count, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (organization_id, month)
                do update set
                  credits_used = excluded.credits_used,
                  estimated_cost_eur = excluded.estimated_cost_eur,
                  gpu_seconds = excluded.gpu_seconds,
                  input_tokens = excluded.input_tokens,
                  output_tokens = excluded.output_tokens,
                  storage_bytes = excluded.storage_bytes,
                  runs = excluded.runs,
                  reports = excluded.reports,
                  comparisons = excluded.comparisons,
                  usage_event_count = excluded.usage_event_count
                returning *
                """,
                (
                    organization_id,
                    month,
                    stats["credits_used"],
                    stats["total_cost_eur"],
                    stats["gpu_seconds"],
                    stats["input_tokens"],
                    stats["output_tokens"],
                    stats["storage_bytes"],
                    stats["runs"],
                    stats["reports"],
                    stats["comparisons"],
                    stats["usage_event_count"],
                    user.id,
                ),
            ).fetchone()
            conn.execute(
                """
                insert into public.audit_logs (
                  organization_id, actor_id, action, entity_type, entity_id, severity, metadata
                )
                values (%s, %s, 'billing_export.generated', 'monthly_usage_export', %s, 'info', %s)
                """,
                (
                    organization_id,
                    user.id,
                    row["id"],
                    jsonb({"month": month, "invoice_mode": "manual_beta", "message": "Export mensual generado para facturacion manual beta."}),
                ),
            )
            conn.commit()
            return AdminMonthlyUsageExportRead(**row)

    def create_audit_log(self, payload: AuditLogCreate, user: CurrentUser) -> AuditLogRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.audit_logs (
                  organization_id, actor_id, action, entity_type, entity_id, severity, metadata
                )
                values (%s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    payload.organization_id,
                    user.id,
                    payload.action,
                    payload.entity_type,
                    payload.entity_id,
                    payload.severity,
                    jsonb(payload.metadata),
                ),
            ).fetchone()
            conn.commit()
            return AuditLogRead(
                id=row["id"],
                organization_id=row["organization_id"],
                action=row["action"],
                entity_type=row["entity_type"],
                entity_id=row["entity_id"],
                severity=row["severity"],
                metadata=row["metadata"] or {},
                created_at=row["created_at"],
            )

    def create_backup_snapshot(self, payload: BackupSnapshotCreate, user: CurrentUser) -> BackupSnapshotRead:
        with connection() as conn:
            assert_org_admin(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.backup_snapshots (
                  organization_id, environment, snapshot_type, storage_bucket, storage_key,
                  byte_size, checksum, status
                )
                values (%s, %s, %s, %s, %s, %s, %s, 'completed')
                returning *
                """,
                (
                    payload.organization_id,
                    payload.environment,
                    payload.snapshot_type,
                    payload.storage_bucket,
                    payload.storage_key,
                    payload.byte_size,
                    payload.checksum,
                ),
            ).fetchone()
            conn.execute(
                """
                insert into public.audit_logs (
                  organization_id, actor_id, action, entity_type, entity_id, severity, metadata
                )
                values (%s, %s, 'backup_snapshot.registered', 'backup_snapshot', %s, 'info', %s)
                """,
                (
                    payload.organization_id,
                    user.id,
                    row["id"],
                    jsonb({"environment": payload.environment, "snapshot_type": payload.snapshot_type, "storage_key": payload.storage_key}),
                ),
            )
            conn.commit()
            return BackupSnapshotRead(**row)

    def create_deletion(self, payload: SecureDeleteCreate, user: CurrentUser) -> SecureDeleteRead:
        with connection() as conn:
            assert_org_admin(conn, payload.organization_id, user)
            storage_keys = _unique([*payload.storage_keys, *self._storage_keys_for_asset(conn, payload.organization_id, payload.asset_id)])
            storage_row = conn.execute(
                """
                select coalesce(sum(byte_size), 0) as byte_size
                from public.storage_objects
                where organization_id = %s and storage_key = any(%s) and status = 'active'
                """,
                (payload.organization_id, storage_keys),
            ).fetchone()
            deleted_bytes = int(storage_row["byte_size"] or 0)
            deletion = storage_service.delete_objects(bucket=storage_service.bucket, keys=storage_keys)
            deleted_keys = deletion.deleted if storage_service.is_configured else []
            status = "completed" if len(deletion.errors) == 0 else "failed"
            removed_counts = {
                key: int(value)
                for key, value in payload.scope.items()
                if isinstance(value, int)
            }
            removed_counts.update(
                {
                    "storage_keys_requested": len(deletion.requested),
                    "storage_keys_deleted": len(deleted_keys),
                    "storage_errors": len(deletion.errors),
                }
            )
            if deleted_keys:
                conn.execute(
                    """
                    update public.storage_objects
                    set status = 'deleted', deleted_at = now(), delete_error = null
                    where organization_id = %s and storage_key = any(%s)
                    """,
                    (payload.organization_id, deleted_keys),
                )
            if deletion.errors:
                failed_keys = [item["key"] for item in deletion.errors if item.get("key")]
                conn.execute(
                    """
                    update public.storage_objects
                    set status = 'delete_failed', delete_error = %s
                    where organization_id = %s and storage_key = any(%s)
                    """,
                    ("; ".join(item["message"] for item in deletion.errors[:3]), payload.organization_id, failed_keys),
                )
            if status == "completed":
                conn.execute(
                    """
                    update public.assets
                    set status = 'deleted', updated_at = now()
                    where id = %s and organization_id = %s
                    """,
                    (payload.asset_id, payload.organization_id),
                )
            row = conn.execute(
                """
                insert into public.secure_deletion_requests (
                  organization_id, requested_by, asset_id, status, scope, storage_keys,
                  removed_counts, error_message, completed_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, now())
                returning *
                """,
                (
                    payload.organization_id,
                    user.id,
                    payload.asset_id,
                    status,
                    jsonb({**payload.scope, "asset_name": payload.asset_name, "storage_delete_errors": deletion.errors}),
                    jsonb(storage_keys),
                    jsonb(removed_counts),
                    "; ".join(item["message"] for item in deletion.errors[:3]) if deletion.errors else None,
                ),
            ).fetchone()
            conn.execute(
                """
                insert into public.usage_events (
                  organization_id, event_type, source_table, source_id, asset_id,
                  credits_delta, estimated_cost_eur, storage_bytes_delta, metadata, created_by
                )
                values (%s, 'secure_delete', 'secure_deletion_requests', %s, %s, 0, %s, %s, %s, %s)
                """,
                (
                    payload.organization_id,
                    row["id"],
                    payload.asset_id,
                    settings.platform_event_eur,
                    -deleted_bytes,
                    jsonb(
                        {
                            "label": f"Borrado seguro {payload.asset_name}",
                            "status": status,
                            "storage_keys_requested": len(deletion.requested),
                            "storage_keys_deleted": len(deleted_keys),
                            "storage_errors": len(deletion.errors),
                        }
                    ),
                    user.id,
                ),
            )
            conn.commit()
            return SecureDeleteRead(
                id=row["id"],
                organization_id=row["organization_id"],
                asset_id=row["asset_id"],
                asset_name=payload.asset_name,
                status=row["status"],
                storage_keys=row["storage_keys"] or [],
                removed_counts=row["removed_counts"] or {},
                created_at=row["requested_at"],
            )

    def _storage_keys_for_asset(self, conn, organization_id: UUID, asset_id: UUID) -> list[str]:
        keys: list[str] = []
        keys.extend(
            row["storage_key"]
            for row in conn.execute(
                """
                select av.storage_key
                from public.asset_versions av
                join public.assets a on a.id = av.asset_id
                where a.organization_id = %s and a.id = %s
                """,
                (organization_id, asset_id),
            ).fetchall()
        )
        keys.extend(
            row["storage_key"]
            for row in conn.execute(
                """
                select storage_key
                from public.asset_derivatives
                where organization_id = %s and asset_id = %s
                """,
                (organization_id, asset_id),
            ).fetchall()
        )
        keys.extend(
            row["storage_key"]
            for row in conn.execute(
                """
                select storage_key
                from public.prediction_artifacts
                where organization_id = %s and asset_id = %s
                """,
                (organization_id, asset_id),
            ).fetchall()
        )
        report_rows = conn.execute(
            """
            select html_storage_key, pdf_storage_key
            from public.reports
            where organization_id = %s and asset_id = %s
            """,
            (organization_id, asset_id),
        ).fetchall()
        for row in report_rows:
            if row["html_storage_key"]:
                keys.append(row["html_storage_key"])
            if row["pdf_storage_key"]:
                keys.append(row["pdf_storage_key"])
        keys.extend(
            row["storage_key"]
            for row in conn.execute(
                """
                select storage_key
                from public.storage_objects
                where organization_id = %s and asset_id = %s and status = 'active'
                """,
                (organization_id, asset_id),
            ).fetchall()
        )
        return _unique(keys)

    def snapshot(self, organization_id: UUID, user: CurrentUser) -> AdminSnapshotRead:
        with connection() as conn:
            assert_org_member(conn, organization_id, user)
            limits = self._limits(conn, organization_id)
            monthly_stats = self._usage_stats_for_current_month(conn, organization_id)
            self._maybe_record_cost_alert(conn, organization_id, limits, monthly_stats)
            usage_rows = conn.execute(
                "select * from public.usage_events where organization_id = %s order by created_at desc",
                (organization_id,),
            ).fetchall()
            audit_rows = conn.execute(
                "select * from public.audit_logs where organization_id = %s order by created_at desc",
                (organization_id,),
            ).fetchall()
            deletion_rows = conn.execute(
                "select * from public.secure_deletion_requests where organization_id = %s order by requested_at desc",
                (organization_id,),
            ).fetchall()
            error_rows = conn.execute(
                """
                select *
                from public.error_events
                where organization_id = %s
                order by created_at desc
                limit 100
                """,
                (organization_id,),
            ).fetchall()
            backup_rows = conn.execute(
                """
                select *
                from public.backup_snapshots
                where organization_id = %s
                order by created_at desc
                limit 50
                """,
                (organization_id,),
            ).fetchall()
            export_rows = conn.execute(
                "select * from public.monthly_usage_exports where organization_id = %s order by month desc",
                (organization_id,),
            ).fetchall()
            usage_events = [UsageEventRead(**row) for row in usage_rows]
            audit_logs = [
                AuditLogRead(
                    id=row["id"],
                    organization_id=row["organization_id"],
                    action=row["action"],
                    entity_type=row["entity_type"],
                    entity_id=row["entity_id"],
                    severity=row["severity"],
                    metadata=row["metadata"] or {},
                    created_at=row["created_at"],
                )
                for row in audit_rows
            ]
            deletions = [
                SecureDeleteRead(
                    id=row["id"],
                    organization_id=row["organization_id"],
                    asset_id=row["asset_id"],
                    asset_name=(row["scope"] or {}).get("asset_name", "Asset"),
                    status="completed" if row["status"] == "completed" else "failed",
                    storage_keys=row["storage_keys"] or [],
                    removed_counts=row["removed_counts"] or {},
                    created_at=row["requested_at"],
                )
                for row in deletion_rows
            ]
            block_reasons = self._block_reasons(limits, monthly_stats)
            admin_limits = AdminLimitsRead(
                monthly_credit_limit=limits["monthly_credit_limit"],
                hard_credit_limit=limits["hard_credit_limit"],
                monthly_cost_limit_eur=limits["monthly_cost_limit_eur"],
                monthly_gpu_seconds_limit=limits["monthly_gpu_seconds_limit"],
                storage_byte_limit=int(limits["storage_byte_limit"]),
                run_rate_limit_per_hour=int(limits["run_rate_limit_per_hour"]),
                report_rate_limit_per_hour=int(limits["report_rate_limit_per_hour"]),
                retention_days=int(limits["retention_days"]),
                can_analyze=not block_reasons,
                block_reasons=block_reasons,
            )
            return AdminSnapshotRead(
                organization_id=organization_id,
                credits_allocated=limits["monthly_credit_limit"],
                credits_used=monthly_stats["credits_used"],
                credits_remaining=max(0, limits["monthly_credit_limit"] - monthly_stats["credits_used"]),
                estimated_cost_eur=monthly_stats["estimated_cost_eur"],
                gpu_seconds=monthly_stats["gpu_seconds"],
                input_tokens=monthly_stats["input_tokens"],
                output_tokens=monthly_stats["output_tokens"],
                storage_bytes=monthly_stats["storage_bytes"],
                storage_cost_eur=monthly_stats["storage_cost_eur"],
                total_cost_eur=monthly_stats["total_cost_eur"],
                limits=admin_limits,
                monthly_exports=[AdminMonthlyUsageExportRead(**row) for row in export_rows],
                usage_events=usage_events,
                audit_logs=audit_logs,
                error_events=[
                    ErrorEventRead(
                        id=row["id"],
                        organization_id=row["organization_id"],
                        source=row["source"],
                        severity=row["severity"],
                        message=row["message"],
                        entity_type=row["entity_type"],
                        entity_id=row["entity_id"],
                        metadata=row["metadata"] or {},
                        resolved_at=row["resolved_at"],
                        created_at=row["created_at"],
                    )
                    for row in error_rows
                ],
                backup_snapshots=[BackupSnapshotRead(**row) for row in backup_rows],
                deletions=deletions,
            )

    def _limits(self, conn, organization_id: UUID) -> dict[str, float | int]:
        row = conn.execute(
            """
            select
              o.credits,
              coalesce(ol.monthly_credit_limit, o.credits) as monthly_credit_limit,
              coalesce(ol.hard_credit_limit, greatest(o.credits, ceil(o.credits * 1.2))) as hard_credit_limit,
              coalesce(ol.monthly_cost_limit_eur, %s) as monthly_cost_limit_eur,
              coalesce(ol.monthly_gpu_seconds_limit, %s) as monthly_gpu_seconds_limit,
              coalesce(ol.storage_byte_limit, 107374182400) as storage_byte_limit,
              coalesce(ol.run_rate_limit_per_hour, 20) as run_rate_limit_per_hour,
              coalesce(ol.report_rate_limit_per_hour, 30) as report_rate_limit_per_hour,
              coalesce(ol.retention_days, %s) as retention_days
            from public.organizations o
            left join public.organization_limits ol on ol.organization_id = o.id
            where o.id = %s
            """,
            (settings.monthly_cost_cap_eur, settings.monthly_gpu_cap_seconds, settings.retention_days, organization_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Organization not found.")
        return {
            "monthly_credit_limit": float(row["monthly_credit_limit"] or 0),
            "hard_credit_limit": float(row["hard_credit_limit"] or 0),
            "monthly_cost_limit_eur": float(row["monthly_cost_limit_eur"] or 0),
            "monthly_gpu_seconds_limit": float(row["monthly_gpu_seconds_limit"] or 0),
            "storage_byte_limit": int(row["storage_byte_limit"] or 0),
            "run_rate_limit_per_hour": int(row["run_rate_limit_per_hour"] or 0),
            "report_rate_limit_per_hour": int(row["report_rate_limit_per_hour"] or 0),
            "retention_days": int(row["retention_days"] or settings.retention_days),
        }

    def _usage_stats_for_current_month(self, conn, organization_id: UUID) -> dict[str, float | int]:
        row = conn.execute(
            """
            select
              coalesce(sum(credits_delta), 0) as credits_used,
              coalesce(sum(estimated_cost_eur), 0) as estimated_cost_eur,
              coalesce(sum(gpu_seconds), 0) as gpu_seconds,
              coalesce(sum(input_tokens), 0) as input_tokens,
              coalesce(sum(output_tokens), 0) as output_tokens,
              count(*) as usage_event_count,
              count(*) filter (where event_type = 'tribe_run') as runs,
              count(*) filter (where event_type = 'report_generation') as reports,
              count(*) filter (where event_type = 'comparison_generation') as comparisons
            from public.usage_events
            where organization_id = %s
              and created_at >= date_trunc('month', now())
            """,
            (organization_id,),
        ).fetchone()
        return self._stats_from_row(conn, organization_id, row)

    def _usage_stats_for_month(self, conn, organization_id: UUID, month: str) -> dict[str, float | int]:
        row = conn.execute(
            """
            select
              coalesce(sum(credits_delta), 0) as credits_used,
              coalesce(sum(estimated_cost_eur), 0) as estimated_cost_eur,
              coalesce(sum(gpu_seconds), 0) as gpu_seconds,
              coalesce(sum(input_tokens), 0) as input_tokens,
              coalesce(sum(output_tokens), 0) as output_tokens,
              count(*) as usage_event_count,
              count(*) filter (where event_type = 'tribe_run') as runs,
              count(*) filter (where event_type = 'report_generation') as reports,
              count(*) filter (where event_type = 'comparison_generation') as comparisons
            from public.usage_events
            where organization_id = %s
              and created_at >= to_date(%s, 'YYYY-MM')
              and created_at < to_date(%s, 'YYYY-MM') + interval '1 month'
            """,
            (organization_id, month, month),
        ).fetchone()
        return self._stats_from_row(conn, organization_id, row)

    def _stats_from_row(self, conn, organization_id: UUID, row) -> dict[str, float | int]:
        storage_bytes = self._active_storage_bytes(conn, organization_id)
        storage_cost = round((storage_bytes / (1024 ** 3)) * settings.storage_eur_per_gb_month, 6)
        estimated_cost = float(row["estimated_cost_eur"] or 0)
        return {
            "credits_used": float(row["credits_used"] or 0),
            "estimated_cost_eur": estimated_cost,
            "gpu_seconds": float(row["gpu_seconds"] or 0),
            "input_tokens": int(row["input_tokens"] or 0),
            "output_tokens": int(row["output_tokens"] or 0),
            "storage_bytes": int(storage_bytes),
            "storage_cost_eur": storage_cost,
            "total_cost_eur": round(estimated_cost + storage_cost, 6),
            "usage_event_count": int(row["usage_event_count"] or 0),
            "runs": int(row["runs"] or 0),
            "reports": int(row["reports"] or 0),
            "comparisons": int(row["comparisons"] or 0),
        }

    def _active_storage_bytes(self, conn, organization_id: UUID) -> int:
        row = conn.execute(
            """
            select coalesce(sum(byte_size), 0) as storage_bytes
            from public.storage_objects
            where organization_id = %s and status = 'active'
            """,
            (organization_id,),
        ).fetchone()
        return int(row["storage_bytes"] or 0)

    def _block_reasons(self, limits: dict[str, float | int], stats: dict[str, float | int]) -> list[str]:
        reasons: list[str] = []
        if limits["hard_credit_limit"] and stats["credits_used"] >= limits["hard_credit_limit"]:
            reasons.append("hard_credit_limit")
        if limits["monthly_cost_limit_eur"] and stats["total_cost_eur"] >= limits["monthly_cost_limit_eur"]:
            reasons.append("monthly_cost_limit_eur")
        if limits["monthly_gpu_seconds_limit"] and stats["gpu_seconds"] >= limits["monthly_gpu_seconds_limit"]:
            reasons.append("monthly_gpu_seconds_limit")
        if limits["storage_byte_limit"] and stats["storage_bytes"] >= limits["storage_byte_limit"]:
            reasons.append("storage_byte_limit")
        return reasons

    def _maybe_record_cost_alert(
        self,
        conn,
        organization_id: UUID,
        limits: dict[str, float | int],
        stats: dict[str, float | int],
    ) -> None:
        configured_threshold = float(settings.cost_alert_threshold_eur or 0)
        monthly_limit = float(limits["monthly_cost_limit_eur"] or 0)
        threshold = configured_threshold if configured_threshold > 0 else monthly_limit * 0.8
        total_cost = float(stats["total_cost_eur"] or 0)
        if threshold <= 0 or total_cost < threshold:
            return
        month = conn.execute("select to_char(now(), 'YYYY-MM') as month").fetchone()["month"]
        fingerprint = f"cost-alert:{organization_id}:{month}:{threshold:.2f}"
        conn.execute(
            """
            insert into public.error_events (
              organization_id, source, severity, message, entity_type,
              fingerprint, metadata
            )
            select %s, 'cost', 'warning', %s, 'usage_events', %s, %s
            where not exists (
              select 1
              from public.error_events
              where organization_id = %s
                and source = 'cost'
                and fingerprint = %s
                and resolved_at is null
            )
            """,
            (
                organization_id,
                "Cost alert threshold reached.",
                fingerprint,
                jsonb({
                    "month": month,
                    "threshold_eur": round(threshold, 2),
                    "total_cost_eur": round(total_cost, 4),
                    "monthly_cost_limit_eur": monthly_limit,
                }),
                organization_id,
                fingerprint,
            ),
        )
        conn.commit()


admin_db_repository = AdminDbRepository()
