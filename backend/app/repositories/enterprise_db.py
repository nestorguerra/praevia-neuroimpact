from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.auth import CurrentUser
from app.repositories.db import assert_org_admin, assert_org_member, connection, jsonb
from app.repositories.enterprise_memory import _plans, _procurement_checklist, _secret_preview, _sla
from app.schemas.enterprise import (
    ApiKeyCreate,
    ApiKeyRead,
    BillingExportCreate,
    BillingExportRead,
    EnterpriseSnapshotRead,
    RetentionPolicyRead,
    RetentionPolicyUpdate,
    SsoRoadmapRead,
)


def _key_from_row(row) -> ApiKeyRead:
    return ApiKeyRead(
        id=row["id"],
        organization_id=row["organization_id"],
        name=row["name"],
        prefix=row["key_prefix"],
        secret_preview=f"{row['key_prefix']}...stored",
        scopes=list(row["scopes"] or []),
        status=row["status"],
        created_at=row["created_at"],
        expires_at=row["expires_at"],
        rotated_at=row["rotated_at"],
    )


class EnterpriseDbRepository:
    def create_api_key(self, payload: ApiKeyCreate, user: CurrentUser) -> ApiKeyRead:
        with connection() as conn:
            assert_org_admin(conn, payload.organization_id, user)
            prefix, preview = _secret_preview(str(user.id) + datetime.now(timezone.utc).isoformat())
            row = conn.execute(
                """
                insert into public.organization_api_keys (
                  organization_id, name, key_prefix, scopes, expires_at, created_by
                )
                values (%s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    payload.organization_id,
                    payload.name,
                    prefix,
                    payload.scopes,
                    payload.expires_at or datetime.now(timezone.utc) + timedelta(days=90),
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            key = _key_from_row(row)
            return key.model_copy(update={"secret_preview": preview})

    def rotate_api_key(self, key_id: UUID, user: CurrentUser) -> ApiKeyRead | None:
        with connection() as conn:
            key = conn.execute("select * from public.organization_api_keys where id = %s", (key_id,)).fetchone()
            if not key:
                return None
            assert_org_admin(conn, key["organization_id"], user)
            prefix, preview = _secret_preview(str(key_id) + datetime.now(timezone.utc).isoformat())
            row = conn.execute(
                """
                update public.organization_api_keys
                set key_prefix = %s, rotated_at = now(), expires_at = %s, status = 'active'
                where id = %s
                returning *
                """,
                (prefix, datetime.now(timezone.utc) + timedelta(days=90), key_id),
            ).fetchone()
            conn.commit()
            return _key_from_row(row).model_copy(update={"secret_preview": preview})

    def revoke_api_key(self, key_id: UUID, user: CurrentUser) -> ApiKeyRead | None:
        with connection() as conn:
            key = conn.execute("select * from public.organization_api_keys where id = %s", (key_id,)).fetchone()
            if not key:
                return None
            assert_org_admin(conn, key["organization_id"], user)
            row = conn.execute(
                "update public.organization_api_keys set status = 'revoked' where id = %s returning *",
                (key_id,),
            ).fetchone()
            conn.commit()
            return _key_from_row(row)

    def upsert_retention(self, payload: RetentionPolicyUpdate, user: CurrentUser) -> RetentionPolicyRead:
        with connection() as conn:
            assert_org_admin(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.organization_retention_policies (
                  organization_id, asset_retention_days, report_retention_days, backup_retention_days,
                  secure_delete_sla_days, incident_response_hours, dpa_status, updated_by, updated_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, now())
                on conflict (organization_id)
                do update set
                  asset_retention_days = excluded.asset_retention_days,
                  report_retention_days = excluded.report_retention_days,
                  backup_retention_days = excluded.backup_retention_days,
                  secure_delete_sla_days = excluded.secure_delete_sla_days,
                  incident_response_hours = excluded.incident_response_hours,
                  dpa_status = excluded.dpa_status,
                  updated_by = excluded.updated_by,
                  updated_at = now()
                returning *
                """,
                (
                    payload.organization_id,
                    payload.asset_retention_days,
                    payload.report_retention_days,
                    payload.backup_retention_days,
                    payload.secure_delete_sla_days,
                    payload.incident_response_hours,
                    payload.dpa_status,
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return RetentionPolicyRead(
                organization_id=row["organization_id"],
                asset_retention_days=row["asset_retention_days"],
                report_retention_days=row["report_retention_days"],
                backup_retention_days=row["backup_retention_days"],
                secure_delete_sla_days=row["secure_delete_sla_days"],
                incident_response_hours=row["incident_response_hours"],
                dpa_status=row["dpa_status"],
                region=row["region"],
                updated_at=row["updated_at"],
            )

    def create_billing_export(self, payload: BillingExportCreate, user: CurrentUser) -> BillingExportRead:
        with connection() as conn:
            assert_org_admin(conn, payload.organization_id, user)
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
                    payload.organization_id,
                    payload.month,
                    payload.credits_used,
                    payload.estimated_cost_eur,
                    payload.gpu_seconds,
                    payload.input_tokens,
                    payload.output_tokens,
                    payload.storage_bytes,
                    payload.runs,
                    payload.reports,
                    payload.comparisons,
                    payload.usage_event_count,
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return BillingExportRead(**row)

    def snapshot(self, organization_id: UUID, user: CurrentUser) -> EnterpriseSnapshotRead:
        with connection() as conn:
            assert_org_member(conn, organization_id, user)
            keys = conn.execute(
                "select * from public.organization_api_keys where organization_id = %s order by created_at desc",
                (organization_id,),
            ).fetchall()
            retention = conn.execute(
                "select * from public.organization_retention_policies where organization_id = %s",
                (organization_id,),
            ).fetchone()
            sso = conn.execute(
                "select * from public.organization_sso_configs where organization_id = %s",
                (organization_id,),
            ).fetchone()
            exports = conn.execute(
                "select * from public.monthly_usage_exports where organization_id = %s order by month desc",
                (organization_id,),
            ).fetchall()
            return EnterpriseSnapshotRead(
                organization_id=organization_id,
                plans=_plans(),
                api_keys=[_key_from_row(row) for row in keys],
                retention_policy=RetentionPolicyRead(
                    organization_id=organization_id,
                    asset_retention_days=retention["asset_retention_days"] if retention else 30,
                    report_retention_days=retention["report_retention_days"] if retention else 90,
                    backup_retention_days=retention["backup_retention_days"] if retention else 30,
                    secure_delete_sla_days=retention["secure_delete_sla_days"] if retention else 7,
                    incident_response_hours=retention["incident_response_hours"] if retention else 24,
                    dpa_status=retention["dpa_status"] if retention else "draft_ready",
                    region=retention["region"] if retention else "EU",
                    updated_at=retention["updated_at"] if retention else datetime.now(timezone.utc),
                ),
                sso_roadmap=SsoRoadmapRead(
                    organization_id=organization_id,
                    status=sso["status"] if sso else "requirements_ready",
                    protocol=sso["protocol"] if sso else "SAML 2.0 / OIDC",
                    target_plan=sso["target_plan"] if sso else "Enterprise",
                    provider_examples=list(sso["provider_examples"]) if sso else ["Okta", "Microsoft Entra ID", "Google Workspace", "OneLogin"],
                    requirements=sso["requirements"] if sso else [
                        "Dominio corporativo verificado",
                        "Metadata XML o issuer/client id del proveedor",
                        "Atributos minimos: email, nombre, organizacion y rol",
                        "Ventana de QA con owner y viewer",
                    ],
                    updated_at=sso["updated_at"] if sso else datetime.now(timezone.utc),
                ),
                billing_exports=[BillingExportRead(**row) for row in exports],
                procurement_checklist=_procurement_checklist(),
                sla=_sla(),
            )


enterprise_db_repository = EnterpriseDbRepository()

