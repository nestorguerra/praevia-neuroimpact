from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

import numpy as np

from tribe_worker.schemas import TribeOutput, TribeRunSpec

EXPECTED_VERTICES = 20484


def _language_name(value: str | None) -> str:
    normalized = (value or "unknown").lower()
    return {
        "en": "english",
        "eng": "english",
        "english": "english",
        "es": "spanish",
        "spa": "spanish",
        "spanish": "spanish",
        "fr": "french",
        "fre": "french",
        "fra": "french",
        "french": "french",
        "nl": "dutch",
        "dut": "dutch",
        "nld": "dutch",
        "dutch": "dutch",
        "zh": "chinese",
        "zho": "chinese",
        "chinese": "chinese",
    }.get(normalized, "english")


def _detect_language(text: str) -> str:
    normalized = f" {text.lower()} "
    spanish = sum(normalized.count(token) for token in [" que ", " de ", " la ", " el ", " para ", " una ", " con ", " por "])
    english = sum(normalized.count(token) for token in [" the ", " and ", " for ", " with ", " this ", " that ", " from "])
    if spanish >= english and spanish > 0:
        return "spanish"
    if english > spanish:
        return "english"
    return "english"


def _read_text_segments(path: str) -> tuple[list[dict[str, Any]], str]:
    source = Path(path)
    raw = source.read_text(encoding="utf-8", errors="ignore")
    language = "english"
    try:
        payload = json.loads(raw)
    except Exception:
        payload = None

    if isinstance(payload, dict):
        language = _language_name(str(payload.get("language") or payload.get("detected_language") or ""))
        segments = payload.get("segments")
        if isinstance(segments, list) and segments:
            parsed = []
            for index, segment in enumerate(segments):
                text = str(segment.get("text") or "").strip()
                if not text:
                    continue
                start = float(segment.get("start") or 0.0)
                end = segment.get("end")
                duration = segment.get("duration")
                if end is not None:
                    segment_end = float(end)
                elif duration is not None:
                    segment_end = start + float(duration)
                else:
                    segment_end = start + max(1.2, len(text.split()) * 0.42)
                parsed.append({"start": start, "end": max(segment_end, start + 0.2), "text": text, "sequence_id": index})
            if parsed:
                return parsed, language
        if isinstance(payload.get("text"), str):
            raw = str(payload["text"])

    text = re.sub(r"\s+", " ", raw).strip()
    language = _detect_language(text)
    if not text:
        raise ValueError(f"Text file is empty: {source}")
    sentence_parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    if not sentence_parts:
        sentence_parts = [text]
    segments = []
    cursor = 0.0
    for index, sentence in enumerate(sentence_parts):
        duration = max(1.2, len(sentence.split()) * 0.42)
        segments.append({"start": cursor, "end": cursor + duration, "text": sentence, "sequence_id": index})
        cursor += duration + 0.08
    return segments, language


def _word_events_from_text(path: str) -> Any:
    pd = _load_pandas()
    if pd is None:
        raise RuntimeError("pandas no esta disponible para construir eventos de texto.")
    segments, language = _read_text_segments(path)
    records: list[dict[str, Any]] = []
    for segment_index, segment in enumerate(segments):
        sentence = str(segment["text"]).strip()
        words = re.findall(r"[\wÀ-ÿ]+(?:[-'][\wÀ-ÿ]+)?", sentence)
        if not words:
            continue
        start = float(segment["start"])
        end = float(segment["end"])
        step = max((end - start) / max(len(words), 1), 0.18)
        context = " ".join(str(item["text"]).strip() for item in segments[max(0, segment_index - 1) : segment_index + 2] if str(item.get("text") or "").strip())
        for word_index, word in enumerate(words):
            records.append(
                {
                    "type": "Word",
                    "text": word,
                    "start": round(start + word_index * step, 4),
                    "duration": round(max(step * 0.85, 0.12), 4),
                    "sequence_id": segment.get("sequence_id", segment_index),
                    "sentence": sentence,
                    "context": context or sentence,
                    "language": language,
                    "timeline": "default",
                    "subject": "default",
                }
            )
    if not records:
        raise ValueError(f"No se pudieron construir eventos Word desde {path}")
    return pd.DataFrame(records)


def _build_events_dataframe(model: Any, spec: TribeRunSpec) -> Any:
    from neuralset.events.utils import standardize_events
    from tribev2.demo_utils import get_audio_and_text_events

    pd = _load_pandas()
    if pd is None:
        raise RuntimeError("pandas no esta disponible para construir eventos TRIBE.")

    frames = []
    if spec.inputs.video_path:
        video_events = pd.DataFrame(
            [
                {
                    "type": "Video",
                    "filepath": spec.inputs.video_path,
                    "start": 0,
                    "timeline": "default",
                    "subject": "default",
                }
            ]
        )
        frames.append(get_audio_and_text_events(video_events, audio_only=True))
    elif spec.inputs.audio_path:
        audio_events = pd.DataFrame(
            [
                {
                    "type": "Audio",
                    "filepath": spec.inputs.audio_path,
                    "start": 0,
                    "timeline": "default",
                    "subject": "default",
                }
            ]
        )
        frames.append(get_audio_and_text_events(audio_events, audio_only=True))

    if spec.inputs.text_path:
        frames.append(_word_events_from_text(spec.inputs.text_path))

    if not frames:
        raise ValueError("El run spec no incluye video_path, audio_path ni text_path")

    events = pd.concat(frames, ignore_index=True, sort=False)
    return standardize_events(events)


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


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items() if not str(key).startswith("_")}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]
    if hasattr(value, "to_dict"):
        try:
            return _jsonable(value.to_dict())
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        try:
            return _jsonable({key: item for key, item in vars(value).items() if not key.startswith("_")})
        except Exception:
            pass
    return repr(value)


def _segment_to_record(segment: Any, index: int) -> dict[str, Any]:
    if isinstance(segment, dict):
        record = segment
    elif hasattr(segment, "to_dict"):
        try:
            record = segment.to_dict()
        except Exception:
            record = {}
    elif hasattr(segment, "__dict__"):
        record = {key: item for key, item in vars(segment).items() if not key.startswith("_")}
    else:
        record = {"segment": repr(segment)}
    payload = _jsonable(record)
    if not isinstance(payload, dict):
        payload = {"segment": payload}
    payload.setdefault("time_index", index)
    return payload


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
        return [_segment_to_record(segment, index) for index, segment in enumerate(segments)]
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

    events = _build_events_dataframe(model, spec)
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
