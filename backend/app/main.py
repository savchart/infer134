from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from fastapi import FastAPI, HTTPException

from app.auth import create_auth_challenge, get_auth_session, logout_auth_session, verify_auth_challenge
from app.chain import chain_status
from app.identity import get_identity_metadata, identity_metadata, resolve_name
from app.jobs import (
    get_job,
    list_jobs,
    list_open_jobs,
    run_agent_task,
    run_paid_job,
    run_session_job,
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
    AuthChallengeRequest,
    AuthLogoutRequest,
    AuthVerifyRequest,
    PrepareModelRequest,
    RegisterModelRequest,
    RegisterWorkerRequest,
    RunPaidJobRequest,
    RunSessionJobRequest,
)
from app.providers import get_worker, list_offers, list_worker_offers, list_workers, register_worker
from app.receipts import verify_execution_receipt
from app.store import STORE


app = FastAPI(
    title="Infer134 Backend",
    description="Private offchain inference coordinator for the local ETHPrague MVP.",
    version="0.1.0",
)


def _handle_value_error(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


def _provider_connected() -> bool:
    provider_url = os.getenv("PROVIDER_NODE_URL", "http://127.0.0.1:8010").rstrip("/")
    request = urllib.request.Request(provider_url + "/health", method="GET")
    try:
        with urllib.request.urlopen(request, timeout=1) as response:
            json.loads(response.read().decode("utf-8"))
            return response.status == 200
    except (OSError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return False


def _demo_modes() -> dict[str, bool]:
    chain = chain_status()
    chain_connected = bool(chain.get("chain_enabled") and not chain.get("error"))
    provider_connected = _provider_connected()
    return {
        "backend_connected": True,
        "chain_connected": chain_connected,
        "provider_connected": provider_connected,
        "fixture_mode": False,
        "mock_settlement": not chain_connected,
        "mock_inference": not provider_connected,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "infer134-backend",
        "mode": "local-mvp",
    }


@app.post("/auth/challenge")
def auth_challenge_endpoint(request: AuthChallengeRequest):
    try:
        return create_auth_challenge(STORE, request)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/auth/verify")
def auth_verify_endpoint(request: AuthVerifyRequest):
    try:
        session = verify_auth_challenge(STORE, request)
        return {
            "session": session,
            "verification_status": session.verification_status,
            "trusted": ["wallet signature string was recorded", "backend session is in memory"],
            "not_verified": ["signer recovery", "SIWE domain binding", "production authorization"],
        }
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.get("/auth/session/{session_token}")
def auth_session_endpoint(session_token: str):
    try:
        return get_auth_session(STORE, session_token)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/auth/logout")
def auth_logout_endpoint(request: AuthLogoutRequest):
    return logout_auth_session(STORE, request)


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


@app.get("/workers/{worker_id}/offers")
def worker_offers_endpoint(worker_id: str):
    try:
        return list_worker_offers(STORE, worker_id)
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.get("/offers")
def offers_endpoint():
    return list_offers(STORE)


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


@app.post("/jobs/run-paid")
def run_paid_job_endpoint(request: RunPaidJobRequest):
    try:
        result = run_paid_job(STORE, request)
        result["demo_modes"] = _demo_modes()
        result["offchain"] = ["prompt", "result", "full receipt"]
        result["hashable_metadata"] = [
            "input_hash",
            "output_hash",
            "receipt_hash",
            "worker",
            "price",
            "payment_state",
        ]
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise _handle_value_error(exc) from exc


@app.post("/jobs/run-session")
def run_session_job_endpoint(request: RunSessionJobRequest):
    try:
        result = run_session_job(STORE, request)
        result["demo_modes"] = _demo_modes()
        result["offchain"] = ["prompt", "result", "full receipt", "session escrow ledger"]
        result["hashable_metadata"] = [
            "input_hash",
            "output_hash",
            "receipt_hash",
            "worker",
            "token_usage",
            "session_balance",
        ]
        return result
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
            "demo_modes": _demo_modes(),
        }
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
        "demo_modes": _demo_modes(),
    }


@app.post("/agent/tasks")
def agent_task_endpoint(request: AgentTaskRequest):
    try:
        return run_agent_task(STORE, request)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise _handle_value_error(exc) from exc
