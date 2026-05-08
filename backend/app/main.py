from __future__ import annotations

from fastapi import FastAPI, HTTPException

from app.chain import chain_status
from app.identity import get_identity_metadata, identity_metadata, resolve_name
from app.jobs import (
    create_job,
    get_job,
    list_jobs,
    list_open_jobs,
    pay_job,
    run_agent_task,
    run_job,
    submit_job,
    claim_job,
)
from app.model_registry import (
    get_model,
    list_models,
    list_worker_models,
    prepare_model,
    register_model,
)
from app.models import (
    AgentTaskRequest,
    ClaimJobRequest,
    CreateJobRequest,
    PrepareModelRequest,
    PayJobRequest,
    RegisterModelRequest,
    RegisterWorkerRequest,
    RunJobRequest,
    SubmitJobRequest,
)
from app.providers import get_worker, list_workers, register_worker
from app.receipts import verify_execution_receipt
from app.store import STORE


app = FastAPI(
    title="Infer134 Backend",
    description="Private offchain inference coordinator for the local ETHPrague MVP.",
    version="0.1.0",
)


def _handle_value_error(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "infer134-backend",
        "mode": "local-mvp",
    }


@app.get("/chain/status")
def chain_status_endpoint():
    return chain_status()


@app.get("/identity/mock")
def mock_identities() -> dict[str, str]:
    return identity_metadata()


@app.get("/identity/resolve/{name}")
def resolve_identity_endpoint(name: str):
    return {
        "name": name,
        "address": resolve_name(name),
        "resolver": "mock-ens-style-resolver",
        "note": "This MVP uses mocked ENS-style resolution. Real ENS resolution can replace this boundary later.",
    }


@app.get("/identity/{name}/metadata")
def identity_metadata_endpoint(name: str):
    return get_identity_metadata(name)


@app.post("/workers/register")
def register_worker_endpoint(request: RegisterWorkerRequest):
    return register_worker(STORE, request)


@app.get("/workers")
def workers_endpoint():
    return list_workers(STORE)


@app.get("/workers/{worker_id}")
def worker_endpoint(worker_id: str):
    try:
        return get_worker(STORE, worker_id)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.get("/workers/{worker_id}/models")
def worker_models_endpoint(worker_id: str):
    try:
        return list_worker_models(STORE, worker_id)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/providers/register")
def legacy_register_provider_endpoint(request: RegisterWorkerRequest):
    return register_worker(STORE, request)


@app.get("/providers")
def legacy_providers_endpoint():
    return list_workers(STORE)


@app.get("/models")
def models_endpoint():
    return list_models(STORE)


@app.post("/models/register")
def register_model_endpoint(request: RegisterModelRequest):
    return register_model(STORE, request)


@app.post("/models/prepare")
def prepare_model_endpoint(request: PrepareModelRequest):
    try:
        return prepare_model(STORE, request)
    except (KeyError, ValueError) as exc:
        raise _handle_value_error(ValueError(str(exc))) from exc


@app.get("/models/{model_id}")
def model_endpoint(model_id: str):
    try:
        return get_model(STORE, model_id)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/jobs")
def create_job_endpoint(request: CreateJobRequest):
    try:
        job = create_job(STORE, request)
        return {
            "job": job,
            "payment_explanation": "payment required -> mocked payment state accepted",
            "offchain": ["prompt", "result", "full receipt"],
            "hashable_metadata": ["input_hash", "output_hash", "receipt_hash", "worker", "price", "payment_state"],
        }
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.get("/jobs")
def jobs_endpoint():
    return list_jobs(STORE)


@app.get("/jobs/open")
def open_jobs_endpoint():
    return list_open_jobs(STORE)


@app.get("/jobs/{job_id}")
def job_endpoint(job_id: str):
    try:
        job = get_job(STORE, job_id)
        return {
            "job": job,
            "offchain": ["prompt", "result", "full receipt"],
            "hashable_metadata": ["input_hash", "output_hash", "receipt_hash", "worker", "price", "payment_state"],
        }
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/jobs/{job_id}/claim")
def claim_job_endpoint(job_id: str, request: ClaimJobRequest):
    try:
        return claim_job(STORE, job_id, request)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/jobs/{job_id}/run")
def run_job_endpoint(job_id: str, request: RunJobRequest = RunJobRequest()):
    try:
        return run_job(STORE, job_id, request)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/jobs/{job_id}/submit")
def submit_job_endpoint(job_id: str, request: SubmitJobRequest = SubmitJobRequest()):
    try:
        return submit_job(STORE, job_id, request)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/jobs/{job_id}/complete")
def legacy_complete_job_endpoint(job_id: str, request: SubmitJobRequest = SubmitJobRequest()):
    try:
        return submit_job(STORE, job_id, request)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/jobs/{job_id}/pay")
def pay_job_endpoint(job_id: str, request: PayJobRequest = PayJobRequest()):
    try:
        return pay_job(STORE, job_id, request)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.get("/jobs/{job_id}/receipt")
def receipt_endpoint(job_id: str):
    try:
        job = get_job(STORE, job_id)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc

    receipt = STORE.receipts.get(job_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="receipt not found")
    verification = verify_execution_receipt(receipt)
    return {
        "receipt": receipt,
        "receipt_verified": verification["verified"],
        "job_payment_state": job.payment_state.value,
        "verification": verification,
        "offchain": ["prompt", "result", "full receipt"],
        "verified": ["input hash integrity", "output hash integrity", "receipt hash integrity", "demo signature"],
        "trusted": ["backend coordinator", "worker inference correctness", "mocked payment state"],
    }


@app.post("/agent/tasks")
def agent_task_endpoint(request: AgentTaskRequest):
    try:
        return run_agent_task(STORE, request)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc
