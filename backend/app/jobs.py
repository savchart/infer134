from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from app.auth import get_role_session
from app.chain import create_escrow_job, release_escrow_payment, settlement_metadata, submit_escrow_result
from app.identity import resolve_name
from app.model_registry import get_model, get_worker_model_capability
from app.models import (
    AgentTaskRequest,
    AuthRole,
    ClaimJobRequest,
    CreateJobRequest,
    Job,
    JobStatus,
    PaymentState,
    RunJobRequest,
    SubmitJobRequest,
)
from app.providers import choose_worker, ensure_default_worker, get_worker
from app.receipts import build_execution_receipt, sha256_hex, verify_execution_receipt
from app.settings import get_chain_settings
from app.store import InMemoryStore


TRUST_NOTES = [
    "prompts and outputs stay offchain in backend memory",
    "hashes prove integrity of stored values, not semantic correctness",
    "signature is a deterministic demo placeholder, not production cryptography",
    "model_hash is a signed worker claim in this MVP, not proof of real execution",
    "backend coordinator is trusted in this MVP",
]


def create_job(store: InMemoryStore, request: CreateJobRequest) -> Job:
    auth_session = get_role_session(store, request.auth_token, AuthRole.CLIENT)
    buyer = auth_session.address if auth_session else request.buyer_address or resolve_name(request.buyer_name)
    buyer_name = auth_session.ens_style_name if auth_session and auth_session.ens_style_name else request.buyer_name
    input_hash = sha256_hex(request.prompt)
    model = get_model(store, request.model_id)
    job = Job(
        job_id=store.next_job_id(),
        buyer=buyer,
        buyer_name=buyer_name,
        prompt=request.prompt,
        input_hash=input_hash,
        prompt_hash=input_hash,
        onchain_job_id=request.onchain_job_id,
        onchain_tx_hash_create=request.onchain_tx_hash_create,
        chain_payment_state=request.chain_payment_state or ("created" if request.onchain_job_id else "not_linked"),
        price=request.price or model.inference_fee,
        model=model.display_name,
        model_id=model.model_id,
        model_source=model.model_source,
        model_revision=model.model_revision,
        model_hash=model.model_hash,
        adapter_hash=model.adapter_hash,
        runtime=model.runtime,
        cold_start_fee=model.cold_start_fee,
        inference_fee=model.inference_fee,
        status=JobStatus.CREATED,
        payment_state=PaymentState.ESCROWED,
        payment_trace=[PaymentState.UNPAID.value, PaymentState.ESCROWED.value],
        trust_notes=list(TRUST_NOTES),
        auth_session_token=auth_session.session_token if auth_session else None,
        auth_verification_status=auth_session.verification_status if auth_session else None,
    )
    store.jobs[job.job_id] = job

    if request.worker_id:
        claim_job(store, job.job_id, ClaimJobRequest(worker_id=request.worker_id))

    return job


def list_jobs(store: InMemoryStore) -> list[Job]:
    return list(store.jobs.values())


def list_open_jobs(store: InMemoryStore) -> list[Job]:
    return [
        job
        for job in store.jobs.values()
        if job.status == JobStatus.CREATED and job.payment_state == PaymentState.ESCROWED
    ]


def get_job(store: InMemoryStore, job_id: str) -> Job:
    try:
        return store.jobs[job_id]
    except KeyError as exc:
        raise ValueError(f"job not found: {job_id}") from exc


def claim_job(store: InMemoryStore, job_id: str, request: ClaimJobRequest) -> Job:
    job = get_job(store, job_id)
    worker = get_worker(store, request.worker_id)
    if job.status not in {JobStatus.CREATED, JobStatus.CLAIMED}:
        raise ValueError(f"job cannot be claimed from status {job.status.value}")
    capability = get_worker_model_capability(worker, job.model_id)
    if not capability:
        raise ValueError(f"worker {worker.worker_id} does not support ready model {job.model_id}")

    job.worker_id = worker.worker_id
    job.worker = worker.address
    job.worker_name = worker.name
    job.model = capability.model_id
    job.model_source = capability.model_source
    job.model_revision = capability.model_revision
    job.model_hash = capability.model_hash
    job.adapter_hash = capability.adapter_hash
    job.runtime = capability.runtime
    job.cold_start_fee = capability.cold_start_fee
    job.inference_fee = capability.inference_fee
    job.price = job.price or capability.inference_fee
    job.status = JobStatus.CLAIMED
    if not job.onchain_job_id:
        try:
            chain_settings = get_chain_settings()
            if chain_settings.chain_write_enabled and chain_settings.worker_address:
                job.worker = chain_settings.worker_address
            chain_result = create_escrow_job(job.worker, job.input_hash)
            job.onchain_job_id = chain_result["onchain_job_id"]
            job.onchain_tx_hash_create = chain_result["tx_hash"]
            job.chain_payment_state = chain_result["chain_payment_state"]
        except Exception:
            job.chain_payment_state = "mock_settlement"
    store.jobs[job_id] = job
    return job


def _provider_payload(job: Job) -> dict[str, Any]:
    return {
        "prompt": job.prompt,
        "worker_address": job.worker,
        "worker_name": job.worker_name,
        "model": job.model,
        "model_id": job.model_id,
        "model_source": job.model_source.value,
        "model_revision": job.model_revision,
        "model_hash": job.model_hash,
        "adapter_hash": job.adapter_hash,
        "runtime": job.runtime,
        "cold_start_fee": job.cold_start_fee,
        "inference_fee": job.inference_fee,
        "price": job.price,
    }


def _local_mock_inference(job: Job) -> dict[str, Any]:
    output = (
        "Infer134 mock result: "
        + sha256_hex(job.prompt + "|" + job.model_id + "|" + (job.worker_name or "worker"))[2:18]
        + " :: "
        + job.prompt.strip()
    )
    return {
        "output": output,
        "input_hash": job.input_hash,
        "output_hash": sha256_hex(output),
        "input_tokens": max(1, len(job.prompt.split())),
        "output_tokens": max(1, len(output.split())),
        "model": job.model,
        "model_id": job.model_id,
        "model_source": job.model_source.value,
        "model_revision": job.model_revision,
        "model_hash": job.model_hash,
        "adapter_hash": job.adapter_hash,
        "runtime": job.runtime,
        "cold_start_fee": job.cold_start_fee,
        "inference_fee": job.inference_fee,
        "worker": job.worker,
        "worker_name": job.worker_name,
        "price": job.price,
        "timestamp": "local-fallback",
        "execution_source": "backend-local-fallback",
    }


def _call_provider_node(job: Job) -> dict[str, Any]:
    provider_url = os.getenv("PROVIDER_NODE_URL", "http://127.0.0.1:8010").rstrip("/")
    body = json.dumps(_provider_payload(job)).encode("utf-8")
    request = urllib.request.Request(
        provider_url + "/infer",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            data["execution_source"] = provider_url
            return data
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return _local_mock_inference(job)


def run_job(store: InMemoryStore, job_id: str, request: RunJobRequest) -> dict[str, Any]:
    job = get_job(store, job_id)
    if request.worker_id and not job.worker_id:
        claim_job(store, job_id, ClaimJobRequest(worker_id=request.worker_id))
        job = get_job(store, job_id)
    if not job.worker_id:
        worker = choose_worker(store, job.model_id)
        claim_job(store, job_id, ClaimJobRequest(worker_id=worker.worker_id))
        job = get_job(store, job_id)

    if job.status not in {JobStatus.CLAIMED, JobStatus.RESULT_READY}:
        raise ValueError(f"job cannot run from status {job.status.value}")

    job.status = JobStatus.RUNNING
    store.jobs[job_id] = job

    inference = _call_provider_node(job)
    job.result = inference["output"]
    job.output_hash = inference["output_hash"]
    job.input_tokens = int(inference.get("input_tokens", 0))
    job.output_tokens = int(inference.get("output_tokens", 0))
    job.model = str(inference.get("model", job.model))
    job.model_id = str(inference.get("model_id", job.model_id))
    job.model_hash = str(inference.get("model_hash", job.model_hash))
    job.model_revision = str(inference.get("model_revision", job.model_revision))
    job.runtime = str(inference.get("runtime", job.runtime))
    job.cold_start_fee = str(inference.get("cold_start_fee", job.cold_start_fee))
    job.inference_fee = str(inference.get("inference_fee", job.inference_fee))
    if inference.get("adapter_hash") is not None:
        job.adapter_hash = str(inference["adapter_hash"])
    job.status = JobStatus.RESULT_READY
    store.jobs[job_id] = job
    return {"job": job, "inference": inference, "settlement_metadata": settlement_metadata(job)}


def submit_job(store: InMemoryStore, job_id: str, request: SubmitJobRequest) -> dict[str, Any]:
    job = get_job(store, job_id)
    if job.status not in {JobStatus.RESULT_READY, JobStatus.RUNNING}:
        raise ValueError(f"job cannot be submitted from status {job.status.value}")

    if request.output is not None:
        job.result = request.output
        job.output_hash = request.output_hash or sha256_hex(request.output)
    if not job.result or not job.output_hash:
        raise ValueError("job has no inference output to submit")

    if request.input_tokens is not None:
        job.input_tokens = request.input_tokens
    if request.output_tokens is not None:
        job.output_tokens = request.output_tokens
    if request.model is not None:
        job.model = request.model
    if request.model_id is not None:
        job.model_id = request.model_id
    if request.model_source is not None:
        job.model_source = request.model_source
    if request.model_revision is not None:
        job.model_revision = request.model_revision
    if request.model_hash is not None:
        job.model_hash = request.model_hash
    if request.adapter_hash is not None:
        job.adapter_hash = request.adapter_hash
    if request.runtime is not None:
        job.runtime = request.runtime
    if request.cold_start_fee is not None:
        job.cold_start_fee = request.cold_start_fee
    if request.inference_fee is not None:
        job.inference_fee = request.inference_fee
    if request.onchain_tx_hash_submit is not None:
        job.onchain_tx_hash_submit = request.onchain_tx_hash_submit
    if request.chain_payment_state is not None:
        job.chain_payment_state = request.chain_payment_state

    receipt = build_execution_receipt(job)
    verification = verify_execution_receipt(receipt)
    job.receipt_hash = receipt.receipt_hash
    job.worker_signature = receipt.signature
    if job.onchain_job_id:
        try:
            chain_result = submit_escrow_result(job.onchain_job_id, job.output_hash, job.receipt_hash)
            job.onchain_tx_hash_submit = chain_result["tx_hash"]
            job.chain_payment_state = chain_result["chain_payment_state"]
        except Exception:
            job.chain_payment_state = "mock_settlement"
    job.status = JobStatus.SUBMITTED
    job.payment_state = PaymentState.PAYABLE
    job.payment_trace.append(PaymentState.PAYABLE.value)
    job.receipt_verified = bool(verification["verified"])
    store.jobs[job_id] = job
    store.receipts[job_id] = receipt
    return {
        "job": job,
        "receipt": receipt,
        "receipt_verified": verification["verified"],
        "verification": verification,
        "settlement_metadata": settlement_metadata(job),
    }


def pay_job(store: InMemoryStore, job_id: str, request: Any | None = None) -> dict[str, Any]:
    job = get_job(store, job_id)
    if job.status != JobStatus.SUBMITTED or job.payment_state != PaymentState.PAYABLE:
        raise ValueError("job is not payable")
    job.status = JobStatus.PAID
    job.payment_state = PaymentState.PAID
    if request and getattr(request, "onchain_tx_hash_release", None):
        job.onchain_tx_hash_release = request.onchain_tx_hash_release
    if request and getattr(request, "chain_payment_state", None):
        job.chain_payment_state = request.chain_payment_state
    elif job.onchain_job_id:
        try:
            chain_result = release_escrow_payment(job.onchain_job_id)
            job.onchain_tx_hash_release = chain_result["tx_hash"]
            job.chain_payment_state = chain_result["chain_payment_state"]
        except Exception:
            job.chain_payment_state = "mock_settlement"
    job.payment_trace.append(PaymentState.PAID.value)
    store.jobs[job_id] = job
    receipt = store.receipts.get(job_id)
    verification = verify_execution_receipt(receipt) if receipt else {"verified": False}
    return {
        "job": job,
        "receipt": receipt,
        "receipt_verified": verification["verified"],
        "verification": verification,
        "settlement_metadata": settlement_metadata(job),
    }


def run_agent_task(store: InMemoryStore, request: AgentTaskRequest) -> dict[str, Any]:
    worker = ensure_default_worker(store)
    model_id = worker.model_capabilities[0].model_id if worker.model_capabilities else "mock-llama"
    job = create_job(
        store,
        CreateJobRequest(
            prompt=request.task_prompt,
            buyer_name=request.buyer_name,
            worker_id=worker.worker_id,
            model_id=model_id,
            price=worker.price,
        ),
    )
    run_result = run_job(store, job.job_id, RunJobRequest(worker_id=worker.worker_id))
    submit_result = submit_job(store, job.job_id, SubmitJobRequest())
    paid_result = pay_job(store, job.job_id)
    final_job = paid_result["job"]
    return {
        "agent": "deterministic demo agent",
        "selected_worker": worker,
        "job": final_job,
        "result": final_job.result,
        "receipt": submit_result["receipt"],
        "receipt_verified": submit_result["receipt_verified"],
        "payment_trace": final_job.payment_trace,
        "flow": [
            "payment required",
            "payment accepted as mocked payment state",
            "work executed",
            "receipt returned",
            "payment marked paid",
        ],
        "trust_assumptions": TRUST_NOTES,
        "verification": submit_result["verification"],
        "run": run_result["inference"],
    }
