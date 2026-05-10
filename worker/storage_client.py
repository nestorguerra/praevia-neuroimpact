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
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def download_s3_object(bucket: str, key: str, destination: Path) -> Path:
    if not bucket or not key:
        raise WorkerStorageError("bucket y key son obligatorios para descargar desde storage")
    destination.parent.mkdir(parents=True, exist_ok=True)
    response = _client().get_object(Bucket=bucket, Key=key)
    with destination.open("wb") as output:
        for chunk in response["Body"].iter_chunks(chunk_size=1024 * 1024):
            if chunk:
                output.write(chunk)
    return destination


def upload_s3_object(bucket: str, key: str, source: Path, content_type: str = "application/octet-stream") -> None:
    if not source.exists():
        raise WorkerStorageError(f"archivo no encontrado: {source}")
    content_length = source.stat().st_size
    with source.open("rb") as body:
        _client().put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentLength=content_length,
            ContentType=content_type,
        )
