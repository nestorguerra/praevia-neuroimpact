from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth import CurrentUser, require_auth
from app.repositories.benchmarks_repository import benchmarks_repository
from app.schemas.benchmarks import (
    BenchmarkCreate,
    BenchmarkItemCreate,
    BenchmarkItemRead,
    BenchmarkRead,
    BenchmarkSnapshotRead,
    ExternalKpiCreate,
    ExternalKpiRead,
)

router = APIRouter(tags=["benchmarks"])


@router.get("/benchmarks/{organization_id}", response_model=BenchmarkSnapshotRead)
def get_benchmark_snapshot(organization_id: UUID, current_user: CurrentUser = Depends(require_auth)) -> BenchmarkSnapshotRead:
    return benchmarks_repository().snapshot(organization_id, current_user)


@router.post("/benchmarks", response_model=BenchmarkRead)
def create_benchmark(payload: BenchmarkCreate, current_user: CurrentUser = Depends(require_auth)) -> BenchmarkRead:
    return benchmarks_repository().create_benchmark(payload, current_user)


@router.post("/benchmark-items", response_model=BenchmarkItemRead)
def create_benchmark_item(payload: BenchmarkItemCreate, current_user: CurrentUser = Depends(require_auth)) -> BenchmarkItemRead:
    return benchmarks_repository().create_item(payload, current_user)


@router.post("/external-kpis", response_model=ExternalKpiRead)
def create_external_kpi(payload: ExternalKpiCreate, current_user: CurrentUser = Depends(require_auth)) -> ExternalKpiRead:
    return benchmarks_repository().create_kpi(payload, current_user)
