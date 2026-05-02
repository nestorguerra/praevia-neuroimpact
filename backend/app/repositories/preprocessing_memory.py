from __future__ import annotations

from uuid import UUID

from app.schemas.preprocessing import PreprocessingBatchRead, PreprocessingJobCreate, PreprocessingJobRead, build_mock_job


class PreprocessingMemoryRepository:
    def __init__(self) -> None:
        self.jobs: dict[UUID, PreprocessingJobRead] = {}

    def create_batch(self, payload: PreprocessingJobCreate, *_args) -> PreprocessingBatchRead:
        jobs = [build_mock_job(asset) for asset in payload.assets]
        for job in jobs:
            self.jobs[job.id] = job
        return PreprocessingBatchRead(jobs=jobs)

    def get_job(self, job_id: UUID, *_args) -> PreprocessingJobRead | None:
        return self.jobs.get(job_id)

    def list_asset_jobs(self, asset_id: UUID, *_args) -> list[PreprocessingJobRead]:
        return [job for job in self.jobs.values() if job.asset_id == asset_id]

    def list_experiment_jobs(self, experiment_id: UUID, *_args) -> list[PreprocessingJobRead]:
        return [job for job in self.jobs.values() if job.experiment_id == experiment_id]


preprocessing_repository = PreprocessingMemoryRepository()
