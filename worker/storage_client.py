from __future__ import annotations

import os
from pathlib import Path


class WorkerStorageError(RuntimeError):
    pass


def _client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT") or None,
        region_name=os.getenv("S3_REGION", "auto"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def download_s3_object(bucket: str, key: str, destination: Path) -> Path:
    if not bucket or not key:
        raise WorkerStorageError("bucket y key son obligatorios para descargar desde storage")
    destination.parent.mkdir(parents=True, exist_ok=True)
    _client().download_file(bucket, key, str(destination))
    return destination


def upload_s3_object(bucket: str, key: str, source: Path, content_type: str = "application/octet-stream") -> None:
    if not source.exists():
        raise WorkerStorageError(f"archivo no encontrado: {source}")
    _client().upload_file(
        str(source),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )
