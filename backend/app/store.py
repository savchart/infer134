from __future__ import annotations

from app.models import ExecutionReceipt, Job, Worker


class InMemoryStore:
    def __init__(self) -> None:
        self.workers: dict[str, Worker] = {}
        self.jobs: dict[str, Job] = {}
        self.receipts: dict[str, ExecutionReceipt] = {}
        self._worker_seq = 1
        self._job_seq = 1

    def next_worker_id(self) -> str:
        worker_id = f"worker-{self._worker_seq:04d}"
        self._worker_seq += 1
        return worker_id

    def next_job_id(self) -> str:
        job_id = f"job-{self._job_seq:04d}"
        self._job_seq += 1
        return job_id


STORE = InMemoryStore()

