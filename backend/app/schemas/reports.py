from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.schemas.scoring import NeuroScoringRead
from app.services.llm_router import ReportAudience, llm_router


ReportType = Literal["executive", "creative", "technical"]
ReportStatus = Literal["draft", "ready", "failed"]
ReportArtifactFormat = Literal["html", "pdf"]


class ReportCreate(BaseModel):
    scoring_result_id: UUID
    report_type: ReportType = "creative"
    language: Literal["es", "en"] = "es"
    audience: ReportAudience = "creative"


class ReportSectionRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    report_id: UUID
    organization_id: UUID
    section_key: str
    title: str
    body: str
    payload: dict
    order_index: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReportUsageRead(BaseModel):
    provider: str
    draft_model: str
    final_model: str
    reviewer_model: str | None = None
    prompt_version: str = "report-master-v0.1"
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_eur: float = 0


class ReportRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    experiment_id: UUID
    asset_id: UUID
    analysis_run_id: UUID
    scoring_result_id: UUID
    report_type: ReportType
    language: str
    status: ReportStatus = "ready"
    title: str
    decision: str
    tldr: str
    guardrail_status: str
    guardrail_findings: list[dict[str, str]]
    usage: ReportUsageRead
    html_storage_key: str
    pdf_storage_key: str
    report_payload: dict
    sections: list[ReportSectionRead]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReportDownloadRead(BaseModel):
    report_id: UUID
    format: ReportArtifactFormat
    signed_url: str
    storage_bucket: str
    storage_key: str
    expires_at: datetime


def build_report_from_scoring(scoring: NeuroScoringRead, payload: ReportCreate) -> ReportRead:
    report_id = uuid4()
    interpretation = llm_router.interpret_scoring(scoring, payload.audience)
    sections = [
        ReportSectionRead(
            report_id=report_id,
            organization_id=scoring.organization_id,
            section_key=section["section_key"],
            title=section["title"],
            body=section["body"],
            payload=section.get("payload", {}),
            order_index=index + 1,
        )
        for index, section in enumerate(interpretation.sections)
    ]
    base_key = f"reports/org/{scoring.organization_id}/experiment/{scoring.experiment_id}/scoring/{scoring.id}/report/{report_id}"
    return ReportRead(
        id=report_id,
        organization_id=scoring.organization_id,
        experiment_id=scoring.experiment_id,
        asset_id=scoring.asset_id,
        analysis_run_id=scoring.analysis_run_id,
        scoring_result_id=scoring.id,
        report_type=payload.report_type,
        language=payload.language,
        title=interpretation.title,
        decision=interpretation.decision,
        tldr=interpretation.tldr,
        guardrail_status=interpretation.guardrail_status,
        guardrail_findings=interpretation.guardrail_findings,
        usage=ReportUsageRead(
            provider=interpretation.usage.provider,
            draft_model=interpretation.usage.draft_model,
            final_model=interpretation.usage.final_model,
            reviewer_model=interpretation.usage.reviewer_model,
            prompt_version=llm_router.prompt_version,
            input_tokens=interpretation.usage.input_tokens,
            output_tokens=interpretation.usage.output_tokens,
            estimated_cost_eur=interpretation.usage.estimated_cost_eur,
        ),
        html_storage_key=f"{base_key}/report.html",
        pdf_storage_key=f"{base_key}/report.pdf",
        report_payload={
            "scoring_version": scoring.scoring_version,
            "benchmark_label": scoring.benchmark_label,
            "bold_delay_seconds": scoring.bold_delay_seconds,
            "editorial_scores": [score.model_dump() for score in scoring.editorial_scores],
            "peak_moments": [moment.model_dump() for moment in scoring.peak_moments],
            "llm_trace": interpretation.metadata,
        },
        sections=sections,
    )
