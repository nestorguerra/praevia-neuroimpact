from __future__ import annotations

from uuid import UUID

from app.auth import CurrentUser
from app.repositories.db import assert_org_admin, assert_org_member, connection, jsonb
from app.schemas.runtime_settings import RuntimeSettingsRead, RuntimeSettingsUpdate


def _read(row) -> RuntimeSettingsRead:
    return RuntimeSettingsRead(
        id=row["id"],
        organization_id=row["organization_id"],
        environment=row["environment"],
        compute_provider=row["compute_provider"],
        worker_mode=row["worker_mode"],
        tribe_worker_endpoint_url=row["tribe_worker_endpoint_url"],
        tribe_model_id=row["tribe_model_id"],
        tribe_max_asset_duration_seconds=row["tribe_max_asset_duration_seconds"],
        monthly_gpu_cap_seconds=row["monthly_gpu_cap_seconds"],
        monthly_cost_cap_eur=float(row["monthly_cost_cap_eur"]),
        llm_provider=row["llm_provider"],
        llm_interpreter_model=row["llm_interpreter_model"],
        llm_writer_model=row["llm_writer_model"],
        llm_writer_reasoning_effort=row["llm_writer_reasoning_effort"],
        llm_prompt_version=row["llm_prompt_version"],
        secret_refs=row["secret_refs"] or {},
        configured_flags=row["configured_flags"] or {},
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class RuntimeSettingsDbRepository:
    def get(self, organization_id: UUID, environment: str, user: CurrentUser) -> RuntimeSettingsRead | None:
        with connection() as conn:
            assert_org_member(conn, organization_id, user)
            row = conn.execute(
                """
                select *
                from public.runtime_settings
                where organization_id = %s and environment = %s
                """,
                (organization_id, environment),
            ).fetchone()
            return _read(row) if row else None

    def upsert(self, payload: RuntimeSettingsUpdate, user: CurrentUser) -> RuntimeSettingsRead:
        with connection() as conn:
            assert_org_admin(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.runtime_settings (
                  organization_id, environment, compute_provider, worker_mode,
                  tribe_worker_endpoint_url, tribe_model_id, tribe_max_asset_duration_seconds,
                  monthly_gpu_cap_seconds, monthly_cost_cap_eur, llm_provider,
                  llm_interpreter_model, llm_writer_model, llm_writer_reasoning_effort,
                  llm_prompt_version, secret_refs, configured_flags, created_by, updated_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (organization_id, environment)
                do update set
                  compute_provider = excluded.compute_provider,
                  worker_mode = excluded.worker_mode,
                  tribe_worker_endpoint_url = excluded.tribe_worker_endpoint_url,
                  tribe_model_id = excluded.tribe_model_id,
                  tribe_max_asset_duration_seconds = excluded.tribe_max_asset_duration_seconds,
                  monthly_gpu_cap_seconds = excluded.monthly_gpu_cap_seconds,
                  monthly_cost_cap_eur = excluded.monthly_cost_cap_eur,
                  llm_provider = excluded.llm_provider,
                  llm_interpreter_model = excluded.llm_interpreter_model,
                  llm_writer_model = excluded.llm_writer_model,
                  llm_writer_reasoning_effort = excluded.llm_writer_reasoning_effort,
                  llm_prompt_version = excluded.llm_prompt_version,
                  secret_refs = excluded.secret_refs,
                  configured_flags = excluded.configured_flags,
                  updated_by = excluded.updated_by,
                  updated_at = now()
                returning *
                """,
                (
                    payload.organization_id,
                    payload.environment,
                    payload.compute_provider,
                    payload.worker_mode,
                    payload.tribe_worker_endpoint_url,
                    payload.tribe_model_id,
                    payload.tribe_max_asset_duration_seconds,
                    payload.monthly_gpu_cap_seconds,
                    payload.monthly_cost_cap_eur,
                    payload.llm_provider,
                    payload.llm_interpreter_model,
                    payload.llm_writer_model,
                    payload.llm_writer_reasoning_effort,
                    payload.llm_prompt_version,
                    jsonb(payload.secret_refs),
                    jsonb(payload.configured_flags),
                    user.id,
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return _read(row)


runtime_settings_db_repository = RuntimeSettingsDbRepository()

