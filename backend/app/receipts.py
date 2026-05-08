from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from app.models import ExecutionReceipt, Job, PaymentState


def sha256_hex(value: str) -> str:
    return "0x" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def utc_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def canonical_receipt_payload(data: dict[str, Any]) -> dict[str, Any]:
    return {
        key: data[key]
        for key in sorted(data)
        if key not in {"signature", "receipt_hash"}
    }


def canonical_json(data: dict[str, Any]) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def receipt_hash_from_payload(data: dict[str, Any]) -> str:
    payload = canonical_receipt_payload(data)
    return sha256_hex(canonical_json(payload))


def demo_sign_receipt(worker_address: str, receipt_hash: str) -> str:
    material = f"infer134-demo-signature|{worker_address.lower()}|{receipt_hash}"
    return sha256_hex(material)


def build_execution_receipt(job: Job) -> ExecutionReceipt:
    if not job.worker or not job.worker_name:
        raise ValueError("job has no claimed worker")
    if not job.output_hash:
        raise ValueError("job has no output hash")

    unsigned = {
        "job_id": job.job_id,
        "model": job.model,
        "model_id": job.model_id,
        "model_source": job.model_source.value,
        "model_revision": job.model_revision,
        "model_hash": job.model_hash,
        "adapter_hash": job.adapter_hash,
        "runtime": job.runtime,
        "input_hash": job.input_hash,
        "output_hash": job.output_hash,
        "worker": job.worker,
        "worker_name": job.worker_name,
        "buyer": job.buyer,
        "buyer_name": job.buyer_name,
        "price": job.price,
        "cold_start_fee": job.cold_start_fee,
        "inference_fee": job.inference_fee,
        "payment_state": PaymentState.PAYABLE.value,
        "timestamp": utc_timestamp(),
    }
    receipt_hash = receipt_hash_from_payload(unsigned)
    signature = demo_sign_receipt(job.worker, receipt_hash)
    return ExecutionReceipt(**unsigned, signature=signature, receipt_hash=receipt_hash)


def verify_execution_receipt(receipt: ExecutionReceipt) -> dict[str, Any]:
    data = receipt.model_dump()
    expected_hash = receipt_hash_from_payload(data)
    expected_signature = demo_sign_receipt(receipt.worker, expected_hash)
    hash_matches = expected_hash == receipt.receipt_hash
    signature_matches = expected_signature == receipt.signature
    return {
        "verified": hash_matches and signature_matches,
        "hash_matches": hash_matches,
        "signature_matches": signature_matches,
        "expected_receipt_hash": expected_hash,
        "actual_receipt_hash": receipt.receipt_hash,
        "signature_scheme": "demo deterministic placeholder; not production cryptography",
        "semantic_correctness": "not verified",
        "model_hash_claim": "trusted worker claim in this MVP; not proof of real execution",
    }
