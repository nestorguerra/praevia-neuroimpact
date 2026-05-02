from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection, jsonb, require_row
from app.schemas.comparisons import (
    ComparabilityIssueRead,
    ComparisonCreate,
    ComparisonItemRead,
    ComparisonMetricDeltaRead,
    ComparisonMixSegmentRead,
    ComparisonRead,
    ComparisonTimepointRead,
    build_comparison,
)
from app.schemas.scoring import NeuroScoringRead


EXPECTED_TRIBE_VERTICES = 20484
COMPARISON_ALGORITHM_VERSION = "comparison-real-v0.1"


def _float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _int(value: Any) -> int | None:
    if value is None:
        return None
    return int(value)


class ComparisonDbRepository:
    def create_comparison(self, results: list[NeuroScoringRead], payload: ComparisonCreate, user: CurrentUser) -> ComparisonRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            comparison = build_comparison(results, payload)
            real_context = self._real_context(conn, comparison, results)
            comparison = self._apply_real_context(comparison, real_context)
            conn.execute(
                """
                insert into public.comparison_runs (
                  id, organization_id, experiment_id, status, title, decision,
                  master_slot, comparability, report_payload, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    comparison.id,
                    comparison.organization_id,
                    comparison.experiment_id,
                    comparison.status,
                    comparison.title,
                    comparison.decision,
                    comparison.master_slot,
                    jsonb([item.model_dump(mode="json") for item in comparison.comparability]),
                    jsonb(comparison.report_payload),
                    user.id,
                ),
            )
            for item in comparison.items:
                conn.execute(
                    """
                    insert into public.comparison_items (
                      organization_id, comparison_id, scoring_result_id, asset_id, slot, rank, nri, global_delta
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        comparison.organization_id,
                        comparison.id,
                        item.scoring_result_id,
                        item.asset_id,
                        item.slot,
                        item.rank,
                        item.nri,
                        item.global_delta,
                    ),
                )
            for delta in comparison.metric_deltas:
                conn.execute(
                    """
                    insert into public.comparison_metric_deltas (
                      organization_id, comparison_id, metric_key, metric_label, winner_slot, values, deltas
                    )
                    values (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        comparison.organization_id,
                        comparison.id,
                        delta.metric_key,
                        delta.metric_label,
                        delta.winner_slot,
                        jsonb(delta.values),
                        jsonb(delta.deltas),
                    ),
                )
            for point in comparison.timepoints:
                conn.execute(
                    """
                    insert into public.comparison_timepoint_deltas (
                      organization_id, comparison_id, point_index, timecode, winner_slot, values
                    )
                    values (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        comparison.organization_id,
                        comparison.id,
                        point.point_index,
                        point.timecode,
                        point.winner_slot,
                        jsonb(point.values),
                    ),
                )
            for segment in comparison.mix:
                conn.execute(
                    """
                    insert into public.comparison_mix_segments (
                      organization_id, comparison_id, segment_key, label, timecode, source_slot,
                      reason, action, order_index
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        comparison.organization_id,
                        comparison.id,
                        segment.segment_key,
                        segment.label,
                        segment.timecode,
                        segment.source_slot,
                        segment.reason,
                        segment.action,
                        segment.order_index,
                    ),
                )
            conn.execute(
                """
                insert into public.usage_events (
                  organization_id, event_type, source_table, source_id, experiment_id,
                  comparison_id, credits_delta, estimated_cost_eur, metadata, created_by
                )
                values (%s, 'comparison_generation', 'comparison_runs', %s, %s, %s, 0.4, %s, %s, %s)
                """,
                (
                    comparison.organization_id,
                    comparison.id,
                    comparison.experiment_id,
                    comparison.id,
                    0.05,
                    jsonb(
                        {
                            "label": comparison.title,
                            "algorithm_version": COMPARISON_ALGORITHM_VERSION,
                            "status": comparison.status,
                            "master_slot": comparison.master_slot,
                            "source_mode": comparison.report_payload.get("source"),
                            "scoring_result_ids": [str(item.scoring_result_id) for item in comparison.items],
                        }
                    ),
                    user.id,
                ),
            )
            conn.commit()
            return comparison

    def _real_context(self, conn, comparison: ComparisonRead, results: list[NeuroScoringRead]) -> dict[str, Any]:
        result_ids = [result.id for result in results]
        placeholders = ", ".join(["%s"] * len(result_ids))
        rows = conn.execute(
            f"""
            select
              nsr.id as scoring_result_id,
              nsr.pipeline_mode,
              nsr.input_quality,
              nsr.n_timesteps as scoring_timesteps,
              nsr.n_vertices as scoring_vertices,
              nsr.source_prediction_artifact_id,
              nsr.scoring_version,
              ar.id as analysis_run_id,
              ar.status as run_status,
              ar.model_id,
              ar.model_revision,
              ar.n_timesteps as run_timesteps,
              ar.n_vertices as run_vertices,
              ar.gpu_seconds,
              ar.duration_seconds as run_duration_seconds,
              ar.completed_at,
              a.id as asset_id,
              a.kind as asset_kind,
              a.slot as asset_slot,
              a.original_filename,
              a.mime_type,
              a.byte_size,
              a.sha256,
              av.duration_seconds as asset_duration_seconds,
              av.width,
              av.height,
              av.fps,
              av.audio_present,
              av.language_guess,
              pa.storage_bucket as prediction_bucket,
              pa.storage_key as prediction_storage_key,
              pa.shape as prediction_shape
            from public.neuro_scoring_results nsr
            join public.analysis_runs ar on ar.id = nsr.analysis_run_id
            join public.assets a on a.id = nsr.asset_id
            left join lateral (
              select *
              from public.asset_versions latest_version
              where latest_version.asset_id = a.id
              order by latest_version.version desc
              limit 1
            ) av on true
            left join public.prediction_artifacts pa on pa.id = nsr.source_prediction_artifact_id
            where nsr.organization_id = %s
              and nsr.experiment_id = %s
              and nsr.id in ({placeholders})
            """,
            (comparison.organization_id, comparison.experiment_id, *result_ids),
        ).fetchall()
        context_by_result = {row["scoring_result_id"]: row for row in rows}
        source_runs = []
        for item in comparison.items:
            context = context_by_result.get(item.scoring_result_id)
            if not context:
                continue
            source_runs.append(
                {
                    "slot": item.slot,
                    "scoring_result_id": str(item.scoring_result_id),
                    "analysis_run_id": str(context["analysis_run_id"]),
                    "asset_id": str(context["asset_id"]),
                    "asset_name": context["original_filename"],
                    "asset_kind": context["asset_kind"],
                    "asset_slot": context["asset_slot"],
                    "pipeline_mode": context["pipeline_mode"],
                    "scoring_version": context["scoring_version"],
                    "run_status": context["run_status"],
                    "model_id": context["model_id"],
                    "model_revision": context["model_revision"],
                    "source_prediction_artifact_id": str(context["source_prediction_artifact_id"]) if context["source_prediction_artifact_id"] else None,
                    "prediction_storage_key": context["prediction_storage_key"],
                    "prediction_shape": context["prediction_shape"] or {},
                    "input_quality": _float(context["input_quality"]),
                    "n_timesteps": _int(context["scoring_timesteps"] or context["run_timesteps"]),
                    "n_vertices": _int(context["scoring_vertices"] or context["run_vertices"]),
                    "duration_seconds": _float(context["asset_duration_seconds"] or context["run_duration_seconds"]),
                    "gpu_seconds": _float(context["gpu_seconds"]),
                    "byte_size": _int(context["byte_size"]),
                    "sha256": context["sha256"],
                    "mime_type": context["mime_type"],
                    "width": _int(context["width"]),
                    "height": _int(context["height"]),
                    "fps": _float(context["fps"]),
                    "audio_present": context["audio_present"],
                    "language_guess": context["language_guess"],
                    "completed_at": context["completed_at"].isoformat() if context["completed_at"] else None,
                }
            )
        return {"rows": rows, "source_runs": source_runs}

    def _apply_real_context(self, comparison: ComparisonRead, real_context: dict[str, Any]) -> ComparisonRead:
        source_runs = real_context["source_runs"]
        source_by_slot = {item["slot"]: item for item in source_runs}
        issues = list(comparison.comparability)
        issues.extend(self._real_comparability(comparison, source_runs))

        if any(issue.severity == "error" for issue in issues):
            comparison.status = "failed"
        elif any(issue.severity == "warning" for issue in issues):
            comparison.status = "needs_review"
        else:
            comparison.status = "ready"

        comparison.items = [
            item.model_copy(
                update={
                    "pipeline_mode": source_by_slot.get(item.slot, {}).get("pipeline_mode"),
                    "run_status": source_by_slot.get(item.slot, {}).get("run_status"),
                    "asset_kind": source_by_slot.get(item.slot, {}).get("asset_kind"),
                    "duration_seconds": source_by_slot.get(item.slot, {}).get("duration_seconds"),
                    "n_timesteps": source_by_slot.get(item.slot, {}).get("n_timesteps"),
                    "n_vertices": source_by_slot.get(item.slot, {}).get("n_vertices"),
                }
            )
            for item in comparison.items
        ]
        comparison.comparability = issues
        comparison.report_payload = {
            **comparison.report_payload,
            "algorithm_version": COMPARISON_ALGORITHM_VERSION,
            "source": "real_scoring_db",
            "source_runs": source_runs,
            "comparability": [item.model_dump(mode="json") for item in issues],
            "winner_by_modality": comparison.winner_by_modality,
            "metric_categories": {item.metric_key: item.category for item in comparison.metric_deltas},
            "winner_by_time_window": [
                {
                    "point_index": point.point_index,
                    "timecode": point.timecode,
                    "winner_slot": point.winner_slot,
                    "margin": point.margin,
                }
                for point in comparison.timepoints
            ],
            "metric_deltas": [item.model_dump(mode="json") for item in comparison.metric_deltas],
            "status": comparison.status,
        }
        return comparison

    def _real_comparability(self, comparison: ComparisonRead, source_runs: list[dict[str, Any]]) -> list[ComparabilityIssueRead]:
        issues: list[ComparabilityIssueRead] = []
        expected = len(comparison.items)
        if len(source_runs) != expected:
            issues.append(
                ComparabilityIssueRead(
                    severity="error",
                    label="Trazabilidad real",
                    detail=f"Solo {len(source_runs)} de {expected} scoring results tienen run/asset asociado en DB.",
                )
            )
            return issues

        run_statuses = {item.get("run_status") for item in source_runs}
        issues.append(
            ComparabilityIssueRead(
                severity="ok" if run_statuses == {"done"} else "error",
                label="Runs TRIBE",
                detail="Todos los runs estan done." if run_statuses == {"done"} else f"Estados encontrados: {', '.join(sorted(str(item) for item in run_statuses))}.",
            )
        )

        modes = {item.get("pipeline_mode") for item in source_runs}
        issues.append(
            ComparabilityIssueRead(
                severity="ok" if modes == {"real_npz"} else "error",
                label="Prediccion real",
                detail="Todos los scorings vienen de bold_predictions.npz real." if modes == {"real_npz"} else f"Pipeline modes encontrados: {', '.join(sorted(str(item) for item in modes))}.",
            )
        )

        missing_artifacts = [item["slot"] for item in source_runs if not item.get("source_prediction_artifact_id")]
        issues.append(
            ComparabilityIssueRead(
                severity="ok" if not missing_artifacts else "error",
                label="Artefactos BOLD",
                detail="Cada version conserva source_prediction_artifact_id." if not missing_artifacts else f"Sin artefacto real en slots: {', '.join(missing_artifacts)}.",
            )
        )

        vertices = {item.get("n_vertices") for item in source_runs}
        issues.append(
            ComparabilityIssueRead(
                severity="ok" if vertices == {EXPECTED_TRIBE_VERTICES} else "error",
                label="Malla cortical",
                detail=f"fsaverage5 esperado: {EXPECTED_TRIBE_VERTICES} vertices." if vertices == {EXPECTED_TRIBE_VERTICES} else f"Vertices encontrados: {', '.join(sorted(str(item) for item in vertices))}.",
            )
        )

        model_ids = {item.get("model_id") for item in source_runs}
        issues.append(
            ComparabilityIssueRead(
                severity="ok" if len(model_ids) == 1 else "warning",
                label="Modelo",
                detail=f"Modelo unico: {next(iter(model_ids))}." if len(model_ids) == 1 else f"Modelos mezclados: {', '.join(sorted(str(item) for item in model_ids))}.",
            )
        )

        kinds = {item.get("asset_kind") for item in source_runs}
        issues.append(
            ComparabilityIssueRead(
                severity="ok" if len(kinds) == 1 else "warning",
                label="Tipo de asset",
                detail="Todas las versiones comparten tipo de asset." if len(kinds) == 1 else f"Tipos mezclados: {', '.join(sorted(str(item) for item in kinds))}.",
            )
        )

        durations = [item["duration_seconds"] for item in source_runs if item.get("duration_seconds") is not None]
        if len(durations) == expected:
            spread = max(durations) - min(durations)
            max_duration = max(durations) or 1
            issues.append(
                ComparabilityIssueRead(
                    severity="ok" if spread <= max(5, max_duration * 0.2) else "warning",
                    label="Duracion real",
                    detail=f"Duraciones {round(min(durations), 1)}-{round(max(durations), 1)}s; spread {round(spread, 1)}s.",
                )
            )
        else:
            issues.append(
                ComparabilityIssueRead(
                    severity="warning",
                    label="Duracion real",
                    detail="Faltan duraciones de asset/version para validar comparabilidad temporal.",
                )
            )

        timesteps = [item["n_timesteps"] for item in source_runs if item.get("n_timesteps") is not None]
        if len(timesteps) == expected:
            spread = max(timesteps) - min(timesteps)
            issues.append(
                ComparabilityIssueRead(
                    severity="ok" if spread <= max(3, int(max(timesteps) * 0.2)) else "warning",
                    label="Timesteps",
                    detail=f"Timesteps {min(timesteps)}-{max(timesteps)}; el timeline comparado usa alineacion por indice.",
                )
            )
        else:
            issues.append(
                ComparabilityIssueRead(
                    severity="warning",
                    label="Timesteps",
                    detail="Faltan timesteps persistidos para una validacion completa.",
                )
            )

        return issues

    def _read_comparison(self, conn, row) -> ComparisonRead:
        items = conn.execute(
            """
            select ci.*, a.original_filename
            from public.comparison_items ci
            join public.assets a on a.id = ci.asset_id
            where ci.comparison_id = %s
            order by ci.slot asc
            """,
            (row["id"],),
        ).fetchall()
        metric_deltas = conn.execute(
            "select * from public.comparison_metric_deltas where comparison_id = %s order by created_at asc",
            (row["id"],),
        ).fetchall()
        timepoints = conn.execute(
            "select * from public.comparison_timepoint_deltas where comparison_id = %s order by point_index asc",
            (row["id"],),
        ).fetchall()
        mix = conn.execute(
            "select * from public.comparison_mix_segments where comparison_id = %s order by order_index asc",
            (row["id"],),
        ).fetchall()
        report_payload = row["report_payload"] or {}
        source_by_slot = {
            item.get("slot"): item
            for item in report_payload.get("source_runs", [])
            if isinstance(item, dict)
        }
        return ComparisonRead(
            id=row["id"],
            organization_id=row["organization_id"],
            experiment_id=row["experiment_id"],
            status=row["status"],
            title=row["title"],
            decision=row["decision"],
            master_slot=row["master_slot"],
            items=[
                ComparisonItemRead(
                    scoring_result_id=item["scoring_result_id"],
                    asset_id=item["asset_id"],
                    asset_name=item["original_filename"],
                    slot=item["slot"],
                    rank=item["rank"],
                    nri=float(item["nri"]),
                    global_delta=float(item["global_delta"]),
                    pipeline_mode=source_by_slot.get(item["slot"], {}).get("pipeline_mode"),
                    run_status=source_by_slot.get(item["slot"], {}).get("run_status"),
                    asset_kind=source_by_slot.get(item["slot"], {}).get("asset_kind"),
                    duration_seconds=source_by_slot.get(item["slot"], {}).get("duration_seconds"),
                    n_timesteps=source_by_slot.get(item["slot"], {}).get("n_timesteps"),
                    n_vertices=source_by_slot.get(item["slot"], {}).get("n_vertices"),
                )
                for item in items
            ],
            metric_deltas=[
                ComparisonMetricDeltaRead(
                    metric_key=item["metric_key"],
                    metric_label=item["metric_label"],
                    winner_slot=item["winner_slot"],
                    values={key: float(value) for key, value in (item["values"] or {}).items()},
                    deltas={key: float(value) for key, value in (item["deltas"] or {}).items()},
                    category=(report_payload.get("metric_categories", {}) or {}).get(item["metric_key"], "other"),
                )
                for item in metric_deltas
            ],
            timepoints=[
                ComparisonTimepointRead(
                    point_index=item["point_index"],
                    timecode=item["timecode"],
                    winner_slot=item["winner_slot"],
                    values={key: float(value) for key, value in (item["values"] or {}).items()},
                    margin=next(
                        (
                            float(point.get("margin", 0))
                            for point in report_payload.get("winner_by_time_window", [])
                            if isinstance(point, dict) and point.get("point_index") == item["point_index"]
                        ),
                        0,
                    ),
                )
                for item in timepoints
            ],
            mix=[
                ComparisonMixSegmentRead(
                    segment_key=item["segment_key"],
                    label=item["label"],
                    timecode=item["timecode"],
                    source_slot=item["source_slot"],
                    reason=item["reason"],
                    action=item["action"],
                    order_index=item["order_index"],
                    impact=next(
                        (
                            segment.get("impact", "medio")
                            for segment in report_payload.get("mix_recommendation", [])
                            if isinstance(segment, dict) and segment.get("segment_key") == item["segment_key"]
                        ),
                        "medio",
                    ),
                    confidence=next(
                        (
                            segment.get("confidence", "media")
                            for segment in report_payload.get("mix_recommendation", [])
                            if isinstance(segment, dict) and segment.get("segment_key") == item["segment_key"]
                        ),
                        "media",
                    ),
                )
                for item in mix
            ],
            comparability=[ComparabilityIssueRead(**item) for item in (row["comparability"] or [])],
            winner_by_modality=report_payload.get("winner_by_modality", {}) or {},
            report_payload=report_payload,
            created_at=row["created_at"],
        )

    def get_comparison(self, comparison_id: UUID, user: CurrentUser) -> ComparisonRead | None:
        with connection() as conn:
            row = conn.execute("select * from public.comparison_runs where id = %s", (comparison_id,)).fetchone()
            if not row:
                return None
            assert_org_member(conn, row["organization_id"], user)
            return self._read_comparison(conn, row)

    def list_experiment_comparisons(self, experiment_id: UUID, user: CurrentUser) -> list[ComparisonRead]:
        with connection() as conn:
            experiment = require_row(
                conn.execute("select organization_id from public.experiments where id = %s", (experiment_id,)).fetchone(),
                "Experiment not found.",
            )
            assert_org_member(conn, experiment["organization_id"], user)
            rows = conn.execute(
                "select * from public.comparison_runs where experiment_id = %s order by created_at desc",
                (experiment_id,),
            ).fetchall()
            return [self._read_comparison(conn, row) for row in rows]


comparison_db_repository = ComparisonDbRepository()
