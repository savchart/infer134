from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from app.auth import get_role_session
from app.chain import (
    create_escrow_job,
    parse_job_created_event,
    settlement_metadata,
    submit_escrow_result,
    verify_escrow_job,
)
from app.identity import resolve_name
from app.model_registry import get_worker_model_capability
from app.models import (
    AgentTaskRequest,
    AuthRole,
    Job,
    JobStatus,
    PaymentState,
    RunPaidJobRequest,
)
from app.providers import ensure_default_worker, get_worker, list_offers
from app.receipts import build_execution_receipt, sha256_hex, verify_execution_receipt
from app.settings import get_chain_settings
from app.store import InMemoryStore


TRUST_NOTES = [
    "prompts and outputs stay offchain in backend memory",
    "hashes prove integrity of stored values, not semantic correctness",
    "signature is a deterministic demo placeholder, not production cryptography",
    "model_hash is a signed worker claim in this MVP, not proof of real execution",
    "backend coordinator is trusted in this MVP",
    "buyer-signed escrow tx gates inference; backend verifies the onchain state before running the model",
]


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


def _find_offer(store: InMemoryStore, offer_id: str):
    for offer in list_offers(store):
        if offer.offer_id == offer_id:
            return offer
    raise ValueError(f"offer not found: {offer_id}")


def _addresses_match(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return False
    return left.lower() == right.lower()


def _execute_paid_job(
    store: InMemoryStore,
    *,
    prompt: str,
    offer,
    worker,
    onchain_job_id: str,
    onchain_tx_hash: str,
    escrow_amount: int,
    buyer: str,
    buyer_name: str,
    auth_session_token: str | None,
    auth_verification_status: str | None,
) -> dict[str, Any]:
    """Build the local Job, run inference, submit on-chain, return the full payload."""
    capability = get_worker_model_capability(worker, offer.model_id)
    if not capability:
        raise ValueError(f"worker {worker.worker_id} does not advertise ready model {offer.model_id}")

    input_hash = sha256_hex(prompt)
    job = Job(
        job_id=store.next_job_id(),
        onchain_job_id=str(onchain_job_id),
        onchain_tx_hash_create=onchain_tx_hash,
        chain_payment_state="created",
        buyer=buyer,
        buyer_name=buyer_name,
        worker_id=worker.worker_id,
        worker=worker.address,
        worker_name=worker.name,
        prompt=prompt,
        input_hash=input_hash,
        prompt_hash=input_hash,
        model=capability.model_id,
        model_id=capability.model_id,
        model_source=capability.model_source,
        model_revision=capability.model_revision,
        model_hash=capability.model_hash,
        adapter_hash=capability.adapter_hash,
        runtime=capability.runtime,
        cold_start_fee=capability.cold_start_fee,
        inference_fee=capability.inference_fee,
        price=capability.inference_fee,
        status=JobStatus.RUNNING,
        payment_state=PaymentState.ESCROWED,
        payment_trace=[PaymentState.UNPAID.value, PaymentState.ESCROWED.value],
        trust_notes=list(TRUST_NOTES),
        auth_session_token=auth_session_token,
        auth_verification_status=auth_verification_status,
    )
    store.jobs[job.job_id] = job

    inference = _call_provider_node(job)
    job.result = inference["output"]
    job.output_hash = inference["output_hash"]
    job.input_tokens = int(inference.get("input_tokens", 0))
    job.output_tokens = int(inference.get("output_tokens", 0))
    job.model = str(inference.get("model", job.model))
    job.runtime = str(inference.get("runtime", job.runtime))
    job.status = JobStatus.RESULT_READY
    store.jobs[job.job_id] = job

    receipt = build_execution_receipt(job)
    verification = verify_execution_receipt(receipt)
    job.receipt_hash = receipt.receipt_hash
    job.worker_signature = receipt.signature
    job.receipt_verified = bool(verification["verified"])

    try:
        chain_result = submit_escrow_result(job.onchain_job_id, job.output_hash, job.receipt_hash)
        job.onchain_tx_hash_submit = chain_result["tx_hash"]
        job.chain_payment_state = chain_result["chain_payment_state"]
    except Exception as exc:  # noqa: BLE001 - surface as job-level chain failure
        job.chain_payment_state = f"submit_failed: {exc}"

    job.status = JobStatus.SUBMITTED
    job.payment_state = PaymentState.PAYABLE
    job.payment_trace.append(PaymentState.PAYABLE.value)
    store.jobs[job.job_id] = job
    store.receipts[job.job_id] = receipt
    return {
        "job": job,
        "receipt": receipt,
        "receipt_verified": verification["verified"],
        "verification": verification,
        "settlement_metadata": settlement_metadata(job),
        "escrow_amount_wei": str(escrow_amount),
    }


def run_paid_job(store: InMemoryStore, request: RunPaidJobRequest) -> dict[str, Any]:
    settings = get_chain_settings()
    if not settings.chain_enabled:
        raise RuntimeError("chain not enabled: /jobs/run-paid requires RPC_URL, CHAIN_ID, INFERENCE_ESCROW_ADDRESS")

    offer = _find_offer(store, request.offer_id)
    worker = get_worker(store, offer.worker_id)

    escrow = verify_escrow_job(request.onchain_job_id)
    if escrow["status"] != "created":
        raise ValueError(f"escrow job is not in 'created' state: {escrow['status']}")

    expected_input_hash = sha256_hex(request.prompt)
    if escrow["input_hash"].lower() != expected_input_hash.lower():
        raise ValueError("escrow input_hash does not match sha256(prompt); refusing to run inference")

    if not _addresses_match(escrow["worker"], offer.worker_address):
        raise ValueError("escrow worker address does not match the selected offer worker")

    event = parse_job_created_event(request.tx_hash)
    if event["onchain_job_id"] != str(request.onchain_job_id):
        raise ValueError("tx_hash JobCreated jobId does not match onchain_job_id")
    if not _addresses_match(event["buyer"], escrow["buyer"]):
        raise ValueError("tx_hash buyer does not match escrow buyer")

    if request.model_id and request.model_id != offer.model_id:
        raise ValueError(f"model_id mismatch: offer is {offer.model_id}, request says {request.model_id}")

    auth_session = get_role_session(store, request.auth_token, AuthRole.CLIENT)
    if auth_session and not _addresses_match(auth_session.address, escrow["buyer"]):
        raise ValueError("auth session address does not match escrow buyer")

    buyer = (
        auth_session.address
        if auth_session
        else (request.buyer_address or escrow["buyer"])
    )
    buyer_name = (
        auth_session.ens_style_name
        if auth_session and auth_session.ens_style_name
        else request.buyer_name
    )

    return _execute_paid_job(
        store,
        prompt=request.prompt,
        offer=offer,
        worker=worker,
        onchain_job_id=str(request.onchain_job_id),
        onchain_tx_hash=request.tx_hash,
        escrow_amount=escrow["escrow_amount"],
        buyer=buyer,
        buyer_name=buyer_name,
        auth_session_token=auth_session.session_token if auth_session else None,
        auth_verification_status=auth_session.verification_status if auth_session else None,
    )


def run_agent_task(store: InMemoryStore, request: AgentTaskRequest) -> dict[str, Any]:
    """Server-side autonomous agent demo. Backend acts as buyer using BUYER_PRIVATE_KEY."""
    settings = get_chain_settings()
    if not settings.chain_write_enabled:
        raise RuntimeError(
            "agent flow needs chain writes: set RPC_URL, CHAIN_ID, INFERENCE_ESCROW_ADDRESS, "
            "BUYER_PRIVATE_KEY, WORKER_PRIVATE_KEY"
        )

    worker = ensure_default_worker(store)
    offers = [offer for offer in list_offers(store) if offer.worker_id == worker.worker_id]
    if not offers:
        raise RuntimeError("no offers published for the default worker; the agent cannot pick a model")
    offer = offers[0]

    chain_result = create_escrow_job(offer.worker_address, sha256_hex(request.task_prompt))
    onchain_job_id = chain_result["onchain_job_id"]
    onchain_tx_hash = chain_result["tx_hash"]

    escrow = verify_escrow_job(onchain_job_id)
    payload = _execute_paid_job(
        store,
        prompt=request.task_prompt,
        offer=offer,
        worker=worker,
        onchain_job_id=onchain_job_id,
        onchain_tx_hash=onchain_tx_hash,
        escrow_amount=escrow["escrow_amount"],
        buyer=escrow["buyer"],
        buyer_name=request.buyer_name,
        auth_session_token=None,
        auth_verification_status=None,
    )
    final_job: Job = payload["job"]
    return {
        "agent": "deterministic demo agent",
        "selected_worker": worker,
        "selected_offer": offer,
        "job": final_job,
        "result": final_job.result,
        "receipt": payload["receipt"],
        "receipt_verified": payload["receipt_verified"],
        "payment_trace": final_job.payment_trace,
        "flow": [
            "buyer dev key signs createJob{value}",
            "backend verifies escrow onchain state",
            "inference runs gated on escrow validity",
            "worker key signs submitResult onchain",
        ],
        "trust_assumptions": TRUST_NOTES,
        "verification": payload["verification"],
        "settlement_metadata": payload["settlement_metadata"],
    }
