from __future__ import annotations

from app.identity import resolve_name
from app.models import RegisterWorkerRequest, Worker
from app.store import InMemoryStore


def register_worker(store: InMemoryStore, request: RegisterWorkerRequest) -> Worker:
    worker_id = store.next_worker_id()
    worker = Worker(
        worker_id=worker_id,
        name=request.name,
        address=request.address or resolve_name(request.name),
        model=request.model,
        hardware=request.hardware,
        price=request.price,
        status=request.status,
        endpoint=request.endpoint,
    )
    store.workers[worker_id] = worker
    return worker


def ensure_default_worker(store: InMemoryStore) -> Worker:
    if store.workers:
        return list(store.workers.values())[0]
    return register_worker(store, RegisterWorkerRequest())


def list_workers(store: InMemoryStore) -> list[Worker]:
    return list(store.workers.values())


def get_worker(store: InMemoryStore, worker_id: str) -> Worker:
    try:
        return store.workers[worker_id]
    except KeyError as exc:
        raise ValueError(f"worker not found: {worker_id}") from exc


def parse_price_amount(price: str) -> float:
    try:
        return float(price.split()[0])
    except (IndexError, ValueError):
        return 0.0


def choose_worker(store: InMemoryStore) -> Worker:
    workers = list_workers(store)
    if not workers:
        return ensure_default_worker(store)
    available = [worker for worker in workers if worker.status == "available"]
    candidates = available or workers
    return sorted(candidates, key=lambda worker: parse_price_amount(worker.price))[0]

