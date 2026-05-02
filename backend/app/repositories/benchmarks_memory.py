from __future__ import annotations

from uuid import UUID

from app.schemas.benchmarks import (
    BenchmarkCreate,
    BenchmarkItemCreate,
    BenchmarkItemRead,
    BenchmarkRead,
    BenchmarkSnapshotRead,
    ExternalKpiCreate,
    ExternalKpiRead,
)


class BenchmarksMemoryRepository:
    def __init__(self) -> None:
        self.benchmarks: dict[UUID, BenchmarkRead] = {}
        self.items: dict[UUID, BenchmarkItemRead] = {}
        self.kpis: dict[UUID, ExternalKpiRead] = {}

    def create_benchmark(self, payload: BenchmarkCreate, *_args) -> BenchmarkRead:
        benchmark = BenchmarkRead(**payload.model_dump())
        self.benchmarks[benchmark.id] = benchmark
        return benchmark

    def create_item(self, payload: BenchmarkItemCreate, *_args) -> BenchmarkItemRead:
        item = BenchmarkItemRead(**payload.model_dump())
        self.items[item.id] = item
        return item

    def create_kpi(self, payload: ExternalKpiCreate, *_args) -> ExternalKpiRead:
        kpi = ExternalKpiRead(**payload.model_dump())
        self.kpis[kpi.id] = kpi
        return kpi

    def snapshot(self, organization_id: UUID, *_args) -> BenchmarkSnapshotRead:
        return BenchmarkSnapshotRead(
            organization_id=organization_id,
            benchmarks=[item for item in self.benchmarks.values() if item.organization_id == organization_id],
            benchmark_items=[item for item in self.items.values() if item.organization_id == organization_id],
            external_kpis=[item for item in self.kpis.values() if item.organization_id == organization_id],
        )


benchmarks_repository = BenchmarksMemoryRepository()
