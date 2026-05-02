from __future__ import annotations

from uuid import UUID

from app.schemas.inference import AnalysisRunBatchRead, AnalysisRunCreate, AnalysisRunRead, build_mock_analysis_run


class InferenceMemoryRepository:
    def __init__(self) -> None:
        self.runs: dict[UUID, AnalysisRunRead] = {}

    def create_run(self, payload: AnalysisRunCreate, *_args) -> AnalysisRunRead:
        run = build_mock_analysis_run(payload)
        self.runs[run.id] = run
        return run

    def create_batch(self, payloads: list[AnalysisRunCreate], *_args) -> AnalysisRunBatchRead:
        return AnalysisRunBatchRead(runs=[self.create_run(payload) for payload in payloads])

    def get_run(self, run_id: UUID, *_args) -> AnalysisRunRead | None:
        return self.runs.get(run_id)

    def list_experiment_runs(self, experiment_id: UUID, *_args) -> list[AnalysisRunRead]:
        return [run for run in self.runs.values() if run.experiment_id == experiment_id]


inference_repository = InferenceMemoryRepository()
