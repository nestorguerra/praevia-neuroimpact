from __future__ import annotations

from uuid import UUID

from app.schemas.scoring import NeuroScoringCreate, NeuroScoringRead, build_mock_scoring


class ScoringMemoryRepository:
    def __init__(self) -> None:
        self.results: dict[UUID, NeuroScoringRead] = {}

    def create_result(self, payload: NeuroScoringCreate, *_args) -> NeuroScoringRead:
        result = build_mock_scoring(payload)
        self.results[result.id] = result
        return result

    def get_result(self, result_id: UUID, *_args) -> NeuroScoringRead | None:
        return self.results.get(result_id)

    def list_run_results(self, analysis_run_id: UUID, *_args) -> list[NeuroScoringRead]:
        return [result for result in self.results.values() if result.analysis_run_id == analysis_run_id]

    def list_experiment_results(self, experiment_id: UUID, *_args) -> list[NeuroScoringRead]:
        return [result for result in self.results.values() if result.experiment_id == experiment_id]


scoring_repository = ScoringMemoryRepository()
