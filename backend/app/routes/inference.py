from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_auth
from app.repositories.inference_repository import inference_repository
from app.schemas.inference import AnalysisRunBatchRead, AnalysisRunCreate, AnalysisRunRead

router = APIRouter(tags=["tribe-inference"])


@router.post("/analysis-runs", response_model=AnalysisRunRead)
def create_analysis_run(payload: AnalysisRunCreate, current_user: CurrentUser = Depends(require_auth)) -> AnalysisRunRead:
    return inference_repository().create_run(payload, current_user)


@router.post("/analysis-runs/batch", response_model=AnalysisRunBatchRead)
def create_analysis_run_batch(payload: list[AnalysisRunCreate], current_user: CurrentUser = Depends(require_auth)) -> AnalysisRunBatchRead:
    if not payload:
        raise HTTPException(status_code=400, detail="At least one analysis run is required")
    return inference_repository().create_batch(payload, current_user)


@router.get("/analysis-runs/{run_id}", response_model=AnalysisRunRead)
def get_analysis_run(run_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> AnalysisRunRead:
    run = inference_repository().get_run(run_id, current_user)
    if run is None:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    return run


@router.get("/experiments/{experiment_id}/analysis-runs", response_model=list[AnalysisRunRead])
def list_experiment_analysis_runs(experiment_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[AnalysisRunRead]:
    return inference_repository().list_experiment_runs(experiment_id, current_user)
