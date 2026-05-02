from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_auth
from app.repositories.reporting_repository import reporting_repository
from app.repositories.scoring_repository import scoring_repository
from app.schemas.reports import ReportArtifactFormat, ReportCreate, ReportDownloadRead, ReportRead

router = APIRouter(tags=["reports"])


@router.post("/reports", response_model=ReportRead)
def create_report(payload: ReportCreate, current_user: CurrentUser = Depends(require_auth)) -> ReportRead:
    scoring = scoring_repository().get_result(payload.scoring_result_id, current_user)
    if scoring is None:
        raise HTTPException(status_code=404, detail="Scoring result not found")
    return reporting_repository().create_report(scoring, payload, current_user)


@router.get("/reports/{report_id}", response_model=ReportRead)
def get_report(report_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> ReportRead:
    report = reporting_repository().get_report(report_id, current_user)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/reports/{report_id}/download", response_model=ReportDownloadRead)
def download_report_artifact(
    report_id: UUID,
    format: ReportArtifactFormat = "pdf",
    current_user: CurrentUser = Depends(require_auth),
) -> ReportDownloadRead:
    return reporting_repository().create_report_download(report_id, format, current_user)


@router.get("/scoring/results/{scoring_result_id}/reports", response_model=list[ReportRead])
def list_scoring_reports(scoring_result_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[ReportRead]:
    return reporting_repository().list_scoring_reports(scoring_result_id, current_user)


@router.get("/experiments/{experiment_id}/reports", response_model=list[ReportRead])
def list_experiment_reports(experiment_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[ReportRead]:
    return reporting_repository().list_experiment_reports(experiment_id, current_user)
