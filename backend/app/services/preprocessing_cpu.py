from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

from app.schemas.preprocessing import (
    AssetDerivativeRead,
    AssetPreprocessingInput,
    DerivativeType,
    PreprocessingStep,
    PreprocessingStepStatus,
)
from app.schemas.uploads import AssetKind
from app.services.storage import storage_service
from app.settings import settings


class CpuPreprocessingError(RuntimeError):
    pass


@dataclass(frozen=True)
class LocalDerivative:
    derivative_type: DerivativeType
    label: str
    path: Path
    mime_type: str
    metadata: dict[str, str | int | float | bool | None]


@dataclass(frozen=True)
class CpuPreprocessingResult:
    derivatives: list[AssetDerivativeRead]
    steps: list[PreprocessingStep]
    logs: list[str]


def _require_binary(name: str) -> str:
    binary = shutil.which(name)
    if not binary:
        raise CpuPreprocessingError(f"{name} no esta instalado en el worker CPU.")
    return binary


def _run(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=check, capture_output=True, text=True)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _detect_language(text: str) -> str:
    normalized = f" {text.lower()} "
    spanish = sum(normalized.count(token) for token in [" que ", " de ", " la ", " el ", " para ", " una ", " con ", " por "])
    english = sum(normalized.count(token) for token in [" the ", " and ", " for ", " with ", " this ", " that ", " from "])
    if spanish >= english and spanish > 0:
        return "es"
    if english > spanish:
        return "en"
    return "unknown"


def _seconds(value: str) -> float:
    if "," in value:
        value = value.replace(",", ".")
    parts = value.split(":")
    if len(parts) == 3:
        hours, minutes, seconds = parts
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    return float(value)


def _probe_media(input_path: Path, output_dir: Path) -> LocalDerivative:
    ffprobe = _require_binary("ffprobe")
    completed = _run([
        ffprobe,
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(input_path),
    ])
    output_path = output_dir / "metadata.ffprobe.json"
    output_path.write_text(completed.stdout, encoding="utf-8")
    metadata = json.loads(completed.stdout or "{}")
    streams = metadata.get("streams", [])
    video_stream = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
    audio_stream = next((stream for stream in streams if stream.get("codec_type") == "audio"), {})
    return LocalDerivative(
        derivative_type=DerivativeType.metadata,
        label=output_path.name,
        path=output_path,
        mime_type="application/json",
        metadata={
            "source": "ffprobe",
            "duration_seconds": _safe_float(metadata.get("format", {}).get("duration")),
            "width": video_stream.get("width"),
            "height": video_stream.get("height"),
            "fps": video_stream.get("avg_frame_rate"),
            "audio_present": bool(audio_stream),
            "audio_codec": audio_stream.get("codec_name"),
            "video_codec": video_stream.get("codec_name"),
        },
    )


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_video(input_path: Path, output_dir: Path) -> LocalDerivative:
    ffmpeg = _require_binary("ffmpeg")
    output_path = output_dir / "normalized_video.mp4"
    _run([
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        "scale='min(1280,iw)':-2,fps=24",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        str(output_path),
    ])
    return LocalDerivative(DerivativeType.normalized_media, output_path.name, output_path, "video/mp4", {"codec": "h264/aac", "target_fps": 24})


def _normalize_audio(input_path: Path, output_dir: Path, derivative_type: DerivativeType) -> LocalDerivative:
    ffmpeg = _require_binary("ffmpeg")
    output_path = output_dir / "audio_16k_mono.wav"
    _run([
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(output_path),
    ])
    return LocalDerivative(derivative_type, output_path.name, output_path, "audio/wav", {"sample_rate": 16000, "channels": 1})


def _detect_silence(audio_path: Path, output_dir: Path) -> LocalDerivative:
    ffmpeg = _require_binary("ffmpeg")
    completed = _run([
        ffmpeg,
        "-i",
        str(audio_path),
        "-af",
        "silencedetect=noise=-35dB:d=0.5",
        "-f",
        "null",
        "-",
    ], check=False)
    starts = re.findall(r"silence_start: ([0-9.]+)", completed.stderr)
    ends = re.findall(r"silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)", completed.stderr)
    silences = []
    total_silence = 0.0
    for index, start in enumerate(starts):
        end, duration = ends[index] if index < len(ends) else (None, None)
        duration_float = float(duration) if duration else 0.0
        total_silence += duration_float
        silences.append({
            "start": float(start),
            "end": float(end) if end else None,
            "duration": duration_float if duration else None,
        })
    output_path = output_dir / "silence_report.json"
    output_path.write_text(json.dumps({"silences": silences, "total_silence_seconds": round(total_silence, 3)}, indent=2), encoding="utf-8")
    return LocalDerivative(
        DerivativeType.silence_report,
        output_path.name,
        output_path,
        "application/json",
        {"method": "ffmpeg_silencedetect", "silence_count": len(silences), "total_silence_seconds": round(total_silence, 3)},
    )


def _parse_srt(input_path: Path, output_dir: Path) -> LocalDerivative:
    text = input_path.read_text(encoding="utf-8", errors="ignore")
    blocks = re.split(r"\n\s*\n", text.strip())
    pattern = re.compile(r"(?P<start>\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(?P<end>\d{2}:\d{2}:\d{2}[,.]\d{3})")
    segments: list[dict[str, str | float]] = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        match_index = next((index for index, line in enumerate(lines) if pattern.search(line)), None)
        if match_index is None:
            continue
        match = pattern.search(lines[match_index])
        if not match:
            continue
        content = " ".join(lines[match_index + 1 :])
        segments.append({
            "start": _seconds(match.group("start")),
            "end": _seconds(match.group("end")),
            "text": content,
        })
    language = _detect_language(" ".join(str(segment["text"]) for segment in segments))
    output_path = output_dir / "transcript.srt.json"
    output_path.write_text(json.dumps({"source": "srt", "language": language, "segments": segments}, indent=2, ensure_ascii=False), encoding="utf-8")
    return LocalDerivative(DerivativeType.transcript, output_path.name, output_path, "application/json", {"source": "srt", "language": language, "segment_count": len(segments)})


def _normalize_text(input_path: Path, output_dir: Path) -> LocalDerivative:
    text = input_path.read_text(encoding="utf-8", errors="ignore")
    normalized = re.sub(r"\s+", " ", text).strip()
    language = _detect_language(normalized)
    output_path = output_dir / "normalized_text.json"
    output_path.write_text(
        json.dumps({"text": normalized, "language": language, "word_count": len(normalized.split())}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return LocalDerivative(DerivativeType.normalized_text, output_path.name, output_path, "application/json", {"parser": input_path.suffix.lower().lstrip(".") or "text", "language": language, "word_count": len(normalized.split())})


def _transcribe_audio(audio_path: Path, output_dir: Path) -> LocalDerivative:
    output_path = output_dir / "transcript.whisper.json"
    if settings.whisper_provider != "local":
        payload = {"source": settings.whisper_provider, "status": "skipped", "segments": []}
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return LocalDerivative(DerivativeType.transcript, output_path.name, output_path, "application/json", {"source": settings.whisper_provider, "status": "skipped", "segment_count": 0})

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        payload = {
            "source": "faster-whisper",
            "status": "dependency_missing",
            "message": "Instala faster-whisper en el worker CPU para transcripcion real.",
            "segments": [],
        }
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return LocalDerivative(DerivativeType.transcript, output_path.name, output_path, "application/json", {"source": "faster-whisper", "status": "dependency_missing", "error": str(exc), "segment_count": 0})

    model = WhisperModel(settings.whisper_model, device=settings.whisper_device, compute_type=settings.whisper_compute_type)
    segments_iter, info = model.transcribe(str(audio_path), vad_filter=True)
    segments = [
        {"start": round(segment.start, 3), "end": round(segment.end, 3), "text": segment.text.strip()}
        for segment in segments_iter
        if segment.text.strip()
    ]
    payload = {
        "source": "faster-whisper",
        "model": settings.whisper_model,
        "language": info.language,
        "language_probability": round(float(info.language_probability or 0), 4),
        "segments": segments,
    }
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return LocalDerivative(DerivativeType.transcript, output_path.name, output_path, "application/json", {"source": "faster-whisper", "model": settings.whisper_model, "language": info.language, "segment_count": len(segments)})


def _build_local_derivatives(asset: AssetPreprocessingInput, source_path: Path, output_dir: Path, logs: list[str]) -> list[LocalDerivative]:
    derivatives: list[LocalDerivative] = []
    if asset.kind in {AssetKind.video, AssetKind.audio}:
        metadata = _probe_media(source_path, output_dir)
        derivatives.append(metadata)
        audio_present = bool(metadata.metadata.get("audio_present", asset.kind == AssetKind.audio))
        if asset.kind == AssetKind.video:
            derivatives.append(_normalize_video(source_path, output_dir))
            if audio_present:
                audio = _normalize_audio(source_path, output_dir, DerivativeType.extracted_audio)
                derivatives.append(audio)
                derivatives.append(_transcribe_audio(audio.path, output_dir))
                derivatives.append(_detect_silence(audio.path, output_dir))
            else:
                logs.append("video sin audio: transcript y silencio omitidos")
        else:
            audio = _normalize_audio(source_path, output_dir, DerivativeType.normalized_media)
            derivatives.append(audio)
            derivatives.append(_transcribe_audio(audio.path, output_dir))
            derivatives.append(_detect_silence(audio.path, output_dir))
        return derivatives

    if asset.kind == AssetKind.text:
        if source_path.suffix.lower() == ".srt" or asset.has_srt_timecodes:
            derivatives.append(_parse_srt(source_path, output_dir))
        derivatives.append(_normalize_text(source_path, output_dir))
        return derivatives

    raise CpuPreprocessingError(f"tipo de asset no soportado: {asset.kind}")


def run_local_cpu_preprocessing(
    *,
    asset: AssetPreprocessingInput,
    job_id: UUID,
    source_bucket: str,
    source_key: str,
) -> CpuPreprocessingResult:
    if not storage_service.is_configured:
        raise CpuPreprocessingError("Storage real no configurado; el worker CPU necesita leer y escribir S3/R2.")

    logs = [
        f"worker=local_cpu",
        f"asset={asset.file_name}",
        f"kind={asset.kind.value}",
        f"source={source_bucket}/{source_key}",
    ]
    steps: list[PreprocessingStep] = []
    with tempfile.TemporaryDirectory(prefix=f"preprocess-{asset.asset_id}-", dir=settings.preprocessing_temp_dir if Path(settings.preprocessing_temp_dir).exists() else None) as temp_dir:
        root = Path(temp_dir)
        source_path = root / "source" / Path(asset.file_name).name
        output_dir = root / "derived"
        output_dir.mkdir(parents=True, exist_ok=True)
        steps.append(PreprocessingStep(label="storage download", status=PreprocessingStepStatus.running, message="Descargando original desde storage."))
        storage_service.download_file(bucket=source_bucket, key=source_key, destination=source_path)
        steps[-1] = PreprocessingStep(label="storage download", status=PreprocessingStepStatus.completed, message="Original descargado.")

        steps.append(PreprocessingStep(label="cpu preprocessing", status=PreprocessingStepStatus.running, message="Normalizando asset y extrayendo derivados."))
        local_derivatives = _build_local_derivatives(asset, source_path, output_dir, logs)
        steps[-1] = PreprocessingStep(label="cpu preprocessing", status=PreprocessingStepStatus.completed, message=f"{len(local_derivatives)} derivados locales creados.")

        steps.append(PreprocessingStep(label="storage upload", status=PreprocessingStepStatus.running, message="Subiendo derivados a storage."))
        remote_derivatives: list[AssetDerivativeRead] = []
        base_key = f"{settings.app_env}/derived/org/{asset.organization_id}/experiment/{asset.experiment_id}/asset/{asset.asset_id}/job/{job_id}"
        for derivative in local_derivatives:
            storage_key = f"{base_key}/{derivative.label}"
            digest = _sha256(derivative.path)
            head = storage_service.upload_file(
                bucket=storage_service.bucket,
                key=storage_key,
                source=derivative.path,
                content_type=derivative.mime_type,
                metadata={
                    "asset-id": str(asset.asset_id),
                    "preprocessing-job-id": str(job_id),
                    "derivative-type": derivative.derivative_type.value,
                    "sha256": digest,
                },
            )
            remote_derivatives.append(
                AssetDerivativeRead(
                    asset_id=asset.asset_id,
                    preprocessing_job_id=job_id,
                    derivative_type=derivative.derivative_type,
                    label=derivative.label,
                    storage_bucket=head.bucket,
                    storage_key=head.key,
                    mime_type=head.content_type,
                    metadata={
                        "label": derivative.label,
                        "byte_size": head.byte_size,
                        "sha256": digest,
                        **derivative.metadata,
                    },
                )
            )
        steps[-1] = PreprocessingStep(label="storage upload", status=PreprocessingStepStatus.completed, message="Derivados subidos a storage.")

    logs.append(f"derivatives={len(remote_derivatives)}")
    return CpuPreprocessingResult(derivatives=remote_derivatives, steps=steps, logs=logs)
