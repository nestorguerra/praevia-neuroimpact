from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException

from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection, jsonb, require_row
from app.schemas.uploads import (
    AssetDownloadRead,
    AssetRead,
    UploadCompleteCreate,
    UploadCompleteRead,
    UploadIntentCreate,
    UploadIntentRead,
)
from app.services.asset_validation import normalize_extension, validate_upload_payload
from app.services.storage import storage_service
from app.settings import settings


class UploadsDbRepository:
    def _asset_from_row(self, row) -> AssetRead:
        return AssetRead(
            id=row["id"],
            organization_id=row["organization_id"],
            workspace_id=row["workspace_id"],
            project_id=row["project_id"],
            experiment_id=row["experiment_id"],
            slot=row["slot"],
            kind=row["kind"],
            original_filename=row["original_filename"],
            mime_type=row["mime_type"],
            byte_size=int(row["byte_size"]),
            sha256=row["sha256"],
            status=row["status"],
            storage_bucket=row.get("storage_bucket"),
            storage_key=row.get("storage_key"),
            health=row.get("health") or {},
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def create_upload_intent(self, payload: UploadIntentCreate, user: CurrentUser) -> UploadIntentRead:
        content_type = validate_upload_payload(payload)
        upload_session_id = uuid4()
        asset_id = uuid4()
        safe_name = Path(payload.file_name).name.replace("/", "_")
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.signed_url_ttl_seconds)
        bucket = storage_service.bucket
        if settings.storage_mode == "s3" and not storage_service.is_configured:
            raise HTTPException(status_code=503, detail="Storage S3/R2 obligatorio pero no configurado.")

        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            asset_row = conn.execute(
                """
                insert into public.assets (
                  id, organization_id, workspace_id, project_id, experiment_id, slot, kind,
                  original_filename, mime_type, byte_size, sha256, status, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'uploading', %s)
                on conflict (experiment_id, slot)
                do update set
                  kind = excluded.kind,
                  original_filename = excluded.original_filename,
                  mime_type = excluded.mime_type,
                  byte_size = excluded.byte_size,
                  sha256 = excluded.sha256,
                  status = 'uploading',
                  updated_at = now()
                returning id
                """,
                (
                    asset_id,
                    payload.organization_id,
                    payload.workspace_id,
                    payload.project_id,
                    payload.experiment_id,
                    payload.slot.value,
                    payload.kind.value,
                    payload.file_name,
                    payload.mime_type,
                    payload.byte_size,
                    payload.sha256,
                    user.id,
                ),
            ).fetchone()
            asset_id = asset_row["id"]
            storage_key = (
                f"{settings.app_env}/org/{payload.organization_id}/experiment/{payload.experiment_id}/"
                f"{payload.slot.value.lower()}-{asset_id}-{safe_name}"
            )
            conn.execute(
                """
                insert into public.upload_sessions (
                  id, organization_id, asset_id, storage_bucket, storage_key, signed_url_expires_at,
                  status, expected_sha256, max_byte_size, created_by
                )
                values (%s, %s, %s, %s, %s, %s, 'created', %s, %s, %s)
                """,
                (
                    upload_session_id,
                    payload.organization_id,
                    asset_id,
                    bucket,
                    storage_key,
                    expires_at,
                    payload.sha256,
                    payload.byte_size,
                    user.id,
                ),
            )
            conn.commit()

        headers = {
            "Content-Type": content_type,
            "x-amz-meta-sha256": payload.sha256 or "",
            "x-amz-meta-asset-id": str(asset_id),
            "x-amz-meta-upload-session-id": str(upload_session_id),
            "x-amz-meta-organization-id": str(payload.organization_id),
        }
        is_mock = not storage_service.is_configured
        signed_url = f"https://storage.local/upload/{upload_session_id}"
        if storage_service.is_configured:
            signed_url, headers = storage_service.create_presigned_upload_url(
                key=storage_key,
                content_type=content_type,
                metadata={
                    "sha256": payload.sha256 or "",
                    "asset-id": str(asset_id),
                    "upload-session-id": str(upload_session_id),
                    "organization-id": str(payload.organization_id),
                },
                expires_in=settings.signed_url_ttl_seconds,
            )

        return UploadIntentRead(
            upload_session_id=upload_session_id,
            asset_id=asset_id,
            signed_url=signed_url,
            storage_bucket=bucket,
            storage_key=storage_key,
            expires_at=expires_at,
            max_byte_size=payload.byte_size,
            headers=headers,
            is_mock=is_mock,
        )

    def complete_upload_session(self, payload: UploadCompleteCreate, user: CurrentUser) -> UploadCompleteRead:
        verified = False
        health = {"sha256": payload.sha256, "byte_size": payload.byte_size, "validated_by": "api"}
        with connection() as conn:
            session = require_row(
                conn.execute(
                    """
                    select us.*, a.organization_id, a.byte_size as expected_byte_size, a.sha256 as expected_sha256,
                           a.original_filename, a.kind, a.mime_type, a.workspace_id, a.project_id, a.experiment_id
                    from public.upload_sessions us
                    join public.assets a on a.id = us.asset_id
                    where us.id = %s
                    """,
                    (payload.upload_session_id,),
                ).fetchone(),
                "Upload session not found.",
            )
            assert_org_member(conn, session["organization_id"], user)
            if payload.byte_size > int(session["max_byte_size"]):
                raise HTTPException(status_code=413, detail="El archivo supera el tamano autorizado para la URL firmada.")
            if session["expected_sha256"] and session["expected_sha256"] != payload.sha256:
                raise HTTPException(status_code=400, detail="El hash SHA-256 no coincide con la intencion de subida.")

            if storage_service.is_configured:
                head = storage_service.head_object(bucket=session["storage_bucket"], key=session["storage_key"])
                if head.byte_size != payload.byte_size:
                    raise HTTPException(status_code=400, detail="El tamano del objeto en storage no coincide con el archivo registrado.")
                stored_hash = head.metadata.get("sha256")
                if stored_hash and stored_hash != payload.sha256:
                    raise HTTPException(status_code=400, detail="El hash metadata del objeto no coincide.")
                verified = True
                health.update(
                    {
                        "validated_by": "s3_head_object",
                        "storage_verified": True,
                        "content_type": head.content_type,
                        "metadata_sha256": stored_hash,
                    }
                )
            else:
                health.update({"storage_verified": False, "storage_mode": "mock"})

            conn.execute(
                """
                update public.upload_sessions
                set status = 'completed', completed_at = now()
                where id = %s
                """,
                (payload.upload_session_id,),
            )
            conn.execute(
                """
                update public.assets
                set status = 'validated', sha256 = %s, byte_size = %s, updated_at = now()
                where id = %s
                """,
                (payload.sha256, payload.byte_size, session["asset_id"]),
            )
            conn.execute(
                """
                insert into public.asset_versions (
                  asset_id, version, storage_bucket, storage_key, health
                )
                values (%s, 1, %s, %s, %s)
                on conflict (asset_id, version)
                do update set
                  storage_bucket = excluded.storage_bucket,
                  storage_key = excluded.storage_key,
                  health = excluded.health,
                  created_at = now()
                """,
                (
                    session["asset_id"],
                    session["storage_bucket"],
                    session["storage_key"],
                    jsonb(health),
                ),
            )
            conn.execute(
                """
                insert into public.storage_objects (
                  organization_id, asset_id, upload_session_id, source_table, source_id, object_role,
                  storage_bucket, storage_key, content_type, byte_size, sha256, extension,
                  status, retention_delete_after, metadata, created_by
                )
                values (
                  %s, %s, %s, 'asset_versions', %s, 'original',
                  %s, %s, %s, %s, %s, %s,
                  'active',
                  now() + make_interval(days => coalesce((
                    select asset_retention_days
                    from public.organization_retention_policies
                    where organization_id = %s
                  ), %s)),
                  %s, %s
                )
                on conflict (storage_bucket, storage_key)
                do update set
                  byte_size = excluded.byte_size,
                  sha256 = excluded.sha256,
                  content_type = excluded.content_type,
                  extension = excluded.extension,
                  status = 'active',
                  deleted_at = null,
                  metadata = excluded.metadata
                """,
                (
                    session["organization_id"],
                    session["asset_id"],
                    payload.upload_session_id,
                    session["asset_id"],
                    session["storage_bucket"],
                    session["storage_key"],
                    session["mime_type"],
                    payload.byte_size,
                    payload.sha256,
                    normalize_extension(session["original_filename"]),
                    session["organization_id"],
                    settings.retention_days,
                    jsonb(
                        {
                            "kind": session["kind"],
                            "workspace_id": session["workspace_id"],
                            "project_id": session["project_id"],
                            "experiment_id": session["experiment_id"],
                            **health,
                        }
                    ),
                    user.id,
                ),
            )
            upload_credits = max(1, int((payload.byte_size + (25 * 1024 * 1024) - 1) // (25 * 1024 * 1024)))
            conn.execute(
                """
                insert into public.usage_events (
                  organization_id, event_type, source_table, source_id, experiment_id, asset_id,
                  credits_delta, estimated_cost_eur, storage_bytes_delta, metadata, created_by
                )
                values (%s, 'asset_upload', 'assets', %s, %s, %s, %s, 0, %s, %s, %s)
                """,
                (
                    session["organization_id"],
                    session["asset_id"],
                    session["experiment_id"],
                    session["asset_id"],
                    upload_credits,
                    payload.byte_size,
                    jsonb(
                        {
                            "label": f"Upload {session['original_filename']}",
                            "kind": session["kind"],
                            "mime_type": session["mime_type"],
                            "storage_verified": verified,
                        }
                    ),
                    user.id,
                ),
            )
            conn.commit()
        return UploadCompleteRead(
            upload_session_id=payload.upload_session_id,
            asset_id=session["asset_id"],
            storage_bucket=session["storage_bucket"],
            storage_key=session["storage_key"],
            verified=verified,
        )

    def list_experiment_assets(self, experiment_id: UUID, user: CurrentUser) -> list[AssetRead]:
        with connection() as conn:
            row = require_row(
                conn.execute(
                    "select organization_id from public.experiments where id = %s",
                    (experiment_id,),
                ).fetchone(),
                "Experiment not found.",
            )
            assert_org_member(conn, row["organization_id"], user)
            rows = conn.execute(
                """
                select a.*, av.storage_bucket, av.storage_key, av.health
                from public.assets a
                left join public.asset_versions av on av.asset_id = a.id and av.version = 1
                where a.experiment_id = %s
                order by a.slot asc
                """,
                (experiment_id,),
            ).fetchall()
            return [self._asset_from_row(row) for row in rows]

    def create_asset_download_url(self, asset_id: UUID, user: CurrentUser) -> AssetDownloadRead:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.signed_url_ttl_seconds)
        with connection() as conn:
            row = require_row(
                conn.execute(
                    """
                    select a.organization_id, av.storage_bucket, av.storage_key
                    from public.assets a
                    join public.asset_versions av on av.asset_id = a.id
                    where a.id = %s
                    order by av.version desc
                    limit 1
                    """,
                    (asset_id,),
                ).fetchone(),
                "Asset version not found.",
            )
            assert_org_member(conn, row["organization_id"], user)
        signed_url = f"https://storage.local/download/{asset_id}"
        if storage_service.is_configured:
            signed_url = storage_service.create_presigned_download_url(
                key=row["storage_key"],
                expires_in=settings.signed_url_ttl_seconds,
            )
        return AssetDownloadRead(
            asset_id=asset_id,
            signed_url=signed_url,
            storage_bucket=row["storage_bucket"],
            storage_key=row["storage_key"],
            expires_at=expires_at,
        )


uploads_db_repository = UploadsDbRepository()
