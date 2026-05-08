from __future__ import annotations

from app.identity import resolve_name
from app.models import (
    ModelPreparationJob,
    ModelReadinessState,
    ModelSourceType,
    ModelSpec,
    PrepareModelRequest,
    RegisterModelRequest,
    Worker,
    WorkerModelCapability,
)
from app.receipts import sha256_hex
from app.store import InMemoryStore


DEFAULT_MODEL_ID = "mock-llama"

MODEL_TRUST_NOTES = [
    "model_hash is a signed worker claim in this MVP",
    "model_hash does not prove semantic correctness or real execution",
    "model weights are never stored onchain or in this backend",
]


def deterministic_model_hash(model_id: str, source_ref: str, revision: str, runtime: str, adapter_hash: str | None) -> str:
    material = "|".join([model_id, source_ref, revision, runtime, adapter_hash or ""])
    return sha256_hex("model|" + material)


def default_model_spec() -> ModelSpec:
    source_ref = "worker://gpu-prague/mock-llama"
    revision = "local-demo"
    runtime = "mock-runtime"
    return ModelSpec(
        model_id=DEFAULT_MODEL_ID,
        display_name="Mock Llama",
        model_source=ModelSourceType.WORKER_CATALOG,
        source_ref=source_ref,
        model_revision=revision,
        model_hash=deterministic_model_hash(DEFAULT_MODEL_ID, source_ref, revision, runtime, None),
        runtime=runtime,
        readiness_state=ModelReadinessState.READY,
        cold_start_fee="0 USDC",
        inference_fee="0.01 USDC",
        trust_notes=list(MODEL_TRUST_NOTES),
    )


def capability_from_model(model: ModelSpec) -> WorkerModelCapability:
    return WorkerModelCapability(
        model_id=model.model_id,
        model_source=model.model_source,
        model_revision=model.model_revision,
        model_hash=model.model_hash,
        adapter_hash=model.adapter_hash,
        runtime=model.runtime,
        readiness_state=model.readiness_state,
        cold_start_fee=model.cold_start_fee,
        inference_fee=model.inference_fee,
    )


def ensure_default_models(store: InMemoryStore) -> None:
    if DEFAULT_MODEL_ID not in store.models:
        store.models[DEFAULT_MODEL_ID] = default_model_spec()


def list_models(store: InMemoryStore) -> list[ModelSpec]:
    ensure_default_models(store)
    return list(store.models.values())


def get_model(store: InMemoryStore, model_id: str) -> ModelSpec:
    ensure_default_models(store)
    try:
        return store.models[model_id]
    except KeyError as exc:
        raise ValueError(f"model not found or not ready: {model_id}") from exc


def register_model(store: InMemoryStore, request: RegisterModelRequest) -> ModelSpec:
    model_hash = request.model_hash or deterministic_model_hash(
        request.model_id,
        request.source_ref,
        request.model_revision,
        request.runtime,
        request.adapter_hash,
    )
    model = ModelSpec(
        model_id=request.model_id,
        display_name=request.display_name or request.model_id,
        model_source=request.model_source,
        source_ref=request.source_ref,
        model_revision=request.model_revision,
        model_hash=model_hash,
        adapter_hash=request.adapter_hash,
        runtime=request.runtime,
        readiness_state=request.readiness_state,
        cold_start_fee=request.cold_start_fee,
        inference_fee=request.inference_fee,
        trust_notes=list(MODEL_TRUST_NOTES),
    )
    store.models[model.model_id] = model
    return model


def worker_supports_model(worker: Worker, model_id: str) -> bool:
    return get_worker_model_capability(worker, model_id) is not None


def get_worker_model_capability(worker: Worker, model_id: str) -> WorkerModelCapability | None:
    for capability in worker.model_capabilities:
        if capability.model_id == model_id and capability.readiness_state == ModelReadinessState.READY:
            return capability
    return None


def list_worker_models(store: InMemoryStore, worker_id: str) -> list[WorkerModelCapability]:
    try:
        return store.workers[worker_id].model_capabilities
    except KeyError as exc:
        raise ValueError(f"worker not found: {worker_id}") from exc


def attach_model_to_worker(store: InMemoryStore, worker: Worker, model: ModelSpec) -> Worker:
    capability = capability_from_model(model)
    remaining = [item for item in worker.model_capabilities if item.model_id != capability.model_id]
    worker.model_capabilities = [*remaining, capability]
    worker.model = capability.model_id
    worker.price = capability.inference_fee
    store.workers[worker.worker_id] = worker
    return worker


def prepare_model(store: InMemoryStore, request: PrepareModelRequest) -> dict[str, ModelPreparationJob | ModelSpec]:
    if not store.workers:
        raise ValueError("no worker available to prepare model")

    if request.worker_id and request.worker_id not in store.workers:
        raise ValueError(f"worker not found: {request.worker_id}")
    worker = store.workers[request.worker_id] if request.worker_id else list(store.workers.values())[0]
    model_hash = deterministic_model_hash(
        request.model_id,
        request.source_ref,
        request.model_revision,
        request.runtime,
        request.adapter_hash,
    )
    trace = [
        ModelReadinessState.REQUESTED.value,
        ModelReadinessState.ACCEPTED.value,
        ModelReadinessState.PREPARING.value,
        ModelReadinessState.READY.value,
    ]
    preparation = ModelPreparationJob(
        preparation_job_id=store.next_preparation_id(),
        model_id=request.model_id,
        buyer=request.buyer_address or resolve_name(request.buyer_name),
        buyer_name=request.buyer_name,
        worker_id=worker.worker_id,
        worker=worker.address,
        worker_name=worker.name,
        model_source=request.model_source,
        source_ref=request.source_ref,
        model_revision=request.model_revision,
        model_hash=model_hash,
        adapter_hash=request.adapter_hash,
        runtime=request.runtime,
        readiness_state=ModelReadinessState.READY,
        readiness_trace=trace,
        cold_start_fee=request.cold_start_fee,
        inference_fee=request.inference_fee,
        trust_notes=list(MODEL_TRUST_NOTES),
    )
    model = ModelSpec(
        model_id=request.model_id,
        display_name=request.model_id,
        model_source=request.model_source,
        source_ref=request.source_ref,
        model_revision=request.model_revision,
        model_hash=model_hash,
        adapter_hash=request.adapter_hash,
        runtime=request.runtime,
        readiness_state=ModelReadinessState.READY,
        cold_start_fee=request.cold_start_fee,
        inference_fee=request.inference_fee,
        trust_notes=list(MODEL_TRUST_NOTES),
    )
    store.model_preparations[preparation.preparation_job_id] = preparation
    store.models[model.model_id] = model
    attach_model_to_worker(store, worker, model)
    return {"preparation": preparation, "model": model}
