from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_auth
from app.repositories.comparison_repository import comparison_repository
from app.repositories.scoring_repository import scoring_repository
from app.schemas.comparisons import ComparisonCreate, ComparisonRead

router = APIRouter(tags=["comparisons"])


@router.post("/comparisons", response_model=ComparisonRead)
def create_comparison(payload: ComparisonCreate, current_user: CurrentUser = Depends(require_auth)) -> ComparisonRead:
    results = []
    for result_id in payload.scoring_result_ids:
        result = scoring_repository().get_result(result_id, current_user)
        if result is None:
            raise HTTPException(status_code=404, detail=f"Scoring result not found: {result_id}")
        if result.experiment_id != payload.experiment_id:
            raise HTTPException(status_code=400, detail="All scoring results must belong to the comparison experiment")
        if result.organization_id != payload.organization_id:
            raise HTTPException(status_code=400, detail="All scoring results must belong to the comparison organization")
        results.append(result)

    try:
        return comparison_repository().create_comparison(results, payload, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/comparisons/{comparison_id}", response_model=ComparisonRead)
def get_comparison(comparison_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> ComparisonRead:
    comparison = comparison_repository().get_comparison(comparison_id, current_user)
    if comparison is None:
        raise HTTPException(status_code=404, detail="Comparison not found")
    return comparison


@router.get("/experiments/{experiment_id}/comparisons", response_model=list[ComparisonRead])
def list_experiment_comparisons(experiment_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> list[ComparisonRead]:
    return comparison_repository().list_experiment_comparisons(experiment_id, current_user)
