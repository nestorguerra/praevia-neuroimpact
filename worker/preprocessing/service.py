from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from storage_client import download_s3_object, upload_s3_object


class PreprocessingError(RuntimeError):
    pass


@dataclass
class Derivative:
    derivative_type: str
    path: str
    mime_type: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PreprocessingResult:
    input_path: str
    kind: str
    derivatives: list[Derivative]
    logs: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "input_path": self.input_path,
            "kind": self.kind,
            "derivatives": [
                {
                    "derivative_type": item.derivative_type,
                    "path": item.path,
                    "mime_type": item.mime_type,
                    "metadata": item.metadata,
                }
                for item in self.derivatives
            ],
            "logs": self.logs,
        }


def require_binary(name: str) -> str:
    binary = shutil.which(name)
    if not binary:
        raise PreprocessingError(f"{name} no esta instalado o no esta en PATH")
    return binary


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=True, capture_output=True, text=True)


def probe_media(input_path: Path, output_dir: Path) -> Derivative:
    ffprobe = require_binary("ffprobe")
    completed = run_command(
        [
            ffprobe,
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(input_path),
        ]
    )
    output_path = output_dir / "metadata.ffprobe.json"
    output_path.write_text(completed.stdout, encoding="utf-8")
    metadata = json.loads(completed.stdout or "{}")
    return Derivative("metadata", str(output_path), "application/json", summarize_probe(metadata))


def summarize_probe(metadata: dict[str, Any]) -> dict[str, Any]:
    streams = metadata.get("streams", [])
    video_stream = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
    audio_stream = next((stream for stream in streams if stream.get("codec_type") == "audio"), {})
    return {
        "duration": metadata.get("format", {}).get("duration"),
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "fps": video_stream.get("avg_frame_rate"),
        "audio_present": bool(audio_stream),
        "audio_codec": audio_stream.get("codec_name"),
        "video_codec": video_stream.get("codec_name"),
    }


def normalize_video(input_path: Path, output_dir: Path) -> Derivative:
    ffmpeg = require_binary("ffmpeg")
    output_path = output_dir / "normalized_video.mp4"
    run_command(
        [
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
        ]
    )
    return Derivative("normalized_media", str(output_path), "video/mp4", {"target_fps": 24, "codec": "h264/aac"})


def normalize_audio(input_path: Path, output_dir: Path, name: str = "audio_16k_mono.wav") -> Derivative:
    ffmpeg = require_binary("ffmpeg")
    output_path = output_dir / name
    run_command(
        [
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
        ]
    )
    return Derivative("extracted_audio" if input_path.suffix.lower() not in {".wav", ".mp3", ".flac", ".ogg", ".m4a"} else "normalized_media", str(output_path), "audio/wav", {"sample_rate": 16000, "channels": 1})


def detect_silence(input_path: Path, output_dir: Path) -> Derivative:
    ffmpeg = require_binary("ffmpeg")
    output_path = output_dir / "silence_report.json"
    completed = subprocess.run(
        [
            ffmpeg,
            "-i",
            str(input_path),
            "-af",
            "silencedetect=noise=-35dB:d=0.5",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    silences = []
    starts = re.findall(r"silence_start: ([0-9.]+)", completed.stderr)
    ends = re.findall(r"silence_end: ([0-9.]+) \\| silence_duration: ([0-9.]+)", completed.stderr)
    for index, start in enumerate(starts):
        end, duration = ends[index] if index < len(ends) else (None, None)
        silences.append({"start": float(start), "end": float(end) if end else None, "duration": float(duration) if duration else None})
    output_path.write_text(json.dumps({"silences": silences}, indent=2), encoding="utf-8")
    return Derivative("silence_report", str(output_path), "application/json", {"silence_count": len(silences)})


def parse_srt(input_path: Path, output_dir: Path) -> Derivative:
    text = input_path.read_text(encoding="utf-8", errors="ignore")
    blocks = re.split(r"\n\s*\n", text.strip())
    segments = []
    pattern = re.compile(r"(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(?P<end>\d{2}:\d{2}:\d{2},\d{3})")
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        match_index = next((index for index, line in enumerate(lines) if pattern.search(line)), None)
        if match_index is None:
            continue
        match = pattern.search(lines[match_index])
        if not match:
            continue
        content = " ".join(lines[match_index + 1 :])
        segments.append({"start": match.group("start"), "end": match.group("end"), "text": content})
    language = detect_language(" ".join(segment["text"] for segment in segments))
    output_path = output_dir / "transcript.srt.json"
    output_path.write_text(json.dumps({"source": "srt", "language": language, "segments": segments}, indent=2, ensure_ascii=False), encoding="utf-8")
    return Derivative("transcript", str(output_path), "application/json", {"parser": "srt", "language": language, "segment_count": len(segments)})


def normalize_text(input_path: Path, output_dir: Path) -> Derivative:
    text = input_path.read_text(encoding="utf-8", errors="ignore")
    normalized = re.sub(r"\s+", " ", text).strip()
    language = detect_language(normalized)
    output_path = output_dir / "normalized_text.json"
    output_path.write_text(json.dumps({"text": normalized, "language": language, "word_count": len(normalized.split())}, indent=2, ensure_ascii=False), encoding="utf-8")
    return Derivative("normalized_text", str(output_path), "application/json", {"language": language, "word_count": len(normalized.split())})


def detect_language(text: str) -> str:
    normalized = f" {text.lower()} "
    spanish = sum(normalized.count(token) for token in [" que ", " de ", " la ", " el ", " para ", " una ", " con ", " por "])
    english = sum(normalized.count(token) for token in [" the ", " and ", " for ", " with ", " this ", " that ", " from "])
    if spanish >= english and spanish > 0:
        return "es"
    if english > spanish:
        return "en"
    return "unknown"


def transcribe_audio(audio_path: Path, output_dir: Path) -> Derivative:
    output_path = output_dir / "transcript.whisper.json"
    provider = os.getenv("WHISPER_PROVIDER", "local").lower()
    if provider != "local":
        payload = {"source": provider, "status": "skipped", "segments": []}
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return Derivative("transcript", str(output_path), "application/json", {"source": provider, "status": "skipped", "segment_count": 0})

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
        return Derivative("transcript", str(output_path), "application/json", {"source": "faster-whisper", "status": "dependency_missing", "error": str(exc), "segment_count": 0})

    model_name = os.getenv("WHISPER_MODEL", "small")
    device = os.getenv("WHISPER_DEVICE", "cpu")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments_iter, info = model.transcribe(str(audio_path), vad_filter=True)
    segments = [
        {"start": round(segment.start, 3), "end": round(segment.end, 3), "text": segment.text.strip()}
        for segment in segments_iter
        if segment.text.strip()
    ]
    payload = {
        "source": "faster-whisper",
        "model": model_name,
        "language": info.language,
        "language_probability": round(float(info.language_probability or 0), 4),
        "segments": segments,
    }
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return Derivative("transcript", str(output_path), "application/json", {"source": "faster-whisper", "model": model_name, "language": info.language, "segment_count": len(segments)})


def preprocess_asset(input_path: Path, kind: str, output_dir: Path) -> PreprocessingResult:
    output_dir.mkdir(parents=True, exist_ok=True)
    logs = [f"input={input_path}", f"kind={kind}"]
    derivatives: list[Derivative] = []

    if kind in {"video", "audio"}:
        derivatives.append(probe_media(input_path, output_dir))
        if kind == "video":
            derivatives.append(normalize_video(input_path, output_dir))
            audio = normalize_audio(input_path, output_dir)
            derivatives.append(audio)
            derivatives.append(transcribe_audio(Path(audio.path), output_dir))
            derivatives.append(detect_silence(Path(audio.path), output_dir))
        else:
            audio = normalize_audio(input_path, output_dir)
            derivatives.append(audio)
            derivatives.append(transcribe_audio(Path(audio.path), output_dir))
            derivatives.append(detect_silence(Path(audio.path), output_dir))
    elif kind == "text":
        if input_path.suffix.lower() == ".srt":
            derivatives.append(parse_srt(input_path, output_dir))
        derivatives.append(normalize_text(input_path, output_dir))
    else:
        raise PreprocessingError(f"kind no soportado: {kind}")

    logs.append(f"derivatives={len(derivatives)}")
    return PreprocessingResult(str(input_path), kind, derivatives, logs)


def main() -> None:
    parser = argparse.ArgumentParser(description="PraevIA NeuroImpact CPU preprocessor")
    parser.add_argument("--input")
    parser.add_argument("--s3-bucket")
    parser.add_argument("--s3-key")
    parser.add_argument("--upload-bucket")
    parser.add_argument("--upload-prefix")
    parser.add_argument("--kind", required=True, choices=["video", "audio", "text"])
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    output_dir = Path(args.output)
    input_path = Path(args.input) if args.input else None
    if args.s3_key:
        bucket = args.s3_bucket or ""
        local_source = output_dir / "source" / Path(args.s3_key).name
        input_path = download_s3_object(bucket, args.s3_key, local_source)
    if input_path is None:
        raise PreprocessingError("usa --input local o --s3-bucket + --s3-key")

    result = preprocess_asset(input_path, args.kind, output_dir)
    if args.upload_bucket and args.upload_prefix:
        prefix = args.upload_prefix.rstrip("/")
        for derivative in result.derivatives:
            source = Path(derivative.path)
            key = f"{prefix}/{source.name}"
            upload_s3_object(args.upload_bucket, key, source, derivative.mime_type)
            derivative.metadata["storage_bucket"] = args.upload_bucket
            derivative.metadata["storage_key"] = key
        result.logs.append(f"uploaded_derivatives={len(result.derivatives)}")
    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
