from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_auth
from app.repositories.preprocessing_repository import preprocessing_repository
from app.schemas.preprocessing import PreprocessingBatchRead, PreprocessingJobCreate, PreprocessingJobRead

router = APIRouter(tags=["preprocessing"])


@router.post("/preprocessing/jobs", response_model=PreprocessingBatchRead)
def create_preprocessing_jobs(payload: PreprocessingJobCreate, current_user: CurrentUser = Depends(require_auth)) -> PreprocessingBatchRead:
    return preprocessing_repository().create_batch(payload, current_user)


@router.get("/preprocessing/jobs/{job_id}", response_model=PreprocessingJobRead)
def get_preprocessing_job(job_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> PreprocessingJobRead:
    job = preprocessing_repository().get_job(job_id, current_user)
    if job is None:
        raise HTTPException(status_code=404, detail="Preprocessing job not found")
    return job


@router.get("/assets/{asset_id}/preprocessing-jobs", response_model=list[PreprocessingJobRead])
def list_asset_preprocessing_jobs(asset_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[PreprocessingJobRead]:
    return preprocessing_repository().list_asset_jobs(asset_id, current_user)


@router.get("/experiments/{experiment_id}/preprocessing-jobs", response_model=list[PreprocessingJobRead])
def list_experiment_preprocessing_jobs(experiment_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[PreprocessingJobRead]:
    return preprocessing_repository().list_experiment_jobs(experiment_id, current_user)
