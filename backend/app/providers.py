from __future__ import annotations

from app.auth import get_role_session
from app.identity import resolve_name
from app.model_registry import capability_from_model, deterministic_model_hash, ensure_default_models
from app.models import (
    GpuCapability,
    AuthRole,
    ModelReadinessState,
    ModelSourceType,
    ModelSpec,
    RegisterWorkerRequest,
    Worker,
    WorkerModelCapability,
    WorkerOffer,
)
from app.store import InMemoryStore


def _normalize_endpoint(endpoint: str) -> str:
    return endpoint.rstrip("/")


def _normalize_address(address: str) -> str:
    return address.lower()


def default_gpu_capability() -> GpuCapability:
    return GpuCapability(
        gpu_id="local-rtx-2070",
        display_name="NVIDIA RTX 2070",
        memory_gb=8,
        runtime="vllm",
        status="available",
        notes="Local demo GPU claimed by gpu-prague.eth.",
    )


def register_worker(store: InMemoryStore, request: RegisterWorkerRequest) -> Worker:
    ensure_default_models(store)
    auth_session = get_role_session(store, request.auth_token, AuthRole.PROVIDER)
    worker_name = auth_session.ens_style_name if auth_session and auth_session.ens_style_name else request.name
    worker_address = auth_session.address if auth_session else request.address or resolve_name(worker_name)
    if request.model not in store.models:
        store.models[request.model] = ModelSpec(
            model_id=request.model,
            display_name=request.model,
            model_source=ModelSourceType.WORKER_CATALOG,
            source_ref=f"worker://{worker_name}/{request.model}",
            model_revision="local-demo",
                model_hash=deterministic_model_hash(
                    request.model,
                    f"worker://{worker_name}/{request.model}",
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
    gpu_capabilities = request.gpu_capabilities or [default_gpu_capability()]
    existing_worker = next(
        (
            worker
            for worker in store.workers.values()
            if _normalize_address(worker.address) == _normalize_address(worker_address)
            and _normalize_endpoint(worker.endpoint) == _normalize_endpoint(request.endpoint)
        ),
        None,
    )
    for capability in capabilities:
        if capability.model_id not in store.models:
            store.models[capability.model_id] = ModelSpec(
                model_id=capability.model_id,
                display_name=capability.model_id,
                model_source=capability.model_source,
                source_ref=f"worker://{worker_name}/{capability.model_id}",
                model_revision=capability.model_revision,
                model_hash=capability.model_hash,
                adapter_hash=capability.adapter_hash,
                runtime=capability.runtime,
                readiness_state=capability.readiness_state,
                cold_start_fee=capability.cold_start_fee,
                inference_fee=capability.inference_fee,
            )
    worker_id = existing_worker.worker_id if existing_worker else store.next_worker_id()
    worker = Worker(
        worker_id=worker_id,
        name=worker_name,
        address=worker_address,
        model=capabilities[0].model_id if capabilities else request.model,
        hardware=request.hardware,
        price=capabilities[0].inference_fee if capabilities else request.price,
        status=request.status,
        endpoint=request.endpoint,
        gpu_capabilities=gpu_capabilities,
        model_capabilities=capabilities,
        auth_session_token=auth_session.session_token if auth_session else None,
        auth_verification_status=auth_session.verification_status if auth_session else None,
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


def _offer_id(worker: Worker, gpu: GpuCapability, model: WorkerModelCapability) -> str:
    safe_model = model.model_id.replace("/", "__")
    return f"{worker.worker_id}:{gpu.gpu_id}:{safe_model}"


def offers_for_worker(worker: Worker) -> list[WorkerOffer]:
    offers: list[WorkerOffer] = []
    available_gpus = [gpu for gpu in worker.gpu_capabilities if gpu.status == "available"]
    ready_models = [
        capability
        for capability in worker.model_capabilities
        if capability.readiness_state == ModelReadinessState.READY
    ]
    for gpu in available_gpus:
        for model in ready_models:
            offers.append(
                WorkerOffer(
                    offer_id=_offer_id(worker, gpu, model),
                    worker_id=worker.worker_id,
                    worker_name=worker.name,
                    worker_address=worker.address,
                    worker_status=worker.status,
                    gpu_id=gpu.gpu_id,
                    gpu_name=gpu.display_name,
                    gpu_memory_gb=gpu.memory_gb,
                    gpu_status=gpu.status,
                    model_id=model.model_id,
                    model_source=model.model_source,
                    model_revision=model.model_revision,
                    model_hash=model.model_hash,
                    runtime=model.runtime,
                    readiness_state=model.readiness_state,
                    cold_start_fee=model.cold_start_fee,
                    inference_fee=model.inference_fee,
                    price_per_1m_input_tokens=model.price_per_1m_input_tokens,
                    price_per_1m_output_tokens=model.price_per_1m_output_tokens,
                    currency=model.currency,
                    endpoint=worker.endpoint,
                )
            )
    return offers


def list_worker_offers(store: InMemoryStore, worker_id: str) -> list[WorkerOffer]:
    return offers_for_worker(get_worker(store, worker_id))


def list_offers(store: InMemoryStore) -> list[WorkerOffer]:
    deduped: dict[tuple[str, str, str, str], WorkerOffer] = {}
    for worker in list_workers(store):
        if worker.status != "available":
            continue
        for offer in offers_for_worker(worker):
            key = (
                _normalize_address(offer.worker_address),
                _normalize_endpoint(offer.endpoint),
                offer.gpu_id,
                offer.model_id,
            )
            deduped[key] = offer
    return list(deduped.values())


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
