from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ScoreEvidence(BaseModel):
    confidence: float = Field(ge=0, le=1)
    benchmark_delta: float | None = None
    evidence: str
    action: str


class EditorialScoreRead(ScoreEvidence):
    metric_key: str
    metric_label: str
    score: float = Field(ge=0, le=100)


class RegionScoreRead(BaseModel):
    region_key: str
    region_label: str
    network_key: str
    score: float = Field(ge=0, le=100)
    mean_response: float
    peak_response: float
    evidence: str


class NetworkScoreRead(BaseModel):
    network_key: str
    network_label: str
    score: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    evidence: str


class TimecoursePointRead(BaseModel):
    point_index: int
    bold_time_seconds: float
    stimulus_time_seconds: float
    global_response: float
    normalized_response: float = Field(ge=0, le=100)
    event_label: str | None = None


class PeakMomentRead(BaseModel):
    moment_type: str
    start_seconds: float
    end_seconds: float
    score: float = Field(ge=0, le=100)
    evidence: str
    action: str


class NeuroScoringCreate(BaseModel):
    organization_id: UUID
    experiment_id: UUID
    asset_id: UUID
    analysis_run_id: UUID
    asset_name: str
    model_id: str = "facebook/tribev2"
    n_timesteps: int = 12
    n_vertices: int = 20484
    asset_kind: str = "video"


class NeuroScoringRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    experiment_id: UUID
    asset_id: UUID
    analysis_run_id: UUID
    asset_name: str
    model_id: str
    scoring_version: str = "scoring-v0.1"
    confidence_label: str
    benchmark_label: str
    bold_delay_seconds: float
    summary: dict[str, str | float | int]
    editorial_scores: list[EditorialScoreRead]
    region_scores: list[RegionScoreRead]
    network_scores: list[NetworkScoreRead]
    timecourse_points: list[TimecoursePointRead]
    peak_moments: list[PeakMomentRead]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _clip(value: float, low: float = 0, high: float = 100) -> float:
    return round(max(low, min(high, value)), 1)


def _confidence_label(n_timesteps: int, asset_kind: str) -> tuple[str, float]:
    if n_timesteps >= 24 and asset_kind in {"video", "audio"}:
        return "alta", 0.86
    if n_timesteps >= 10:
        return "media", 0.72
    return "baja", 0.55


def build_mock_scoring(payload: NeuroScoringCreate) -> NeuroScoringRead:
    result_id = uuid4()
    confidence_label, confidence = _confidence_label(payload.n_timesteps, payload.asset_kind)
    seed = sum(ord(char) for char in payload.asset_name) % 17
    base = 58 + seed
    network_scores = [
        NetworkScoreRead(network_key="visual", network_label="Visual salience network", score=_clip(base + 10), confidence=confidence, evidence="Respuesta alta en segmentos visuales del contrato TRIBE."),
        NetworkScoreRead(network_key="auditory", network_label="Auditory processing network", score=_clip(base - 2), confidence=confidence, evidence="Audio extraido y transcript disponibles como derivados."),
        NetworkScoreRead(network_key="language", network_label="Language and semantic network", score=_clip(base + 4), confidence=confidence - 0.04, evidence="Transcript mock/Whisper preparado; confianza subira con transcripcion real."),
        NetworkScoreRead(network_key="social", network_label="Social cognition network", score=_clip(base - 7), confidence=confidence - 0.08, evidence="No hay deteccion semantica fina de personas en scoring v0.1."),
        NetworkScoreRead(network_key="control", network_label="Executive control network", score=_clip(base + 1), confidence=confidence - 0.02, evidence="Densidad temporal moderada en el run."),
    ]
    region_scores = [
        RegionScoreRead(region_key="v1_v2", region_label="Visual occipital", network_key="visual", score=_clip(base + 12), mean_response=0.062, peak_response=0.141, evidence="Mayor energia cortical en el bloque visual."),
        RegionScoreRead(region_key="stg", region_label="Superior temporal", network_key="auditory", score=_clip(base - 1), mean_response=0.047, peak_response=0.109, evidence="Audio disponible, pendiente validacion real de pista."),
        RegionScoreRead(region_key="ifg", region_label="Inferior frontal language", network_key="language", score=_clip(base + 3), mean_response=0.051, peak_response=0.118, evidence="Transcript presente para alineacion semantica."),
        RegionScoreRead(region_key="sts_tpj", region_label="STS / TPJ social", network_key="social", score=_clip(base - 6), mean_response=0.039, peak_response=0.092, evidence="Senales sociales no calibradas aun."),
        RegionScoreRead(region_key="dlpfc", region_label="Prefrontal control", network_key="control", score=_clip(base), mean_response=0.044, peak_response=0.101, evidence="Patron compatible con control narrativo moderado."),
    ]
    values = [35, 48, 62, 76, 72, 58, 43, 51, 69, 83, 61, 46][: payload.n_timesteps]
    timecourse = [
        TimecoursePointRead(
            point_index=index,
            bold_time_seconds=round(index * 1.49, 2),
            stimulus_time_seconds=round(max(0, index * 1.49 - 4.5), 2),
            global_response=round(value / 100, 3),
            normalized_response=value,
            event_label="peak" if value >= 80 else "valley" if value <= 40 else None,
        )
        for index, value in enumerate(values)
    ]
    peak_moments = [
        PeakMomentRead(moment_type="peak", start_seconds=8.9, end_seconds=11.9, score=83, evidence="Pico global tras correccion BOLD aproximada.", action="Usar este tramo como referencia de ritmo o cierre."),
        PeakMomentRead(moment_type="valley", start_seconds=0.0, end_seconds=1.5, score=35, evidence="Arranque con respuesta baja.", action="Refuerza primer plano, claim o entrada sonora en los 2 primeros segundos."),
        PeakMomentRead(moment_type="flat", start_seconds=7.4, end_seconds=8.9, score=51, evidence="Tramo medio sin diferencial claro.", action="Introducir contraste visual o simplificar carga verbal."),
    ]
    metric_values = {
        "nri": _clip(base + 5),
        "visual_salience": _clip(base + 12),
        "narrative_clarity": _clip(base + 1),
        "multimodal_coherence": _clip(base + 3),
        "semantic_load": _clip(100 - (base - 6)),
        "social_cueing": _clip(base - 8),
        "scene_immersion": _clip(base + 6),
        "action_readiness": _clip(base - 2),
        "temporal_momentum": _clip(base + 4),
    }
    labels = {
        "nri": "Neural Response Index",
        "visual_salience": "Visual Salience",
        "narrative_clarity": "Narrative Clarity",
        "multimodal_coherence": "Multimodal Coherence",
        "semantic_load": "Semantic Load",
        "social_cueing": "Social Cueing",
        "scene_immersion": "Scene Immersion",
        "action_readiness": "Action Readiness",
        "temporal_momentum": "Temporal Momentum",
    }
    editorial_scores = [
        EditorialScoreRead(
            metric_key=key,
            metric_label=labels[key],
            score=value,
            confidence=confidence,
            benchmark_delta=round(value - 60, 1),
            evidence=f"{labels[key]} calculado desde redes y timecourse v0.1.",
            action="Revisar contra benchmark interno antes de tomar decision final.",
        )
        for key, value in metric_values.items()
    ]
    return NeuroScoringRead(
        id=result_id,
        organization_id=payload.organization_id,
        experiment_id=payload.experiment_id,
        asset_id=payload.asset_id,
        analysis_run_id=payload.analysis_run_id,
        asset_name=payload.asset_name,
        model_id=payload.model_id,
        confidence_label=confidence_label,
        benchmark_label="Demo baseline · sin benchmark cliente",
        bold_delay_seconds=4.5,
        summary={
            "nri": metric_values["nri"],
            "confidence": confidence_label,
            "benchmark": "Demo baseline",
            "decision": "Apto para scoring interno; requiere run TRIBE real para decision comercial.",
        },
        editorial_scores=editorial_scores,
        region_scores=region_scores,
        network_scores=network_scores,
        timecourse_points=timecourse,
        peak_moments=peak_moments,
    )

