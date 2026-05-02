from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.services.observability import record_exception
from app.settings import settings


@dataclass(frozen=True)
class StorageObjectHead:
    bucket: str
    key: str
    byte_size: int
    content_type: str
    metadata: dict[str, str]


@dataclass(frozen=True)
class DeletedStorageObjects:
    requested: list[str]
    deleted: list[str]
    errors: list[dict[str, str]]


class StorageService:
    """S3-compatible storage adapter for Cloudflare R2, AWS S3 and local MinIO."""

    def __init__(self) -> None:
        self._client: Any | None = None
        self._bucket_checked = False

    @property
    def bucket(self) -> str:
        return settings.s3_bucket

    @property
    def is_configured(self) -> bool:
        if settings.storage_mode == "mock":
            return False
        return bool(
            settings.s3_bucket
            and settings.s3_access_key_id
            and settings.s3_secret_access_key
            and (settings.s3_endpoint or settings.s3_region)
        )

    def _client_or_raise(self) -> Any:
        if not self.is_configured:
            raise HTTPException(status_code=503, detail="Storage S3/R2 no configurado.")
        if self._client is None:
            import boto3
            from botocore.config import Config

            self._client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint or None,
                region_name=settings.s3_region,
                aws_access_key_id=settings.s3_access_key_id,
                aws_secret_access_key=settings.s3_secret_access_key,
                config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            )
        return self._client

    def ensure_bucket(self) -> None:
        if not self.is_configured or self._bucket_checked:
            return
        client = self._client_or_raise()
        try:
            client.head_bucket(Bucket=self.bucket)
            self._bucket_checked = True
            return
        except Exception as exc:
            record_exception(exc, source="storage", metadata={"operation": "head_bucket", "bucket": self.bucket})
            status = int(getattr(exc, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode", 0))
            if status != 404 or not settings.s3_create_bucket_if_missing:
                raise HTTPException(status_code=503, detail=f"Bucket de storage no disponible: {self.bucket}") from exc
        try:
            client.create_bucket(Bucket=self.bucket)
            self._bucket_checked = True
        except Exception as exc:
            record_exception(exc, source="storage", metadata={"operation": "create_bucket", "bucket": self.bucket})
            raise HTTPException(status_code=503, detail=f"No se pudo crear el bucket local: {self.bucket}") from exc

    def create_presigned_upload_url(
        self,
        *,
        key: str,
        content_type: str,
        metadata: dict[str, str],
        expires_in: int,
    ) -> tuple[str, dict[str, str]]:
        self.ensure_bucket()
        client = self._client_or_raise()
        clean_metadata = {item_key: str(item_value) for item_key, item_value in metadata.items() if item_value}
        try:
            url = client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": key,
                    "ContentType": content_type,
                    "Metadata": clean_metadata,
                },
                ExpiresIn=expires_in,
                HttpMethod="PUT",
            )
        except Exception as exc:
            record_exception(exc, source="storage", metadata={"operation": "presigned_upload", "bucket": self.bucket, "key": key})
            raise HTTPException(status_code=503, detail="No se pudo generar URL firmada de subida.") from exc

        headers = {"Content-Type": content_type}
        headers.update({f"x-amz-meta-{item_key}": item_value for item_key, item_value in clean_metadata.items()})
        return url, headers

    def create_presigned_download_url(self, *, key: str, expires_in: int) -> str:
        self.ensure_bucket()
        client = self._client_or_raise()
        try:
            return client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in,
                HttpMethod="GET",
            )
        except Exception as exc:
            record_exception(exc, source="storage", metadata={"operation": "presigned_download", "bucket": self.bucket, "key": key})
            raise HTTPException(status_code=503, detail="No se pudo generar URL firmada de descarga.") from exc

    def head_object(self, *, bucket: str, key: str) -> StorageObjectHead:
        if bucket != self.bucket:
            raise HTTPException(status_code=400, detail="Bucket no coincide con el entorno actual.")
        self.ensure_bucket()
        client = self._client_or_raise()
        try:
            row = client.head_object(Bucket=bucket, Key=key)
        except Exception as exc:
            record_exception(exc, source="storage", metadata={"operation": "head_object", "bucket": bucket, "key": key})
            status = int(getattr(exc, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode", 0))
            if status == 404:
                raise HTTPException(status_code=404, detail="Objeto no encontrado en storage.") from exc
            raise HTTPException(status_code=503, detail="No se pudo verificar el objeto en storage.") from exc
        return StorageObjectHead(
            bucket=bucket,
            key=key,
            byte_size=int(row.get("ContentLength") or 0),
            content_type=row.get("ContentType") or "application/octet-stream",
            metadata={str(key): str(value) for key, value in (row.get("Metadata") or {}).items()},
        )

    def download_file(self, *, bucket: str, key: str, destination: Path) -> None:
        if bucket != self.bucket:
            raise HTTPException(status_code=400, detail="Bucket no coincide con el entorno actual.")
        self.ensure_bucket()
        destination.parent.mkdir(parents=True, exist_ok=True)
        client = self._client_or_raise()
        try:
            client.download_file(bucket, key, str(destination))
        except Exception as exc:
            record_exception(exc, source="storage", metadata={"operation": "download_file", "bucket": bucket, "key": key})
            raise HTTPException(status_code=503, detail="No se pudo descargar el asset desde storage.") from exc

    def upload_file(
        self,
        *,
        bucket: str,
        key: str,
        source: Path,
        content_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StorageObjectHead:
        if bucket != self.bucket:
            raise HTTPException(status_code=400, detail="Bucket no coincide con el entorno actual.")
        if not source.exists():
            raise HTTPException(status_code=500, detail=f"Derivado no encontrado: {source.name}")
        self.ensure_bucket()
        client = self._client_or_raise()
        extra_args = {"ContentType": content_type}
        clean_metadata = {item_key: str(item_value) for item_key, item_value in (metadata or {}).items() if item_value}
        if clean_metadata:
            extra_args["Metadata"] = clean_metadata
        try:
            client.upload_file(str(source), bucket, key, ExtraArgs=extra_args)
        except Exception as exc:
            record_exception(exc, source="storage", metadata={"operation": "upload_file", "bucket": bucket, "key": key})
            raise HTTPException(status_code=503, detail="No se pudo subir el derivado a storage.") from exc
        return self.head_object(bucket=bucket, key=key)

    def delete_objects(self, *, bucket: str, keys: list[str]) -> DeletedStorageObjects:
        unique_keys = sorted({key for key in keys if key})
        if not unique_keys:
            return DeletedStorageObjects(requested=[], deleted=[], errors=[])
        if bucket != self.bucket:
            raise HTTPException(status_code=400, detail="Bucket no coincide con el entorno actual.")
        if not self.is_configured:
            return DeletedStorageObjects(requested=unique_keys, deleted=[], errors=[{"key": key, "message": "storage_mock"} for key in unique_keys])

        self.ensure_bucket()
        client = self._client_or_raise()
        deleted: list[str] = []
        errors: list[dict[str, str]] = []
        for index in range(0, len(unique_keys), 1000):
            batch = unique_keys[index : index + 1000]
            try:
                response = client.delete_objects(
                    Bucket=bucket,
                    Delete={"Objects": [{"Key": key} for key in batch], "Quiet": False},
                )
            except Exception as exc:
                record_exception(exc, source="storage", metadata={"operation": "delete_objects", "bucket": bucket, "keys": len(batch)})
                errors.extend({"key": key, "message": str(exc)} for key in batch)
                continue
            deleted.extend(item.get("Key", "") for item in response.get("Deleted", []) if item.get("Key"))
            errors.extend(
                {"key": item.get("Key", ""), "message": item.get("Message", item.get("Code", "delete_failed"))}
                for item in response.get("Errors", [])
            )
        return DeletedStorageObjects(requested=unique_keys, deleted=deleted, errors=errors)

    def object_url_to_local_name(self, key: str) -> str:
        return Path(key).name or "asset.bin"


storage_service = StorageService()
