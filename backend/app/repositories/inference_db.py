from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException
from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection, jsonb, require_row
from app.schemas.inference import (
    AnalysisRunBatchRead,
    AnalysisRunCreate,
    AnalysisRunRead,
    AnalysisRunStatus,
    PredictionArtifactRead,
    PredictionArtifactType,
    TribeCallbackPayload,
    build_mock_analysis_run,
)
from app.services.asset_validation import normalize_extension
from app.services.observability import record_error_event
from app.services.gpu_worker_client import gpu_worker_client
from app.services.storage import storage_service
from app.settings import settings


class InferenceDbRepository:
    def create_run(self, payload: AnalysisRunCreate, user: CurrentUser) -> AnalysisRunRead:
        if settings.tribe_worker_mode == "remote_gpu":
            return self._create_remote_run(payload, user)
        return self._create_mock_run(payload, user)

    def _create_mock_run(self, payload: AnalysisRunCreate, user: CurrentUser) -> AnalysisRunRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            require_row(
                conn.execute(
                    "select id from public.assets where id = %s and organization_id = %s",
                    (payload.asset_id, payload.organization_id),
                ).fetchone(),
                "Asset not found.",
            )
            run = build_mock_analysis_run(payload)
            conn.execute(
                """
                insert into public.analysis_runs (
                  id, organization_id, experiment_id, asset_id, preprocessing_job_id, status,
                  model_id, model_revision, worker_image, progress, n_timesteps, n_vertices,
                  gpu_seconds, gpu_vram_mb, duration_seconds, logs, created_by, completed_at,
                  compute_provider
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    run.id,
                    run.organization_id,
                    run.experiment_id,
                    run.asset_id,
                    run.preprocessing_job_id,
                    run.status.value,
                    run.model_id,
                    run.model_revision,
                    run.worker_image,
                    run.progress,
                    run.n_timesteps,
                    run.n_vertices,
                    run.gpu_seconds,
                    run.gpu_vram_mb,
                    run.duration_seconds,
                    jsonb(run.logs),
                    user.id,
                    run.completed_at,
                    "local_mock",
                ),
            )
            for artifact in run.artifacts:
                conn.execute(
                    """
                    insert into public.prediction_artifacts (
                      id, organization_id, analysis_run_id, asset_id, artifact_type,
                      storage_bucket, storage_key, mime_type, shape, metadata
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        artifact.id,
                        run.organization_id,
                        artifact.analysis_run_id,
                        artifact.asset_id,
                        artifact.artifact_type.value,
                        artifact.storage_bucket,
                        artifact.storage_key,
                        artifact.mime_type,
                        jsonb(artifact.shape),
                        jsonb(artifact.metadata),
                    ),
                )
            conn.commit()
            return run

    def _create_remote_run(self, payload: AnalysisRunCreate, user: CurrentUser) -> AnalysisRunRead:
        if not storage_service.is_configured:
            raise HTTPException(status_code=503, detail="Storage S3/R2 es obligatorio para TRIBE remoto.")
        if not settings.tribe_worker_endpoint_configured:
            raise HTTPException(status_code=503, detail="TRIBE_WORKER_ENDPOINT_URL no configurado.")
        if settings.gpu_provider == "google_cloud_run_gpu":
            if not settings.gcp_project_id or not settings.gcp_tasks_queue or not settings.gcp_tasks_location:
                raise HTTPException(status_code=503, detail="Google Cloud Tasks no configurado para TRIBE remoto.")
        elif not settings.gpu_provider_api_key_configured:
            raise HTTPException(status_code=503, detail="RUNPOD_API_KEY/GPU_PROVIDER_API_KEY no configurada.")

        run_id = uuid4()
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            require_row(
                conn.execute(
                    "select id from public.assets where id = %s and organization_id = %s",
                    (payload.asset_id, payload.organization_id),
                ).fetchone(),
                "Asset not found.",
            )
            self._assert_gpu_caps(conn, payload.organization_id)
            derivatives = self._derivatives_for_run(conn, payload)
            if not derivatives:
                raise HTTPException(status_code=400, detail="No hay derivados de preprocesamiento para lanzar TRIBE.")

            logs = [
                "analysis run accepted",
                "worker mode=remote_gpu",
                f"provider={settings.gpu_provider}",
                f"worker_image={settings.tribe_worker_image}",
                f"derivatives={len(derivatives)}",
            ]
            conn.execute(
                """
                insert into public.analysis_runs (
                  id, organization_id, experiment_id, asset_id, preprocessing_job_id, status,
                  model_id, model_revision, worker_image, progress, logs, created_by,
                  started_at, compute_provider, worker_timeout_seconds, attempt_count
                )
                values (%s, %s, %s, %s, %s, 'queued', %s, 'main', %s, 5, %s, %s,
                        now(), %s, %s, 1)
                """,
                (
                    run_id,
                    payload.organization_id,
                    payload.experiment_id,
                    payload.asset_id,
                    payload.preprocessing_job_id,
                    payload.model_id,
                    settings.tribe_worker_image,
                    jsonb(logs),
                    user.id,
                    settings.gpu_provider,
                    settings.tribe_run_timeout_seconds,
                ),
            )
            conn.commit()

        output_prefix = (
            f"{settings.tribe_output_prefix}/{settings.app_env}/org/{payload.organization_id}/"
            f"experiment/{payload.experiment_id}/asset/{payload.asset_id}/run/{run_id}"
        )
        worker_payload = {
            "input": {
                "run_id": str(run_id),
                "organization_id": str(payload.organization_id),
                "experiment_id": str(payload.experiment_id),
                "asset_id": str(payload.asset_id),
                "model_id": payload.model_id,
                "cache_dir": "/models/tribe",
                "mock": False,
                "expected_vertices": settings.tribe_expected_vertices,
                "source_bucket": storage_service.bucket,
                "output_bucket": settings.tribe_output_bucket or storage_service.bucket,
                "output_prefix": output_prefix,
                "derivatives": derivatives,
                "callback_url": settings.tribe_callback_url,
                "timeout_seconds": settings.tribe_run_timeout_seconds,
            }
        }
        provider_job = None
        last_error: Exception | None = None
        attempt_count = 0
        for _attempt in range(settings.tribe_run_max_retries + 1):
            attempt_count = _attempt + 1
            try:
                provider_job = gpu_worker_client.enqueue(worker_payload)
                break
            except Exception as exc:
                last_error = exc
        if provider_job is None:
            message = str(last_error) if last_error else f"{settings.gpu_provider} enqueue failed."
            self._mark_provider_failure(run_id, message)
            if last_error:
                raise last_error
            raise HTTPException(status_code=502, detail=message)

        with connection() as conn:
            conn.execute(
                """
                update public.analysis_runs
                set status = 'running', progress = 15, provider_job_id = %s,
                    last_provider_status = %s, attempt_count = %s, logs = logs || %s::jsonb
                where id = %s
                """,
                (
                    provider_job.job_id,
                    provider_job.status,
                    attempt_count,
                    jsonb([f"provider_job_id={provider_job.job_id}", f"provider_status={provider_job.status}", f"provider={settings.gpu_provider}"]),
                    run_id,
                ),
            )
            conn.commit()
            row = conn.execute(
                """
                select ar.*, a.original_filename, a.kind
                from public.analysis_runs ar
                join public.assets a on a.id = ar.asset_id
                where ar.id = %s
                """,
                (run_id,),
            ).fetchone()
            return self._read_run(conn, row)

    def _assert_gpu_caps(self, conn, organization_id: UUID) -> None:
        row = conn.execute(
            """
            select
              coalesce(sum(credits_delta), 0) as credits_used,
              coalesce(sum(estimated_cost_eur), 0) as estimated_cost_eur,
              coalesce(sum(gpu_seconds), 0) as gpu_seconds
            from public.usage_events
            where organization_id = %s
              and created_at >= date_trunc('month', now())
            """,
            (organization_id,),
        ).fetchone()
        limits = conn.execute(
            """
            select
              coalesce(ol.hard_credit_limit, greatest(o.credits, ceil(o.credits * 1.2))) as hard_credit_limit,
              coalesce(ol.monthly_cost_limit_eur, %s) as monthly_cost_limit_eur,
              coalesce(ol.monthly_gpu_seconds_limit, %s) as monthly_gpu_seconds_limit,
              coalesce(ol.storage_byte_limit, 107374182400) as storage_byte_limit
            from public.organizations o
            left join public.organization_limits ol on ol.organization_id = o.id
            where o.id = %s
            """,
            (settings.monthly_cost_cap_eur, settings.monthly_gpu_cap_seconds, organization_id),
        ).fetchone()
        storage = conn.execute(
            """
            select coalesce(sum(byte_size), 0) as storage_bytes
            from public.storage_objects
            where organization_id = %s and status = 'active'
            """,
            (organization_id,),
        ).fetchone()
        credits_used = float(row["credits_used"] or 0)
        gpu_seconds = float(row["gpu_seconds"] or 0)
        estimated_cost = float(row["estimated_cost_eur"] or 0)
        storage_bytes = int(storage["storage_bytes"] or 0)
        hard_credit_limit = float(limits["hard_credit_limit"] or 0)
        monthly_cost_limit = float(limits["monthly_cost_limit_eur"] or 0)
        monthly_gpu_limit = float(limits["monthly_gpu_seconds_limit"] or 0)
        storage_limit = int(limits["storage_byte_limit"] or 0)
        if hard_credit_limit and credits_used >= hard_credit_limit:
            raise HTTPException(status_code=429, detail="Cap mensual de creditos alcanzado.")
        if monthly_gpu_limit and gpu_seconds >= monthly_gpu_limit:
            raise HTTPException(status_code=429, detail="Cap mensual de GPU seconds alcanzado.")
        if monthly_cost_limit and estimated_cost >= monthly_cost_limit:
            raise HTTPException(status_code=429, detail="Cap mensual de coste alcanzado.")
        if storage_limit and storage_bytes >= storage_limit:
            raise HTTPException(status_code=429, detail="Cap de storage alcanzado.")

    def _derivatives_for_run(self, conn, payload: AnalysisRunCreate) -> list[dict[str, str]]:
        rows = []
        if payload.preprocessing_job_id:
            rows = conn.execute(
                """
                select derivative_type, storage_bucket, storage_key, mime_type, metadata
                from public.asset_derivatives
                where preprocessing_job_id = %s and organization_id = %s
                order by created_at asc
                """,
                (payload.preprocessing_job_id, payload.organization_id),
            ).fetchall()
        if not rows:
            rows = conn.execute(
                """
                select derivative_type, storage_bucket, storage_key, mime_type, metadata
                from public.asset_derivatives
                where asset_id = %s and organization_id = %s
                order by created_at asc
                """,
                (payload.asset_id, payload.organization_id),
            ).fetchall()
        if rows:
            return [
                {
                    "derivative_type": row["derivative_type"],
                    "storage_bucket": row["storage_bucket"],
                    "storage_key": row["storage_key"],
                    "mime_type": row["mime_type"],
                    "label": (row["metadata"] or {}).get("label") or Path(row["storage_key"]).name,
                }
                for row in rows
            ]
        return [
            {
                "derivative_type": self._infer_derivative_type(key),
                "storage_bucket": storage_service.bucket,
                "storage_key": key,
                "mime_type": "application/octet-stream",
                "label": Path(key).name,
            }
            for key in payload.derivative_keys
        ]

    def _infer_derivative_type(self, key: str) -> str:
        name = Path(key).name
        if name == "normalized_video.mp4":
            return "normalized_media"
        if name == "audio_16k_mono.wav":
            return "extracted_audio"
        if name.startswith("transcript"):
            return "transcript"
        if name == "normalized_text.json":
            return "normalized_text"
        return "metadata"

    def _mark_provider_failure(self, run_id: UUID, message: str) -> None:
        with connection() as conn:
            row = conn.execute(
                "select organization_id, asset_id from public.analysis_runs where id = %s",
                (run_id,),
            ).fetchone()
            conn.execute(
                """
                update public.analysis_runs
                set status = 'failed', progress = 100, completed_at = now(),
                    error_message = %s, logs = logs || %s::jsonb
                where id = %s
                """,
                (message, jsonb([f"provider_enqueue_failed={message}"]), run_id),
            )
            conn.commit()
        if row:
            record_error_event(
                source="worker",
                organization_id=row["organization_id"],
                entity_type="analysis_run",
                entity_id=run_id,
                message=message,
                metadata={"asset_id": str(row["asset_id"]), "phase": "provider_enqueue"},
            )

    def create_batch(self, payloads: list[AnalysisRunCreate], user: CurrentUser) -> AnalysisRunBatchRead:
        return AnalysisRunBatchRead(runs=[self.create_run(payload, user) for payload in payloads])

    def _read_run(self, conn, row) -> AnalysisRunRead:
        artifacts = conn.execute(
            """
            select *
            from public.prediction_artifacts
            where analysis_run_id = %s
            order by created_at asc
            """,
            (row["id"],),
        ).fetchall()
        return AnalysisRunRead(
            id=row["id"],
            organization_id=row["organization_id"],
            experiment_id=row["experiment_id"],
            asset_id=row["asset_id"],
            preprocessing_job_id=row["preprocessing_job_id"],
            asset_name=row["original_filename"],
            asset_kind=row["kind"],
            status=row["status"],
            progress=row["progress"],
            model_id=row["model_id"],
            model_revision=row["model_revision"],
            worker_image=row["worker_image"] or "praevia/tribe-worker:local",
            compute_provider=row.get("compute_provider") or "local_mock",
            provider_job_id=row.get("provider_job_id"),
            n_timesteps=row["n_timesteps"],
            n_vertices=row["n_vertices"],
            gpu_seconds=float(row["gpu_seconds"]) if row["gpu_seconds"] is not None else None,
            gpu_vram_mb=float(row["gpu_vram_mb"]) if row["gpu_vram_mb"] is not None else None,
            duration_seconds=float(row["duration_seconds"]) if row["duration_seconds"] is not None else None,
            logs=row["logs"] or [],
            artifacts=[
                PredictionArtifactRead(
                    id=item["id"],
                    analysis_run_id=item["analysis_run_id"],
                    asset_id=item["asset_id"],
                    artifact_type=item["artifact_type"],
                    storage_bucket=item["storage_bucket"],
                    storage_key=item["storage_key"],
                    mime_type=item["mime_type"],
                    shape=item["shape"] or {},
                    metadata=item["metadata"] or {},
                    created_at=item["created_at"],
                )
                for item in artifacts
            ],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
        )

    def apply_callback(self, payload: TribeCallbackPayload) -> AnalysisRunRead:
        with connection() as conn:
            row = require_row(
                conn.execute(
                    """
                    select ar.*, a.original_filename, a.kind
                    from public.analysis_runs ar
                    join public.assets a on a.id = ar.asset_id
                    where ar.id = %s and ar.organization_id = %s and ar.asset_id = %s
                    """,
                    (payload.run_id, payload.organization_id, payload.asset_id),
                ).fetchone(),
                "Analysis run not found.",
            )
            conn.execute("delete from public.prediction_artifacts where analysis_run_id = %s", (payload.run_id,))
            progress = 100 if payload.status in {AnalysisRunStatus.done, AnalysisRunStatus.failed, AnalysisRunStatus.cancelled} else 50
            conn.execute(
                """
                update public.analysis_runs
                set status = %s, progress = %s, provider_job_id = coalesce(%s, provider_job_id),
                    n_timesteps = %s, n_vertices = %s, gpu_seconds = %s, gpu_vram_mb = %s,
                    duration_seconds = %s, error_message = %s, logs = logs || %s::jsonb,
                    last_provider_status = %s,
                    callback_received_at = now(), completed_at = case when %s then now() else completed_at end,
                    updated_at = now()
                where id = %s
                """,
                (
                    payload.status.value,
                    progress,
                    payload.provider_job_id,
                    payload.n_timesteps,
                    payload.n_vertices,
                    payload.gpu_seconds,
                    payload.gpu_vram_mb,
                    payload.duration_seconds,
                    payload.error_message,
                    jsonb(payload.logs),
                    payload.status.value,
                    payload.status in {AnalysisRunStatus.done, AnalysisRunStatus.failed, AnalysisRunStatus.cancelled},
                    payload.run_id,
                ),
            )
            for artifact in payload.artifacts:
                artifact_id = uuid4()
                conn.execute(
                    """
                    insert into public.prediction_artifacts (
                      id, organization_id, analysis_run_id, asset_id, artifact_type,
                      storage_bucket, storage_key, mime_type, byte_size, sha256, shape, metadata
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        artifact_id,
                        payload.organization_id,
                        payload.run_id,
                        payload.asset_id,
                        artifact.artifact_type.value,
                        artifact.storage_bucket,
                        artifact.storage_key,
                        artifact.mime_type,
                        artifact.byte_size,
                        artifact.sha256,
                        jsonb(artifact.shape),
                        jsonb(artifact.metadata),
                    ),
                )
                self._insert_storage_manifest(conn, payload.organization_id, payload.asset_id, artifact_id, artifact)
            if payload.status in {AnalysisRunStatus.done, AnalysisRunStatus.failed, AnalysisRunStatus.cancelled} and payload.gpu_seconds is not None:
                estimated_cost = float(payload.gpu_seconds or 0) * settings.tribe_gpu_eur_per_second
                conn.execute(
                    """
                    insert into public.usage_events (
                      organization_id, event_type, source_table, source_id, experiment_id, asset_id,
                      analysis_run_id, credits_delta, estimated_cost_eur, gpu_seconds,
                      storage_bytes_delta, metadata
                    )
                    values (%s, 'tribe_run', 'analysis_runs', %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.organization_id,
                        payload.run_id,
                        row["experiment_id"],
                        payload.asset_id,
                        payload.run_id,
                        1 if payload.status == AnalysisRunStatus.done else 0,
                        estimated_cost,
                        payload.gpu_seconds or 0,
                        sum(item.byte_size for item in payload.artifacts),
                        jsonb({"provider_job_id": payload.provider_job_id, "worker": settings.gpu_provider}),
                    ),
                )
            if payload.status == AnalysisRunStatus.failed:
                conn.execute(
                    """
                    insert into public.error_events (
                      organization_id, source, severity, message, entity_type, entity_id, metadata
                    )
                    values (%s, 'worker', 'error', %s, 'analysis_run', %s, %s)
                    """,
                    (
                        payload.organization_id,
                        payload.error_message or "TRIBE worker failed.",
                        payload.run_id,
                        jsonb(
                            {
                                "asset_id": str(payload.asset_id),
                                "provider_job_id": payload.provider_job_id,
                                "gpu_seconds": payload.gpu_seconds,
                                "logs": payload.logs[-5:],
                            }
                        ),
                    ),
                )
            conn.commit()
            fresh = conn.execute(
                """
                select ar.*, a.original_filename, a.kind
                from public.analysis_runs ar
                join public.assets a on a.id = ar.asset_id
                where ar.id = %s
                """,
                (payload.run_id,),
            ).fetchone()
            return self._read_run(conn, fresh)

    def _insert_storage_manifest(self, conn, organization_id: UUID, asset_id: UUID, artifact_id: UUID, artifact) -> None:
        conn.execute(
            """
            insert into public.storage_objects (
              organization_id, asset_id, source_table, source_id, object_role,
              storage_bucket, storage_key, content_type, byte_size, sha256, extension,
              status, retention_delete_after, metadata
            )
            values (
              %s, %s, 'prediction_artifacts', %s, 'prediction',
              %s, %s, %s, %s, %s, %s,
              'active',
              now() + make_interval(days => coalesce((
                select asset_retention_days
                from public.organization_retention_policies
                where organization_id = %s
              ), %s)),
              %s
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
                asset_id,
                artifact_id,
                artifact.storage_bucket,
                artifact.storage_key,
                artifact.mime_type,
                artifact.byte_size,
                artifact.sha256,
                normalize_extension(Path(artifact.storage_key).name),
                organization_id,
                settings.retention_days,
                jsonb({"prediction_artifact_id": str(artifact_id), **artifact.metadata}),
            ),
        )

    def get_run(self, run_id: UUID, user: CurrentUser) -> AnalysisRunRead | None:
        with connection() as conn:
            row = conn.execute(
                """
                select ar.*, a.original_filename, a.kind
                from public.analysis_runs ar
                join public.assets a on a.id = ar.asset_id
                where ar.id = %s
                """,
                (run_id,),
            ).fetchone()
            if not row:
                return None
            assert_org_member(conn, row["organization_id"], user)
            return self._read_run(conn, row)

    def list_experiment_runs(self, experiment_id: UUID, user: CurrentUser) -> list[AnalysisRunRead]:
        with connection() as conn:
            experiment = require_row(
                conn.execute("select organization_id from public.experiments where id = %s", (experiment_id,)).fetchone(),
                "Experiment not found.",
            )
            assert_org_member(conn, experiment["organization_id"], user)
            rows = conn.execute(
                """
                select ar.*, a.original_filename, a.kind
                from public.analysis_runs ar
                join public.assets a on a.id = ar.asset_id
                where ar.experiment_id = %s
                order by ar.created_at desc
                """,
                (experiment_id,),
            ).fetchall()
            return [self._read_run(conn, row) for row in rows]


inference_db_repository = InferenceDbRepository()
