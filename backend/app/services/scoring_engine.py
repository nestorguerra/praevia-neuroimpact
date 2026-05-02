from __future__ import annotations

import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

EXPECTED_VERTICES = 20484
BOLD_DELAY_SECONDS = 4.5
TR_SECONDS = 1.49
SCORING_VERSION = "scoring-v0.2-real"

NETWORK_SLICES = {
    "visual": ("Visual salience network", slice(0, 3600)),
    "auditory": ("Auditory processing network", slice(3600, 6200)),
    "language": ("Language and semantic network", slice(6200, 9800)),
    "social": ("Social cognition network", slice(9800, 13200)),
    "control": ("Executive control network", slice(13200, 16800)),
    "motor": ("Action readiness network", slice(16800, EXPECTED_VERTICES)),
}

REGION_SLICES = {
    "v1_v2": ("Visual occipital", "visual", slice(0, 1800)),
    "ppa_scene": ("Scene / parahippocampal", "visual", slice(1800, 3600)),
    "stg": ("Superior temporal", "auditory", slice(3600, 5000)),
    "a1_a2": ("Primary auditory proxy", "auditory", slice(5000, 6200)),
    "ifg": ("Inferior frontal language", "language", slice(6200, 7800)),
    "mtg_semantic": ("Temporal semantic", "language", slice(7800, 9800)),
    "sts_tpj": ("STS / TPJ social", "social", slice(9800, 11400)),
    "ffa_social": ("Face/social cue proxy", "social", slice(11400, 13200)),
    "dlpfc": ("Prefrontal control", "control", slice(13200, 15000)),
    "acc_control": ("Cingulate control", "control", slice(15000, 16800)),
    "premotor": ("Premotor / action", "motor", slice(16800, 18600)),
    "motor_cue": ("Motor cue proxy", "motor", slice(18600, EXPECTED_VERTICES)),
}


@dataclass(frozen=True)
class InputQuality:
    label: str
    confidence: float
    evidence: list[str]


def _clip(value: float, low: float = 0, high: float = 100) -> float:
    return round(float(np.clip(value, low, high)), 1)


def _load_bold(npz_path: Path) -> np.ndarray:
    payload = np.load(npz_path, allow_pickle=False)
    key = "bold" if "bold" in payload.files else payload.files[0] if payload.files else ""
    if not key:
        raise ValueError("El artefacto NPZ no contiene arrays.")
    bold = np.asarray(payload[key], dtype="float32")
    if bold.ndim != 2:
        raise ValueError(f"bold_predictions debe ser 2D; recibido shape={bold.shape}.")
    if bold.shape[1] != EXPECTED_VERTICES:
        raise ValueError(f"vertices esperados={EXPECTED_VERTICES}; recibido={bold.shape[1]}.")
    if bold.shape[0] < 2:
        raise ValueError("TRIBE devolvio menos de 2 puntos temporales; no se puede calcular timeline.")
    if not np.isfinite(bold).all():
        raise ValueError("bold_predictions contiene NaN o infinitos.")
    return bold


def _score_from_signal(values: np.ndarray) -> float:
    percentile_75 = np.percentile(np.abs(values), 75)
    return _clip(100 * percentile_75 / (percentile_75 + 0.08))


def _normalize(values: np.ndarray) -> np.ndarray:
    low = float(np.min(values))
    high = float(np.max(values))
    if high - low < 1e-9:
        return np.full_like(values, 50.0, dtype=float)
    return 100 * (values - low) / (high - low)


def _quality(n_timesteps: int, n_vertices: int, asset_kind: str, derivative_types: set[str]) -> InputQuality:
    score = 0.52
    evidence = []
    if n_vertices == EXPECTED_VERTICES:
        score += 0.12
        evidence.append("shape fsaverage5 validada")
    if n_timesteps >= 24:
        score += 0.16
        evidence.append("duracion temporal suficiente")
    elif n_timesteps >= 10:
        score += 0.08
        evidence.append("duracion temporal aceptable")
    else:
        evidence.append("duracion temporal corta")
    if "transcript" in derivative_types or "normalized_text" in derivative_types:
        score += 0.06
        evidence.append("texto/transcript disponible")
    if "extracted_audio" in derivative_types:
        score += 0.05
        evidence.append("audio normalizado disponible")
    if asset_kind == "video" and "normalized_media" in derivative_types:
        score += 0.05
        evidence.append("video normalizado disponible")
    confidence = round(float(np.clip(score, 0.45, 0.92)), 2)
    if confidence >= 0.82:
        label = "alta"
    elif confidence >= 0.65:
        label = "media"
    else:
        label = "baja"
    return InputQuality(label=label, confidence=confidence, evidence=evidence)


def _network_scores(bold: np.ndarray, quality: InputQuality) -> list[dict[str, Any]]:
    scores = []
    for key, (label, vertex_slice) in NETWORK_SLICES.items():
        block = bold[:, vertex_slice]
        scores.append(
            {
                "network_key": key,
                "network_label": label,
                "score": _score_from_signal(block),
                "confidence": quality.confidence,
                "evidence": f"Score real desde bold_predictions.npz; vertices {vertex_slice.start}:{vertex_slice.stop}.",
            }
        )
    return scores


def _region_scores(bold: np.ndarray) -> list[dict[str, Any]]:
    scores = []
    for key, (label, network_key, vertex_slice) in REGION_SLICES.items():
        block = np.abs(bold[:, vertex_slice])
        scores.append(
            {
                "region_key": key,
                "region_label": label,
                "network_key": network_key,
                "score": _score_from_signal(block),
                "mean_response": round(float(np.mean(block)), 6),
                "peak_response": round(float(np.max(block)), 6),
                "evidence": f"ROI mapping v0.2 sobre prediccion real; vertices {vertex_slice.start}:{vertex_slice.stop}.",
            }
        )
    return scores


def _timecourse(bold: np.ndarray) -> list[dict[str, Any]]:
    global_signal = np.mean(np.abs(bold), axis=1)
    normalized = _normalize(global_signal)
    points = []
    for index, value in enumerate(normalized):
        event_label = "peak" if value >= 82 else "valley" if value <= 18 else None
        bold_time = round(index * TR_SECONDS, 3)
        points.append(
            {
                "point_index": index,
                "bold_time_seconds": bold_time,
                "stimulus_time_seconds": round(max(0, bold_time - BOLD_DELAY_SECONDS), 3),
                "global_response": round(float(global_signal[index]), 6),
                "normalized_response": round(float(value), 1),
                "event_label": event_label,
            }
        )
    return points


def _moment(points: list[dict[str, Any]], moment_type: str, point: dict[str, Any], action: str) -> dict[str, Any]:
    evidence = {
        "peak": "Mayor respuesta global normalizada tras correccion aproximada del retardo BOLD.",
        "valley": "Menor respuesta global normalizada; posible tramo debil frente al resto de la pieza.",
        "flat": "Tramo con baja diferencia local; util para detectar fatiga o falta de contraste.",
    }[moment_type]
    return {
        "moment_type": moment_type,
        "start_seconds": point["stimulus_time_seconds"],
        "end_seconds": round(point["stimulus_time_seconds"] + TR_SECONDS, 3),
        "score": point["normalized_response"],
        "evidence": evidence,
        "action": action,
    }


def _peak_moments(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sorted_points = sorted(points, key=lambda item: item["normalized_response"])
    valley = sorted_points[0]
    peak = sorted_points[-1]
    diffs = [
        (abs(points[index]["normalized_response"] - points[index - 1]["normalized_response"]), points[index])
        for index in range(1, len(points))
    ]
    flat = min(diffs, key=lambda item: item[0])[1] if diffs else sorted_points[len(sorted_points) // 2]
    return [
        _moment(points, "peak", peak, "Proteger este tramo como referencia de ritmo, cierre o refuerzo creativo."),
        _moment(points, "valley", valley, "Revisar entrada, plano, audio o carga verbal en este tramo antes de lanzar."),
        _moment(points, "flat", flat, "Introducir contraste visual, simplificar mensaje o ajustar sincronizacion multimodal."),
    ]


def _editorial_action(metric_key: str, score: float) -> str:
    if metric_key == "visual_salience" and score < 60:
        return "Refuerza plano, contraste o foco visual en los tramos valle."
    if metric_key == "semantic_load" and score > 70:
        return "Reduce densidad verbal y separa conceptos por tramo/timecode."
    if metric_key == "multimodal_coherence" and score < 65:
        return "Alinea cambio visual, locucion y claim alrededor del mismo timecode."
    if metric_key == "action_readiness" and score < 60:
        return "Acerca CTA, gesto, packshot o cierre al pico temporal detectado."
    if metric_key == "temporal_momentum" and score < 55:
        return "Recorta tramos planos o introduce variacion de ritmo entre valle y pico."
    return "Comparar contra benchmark interno y priorizar cambios con evidencia temporal."


def _editorial_scores(networks: list[dict[str, Any]], timeline: list[dict[str, Any]], quality: InputQuality) -> list[dict[str, Any]]:
    by_key = {item["network_key"]: item["score"] for item in networks}
    momentum = max(point["normalized_response"] for point in timeline) - min(point["normalized_response"] for point in timeline)
    metrics = {
        "nri": ("Neural Response Index", np.mean(list(by_key.values()))),
        "visual_salience": ("Visual Salience", by_key["visual"]),
        "narrative_clarity": ("Narrative Clarity", (by_key["language"] * 0.58 + by_key["control"] * 0.42)),
        "multimodal_coherence": ("Multimodal Coherence", (by_key["visual"] + by_key["auditory"] + by_key["language"]) / 3),
        "semantic_load": ("Semantic Load", 100 - by_key["language"] * 0.45),
        "social_cueing": ("Social Cueing", by_key["social"]),
        "scene_immersion": ("Scene Immersion", by_key["visual"] * 0.72 + by_key["control"] * 0.28),
        "action_readiness": ("Action Readiness", by_key["motor"]),
        "temporal_momentum": ("Temporal Momentum", momentum),
    }
    scores = []
    for key, (label, value) in metrics.items():
        score = _clip(value)
        scores.append(
            {
                "metric_key": key,
                "metric_label": label,
                "score": score,
                "confidence": quality.confidence,
                "benchmark_delta": round(score - 60, 1),
                "evidence": f"{label} calculado desde prediccion BOLD real y mapping v0.2.",
                "action": _editorial_action(key, score),
            }
        )
    return scores


def score_bold_npz_real(
    npz_path: Path,
    *,
    asset_kind: str,
    derivative_types: set[str],
    benchmark_label: str = "Sin benchmark cliente",
) -> dict[str, Any]:
    bold = _load_bold(npz_path)
    quality = _quality(bold.shape[0], bold.shape[1], asset_kind, derivative_types)
    networks = _network_scores(bold, quality)
    regions = _region_scores(bold)
    timeline = _timecourse(bold)
    moments = _peak_moments(timeline)
    editorial = _editorial_scores(networks, timeline, quality)
    nri = next(item["score"] for item in editorial if item["metric_key"] == "nri")
    return {
        "scoring_version": SCORING_VERSION,
        "bold_delay_seconds": BOLD_DELAY_SECONDS,
        "confidence_label": quality.label,
        "benchmark_label": benchmark_label,
        "summary": {
            "nri": nri,
            "confidence": quality.label,
            "benchmark": benchmark_label,
            "decision": "Scoring real calculado desde prediccion TRIBE. Usar como hipotesis editorial comparativa, no como medicion de audiencia real.",
            "n_timesteps": int(bold.shape[0]),
            "n_vertices": int(bold.shape[1]),
            "quality": round(quality.confidence, 2),
            "quality_evidence": "; ".join(quality.evidence),
        },
        "editorial_scores": editorial,
        "region_scores": regions,
        "network_scores": networks,
        "timecourse_points": timeline,
        "peak_moments": moments,
    }


def score_storage_npz(
    *,
    storage_service: Any,
    bucket: str,
    key: str,
    asset_kind: str,
    derivative_types: set[str],
) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="praevia-scoring-") as temp_dir:
        local_path = Path(temp_dir) / "bold_predictions.npz"
        storage_service.download_file(bucket=bucket, key=key, destination=local_path)
        return score_bold_npz_real(local_path, asset_kind=asset_kind, derivative_types=derivative_types)
