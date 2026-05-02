from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

EXPECTED_VERTICES = 20484
BOLD_DELAY_SECONDS = 4.5
TR_SECONDS = 1.49

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
    "ifg": ("Inferior frontal language", "language", slice(6200, 7800)),
    "sts_tpj": ("STS / TPJ social", "social", slice(9800, 11400)),
    "dlpfc": ("Prefrontal control", "control", slice(13200, 15000)),
    "premotor": ("Premotor / action", "motor", slice(16800, 18600)),
}


@dataclass
class ScoringOutput:
    result: dict[str, Any]

    def write(self, path: Path) -> None:
        path.write_text(json.dumps(self.result, indent=2, ensure_ascii=False), encoding="utf-8")


def _score_from_signal(values: np.ndarray) -> float:
    percentile = np.percentile(np.abs(values), 75)
    return float(np.clip(100 * percentile / (percentile + 0.08), 0, 100))


def _normalize(values: np.ndarray) -> np.ndarray:
    low = float(np.min(values))
    high = float(np.max(values))
    if high - low < 1e-9:
        return np.full_like(values, 50.0, dtype=float)
    return 100 * (values - low) / (high - low)


def _confidence(n_timesteps: int, n_vertices: int) -> tuple[str, float]:
    if n_vertices == EXPECTED_VERTICES and n_timesteps >= 24:
        return "alta", 0.86
    if n_vertices == EXPECTED_VERTICES and n_timesteps >= 10:
        return "media", 0.72
    return "baja", 0.55


def _network_scores(bold: np.ndarray, confidence: float) -> list[dict[str, Any]]:
    scores = []
    for key, (label, vertex_slice) in NETWORK_SLICES.items():
        block = bold[:, vertex_slice]
        score = _score_from_signal(block)
        scores.append(
            {
                "network_key": key,
                "network_label": label,
                "score": round(score, 1),
                "confidence": round(confidence, 2),
                "evidence": f"Score v0.1 calculado sobre vertices {vertex_slice.start}:{vertex_slice.stop}.",
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
                "score": round(_score_from_signal(block), 1),
                "mean_response": round(float(np.mean(block)), 5),
                "peak_response": round(float(np.max(block)), 5),
                "evidence": f"ROI proxy v0.1 sobre vertices {vertex_slice.start}:{vertex_slice.stop}.",
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


def _peak_moments(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sorted_points = sorted(points, key=lambda item: item["normalized_response"])
    valley = sorted_points[0]
    peak = sorted_points[-1]
    median = sorted_points[len(sorted_points) // 2]
    return [
        {
            "moment_type": "peak",
            "start_seconds": peak["stimulus_time_seconds"],
            "end_seconds": round(peak["stimulus_time_seconds"] + TR_SECONDS, 3),
            "score": peak["normalized_response"],
            "evidence": "Punto temporal con mayor respuesta global normalizada tras correccion BOLD.",
            "action": "Usar este tramo como referencia para ritmo, cierre o refuerzo creativo.",
        },
        {
            "moment_type": "valley",
            "start_seconds": valley["stimulus_time_seconds"],
            "end_seconds": round(valley["stimulus_time_seconds"] + TR_SECONDS, 3),
            "score": valley["normalized_response"],
            "evidence": "Punto temporal con menor respuesta global normalizada.",
            "action": "Revisar si hay entrada plana, exceso verbal o baja saliencia visual.",
        },
        {
            "moment_type": "flat",
            "start_seconds": median["stimulus_time_seconds"],
            "end_seconds": round(median["stimulus_time_seconds"] + TR_SECONDS, 3),
            "score": median["normalized_response"],
            "evidence": "Tramo medio sin diferencial claro frente a picos y valles.",
            "action": "Introducir contraste, simplificar mensaje o ajustar sincronia multimodal.",
        },
    ]


def _editorial_scores(networks: list[dict[str, Any]], confidence: float) -> list[dict[str, Any]]:
    by_key = {item["network_key"]: item["score"] for item in networks}
    metrics = {
        "nri": ("Neural Response Index", np.mean(list(by_key.values()))),
        "visual_salience": ("Visual Salience", by_key["visual"]),
        "narrative_clarity": ("Narrative Clarity", (by_key["language"] + by_key["control"]) / 2),
        "multimodal_coherence": ("Multimodal Coherence", (by_key["visual"] + by_key["auditory"] + by_key["language"]) / 3),
        "semantic_load": ("Semantic Load", 100 - by_key["language"] * 0.45),
        "social_cueing": ("Social Cueing", by_key["social"]),
        "scene_immersion": ("Scene Immersion", (by_key["visual"] * 0.7 + by_key["control"] * 0.3)),
        "action_readiness": ("Action Readiness", by_key["motor"]),
        "temporal_momentum": ("Temporal Momentum", (max(by_key.values()) - min(by_key.values())) + 45),
    }
    return [
        {
            "metric_key": key,
            "metric_label": label,
            "score": round(float(np.clip(value, 0, 100)), 1),
            "confidence": round(confidence, 2),
            "benchmark_delta": round(float(value - 60), 1),
            "evidence": f"{label} derivado de network scores v0.1.",
            "action": "Comparar contra benchmark interno antes de convertirlo en decision creativa.",
        }
        for key, (label, value) in metrics.items()
    ]


def score_bold_npz(npz_path: Path, output_path: Path | None = None) -> ScoringOutput:
    payload = np.load(npz_path)
    bold = payload["bold"].astype("float32")
    if bold.ndim != 2:
        raise ValueError(f"bold debe ser 2D, recibido shape={bold.shape}")
    if bold.shape[1] != EXPECTED_VERTICES:
        raise ValueError(f"vertices esperados={EXPECTED_VERTICES}, recibido={bold.shape[1]}")

    confidence_label, confidence = _confidence(bold.shape[0], bold.shape[1])
    networks = _network_scores(bold, confidence)
    regions = _region_scores(bold)
    timeline = _timecourse(bold)
    peaks = _peak_moments(timeline)
    editorial = _editorial_scores(networks, confidence)
    nri = next(item["score"] for item in editorial if item["metric_key"] == "nri")

    result = {
        "scoring_version": "scoring-v0.1",
        "bold_delay_seconds": BOLD_DELAY_SECONDS,
        "confidence_label": confidence_label,
        "benchmark_label": "demo baseline",
        "summary": {
            "nri": nri,
            "confidence": confidence_label,
            "decision": "Resultado interno generado. Requiere benchmark real antes de decision comercial.",
        },
        "editorial_scores": editorial,
        "region_scores": regions,
        "network_scores": networks,
        "timecourse_points": timeline,
        "peak_moments": peaks,
    }
    output = ScoringOutput(result)
    if output_path:
        output.write(output_path)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Score TRIBE BOLD prediction artifact")
    parser.add_argument("--npz", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = score_bold_npz(Path(args.npz), Path(args.output))
    print(json.dumps(output.result["summary"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

