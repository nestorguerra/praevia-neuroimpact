from __future__ import annotations

import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException

from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection, jsonb, require_row
from app.schemas.reports import (
    ReportArtifactFormat,
    ReportCreate,
    ReportDownloadRead,
    ReportRead,
    ReportSectionRead,
    ReportUsageRead,
    build_report_from_scoring,
)
from app.schemas.scoring import NeuroScoringRead
from app.services.report_renderer import render_report_artifacts
from app.services.storage import storage_service
from app.settings import settings


class ReportingDbRepository:
    def create_report(self, scoring: NeuroScoringRead, payload: ReportCreate, user: CurrentUser) -> ReportRead:
        with connection() as conn:
            assert_org_member(conn, scoring.organization_id, user)
            report = build_report_from_scoring(scoring, payload)
            asset_sha256 = self._asset_hash(conn, report.asset_id, report.organization_id)
            report.report_payload["asset_sha256"] = asset_sha256
            self._render_and_upload_artifacts(conn, report, scoring, asset_sha256, user)
            conn.execute(
                """
                insert into public.reports (
                  id, organization_id, experiment_id, asset_id, analysis_run_id, scoring_result_id,
                  report_type, language, status, title, decision, tldr, guardrail_status,
                  guardrail_findings, llm_provider, draft_model, final_model, reviewer_model,
                  prompt_version, input_tokens, output_tokens, estimated_cost_eur,
                  html_storage_key, pdf_storage_key, report_payload, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    report.id,
                    report.organization_id,
                    report.experiment_id,
                    report.asset_id,
                    report.analysis_run_id,
                    report.scoring_result_id,
                    report.report_type,
                    report.language,
                    report.status,
                    report.title,
                    report.decision,
                    report.tldr,
                    report.guardrail_status,
                    jsonb(report.guardrail_findings),
                    report.usage.provider,
                    report.usage.draft_model,
                    report.usage.final_model,
                    report.usage.reviewer_model,
                    report.usage.prompt_version,
                    report.usage.input_tokens,
                    report.usage.output_tokens,
                    report.usage.estimated_cost_eur,
                    report.html_storage_key,
                    report.pdf_storage_key,
                    jsonb(report.report_payload),
                    user.id,
                ),
            )
            for section in report.sections:
                conn.execute(
                    """
                    insert into public.report_sections (
                      id, organization_id, report_id, section_key, title, body, payload, order_index
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        section.id,
                        section.organization_id,
                        section.report_id,
                        section.section_key,
                        section.title,
                        section.body,
                        jsonb(section.payload),
                        section.order_index,
                    ),
                )
            conn.execute(
                """
                insert into public.usage_events (
                  organization_id, event_type, source_table, source_id, experiment_id, asset_id,
                  analysis_run_id, report_id, credits_delta, estimated_cost_eur, input_tokens,
                  output_tokens, metadata, created_by
                )
                values (%s, 'report_generation', 'reports', %s, %s, %s, %s, %s, 0.5, %s, %s, %s, %s, %s)
                """,
                (
                    report.organization_id,
                    report.id,
                    report.experiment_id,
                    report.asset_id,
                    report.analysis_run_id,
                    report.id,
                    report.usage.estimated_cost_eur,
                    report.usage.input_tokens,
                    report.usage.output_tokens,
                    jsonb(
                        {
                            "label": report.title,
                            "provider": report.usage.provider,
                            "draft_model": report.usage.draft_model,
                            "final_model": report.usage.final_model,
                            "reviewer_model": report.usage.reviewer_model,
                            "prompt_version": report.usage.prompt_version,
                            "guardrail_status": report.guardrail_status,
                            "llm_trace": report.report_payload.get("llm_trace", {}),
                        }
                    ),
                    user.id,
                ),
            )
            conn.commit()
            return report

    def _asset_hash(self, conn, asset_id: UUID, organization_id: UUID) -> str | None:
        row = conn.execute(
            """
            select coalesce(a.sha256, so.sha256) as sha256
            from public.assets a
            left join public.storage_objects so on so.asset_id = a.id and so.object_role = 'original' and so.status = 'active'
            where a.id = %s and a.organization_id = %s
            order by so.created_at desc
            limit 1
            """,
            (asset_id, organization_id),
        ).fetchone()
        return row["sha256"] if row and row["sha256"] else None

    def _render_and_upload_artifacts(
        self,
        conn,
        report: ReportRead,
        scoring: NeuroScoringRead,
        asset_sha256: str | None,
        user: CurrentUser,
    ) -> None:
        if not storage_service.is_configured:
            report.report_payload["server_pdf"] = {"status": "storage_not_configured"}
            return
        with tempfile.TemporaryDirectory(prefix="praevia-report-render-") as temp_dir:
            artifacts = render_report_artifacts(report, scoring, asset_sha256=asset_sha256, output_dir=Path(temp_dir))
            html_head = storage_service.upload_file(
                bucket=storage_service.bucket,
                key=report.html_storage_key,
                source=artifacts.html_path,
                content_type="text/html; charset=utf-8",
                metadata={
                    "report-id": str(report.id),
                    "report-type": report.report_type,
                    "model-id": scoring.model_id,
                    "prompt-version": report.usage.prompt_version,
                    "benchmark": scoring.benchmark_label,
                    "asset-sha256": asset_sha256 or "",
                },
            )
            pdf_head = storage_service.upload_file(
                bucket=storage_service.bucket,
                key=report.pdf_storage_key,
                source=artifacts.pdf_path,
                content_type="application/pdf",
                metadata={
                    "report-id": str(report.id),
                    "report-type": report.report_type,
                    "model-id": scoring.model_id,
                    "prompt-version": report.usage.prompt_version,
                    "benchmark": scoring.benchmark_label,
                    "asset-sha256": asset_sha256 or "",
                },
            )
            report.report_payload["server_pdf"] = {
                "status": "rendered",
                "renderer": settings.report_renderer_mode,
                "page_count": artifacts.page_count,
                "html_sha256": artifacts.html_sha256,
                "pdf_sha256": artifacts.pdf_sha256,
                "html_bytes": artifacts.html_bytes,
                "pdf_bytes": artifacts.pdf_bytes,
                "html_storage_key": report.html_storage_key,
                "pdf_storage_key": report.pdf_storage_key,
            }
            self._upsert_storage_object(
                conn,
                report,
                role="report_html",
                key=report.html_storage_key,
                content_type=html_head.content_type,
                byte_size=html_head.byte_size,
                sha256=artifacts.html_sha256,
                extension=".html",
                metadata=report.report_payload["server_pdf"],
                user=user,
            )
            self._upsert_storage_object(
                conn,
                report,
                role="report_pdf",
                key=report.pdf_storage_key,
                content_type=pdf_head.content_type,
                byte_size=pdf_head.byte_size,
                sha256=artifacts.pdf_sha256,
                extension=".pdf",
                metadata=report.report_payload["server_pdf"],
                user=user,
            )

    def _upsert_storage_object(
        self,
        conn,
        report: ReportRead,
        *,
        role: str,
        key: str,
        content_type: str,
        byte_size: int,
        sha256: str,
        extension: str,
        metadata: dict,
        user: CurrentUser,
    ) -> None:
        conn.execute(
            """
            insert into public.storage_objects (
              organization_id, asset_id, source_table, source_id, object_role,
              storage_bucket, storage_key, content_type, byte_size, sha256, extension,
              status, retention_delete_after, metadata, created_by
            )
            values (
              %s, %s, 'reports', %s, %s,
              %s, %s, %s, %s, %s, %s,
              'active',
              now() + make_interval(days => coalesce((
                select report_retention_days
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
                report.organization_id,
                report.asset_id,
                report.id,
                role,
                storage_service.bucket,
                key,
                content_type,
                byte_size,
                sha256,
                extension,
                report.organization_id,
                settings.retention_days,
                jsonb(
                    {
                        **metadata,
                        "report_id": str(report.id),
                        "report_type": report.report_type,
                        "prompt_version": report.usage.prompt_version,
                    }
                ),
                user.id,
            ),
        )

    def _read_report(self, conn, row) -> ReportRead:
        sections = conn.execute(
            """
            select *
            from public.report_sections
            where report_id = %s
            order by order_index asc
            """,
            (row["id"],),
        ).fetchall()
        return ReportRead(
            id=row["id"],
            organization_id=row["organization_id"],
            experiment_id=row["experiment_id"],
            asset_id=row["asset_id"],
            analysis_run_id=row["analysis_run_id"],
            scoring_result_id=row["scoring_result_id"],
            report_type=row["report_type"],
            language=row["language"],
            status=row["status"],
            title=row["title"],
            decision=row["decision"],
            tldr=row["tldr"],
            guardrail_status=row["guardrail_status"],
            guardrail_findings=row["guardrail_findings"] or [],
            usage=ReportUsageRead(
                provider=row["llm_provider"],
                draft_model=row["draft_model"],
                final_model=row["final_model"],
                reviewer_model=row["reviewer_model"],
                prompt_version=row["prompt_version"],
                input_tokens=row["input_tokens"],
                output_tokens=row["output_tokens"],
                estimated_cost_eur=float(row["estimated_cost_eur"]),
            ),
            html_storage_key=row["html_storage_key"] or "",
            pdf_storage_key=row["pdf_storage_key"] or "",
            report_payload=row["report_payload"] or {},
            sections=[
                ReportSectionRead(
                    id=section["id"],
                    report_id=section["report_id"],
                    organization_id=section["organization_id"],
                    section_key=section["section_key"],
                    title=section["title"],
                    body=section["body"],
                    payload=section["payload"] or {},
                    order_index=section["order_index"],
                    created_at=section["created_at"],
                )
                for section in sections
            ],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def get_report(self, report_id: UUID, user: CurrentUser) -> ReportRead | None:
        with connection() as conn:
            row = conn.execute("select * from public.reports where id = %s", (report_id,)).fetchone()
            if not row:
                return None
            assert_org_member(conn, row["organization_id"], user)
            return self._read_report(conn, row)

    def create_report_download(self, report_id: UUID, artifact_format: ReportArtifactFormat, user: CurrentUser) -> ReportDownloadRead:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.signed_url_ttl_seconds)
        with connection() as conn:
            row = conn.execute("select * from public.reports where id = %s", (report_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Report not found.")
            assert_org_member(conn, row["organization_id"], user)
            key = row["pdf_storage_key"] if artifact_format == "pdf" else row["html_storage_key"]
            if not key:
                raise HTTPException(status_code=404, detail="El informe no tiene artefacto generado.")
        if not storage_service.is_configured:
            raise HTTPException(status_code=503, detail="Storage S3/R2 no configurado para descarga de informes.")
        signed_url = storage_service.create_presigned_download_url(key=key, expires_in=settings.signed_url_ttl_seconds)
        return ReportDownloadRead(
            report_id=report_id,
            format=artifact_format,
            signed_url=signed_url,
            storage_bucket=storage_service.bucket,
            storage_key=key,
            expires_at=expires_at,
        )

    def list_scoring_reports(self, scoring_result_id: UUID, user: CurrentUser) -> list[ReportRead]:
        with connection() as conn:
            scoring = require_row(
                conn.execute("select organization_id from public.neuro_scoring_results where id = %s", (scoring_result_id,)).fetchone(),
                "Scoring result not found.",
            )
            assert_org_member(conn, scoring["organization_id"], user)
            rows = conn.execute(
                "select * from public.reports where scoring_result_id = %s order by created_at desc",
                (scoring_result_id,),
            ).fetchall()
            return [self._read_report(conn, row) for row in rows]

    def list_experiment_reports(self, experiment_id: UUID, user: CurrentUser) -> list[ReportRead]:
        with connection() as conn:
            experiment = require_row(
                conn.execute("select organization_id from public.experiments where id = %s", (experiment_id,)).fetchone(),
                "Experiment not found.",
            )
            assert_org_member(conn, experiment["organization_id"], user)
            rows = conn.execute(
                "select * from public.reports where experiment_id = %s order by created_at desc",
                (experiment_id,),
            ).fetchall()
            return [self._read_report(conn, row) for row in rows]


reporting_db_repository = ReportingDbRepository()
