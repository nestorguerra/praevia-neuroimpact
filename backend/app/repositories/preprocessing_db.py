from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection, jsonb, require_row
from app.schemas.preprocessing import (
    AssetDerivativeRead,
    PreprocessingBatchRead,
    PreprocessingJobCreate,
    PreprocessingJobRead,
    PreprocessingStep,
    PreprocessingStepStatus,
    PreprocessingStatus,
    build_mock_job,
)
from app.services.asset_validation import normalize_extension
from app.services.preprocessing_cpu import CpuPreprocessingError, CpuPreprocessingResult, run_local_cpu_preprocessing
from app.settings import settings
from app.schemas.uploads import AssetKind


class PreprocessingDbRepository:
    def create_batch(self, payload: PreprocessingJobCreate, user: CurrentUser) -> PreprocessingBatchRead:
        created: list[PreprocessingJobRead] = []
        for asset in payload.assets:
            if settings.preprocessing_worker_mode == "local_cpu":
                created.append(self._create_local_cpu_job(asset, user))
            else:
                created.append(self._create_mock_job(asset, user))
        return PreprocessingBatchRead(jobs=created)

    def _asset_context(self, conn, asset_id: UUID, organization_id: UUID):
        return require_row(
            conn.execute(
                """
                select a.id, a.organization_id, a.experiment_id, a.original_filename, a.kind,
                       a.mime_type, a.byte_size, av.id as asset_version_id,
                       av.storage_bucket, av.storage_key
                from public.assets a
                left join lateral (
                  select *
                  from public.asset_versions
                  where asset_id = a.id
                  order by version desc
                  limit 1
                ) av on true
                where a.id = %s and a.organization_id = %s
                """,
                (asset_id, organization_id),
            ).fetchone(),
            "Asset not found.",
        )

    def _create_mock_job(self, asset, user: CurrentUser) -> PreprocessingJobRead:
        with connection() as conn:
            assert_org_member(conn, asset.organization_id, user)
            asset_row = self._asset_context(conn, asset.asset_id, asset.organization_id)
            mock = build_mock_job(
                asset.model_copy(
                    update={
                        "experiment_id": asset_row["experiment_id"],
                        "file_name": asset_row["original_filename"],
                    }
                )
            )
            self._insert_completed_job(conn, mock, asset_row["asset_version_id"], user.id, register_storage=False)
            conn.commit()
            return mock

    def _create_local_cpu_job(self, asset, user: CurrentUser) -> PreprocessingJobRead:
        job_id = uuid4()
        with connection() as conn:
            assert_org_member(conn, asset.organization_id, user)
            asset_row = self._asset_context(conn, asset.asset_id, asset.organization_id)
            if not asset_row["storage_key"] or not asset_row["storage_bucket"]:
                raise CpuPreprocessingError("Asset sin version de storage; completa el upload antes de preprocesar.")
            conn.execute(
                """
                insert into public.preprocessing_jobs (
                  id, organization_id, asset_id, asset_version_id, status, progress,
                  worker_name, started_at, logs, created_by
                )
                values (%s, %s, %s, %s, 'running', 5, 'cpu-preprocessor-local',
                        now(), %s, %s)
                """,
                (
                    job_id,
                    asset.organization_id,
                    asset.asset_id,
                    asset_row["asset_version_id"],
                    jsonb(["worker=local_cpu", "status=running"]),
                    user.id,
                ),
            )
            conn.commit()

        try:
            result = run_local_cpu_preprocessing(
                asset=asset.model_copy(
                    update={
                        "experiment_id": asset_row["experiment_id"],
                        "file_name": asset_row["original_filename"],
                        "kind": AssetKind(asset_row["kind"]),
                        "mime_type": asset_row["mime_type"],
                        "byte_size": int(asset_row["byte_size"]),
                    }
                ),
                job_id=job_id,
                source_bucket=asset_row["storage_bucket"],
                source_key=asset_row["storage_key"],
            )
        except Exception as exc:
            return self._mark_failed(job_id, asset_row, str(exc))

        return self._complete_local_cpu_job(job_id, asset_row, result, user)

    def _insert_completed_job(self, conn, job: PreprocessingJobRead, asset_version_id: UUID | None, user_id: UUID, *, register_storage: bool) -> None:
        conn.execute(
            """
            insert into public.preprocessing_jobs (
              id, organization_id, asset_id, asset_version_id, status, progress, worker_name,
              completed_at, logs, created_by
            )
            values (%s, %s, %s, %s, %s, %s, 'cpu-preprocessor', %s, %s, %s)
            """,
            (
                job.id,
                job.organization_id,
                job.asset_id,
                asset_version_id,
                job.status.value if hasattr(job.status, "value") else job.status,
                job.progress,
                job.completed_at,
                jsonb(job.logs),
                user_id,
            ),
        )
        for derivative in job.derivatives:
            self._insert_derivative(conn, job.organization_id, derivative, user_id, register_storage=register_storage)
        derivative_bytes = sum(
            int(derivative.metadata.get("byte_size") or 0)
            for derivative in job.derivatives
            if isinstance(derivative.metadata.get("byte_size"), (int, float))
        )
        conn.execute(
            """
            insert into public.usage_events (
              organization_id, event_type, source_table, source_id, experiment_id, asset_id,
              credits_delta, estimated_cost_eur, storage_bytes_delta, metadata, created_by
            )
            values (%s, 'preprocessing', 'preprocessing_jobs', %s, %s, %s, 0.25, %s, %s, %s, %s)
            """,
            (
                job.organization_id,
                job.id,
                job.experiment_id,
                job.asset_id,
                settings.platform_event_eur,
                derivative_bytes,
                jsonb(
                    {
                        "label": f"Preprocesamiento {job.file_name}",
                        "status": job.status.value if hasattr(job.status, "value") else job.status,
                        "derivatives": len(job.derivatives),
                        "worker": "cpu-preprocessor",
                    }
                ),
                user_id,
            ),
        )

    def _insert_derivative(self, conn, organization_id: UUID, derivative, user_id: UUID, *, register_storage: bool) -> None:
        byte_size = derivative.metadata.get("byte_size")
        sha256 = derivative.metadata.get("sha256")
        conn.execute(
            """
            insert into public.asset_derivatives (
              id, organization_id, asset_id, preprocessing_job_id, derivative_type,
              storage_bucket, storage_key, mime_type, byte_size, sha256, metadata
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                derivative.id,
                organization_id,
                derivative.asset_id,
                derivative.preprocessing_job_id,
                derivative.derivative_type.value if hasattr(derivative.derivative_type, "value") else derivative.derivative_type,
                derivative.storage_bucket,
                derivative.storage_key,
                derivative.mime_type,
                int(byte_size) if isinstance(byte_size, (int, float)) else None,
                str(sha256) if sha256 else None,
                jsonb({"label": derivative.label, **derivative.metadata}),
            ),
        )
        if not register_storage:
            return
        conn.execute(
            """
            insert into public.storage_objects (
              organization_id, asset_id, source_table, source_id, object_role,
              storage_bucket, storage_key, content_type, byte_size, sha256, extension,
              status, retention_delete_after, metadata, created_by
            )
            values (
              %s, %s, 'asset_derivatives', %s, 'derivative',
              %s, %s, %s, %s, %s, %s,
              'active',
              now() + make_interval(days => coalesce((
                select asset_retention_days
                from public.organization_retention_policies
                where organization_id = %s
              ), %s)),
              %s, %s
            )
            on conflict (storage_bucket, storage_key)
            do update set
              byte_size = excluded.byte_size,
              sha256 = excluded.sha256,
              content_type = excluded.content_type,
              extension = excluded.extension,
              status = 'active',
              deleted_at = null,
              metadata = excluded.metadata
            """,
            (
                organization_id,
                derivative.asset_id,
                derivative.id,
                derivative.storage_bucket,
                derivative.storage_key,
                derivative.mime_type,
                int(byte_size) if isinstance(byte_size, (int, float)) else None,
                str(sha256) if sha256 else None,
                normalize_extension(derivative.label),
                organization_id,
                settings.retention_days,
                jsonb({"preprocessing_job_id": str(derivative.preprocessing_job_id), **derivative.metadata}),
                user_id,
            ),
        )

    def _complete_local_cpu_job(self, job_id: UUID, asset_row, result: CpuPreprocessingResult, user: CurrentUser) -> PreprocessingJobRead:
        with connection() as conn:
            conn.execute(
                """
                update public.preprocessing_jobs
                set status = 'completed', progress = 100, completed_at = now(),
                    logs = %s, updated_at = now()
                where id = %s
                """,
                (jsonb(result.logs + [f"step={step.label}:{step.status.value}" for step in result.steps]), job_id),
            )
            for derivative in result.derivatives:
                self._insert_derivative(conn, asset_row["organization_id"], derivative, user.id, register_storage=True)
            derivative_bytes = sum(
                int(derivative.metadata.get("byte_size") or 0)
                for derivative in result.derivatives
                if isinstance(derivative.metadata.get("byte_size"), (int, float))
            )
            conn.execute(
                """
                insert into public.usage_events (
                  organization_id, event_type, source_table, source_id, experiment_id, asset_id,
                  credits_delta, estimated_cost_eur, storage_bytes_delta, metadata, created_by
                )
                values (%s, 'preprocessing', 'preprocessing_jobs', %s, %s, %s, 0.25, %s, %s, %s, %s)
                """,
                (
                    asset_row["organization_id"],
                    job_id,
                    asset_row["experiment_id"],
                    asset_row["id"],
                    settings.platform_event_eur,
                    derivative_bytes,
                    jsonb(
                        {
                            "label": f"Preprocesamiento {asset_row['original_filename']}",
                            "status": "completed",
                            "derivatives": len(result.derivatives),
                            "worker": "cpu-preprocessor-local",
                        }
                    ),
                    user.id,
                ),
            )
            conn.commit()
            row = conn.execute(
                """
                select pj.*, a.experiment_id, a.original_filename
                from public.preprocessing_jobs pj
                join public.assets a on a.id = pj.asset_id
                where pj.id = %s
                """,
                (job_id,),
            ).fetchone()
            return self._read_job(conn, row)

    def _mark_failed(self, job_id: UUID, asset_row, error_message: str) -> PreprocessingJobRead:
        logs = ["worker=local_cpu", f"status=failed", f"error={error_message}"]
        with connection() as conn:
            conn.execute(
                """
                update public.preprocessing_jobs
                set status = 'failed', progress = 100, completed_at = now(),
                    error_message = %s, logs = %s, updated_at = now()
                where id = %s
                """,
                (error_message, jsonb(logs), job_id),
            )
            conn.commit()
        return PreprocessingJobRead(
            id=job_id,
            organization_id=asset_row["organization_id"],
            experiment_id=asset_row["experiment_id"],
            asset_id=asset_row["id"],
            file_name=asset_row["original_filename"],
            status=PreprocessingStatus.failed,
            progress=100,
            steps=[
                PreprocessingStep(
                    label="cpu preprocessing",
                    status=PreprocessingStepStatus.failed,
                    message=error_message,
                )
            ],
            logs=logs,
            derivatives=[],
            completed_at=datetime.now(timezone.utc),
        )

    def _read_job(self, conn, row) -> PreprocessingJobRead:
        derivative_rows = conn.execute(
            """
            select *
            from public.asset_derivatives
            where preprocessing_job_id = %s
            order by created_at asc
            """,
            (row["id"],),
        ).fetchall()
        derivatives = [
            AssetDerivativeRead(
                id=item["id"],
                asset_id=item["asset_id"],
                preprocessing_job_id=row["id"],
                derivative_type=item["derivative_type"],
                label=(item["metadata"] or {}).get("label") or Path(item["storage_key"]).name,
                storage_bucket=item["storage_bucket"],
                storage_key=item["storage_key"],
                mime_type=item["mime_type"],
                metadata=item["metadata"] or {},
                created_at=item["created_at"],
            )
            for item in derivative_rows
        ]
        status = PreprocessingStatus(row["status"])
        if status == PreprocessingStatus.failed:
            steps = [
                PreprocessingStep(
                    label="cpu preprocessing",
                    status=PreprocessingStepStatus.failed,
                    message=row.get("error_message") or "El preprocesamiento fallo.",
                )
            ]
        elif status == PreprocessingStatus.running:
            steps = [
                PreprocessingStep(label="cpu preprocessing", status=PreprocessingStepStatus.running, message="Worker CPU en ejecucion."),
                PreprocessingStep(label="storage", status=PreprocessingStepStatus.pending, message="Derivados pendientes de persistir."),
            ]
        elif status == PreprocessingStatus.queued:
            steps = [
                PreprocessingStep(label="queued", status=PreprocessingStepStatus.pending, message="Job pendiente de worker CPU.")
            ]
        else:
            steps = [
                PreprocessingStep(label="metadata", status=PreprocessingStepStatus.completed, message="Metadatos registrados."),
                PreprocessingStep(label="derivatives", status=PreprocessingStepStatus.completed, message=f"{len(derivatives)} derivados persistidos."),
            ]
        return PreprocessingJobRead(
            id=row["id"],
            organization_id=row["organization_id"],
            experiment_id=row["experiment_id"],
            asset_id=row["asset_id"],
            file_name=row["original_filename"],
            status=status,
            progress=row["progress"],
            steps=steps,
            logs=row["logs"] or [],
            derivatives=derivatives,
            created_at=row["created_at"],
            completed_at=row["completed_at"],
        )

    def get_job(self, job_id: UUID, user: CurrentUser) -> PreprocessingJobRead | None:
        with connection() as conn:
            row = conn.execute(
                """
                select pj.*, a.experiment_id, a.original_filename
                from public.preprocessing_jobs pj
                join public.assets a on a.id = pj.asset_id
                where pj.id = %s
                """,
                (job_id,),
            ).fetchone()
            if not row:
                return None
            assert_org_member(conn, row["organization_id"], user)
            return self._read_job(conn, row)

    def list_asset_jobs(self, asset_id: UUID, user: CurrentUser) -> list[PreprocessingJobRead]:
        with connection() as conn:
            asset = require_row(
                conn.execute("select organization_id from public.assets where id = %s", (asset_id,)).fetchone(),
                "Asset not found.",
            )
            assert_org_member(conn, asset["organization_id"], user)
            rows = conn.execute(
                """
                select pj.*, a.experiment_id, a.original_filename
                from public.preprocessing_jobs pj
                join public.assets a on a.id = pj.asset_id
                where pj.asset_id = %s
                order by pj.created_at desc
                """,
                (asset_id,),
            ).fetchall()
            return [self._read_job(conn, row) for row in rows]

    def list_experiment_jobs(self, experiment_id: UUID, user: CurrentUser) -> list[PreprocessingJobRead]:
        with connection() as conn:
            experiment = require_row(
                conn.execute("select organization_id from public.experiments where id = %s", (experiment_id,)).fetchone(),
                "Experiment not found.",
            )
            assert_org_member(conn, experiment["organization_id"], user)
            rows = conn.execute(
                """
                select pj.*, a.experiment_id, a.original_filename
                from public.preprocessing_jobs pj
                join public.assets a on a.id = pj.asset_id
                where a.experiment_id = %s
                order by pj.created_at desc
                """,
                (experiment_id,),
            ).fetchall()
            return [self._read_job(conn, row) for row in rows]


preprocessing_db_repository = PreprocessingDbRepository()
