from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_auth
from app.repositories.scoring_repository import scoring_repository
from app.schemas.scoring import NeuroScoringCreate, NeuroScoringRead

router = APIRouter(tags=["neuro-scoring"])


@router.post("/scoring/results", response_model=NeuroScoringRead)
def create_scoring_result(payload: NeuroScoringCreate, current_user: CurrentUser = Depends(require_auth)) -> NeuroScoringRead:
    return scoring_repository().create_result(payload, current_user)


@router.get("/scoring/results/{result_id}", response_model=NeuroScoringRead)
def get_scoring_result(result_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> NeuroScoringRead:
    result = scoring_repository().get_result(result_id, current_user)
    if result is None:
        raise HTTPException(status_code=404, detail="Scoring result not found")
    return result


@router.get("/analysis-runs/{analysis_run_id}/scoring-results", response_model=list[NeuroScoringRead])
def list_run_scoring_results(analysis_run_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[NeuroScoringRead]:
    return scoring_repository().list_run_results(analysis_run_id, current_user)


@router.get("/experiments/{experiment_id}/scoring-results", response_model=list[NeuroScoringRead])
def list_experiment_scoring_results(experiment_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[NeuroScoringRead]:
    return scoring_repository().list_experiment_results(experiment_id, current_user)
