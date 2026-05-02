from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import numpy as np

from tribe_worker.schemas import TribeOutput, TribeRunSpec

EXPECTED_VERTICES = 20484


def _gpu_metrics() -> dict[str, Any]:
    try:
        import torch

        if not torch.cuda.is_available():
            return {"cuda_available": False, "gpu_vram_mb": 0.0, "gpu_name": None}
        device = torch.cuda.current_device()
        return {
            "cuda_available": True,
            "gpu_vram_mb": round(torch.cuda.max_memory_allocated(device) / (1024 * 1024), 2),
            "gpu_name": torch.cuda.get_device_name(device),
        }
    except Exception as exc:  # pragma: no cover - best effort metrics
        return {"cuda_available": False, "gpu_vram_mb": 0.0, "gpu_error": str(exc)}


def _load_pandas():
    try:
        import pandas as pd

        return pd
    except Exception:
        return None


def _write_segments(records: list[dict[str, Any]], output_path: Path) -> str:
    pd = _load_pandas()
    if pd is not None:
        try:
            pd.DataFrame(records).to_parquet(output_path)
            return "parquet"
        except Exception:
            pass
    output_path.write_text(json.dumps({"segments": records}, indent=2), encoding="utf-8")
    return "json_fallback"


def _segments_to_records(segments: Any, n_timesteps: int) -> list[dict[str, Any]]:
    pd = _load_pandas()
    if pd is not None and isinstance(segments, pd.DataFrame):
        return segments.to_dict(orient="records")
    if hasattr(segments, "to_dict"):
        try:
            records = segments.to_dict(orient="records")
            if isinstance(records, list):
                return records
        except Exception:
            pass
    if isinstance(segments, list):
        return segments
    return [{"time_index": index} for index in range(n_timesteps)]


def run_mock(spec: TribeRunSpec, output_dir: Path) -> TribeOutput:
    output_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(abs(hash(spec.run_id)) % (2**32))
    n_timesteps = 12
    bold = rng.normal(0, 0.05, size=(n_timesteps, EXPECTED_VERTICES)).astype("float32")
    segments = [
        {"time_index": index, "stimulus_time": round(index * 1.49, 3), "source": "mock_contract"}
        for index in range(n_timesteps)
    ]

    predictions_path = output_dir / "bold_predictions.npz"
    segments_path = output_dir / "segments.parquet"
    metrics_path = output_dir / "run_metrics.json"

    np.savez_compressed(predictions_path, bold=bold, mesh="fsaverage5", model_id=spec.model_id)
    segments_format = _write_segments(segments, segments_path)
    metrics = {
        "mode": "mock_contract",
        "run_id": spec.run_id,
        "asset_id": spec.asset_id,
        "model_id": spec.model_id,
        "n_timesteps": n_timesteps,
        "n_vertices": EXPECTED_VERTICES,
        "gpu_seconds": 0.0,
        "gpu_vram_mb": 0.0,
        "outputs": {
            "predictions": str(predictions_path),
            "segments": str(segments_path),
        },
        "segments_format": segments_format,
    }
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    return TribeOutput(predictions_path, segments_path, metrics_path, n_timesteps, EXPECTED_VERTICES, metrics)


def run_real(spec: TribeRunSpec, output_dir: Path) -> TribeOutput:
    output_dir.mkdir(parents=True, exist_ok=True)
    start = time.perf_counter()

    try:
        from tribev2.demo_utils import TribeModel
    except Exception as exc:  # pragma: no cover - depends on external package
        raise RuntimeError("No se pudo importar tribev2. Revisa el Docker build y la instalacion del repo oficial.") from exc

    model = TribeModel.from_pretrained(spec.model_id, cache_folder=spec.cache_dir)

    event_kwargs: dict[str, str] = {}
    if spec.inputs.video_path:
        event_kwargs["video_path"] = spec.inputs.video_path
    if spec.inputs.audio_path:
        event_kwargs["audio_path"] = spec.inputs.audio_path
    if spec.inputs.text_path:
        event_kwargs["text_path"] = spec.inputs.text_path
    if not event_kwargs:
        raise ValueError("El run spec no incluye video_path, audio_path ni text_path")

    events = model.get_events_dataframe(**event_kwargs)
    predictions, segments = model.predict(events=events)

    bold = np.asarray(predictions, dtype="float32")
    if bold.ndim != 2:
        raise ValueError(f"TRIBE devolvio una prediccion con shape inesperada: {bold.shape}")
    if bold.shape[1] != EXPECTED_VERTICES:
        raise ValueError(f"TRIBE devolvio {bold.shape[1]} vertices; esperados {EXPECTED_VERTICES}")

    segment_records = _segments_to_records(segments, bold.shape[0])

    predictions_path = output_dir / "bold_predictions.npz"
    segments_path = output_dir / "segments.parquet"
    metrics_path = output_dir / "run_metrics.json"

    np.savez_compressed(predictions_path, bold=bold, mesh="fsaverage5", model_id=spec.model_id)
    segments_format = _write_segments(segment_records, segments_path)

    elapsed = time.perf_counter() - start
    gpu = _gpu_metrics()
    metrics = {
        "mode": "real",
        "run_id": spec.run_id,
        "asset_id": spec.asset_id,
        "model_id": spec.model_id,
        "n_timesteps": int(bold.shape[0]),
        "n_vertices": int(bold.shape[1]),
        "duration_seconds": round(elapsed, 3),
        "gpu_seconds": round(elapsed, 3) if gpu.get("cuda_available") else 0.0,
        **gpu,
        "outputs": {
            "predictions": str(predictions_path),
            "segments": str(segments_path),
        },
        "segments_format": segments_format,
    }
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    return TribeOutput(predictions_path, segments_path, metrics_path, int(bold.shape[0]), int(bold.shape[1]), metrics)
