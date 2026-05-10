from __future__ import annotations

import hashlib
import json
import os
import tempfile
import traceback
import urllib.request
from pathlib import Path
from typing import Any

from storage_client import download_s3_object, upload_s3_object
from tribe_worker.runner import run_mock, run_real
from tribe_worker.schemas import TribeRunSpec


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def _text_from_json(path: Path, output_path: Path) -> Path:
    try:
        payload = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return path
    if isinstance(payload, dict) and isinstance(payload.get("segments"), list):
        text = "\n".join(str(segment.get("text", "")).strip() for segment in payload["segments"] if str(segment.get("text", "")).strip())
    elif isinstance(payload, dict) and payload.get("text"):
        text = str(payload["text"])
    else:
        text = path.read_text(encoding="utf-8", errors="ignore")
    output_path.write_text(text, encoding="utf-8")
    return output_path


def _assign_input_path(derivative: dict[str, Any], local_path: Path, text_output: Path) -> tuple[str, str] | None:
    label = str(derivative.get("label") or local_path.name)
    derivative_type = str(derivative.get("derivative_type") or "")
    if label == "normalized_video.mp4":
        return "video_path", str(local_path)
    if label == "audio_16k_mono.wav":
        return "audio_path", str(local_path)
    if derivative_type == "transcript" or label.startswith("transcript"):
        return "text_path", str(local_path)
    if derivative_type == "normalized_text" or label == "normalized_text.json":
        return "text_path", str(_text_from_json(local_path, text_output))
    return None


def _artifact_type(path: Path) -> str:
    if path.name == "bold_predictions.npz":
        return "bold_npz"
    if path.name == "segments.parquet":
        return "segments_parquet"
    return "metrics_json"


def _mime_type(path: Path) -> str:
    if path.suffix == ".json":
        return "application/json"
    if path.suffix == ".parquet":
        return "application/vnd.apache.parquet"
    return "application/octet-stream"


def _callback(payload: dict[str, Any], callback_url: str | None) -> None:
    if not callback_url:
        return
    secret = os.getenv("TRIBE_CALLBACK_SECRET", "")
    request = urllib.request.Request(
        callback_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-TRIBE-CALLBACK-SECRET": secret,
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read()


def _run(input_payload: dict[str, Any]) -> dict[str, Any]:
    run_id = str(input_payload["run_id"])
    asset_id = str(input_payload["asset_id"])
    organization_id = str(input_payload["organization_id"])
    source_bucket = str(input_payload.get("source_bucket") or os.getenv("S3_BUCKET", ""))
    output_bucket = str(input_payload.get("output_bucket") or source_bucket)
    output_prefix = str(input_payload["output_prefix"]).rstrip("/")
    callback_url = input_payload.get("callback_url")
    derivatives = list(input_payload.get("derivatives") or [])
    logs = [f"run_id={run_id}", f"asset_id={asset_id}", f"derivatives={len(derivatives)}"]

    with tempfile.TemporaryDirectory(prefix=f"tribe-{run_id}-") as temp_dir:
        root = Path(temp_dir)
        input_dir = root / "inputs"
        output_dir = root / "outputs"
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        input_paths: dict[str, str] = {}
        for derivative in derivatives:
            key = str(derivative.get("storage_key") or "")
            bucket = str(derivative.get("storage_bucket") or source_bucket)
            label = str(derivative.get("label") or Path(key).name)
            local_path = input_dir / label
            download_s3_object(bucket, key, local_path)
            assigned = _assign_input_path(derivative, local_path, input_dir / "tribe_text_input.txt")
            if assigned:
                input_paths[assigned[0]] = assigned[1]
        if not input_paths:
            raise RuntimeError("No hay derivados compatibles para TRIBE.")

        spec = TribeRunSpec.from_dict(
            {
                "run_id": run_id,
                "asset_id": asset_id,
                "model_id": input_payload.get("model_id", os.getenv("TRIBE_MODEL_ID", "facebook/tribev2")),
                "cache_dir": input_payload.get("cache_dir", os.getenv("MODEL_CACHE_DIR", "/models/tribe")),
                "device": "cuda",
                "inputs": input_paths,
            }
        )
        mock = bool(input_payload.get("mock") or os.getenv("TRIBE_MOCK", "").lower() == "true")
        output = run_mock(spec, output_dir) if mock else run_real(spec, output_dir)
        paths = [output.predictions_path, output.segments_path, output.metrics_path]
        artifacts = []
        for path in paths:
            key = f"{output_prefix}/{path.name}"
            upload_s3_object(output_bucket, key, path, _mime_type(path))
            byte_size = path.stat().st_size
            artifact_metadata = {"worker": os.getenv("GPU_PROVIDER", "runpod_serverless"), "mode": output.metrics.get("mode", "real")}
            shape: dict[str, int | str | float | None] = {}
            if path.name == "bold_predictions.npz":
                shape = {"n_timesteps": output.n_timesteps, "n_vertices": output.n_vertices, "mesh": "fsaverage5"}
                artifact_metadata["dtype"] = "float32"
            if path.name == "segments.parquet":
                shape = {"rows": output.n_timesteps}
            artifacts.append(
                {
                    "artifact_type": _artifact_type(path),
                    "storage_bucket": output_bucket,
                    "storage_key": key,
                    "mime_type": _mime_type(path),
                    "byte_size": byte_size,
                    "sha256": _sha256(path),
                    "shape": shape,
                    "metadata": artifact_metadata,
                }
            )
        logs.extend([f"uploaded={item['storage_key']}" for item in artifacts])
        payload = {
            "run_id": run_id,
            "asset_id": asset_id,
            "organization_id": organization_id,
            "status": "done",
            "provider_job_id": os.getenv("RUNPOD_JOB_ID") or input_payload.get("provider_job_id"),
            "n_timesteps": output.n_timesteps,
            "n_vertices": output.n_vertices,
            "gpu_seconds": output.metrics.get("gpu_seconds", 0.0),
            "gpu_vram_mb": output.metrics.get("gpu_vram_mb", 0.0),
            "duration_seconds": output.metrics.get("duration_seconds", 0.0),
            "logs": logs,
            "artifacts": artifacts,
        }
        _callback(payload, callback_url)
        return payload


def handler(event: dict[str, Any]) -> dict[str, Any]:
    input_payload = event.get("input") or event
    try:
        return _run(input_payload)
    except Exception as exc:
        failure = {
            "run_id": str(input_payload.get("run_id", "")),
            "asset_id": str(input_payload.get("asset_id", "")),
            "organization_id": str(input_payload.get("organization_id", "")),
            "status": "failed",
            "provider_job_id": os.getenv("RUNPOD_JOB_ID") or input_payload.get("provider_job_id"),
            "error_message": str(exc),
            "logs": ["worker_failed", traceback.format_exc(limit=8)],
            "artifacts": [],
        }
        try:
            _callback(failure, input_payload.get("callback_url"))
        finally:
            return failure


def main() -> None:
    import runpod

    runpod.serverless.start({"handler": handler})


if __name__ == "__main__":
    main()
