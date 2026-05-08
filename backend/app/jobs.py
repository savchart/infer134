from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from app.chain import settlement_metadata
from app.identity import resolve_name
from app.models import (
    AgentTaskRequest,
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
from app.store import InMemoryStore


TRUST_NOTES = [
    "prompts and outputs stay offchain in backend memory",
    "hashes prove integrity of stored values, not semantic correctness",
    "signature is a deterministic demo placeholder, not production cryptography",
    "backend coordinator is trusted in this MVP",
]


def create_job(store: InMemoryStore, request: CreateJobRequest) -> Job:
    buyer = request.buyer_address or resolve_name(request.buyer_name)
    input_hash = sha256_hex(request.prompt)
    job = Job(
        job_id=store.next_job_id(),
        buyer=buyer,
        buyer_name=request.buyer_name,
        prompt=request.prompt,
        input_hash=input_hash,
        prompt_hash=input_hash,
        price=request.price or "0.01 USDC",
        status=JobStatus.CREATED,
        payment_state=PaymentState.ESCROWED,
        payment_trace=[PaymentState.UNPAID.value, PaymentState.ESCROWED.value],
        trust_notes=list(TRUST_NOTES),
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

    job.worker_id = worker.worker_id
    job.worker = worker.address
    job.worker_name = worker.name
    job.model = worker.model
    job.price = job.price or worker.price
    job.status = JobStatus.CLAIMED
    store.jobs[job_id] = job
    return job


def _provider_payload(job: Job) -> dict[str, Any]:
    return {
        "prompt": job.prompt,
        "worker_address": job.worker,
        "worker_name": job.worker_name,
        "model": job.model,
        "price": job.price,
    }


def _local_mock_inference(job: Job) -> dict[str, Any]:
    output = (
        "Infer134 mock result: "
        + sha256_hex(job.prompt + "|" + (job.worker_name or "worker"))[2:18]
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
        worker = choose_worker(store)
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

    receipt = build_execution_receipt(job)
    verification = verify_execution_receipt(receipt)
    job.receipt_hash = receipt.receipt_hash
    job.worker_signature = receipt.signature
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


def pay_job(store: InMemoryStore, job_id: str) -> dict[str, Any]:
    job = get_job(store, job_id)
    if job.status != JobStatus.SUBMITTED or job.payment_state != PaymentState.PAYABLE:
        raise ValueError("job is not payable")
    job.status = JobStatus.PAID
    job.payment_state = PaymentState.PAID
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
    job = create_job(
        store,
        CreateJobRequest(
            prompt=request.task_prompt,
            buyer_name=request.buyer_name,
            worker_id=worker.worker_id,
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
