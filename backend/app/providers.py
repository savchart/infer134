from __future__ import annotations

from app.identity import resolve_name
from app.model_registry import capability_from_model, deterministic_model_hash, ensure_default_models
from app.models import ModelReadinessState, ModelSourceType, ModelSpec, RegisterWorkerRequest, Worker
from app.store import InMemoryStore


def register_worker(store: InMemoryStore, request: RegisterWorkerRequest) -> Worker:
    ensure_default_models(store)
    worker_id = store.next_worker_id()
    if request.model not in store.models:
        store.models[request.model] = ModelSpec(
            model_id=request.model,
            display_name=request.model,
            model_source=ModelSourceType.WORKER_CATALOG,
            source_ref=f"worker://{request.name}/{request.model}",
            model_revision="local-demo",
            model_hash=deterministic_model_hash(
                request.model,
                f"worker://{request.name}/{request.model}",
                "local-demo",
                "mock-runtime",
                None,
            ),
            runtime="mock-runtime",
            readiness_state=ModelReadinessState.READY,
            cold_start_fee="0 USDC",
            inference_fee=request.price,
        )
    capabilities = request.model_capabilities or [capability_from_model(store.models[request.model])]
    for capability in capabilities:
        if capability.model_id not in store.models:
            store.models[capability.model_id] = ModelSpec(
                model_id=capability.model_id,
                display_name=capability.model_id,
                model_source=capability.model_source,
                source_ref=f"worker://{request.name}/{capability.model_id}",
                model_revision=capability.model_revision,
                model_hash=capability.model_hash,
                adapter_hash=capability.adapter_hash,
                runtime=capability.runtime,
                readiness_state=capability.readiness_state,
                cold_start_fee=capability.cold_start_fee,
                inference_fee=capability.inference_fee,
            )
    worker = Worker(
        worker_id=worker_id,
        name=request.name,
        address=request.address or resolve_name(request.name),
        model=capabilities[0].model_id if capabilities else request.model,
        hardware=request.hardware,
        price=capabilities[0].inference_fee if capabilities else request.price,
        status=request.status,
        endpoint=request.endpoint,
        model_capabilities=capabilities,
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


def choose_worker(store: InMemoryStore, model_id: str = "mock-llama") -> Worker:
    from app.model_registry import worker_supports_model

    workers = list_workers(store)
    if not workers:
        return ensure_default_worker(store)
    available = [worker for worker in workers if worker.status == "available"]
    candidates = [worker for worker in (available or workers) if worker_supports_model(worker, model_id)]
    if not candidates:
        raise ValueError(f"no available worker supports model: {model_id}")
    return sorted(candidates, key=lambda worker: parse_price_amount(worker.price))[0]
