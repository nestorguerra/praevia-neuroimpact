from __future__ import annotations

from uuid import UUID

from app.schemas.comparisons import ComparisonCreate, ComparisonRead, build_comparison
from app.schemas.scoring import NeuroScoringRead


class ComparisonMemoryRepository:
    def __init__(self) -> None:
        self.comparisons: dict[UUID, ComparisonRead] = {}

    def create_comparison(self, results: list[NeuroScoringRead], payload: ComparisonCreate, *_args) -> ComparisonRead:
        comparison = build_comparison(results, payload)
        self.comparisons[comparison.id] = comparison
        return comparison

    def get_comparison(self, comparison_id: UUID, *_args) -> ComparisonRead | None:
        return self.comparisons.get(comparison_id)

    def list_experiment_comparisons(self, experiment_id: UUID, *_args) -> list[ComparisonRead]:
        return [
            comparison
            for comparison in self.comparisons.values()
            if comparison.experiment_id == experiment_id
        ]


comparison_repository = ComparisonMemoryRepository()
