from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException

from app.schemas.reports import ReportArtifactFormat, ReportCreate, ReportDownloadRead, ReportRead, build_report_from_scoring
from app.schemas.scoring import NeuroScoringRead


class ReportingMemoryRepository:
    def __init__(self) -> None:
        self.reports: dict[UUID, ReportRead] = {}

    def create_report(self, scoring: NeuroScoringRead, payload: ReportCreate, *_args) -> ReportRead:
        report = build_report_from_scoring(scoring, payload)
        self.reports[report.id] = report
        return report

    def get_report(self, report_id: UUID, *_args) -> ReportRead | None:
        return self.reports.get(report_id)

    def list_scoring_reports(self, scoring_result_id: UUID, *_args) -> list[ReportRead]:
        return [report for report in self.reports.values() if report.scoring_result_id == scoring_result_id]

    def list_experiment_reports(self, experiment_id: UUID, *_args) -> list[ReportRead]:
        return [report for report in self.reports.values() if report.experiment_id == experiment_id]

    def create_report_download(self, report_id: UUID, artifact_format: ReportArtifactFormat, *_args) -> ReportDownloadRead:
        if report_id not in self.reports:
            raise HTTPException(status_code=404, detail="Report not found.")
        raise HTTPException(status_code=503, detail="Los artefactos server-side requieren storage S3/R2.")


reporting_repository = ReportingMemoryRepository()
