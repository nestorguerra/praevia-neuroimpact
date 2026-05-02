from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.schemas.scoring import NeuroScoringRead

AssetSlot = Literal["A", "B", "C"]


class ComparisonCreate(BaseModel):
    organization_id: UUID
    experiment_id: UUID
    scoring_result_ids: list[UUID] = Field(min_length=2, max_length=3)
    slots: dict[str, AssetSlot] = Field(default_factory=dict)


class ComparisonItemRead(BaseModel):
    scoring_result_id: UUID
    asset_id: UUID
    asset_name: str
    slot: AssetSlot
    rank: int
    nri: float
    global_delta: float
    pipeline_mode: str | None = None
    run_status: str | None = None
    asset_kind: str | None = None
    duration_seconds: float | None = None
    n_timesteps: int | None = None
    n_vertices: int | None = None


class ComparisonMetricDeltaRead(BaseModel):
    metric_key: str
    metric_label: str
    winner_slot: AssetSlot
    values: dict[str, float]
    deltas: dict[str, float]
    category: str = "other"


class ComparisonTimepointRead(BaseModel):
    point_index: int
    timecode: str
    winner_slot: AssetSlot
    values: dict[str, float]
    margin: float = 0


class ComparisonMixSegmentRead(BaseModel):
    segment_key: str
    label: str
    timecode: str
    source_slot: AssetSlot
    reason: str
    action: str
    order_index: int
    impact: str = "medio"
    confidence: str = "media"


class ComparabilityIssueRead(BaseModel):
    severity: Literal["ok", "warning", "error"]
    label: str
    detail: str


class ComparisonRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    experiment_id: UUID
    status: Literal["ready", "needs_review", "failed"]
    title: str
    decision: str
    master_slot: AssetSlot
    items: list[ComparisonItemRead]
    metric_deltas: list[ComparisonMetricDeltaRead]
    timepoints: list[ComparisonTimepointRead]
    mix: list[ComparisonMixSegmentRead]
    comparability: list[ComparabilityIssueRead]
    winner_by_modality: dict[str, AssetSlot] = Field(default_factory=dict)
    report_payload: dict[str, object] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


SLOTS: list[AssetSlot] = ["A", "B", "C"]


def _format_time(seconds: float) -> str:
    safe = max(0, seconds)
    minutes = int(safe // 60)
    secs = int(round(safe % 60))
    return f"{minutes:02d}:{secs:02d}"


def _metric_value(result: NeuroScoringRead, metric_key: str) -> float:
    score = next((item for item in result.editorial_scores if item.metric_key == metric_key), None)
    return float(score.score if score else 0)


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0


def _category(metric_key: str) -> str:
    categories = {
        "nri": "global",
        "visual_salience": "visual",
        "narrative_clarity": "narrative",
        "multimodal_coherence": "modality",
        "semantic_load": "narrative",
        "social_cueing": "social",
        "scene_immersion": "visual",
        "action_readiness": "action",
        "temporal_momentum": "temporal",
    }
    return categories.get(metric_key, "other")


def _top_margin(values: dict[str, float], winner_slot: str) -> float:
    winner_value = values.get(winner_slot, 0)
    others = [value for slot, value in values.items() if slot != winner_slot]
    return round(winner_value - max(others, default=winner_value), 1)


def build_comparison(results: list[NeuroScoringRead], payload: ComparisonCreate) -> ComparisonRead:
    if not 2 <= len(results) <= 3:
        raise ValueError("Comparison requires two or three scoring results")
    if any(not result.timecourse_points for result in results):
        raise ValueError("All scoring results must include timecourse points")

    slots = {
        result.id: payload.slots.get(str(result.id), SLOTS[index])
        for index, result in enumerate(results)
    }
    ranked = sorted(results, key=lambda item: float(item.summary.get("nri", 0)), reverse=True)
    rank_by_id = {result.id: index + 1 for index, result in enumerate(ranked)}
    master = ranked[0]
    master_slot = slots[master.id]
    master_nri = float(master.summary.get("nri", 0))
    items = [
        ComparisonItemRead(
            scoring_result_id=result.id,
            asset_id=result.asset_id,
            asset_name=result.asset_name,
            slot=slots[result.id],
            rank=rank_by_id[result.id],
            nri=float(result.summary.get("nri", 0)),
            global_delta=round(float(result.summary.get("nri", 0)) - master_nri, 1),
        )
        for result in results
    ]
    metric_keys = [(score.metric_key, score.metric_label) for score in results[0].editorial_scores]
    metric_deltas: list[ComparisonMetricDeltaRead] = []
    for key, label in metric_keys:
        values = {slots[result.id]: _metric_value(result, key) for result in results}
        winner_slot = max(values.items(), key=lambda item: item[1])[0]
        winner_value = values[winner_slot]
        metric_deltas.append(
            ComparisonMetricDeltaRead(
                metric_key=key,
                metric_label=label,
                winner_slot=winner_slot,
                values=values,
                deltas={slot: round(value - winner_value, 1) for slot, value in values.items()},
                category=_category(key),
            )
        )
    winner_by_modality = {
        delta.category: delta.winner_slot
        for delta in metric_deltas
        if delta.category in {"global", "visual", "narrative", "modality", "social", "action", "temporal"}
    }

    max_points = max(len(result.timecourse_points) for result in results)
    timepoints: list[ComparisonTimepointRead] = []
    for index in range(max_points):
        values = {}
        for result in results:
            point = result.timecourse_points[min(index, len(result.timecourse_points) - 1)]
            values[slots[result.id]] = point.normalized_response
        winner_slot = max(values.items(), key=lambda item: item[1])[0]
        base_point = results[0].timecourse_points[min(index, len(results[0].timecourse_points) - 1)]
        timepoints.append(
            ComparisonTimepointRead(
                point_index=index,
                timecode=_format_time(base_point.stimulus_time_seconds),
                winner_slot=winner_slot,
                values=values,
                margin=_top_margin(values, winner_slot),
            )
        )

    def best_range(start: int, end: int) -> NeuroScoringRead:
        return max(
            results,
            key=lambda result: _avg([
                point.normalized_response
                for point in result.timecourse_points[start:end]
            ]),
        )

    first_end = min(max_points - 1, max(1, max_points // 3))
    middle_end = min(max_points - 1, max(first_end + 1, (max_points * 2) // 3))
    opening_index = min(first_end, max_points - 1)
    middle_index = min(middle_end, max_points - 1)
    visual_slot = next((delta.winner_slot for delta in metric_deltas if delta.metric_key == "visual_salience"), slots[best_range(0, first_end).id])
    action_slot = next((delta.winner_slot for delta in metric_deltas if delta.metric_key == "action_readiness"), slots[best_range(middle_end, max_points).id])
    middle_slot = slots[best_range(first_end, middle_end).id]
    lowest = min(timepoints, key=lambda point: point.values.get(master_slot, 100))
    mix = [
        ComparisonMixSegmentRead(segment_key="master", label="Master", timecode="Global", source_slot=master_slot, reason="Mejor NRI global.", action="Usar como estructura principal.", order_index=1, impact="alto", confidence="alta"),
        ComparisonMixSegmentRead(segment_key="opening", label="Apertura", timecode=f"00:00-{timepoints[opening_index].timecode}", source_slot=visual_slot, reason="Mejor score visual.", action=f"Importar arranque de Version {visual_slot}.", order_index=2, impact="medio", confidence="media"),
        ComparisonMixSegmentRead(segment_key="middle", label="Tramo medio", timecode=f"{timepoints[opening_index].timecode}-{timepoints[middle_index].timecode}", source_slot=middle_slot, reason="Mejor promedio temporal.", action=f"Usar Version {middle_slot} como donante de cuerpo.", order_index=3, impact="medio", confidence="media"),
        ComparisonMixSegmentRead(segment_key="closing", label="Cierre / CTA", timecode=f"{timepoints[middle_index].timecode}-{timepoints[-1].timecode}", source_slot=action_slot, reason="Mejor Action Readiness.", action=f"Sustituir cierre por Version {action_slot}.", order_index=4, impact="alto", confidence="media"),
        ComparisonMixSegmentRead(segment_key="cut", label="Recorte", timecode=lowest.timecode, source_slot=master_slot, reason="Valle relativo del master.", action="Recortar, reforzar claim o cambiar imagen.", order_index=5, impact="alto", confidence="media"),
    ]
    comparability = [
        ComparabilityIssueRead(severity="ok" if len(results) >= 2 else "error", label="Piezas", detail=f"{len(results)} versiones con scoring."),
        ComparabilityIssueRead(severity="ok", label="Formato", detail="Slots A/B/C preparados; validar canal real en produccion."),
        ComparabilityIssueRead(severity="ok" if max_points >= 10 else "warning", label="Duracion", detail=f"{max_points} puntos temporales comparados."),
    ]
    decision = f"Usar Version {master_slot} como master, cierre de Version {action_slot}, arranque de Version {visual_slot} y recortar {lowest.timecode}."
    report_payload = {
        "algorithm_version": "comparison-real-v0.1",
        "source": "scoring_results",
        "winner_global": master_slot,
        "winner_by_modality": winner_by_modality,
        "mix_recommendation": [segment.model_dump(mode="json") for segment in mix],
        "timepoints_compared": len(timepoints),
        "source_scoring_result_ids": [str(result.id) for result in results],
    }
    return ComparisonRead(
        organization_id=payload.organization_id,
        experiment_id=payload.experiment_id,
        status="ready" if all(issue.severity != "error" for issue in comparability) else "needs_review",
        title="Comparativa A/B/C" if len(results) == 3 else "Comparativa A/B",
        decision=decision,
        master_slot=master_slot,
        items=items,
        metric_deltas=metric_deltas,
        timepoints=timepoints,
        mix=mix,
        comparability=comparability,
        winner_by_modality=winner_by_modality,
        report_payload=report_payload,
    )
