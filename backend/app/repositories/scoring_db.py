from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import HTTPException
from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection, jsonb, require_row
from app.schemas.scoring import (
    EditorialScoreRead,
    NetworkScoreRead,
    NeuroScoringCreate,
    NeuroScoringRead,
    PeakMomentRead,
    RegionScoreRead,
    TimecoursePointRead,
)
from app.services.scoring_engine import score_storage_npz
from app.services.storage import storage_service
from app.settings import settings


def _float(value):
    return float(value) if value is not None else value


class ScoringDbRepository:
    def create_result(self, payload: NeuroScoringCreate, user: CurrentUser) -> NeuroScoringRead:
        if not storage_service.is_configured:
            raise HTTPException(status_code=503, detail="Storage S3/R2 es obligatorio para scoring real.")
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            run = require_row(
                conn.execute(
                    """
                    select ar.*, a.original_filename, a.kind
                    from public.analysis_runs ar
                    join public.assets a on a.id = ar.asset_id
                    where ar.id = %s and ar.organization_id = %s
                    """,
                    (payload.analysis_run_id, payload.organization_id),
                ).fetchone(),
                "Analysis run not found.",
            )
            if run["asset_id"] != payload.asset_id or run["experiment_id"] != payload.experiment_id:
                raise HTTPException(status_code=400, detail="El run no coincide con asset/experimento.")
            if run["status"] != "done":
                raise HTTPException(status_code=409, detail="El run TRIBE debe estar done antes de calcular scoring.")
            artifact = self._bold_artifact(conn, payload.analysis_run_id, payload.organization_id)
            derivative_types = self._derivative_types(conn, payload.asset_id, payload.organization_id, run["preprocessing_job_id"])
            engine_result = score_storage_npz(
                storage_service=storage_service,
                bucket=artifact["storage_bucket"],
                key=artifact["storage_key"],
                asset_kind=run["kind"],
                derivative_types=derivative_types,
            )
            result_id = uuid4()
            conn.execute(
                """
                insert into public.neuro_scoring_results (
                  id, organization_id, experiment_id, asset_id, analysis_run_id, model_id,
                  scoring_version, confidence_label, benchmark_label, bold_delay_seconds,
                  summary, source_prediction_artifact_id, pipeline_mode, input_quality,
                  n_timesteps, n_vertices, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'real_npz', %s, %s, %s, %s)
                """,
                (
                    result_id,
                    payload.organization_id,
                    run["experiment_id"],
                    run["asset_id"],
                    run["id"],
                    run["model_id"],
                    engine_result["scoring_version"],
                    engine_result["confidence_label"],
                    engine_result["benchmark_label"],
                    engine_result["bold_delay_seconds"],
                    jsonb(
                        {
                            **engine_result["summary"],
                            "source_artifact_id": str(artifact["id"]),
                            "source_prediction_key": artifact["storage_key"],
                        }
                    ),
                    artifact["id"],
                    engine_result["summary"].get("quality"),
                    engine_result["summary"].get("n_timesteps"),
                    engine_result["summary"].get("n_vertices"),
                    user.id,
                ),
            )
            for score in engine_result["editorial_scores"]:
                conn.execute(
                    """
                    insert into public.editorial_scores (
                      organization_id, scoring_result_id, metric_key, metric_label, score,
                      confidence, benchmark_delta, evidence, action
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.organization_id,
                        result_id,
                        score["metric_key"],
                        score["metric_label"],
                        score["score"],
                        score["confidence"],
                        score["benchmark_delta"],
                        score["evidence"],
                        score["action"],
                    ),
                )
            for score in engine_result["region_scores"]:
                conn.execute(
                    """
                    insert into public.region_scores (
                      organization_id, scoring_result_id, region_key, region_label, network_key,
                      score, mean_response, peak_response, evidence
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.organization_id,
                        result_id,
                        score["region_key"],
                        score["region_label"],
                        score["network_key"],
                        score["score"],
                        score["mean_response"],
                        score["peak_response"],
                        score["evidence"],
                    ),
                )
            for score in engine_result["network_scores"]:
                conn.execute(
                    """
                    insert into public.network_scores (
                      organization_id, scoring_result_id, network_key, network_label, score,
                      confidence, evidence
                    )
                    values (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.organization_id,
                        result_id,
                        score["network_key"],
                        score["network_label"],
                        score["score"],
                        score["confidence"],
                        score["evidence"],
                    ),
                )
            for point in engine_result["timecourse_points"]:
                conn.execute(
                    """
                    insert into public.timecourse_points (
                      organization_id, scoring_result_id, point_index, bold_time_seconds,
                      stimulus_time_seconds, global_response, normalized_response, event_label
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.organization_id,
                        result_id,
                        point["point_index"],
                        point["bold_time_seconds"],
                        point["stimulus_time_seconds"],
                        point["global_response"],
                        point["normalized_response"],
                        point["event_label"],
                    ),
                )
            for moment in engine_result["peak_moments"]:
                conn.execute(
                    """
                    insert into public.peak_moments (
                      organization_id, scoring_result_id, moment_type, start_seconds, end_seconds,
                      score, evidence, action
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.organization_id,
                        result_id,
                        moment["moment_type"],
                        moment["start_seconds"],
                        moment["end_seconds"],
                        moment["score"],
                        moment["evidence"],
                        moment["action"],
                    ),
                )
            conn.execute(
                """
                insert into public.usage_events (
                  organization_id, event_type, source_table, source_id, experiment_id, asset_id,
                  analysis_run_id, credits_delta, estimated_cost_eur, metadata, created_by
                )
                values (%s, 'scoring', 'neuro_scoring_results', %s, %s, %s, %s, 0.2, %s, %s, %s)
                """,
                (
                    payload.organization_id,
                    result_id,
                    run["experiment_id"],
                    run["asset_id"],
                    run["id"],
                    settings.platform_event_eur,
                    jsonb(
                        {
                            "label": f"Scoring {run['original_filename']}",
                            "scoring_version": engine_result["scoring_version"],
                            "source_artifact_id": str(artifact["id"]),
                            "source_prediction_key": artifact["storage_key"],
                        }
                    ),
                    user.id,
                ),
            )
            conn.commit()
            row = conn.execute(
                """
                select nsr.*, a.original_filename
                from public.neuro_scoring_results nsr
                join public.assets a on a.id = nsr.asset_id
                where nsr.id = %s
                """,
                (result_id,),
            ).fetchone()
            return self._read_result(conn, row)

    def _bold_artifact(self, conn, analysis_run_id: UUID, organization_id: UUID):
        return require_row(
            conn.execute(
                """
                select *
                from public.prediction_artifacts
                where analysis_run_id = %s
                  and organization_id = %s
                  and (artifact_type = 'bold_npz' or storage_key ilike '%%bold_predictions.npz')
                order by created_at desc
                limit 1
                """,
                (analysis_run_id, organization_id),
            ).fetchone(),
            "No existe bold_predictions.npz para este run.",
        )

    def _derivative_types(self, conn, asset_id: UUID, organization_id: UUID, preprocessing_job_id: UUID | None) -> set[str]:
        if preprocessing_job_id:
            rows = conn.execute(
                """
                select distinct derivative_type
                from public.asset_derivatives
                where asset_id = %s and organization_id = %s and preprocessing_job_id = %s
                """,
                (asset_id, organization_id, preprocessing_job_id),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                select distinct derivative_type
                from public.asset_derivatives
                where asset_id = %s and organization_id = %s
                """,
                (asset_id, organization_id),
            ).fetchall()
        return {str(row["derivative_type"]) for row in rows}

    def _read_result(self, conn, row) -> NeuroScoringRead:
        editorial = conn.execute(
            "select * from public.editorial_scores where scoring_result_id = %s order by created_at asc",
            (row["id"],),
        ).fetchall()
        regions = conn.execute(
            "select * from public.region_scores where scoring_result_id = %s order by created_at asc",
            (row["id"],),
        ).fetchall()
        networks = conn.execute(
            "select * from public.network_scores where scoring_result_id = %s order by created_at asc",
            (row["id"],),
        ).fetchall()
        points = conn.execute(
            "select * from public.timecourse_points where scoring_result_id = %s order by point_index asc",
            (row["id"],),
        ).fetchall()
        moments = conn.execute(
            "select * from public.peak_moments where scoring_result_id = %s order by created_at asc",
            (row["id"],),
        ).fetchall()
        return NeuroScoringRead(
            id=row["id"],
            organization_id=row["organization_id"],
            experiment_id=row["experiment_id"],
            asset_id=row["asset_id"],
            analysis_run_id=row["analysis_run_id"],
            asset_name=row["original_filename"],
            model_id=row["model_id"],
            scoring_version=row["scoring_version"],
            confidence_label=row["confidence_label"],
            benchmark_label=row["benchmark_label"],
            bold_delay_seconds=_float(row["bold_delay_seconds"]),
            summary=row["summary"] or {},
            editorial_scores=[
                EditorialScoreRead(
                    metric_key=item["metric_key"],
                    metric_label=item["metric_label"],
                    score=_float(item["score"]),
                    confidence=_float(item["confidence"]),
                    benchmark_delta=_float(item["benchmark_delta"]),
                    evidence=item["evidence"],
                    action=item["action"],
                )
                for item in editorial
            ],
            region_scores=[
                RegionScoreRead(
                    region_key=item["region_key"],
                    region_label=item["region_label"],
                    network_key=item["network_key"],
                    score=_float(item["score"]),
                    mean_response=_float(item["mean_response"]),
                    peak_response=_float(item["peak_response"]),
                    evidence=item["evidence"],
                )
                for item in regions
            ],
            network_scores=[
                NetworkScoreRead(
                    network_key=item["network_key"],
                    network_label=item["network_label"],
                    score=_float(item["score"]),
                    confidence=_float(item["confidence"]),
                    evidence=item["evidence"],
                )
                for item in networks
            ],
            timecourse_points=[
                TimecoursePointRead(
                    point_index=item["point_index"],
                    bold_time_seconds=_float(item["bold_time_seconds"]),
                    stimulus_time_seconds=_float(item["stimulus_time_seconds"]),
                    global_response=_float(item["global_response"]),
                    normalized_response=_float(item["normalized_response"]),
                    event_label=item["event_label"],
                )
                for item in points
            ],
            peak_moments=[
                PeakMomentRead(
                    moment_type=item["moment_type"],
                    start_seconds=_float(item["start_seconds"]),
                    end_seconds=_float(item["end_seconds"]),
                    score=_float(item["score"]),
                    evidence=item["evidence"],
                    action=item["action"],
                )
                for item in moments
            ],
            created_at=row["created_at"],
        )

    def get_result(self, result_id: UUID, user: CurrentUser) -> NeuroScoringRead | None:
        with connection() as conn:
            row = conn.execute(
                """
                select nsr.*, a.original_filename
                from public.neuro_scoring_results nsr
                join public.assets a on a.id = nsr.asset_id
                where nsr.id = %s
                """,
                (result_id,),
            ).fetchone()
            if not row:
                return None
            assert_org_member(conn, row["organization_id"], user)
            return self._read_result(conn, row)

    def list_run_results(self, analysis_run_id: UUID, user: CurrentUser) -> list[NeuroScoringRead]:
        with connection() as conn:
            run = require_row(
                conn.execute("select organization_id from public.analysis_runs where id = %s", (analysis_run_id,)).fetchone(),
                "Analysis run not found.",
            )
            assert_org_member(conn, run["organization_id"], user)
            rows = conn.execute(
                """
                select nsr.*, a.original_filename
                from public.neuro_scoring_results nsr
                join public.assets a on a.id = nsr.asset_id
                where nsr.analysis_run_id = %s
                order by nsr.created_at desc
                """,
                (analysis_run_id,),
            ).fetchall()
            return [self._read_result(conn, row) for row in rows]

    def list_experiment_results(self, experiment_id: UUID, user: CurrentUser) -> list[NeuroScoringRead]:
        with connection() as conn:
            experiment = require_row(
                conn.execute("select organization_id from public.experiments where id = %s", (experiment_id,)).fetchone(),
                "Experiment not found.",
            )
            assert_org_member(conn, experiment["organization_id"], user)
            rows = conn.execute(
                """
                select nsr.*, a.original_filename
                from public.neuro_scoring_results nsr
                join public.assets a on a.id = nsr.asset_id
                where nsr.experiment_id = %s
                order by nsr.created_at desc
                """,
                (experiment_id,),
            ).fetchall()
            return [self._read_result(conn, row) for row in rows]


scoring_db_repository = ScoringDbRepository()
