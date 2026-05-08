from __future__ import annotations

from app.models import ExecutionReceipt, Job, ModelPreparationJob, ModelSpec, Worker


class InMemoryStore:
    def __init__(self) -> None:
        self.workers: dict[str, Worker] = {}
        self.models: dict[str, ModelSpec] = {}
        self.model_preparations: dict[str, ModelPreparationJob] = {}
        self.jobs: dict[str, Job] = {}
        self.receipts: dict[str, ExecutionReceipt] = {}
        self._worker_seq = 1
        self._job_seq = 1
        self._preparation_seq = 1

    def next_worker_id(self) -> str:
        worker_id = f"worker-{self._worker_seq:04d}"
        self._worker_seq += 1
        return worker_id

    def next_job_id(self) -> str:
        job_id = f"job-{self._job_seq:04d}"
        self._job_seq += 1
        return job_id

    def next_preparation_id(self) -> str:
        preparation_id = f"prep-{self._preparation_seq:04d}"
        self._preparation_seq += 1
        return preparation_id


STORE = InMemoryStore()
