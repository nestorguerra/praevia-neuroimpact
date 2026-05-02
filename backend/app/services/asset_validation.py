from __future__ import annotations

import mimetypes
from pathlib import Path

from fastapi import HTTPException

from app.schemas.uploads import AssetKind, UploadIntentCreate


ALLOWED_EXTENSIONS: dict[AssetKind, set[str]] = {
    AssetKind.video: {".mp4", ".avi", ".mov", ".mkv", ".webm"},
    AssetKind.audio: {".mp3", ".wav", ".flac", ".ogg", ".m4a"},
    AssetKind.text: {".txt", ".md", ".srt"},
}

ALLOWED_MIME_PREFIXES: dict[AssetKind, tuple[str, ...]] = {
    AssetKind.video: ("video/", "application/octet-stream"),
    AssetKind.audio: ("audio/", "application/octet-stream"),
    AssetKind.text: ("text/", "application/x-subrip", "application/octet-stream"),
}

TEXT_MIME_EXACT = {
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/x-subrip",
    "application/octet-stream",
}


def normalize_extension(file_name: str) -> str:
    return Path(file_name).suffix.lower()


def infer_content_type(file_name: str, provided_mime: str) -> str:
    if provided_mime and provided_mime != "application/octet-stream":
        return provided_mime
    guessed, _ = mimetypes.guess_type(file_name)
    return guessed or provided_mime or "application/octet-stream"


def validate_upload_payload(payload: UploadIntentCreate) -> str:
    extension = normalize_extension(payload.file_name)
    allowed = ALLOWED_EXTENSIONS[payload.kind]
    if extension not in allowed:
        raise HTTPException(
            status_code=415,
            detail=f"Formato no soportado para {payload.kind.value}. Usa: {', '.join(sorted(allowed))}",
        )

    content_type = infer_content_type(payload.file_name, payload.mime_type)
    if payload.kind == AssetKind.text:
        if content_type not in TEXT_MIME_EXACT and not content_type.startswith("text/"):
            raise HTTPException(status_code=415, detail=f"MIME no soportado para texto: {content_type}")
        return content_type

    prefixes = ALLOWED_MIME_PREFIXES[payload.kind]
    if not any(content_type.startswith(prefix) for prefix in prefixes):
        raise HTTPException(status_code=415, detail=f"MIME no soportado para {payload.kind.value}: {content_type}")
    return content_type
