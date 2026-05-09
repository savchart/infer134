from __future__ import annotations

import json
import shutil
import subprocess
import urllib.error
import urllib.request
from typing import Any

from app.models import Job
from app.settings import get_chain_settings


def _rpc_call(rpc_url: str, method: str, params: list[Any] | None = None) -> Any:
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params or [],
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        rpc_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=2) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if "error" in payload:
        raise ValueError(payload["error"])
    return payload["result"]


def chain_status() -> dict[str, Any]:
    settings = get_chain_settings()
    status: dict[str, Any] = {
        "chain_enabled": settings.chain_enabled,
        "chain_write_enabled": settings.chain_write_enabled,
        "rpc_url": settings.rpc_url,
        "chain_id": settings.chain_id,
        "contract_address": settings.contract_address,
        "worker_address": settings.worker_address,
        "latest_block": None,
        "cast_available": shutil.which("cast") is not None,
        "error": None,
    }
    if not settings.chain_enabled:
        status["error"] = "RPC_URL, CHAIN_ID, and INFERENCE_ESCROW_ADDRESS are required to enable chain reads."
        return status

    try:
        latest_block_hex = _rpc_call(settings.rpc_url or "", "eth_blockNumber")
        status["latest_block"] = int(latest_block_hex, 16)
    except (OSError, TimeoutError, urllib.error.URLError, ValueError) as exc:
        status["chain_enabled"] = False
        status["error"] = str(exc)
    return status


def _run_cast(args: list[str]) -> str:
    if shutil.which("cast") is None:
        raise RuntimeError("cast is not available on PATH")
    result = subprocess.run(
        ["cast", *args],
        check=True,
        capture_output=True,
        text=True,
        timeout=20,
    )
    return result.stdout.strip()


def _parse_transaction_hash(output: str) -> str | None:
    for line in output.splitlines():
        normalized = line.strip()
        if normalized.startswith("transactionHash"):
            parts = normalized.split()
            return parts[-1] if parts else None
        if normalized.startswith("0x") and len(normalized) == 66:
            return normalized
    return None


def _normalize_bytes32(value: str) -> str:
    if value.startswith("0x") and len(value) == 66:
        return value
    raise ValueError(f"expected bytes32 hex value, got: {value}")


# keccak256("JobCreated(uint256,address,address,bytes32,uint256)")
JOB_CREATED_TOPIC0 = "0x08e6e98d4b4e6cb7a4c98fc40a1dfde1d3a6661db3ad3e5d23b43219896489ec"

ESCROW_STATUS_LABELS = {
    0: "created",
    1: "result_submitted",
    2: "paid",
    3: "cancelled",
}


def _topic_to_address(topic: str) -> str:
    return "0x" + topic[-40:]


def _topic_to_uint(topic: str) -> int:
    return int(topic, 16)


def parse_job_created_event(tx_hash: str) -> dict[str, Any]:
    """Read a JobCreated log from the given tx receipt and return its fields."""
    settings = get_chain_settings()
    if not settings.chain_enabled:
        raise RuntimeError("chain not enabled: set RPC_URL, CHAIN_ID, INFERENCE_ESCROW_ADDRESS")
    receipt = _rpc_call(settings.rpc_url or "", "eth_getTransactionReceipt", [tx_hash])
    if not receipt:
        raise ValueError(f"tx receipt not found: {tx_hash}")
    if int(receipt.get("status", "0x0"), 16) != 1:
        raise ValueError(f"tx not mined or reverted: {tx_hash}")
    contract_address = (settings.contract_address or "").lower()
    for log in receipt.get("logs", []):
        if log.get("address", "").lower() != contract_address:
            continue
        topics = log.get("topics", [])
        if not topics or topics[0].lower() != JOB_CREATED_TOPIC0.lower():
            continue
        if len(topics) < 4:
            continue
        return {
            "onchain_job_id": str(_topic_to_uint(topics[1])),
            "buyer": _topic_to_address(topics[2]),
            "worker": _topic_to_address(topics[3]),
            "tx_hash": tx_hash,
            "block_number": int(log.get("blockNumber", "0x0"), 16),
        }
    raise ValueError(f"JobCreated event not found in tx logs: {tx_hash}")


def verify_escrow_job(onchain_job_id: str) -> dict[str, Any]:
    """Read jobs(uint256) on the escrow contract for the given job id."""
    settings = get_chain_settings()
    if not settings.chain_enabled:
        raise RuntimeError("chain not enabled: set RPC_URL, CHAIN_ID, INFERENCE_ESCROW_ADDRESS")
    raw = _run_cast(
        [
            "call",
            settings.contract_address or "",
            "jobs(uint256)(address,address,uint256,uint256,bytes32,bytes32,bytes32,uint8)",
            str(onchain_job_id),
            "--rpc-url",
            settings.rpc_url or "",
        ]
    )
    parts = [line.strip() for line in raw.splitlines() if line.strip()]
    if len(parts) < 8:
        raise ValueError(f"unexpected jobs() output: {raw}")
    buyer, worker, escrow_amount, requested_payment, input_hash, output_hash, receipt_hash, status_raw = parts[:8]
    status_int = int(status_raw.split()[0])
    if buyer.lower() == "0x0000000000000000000000000000000000000000":
        raise ValueError(f"escrow job not found onchain: {onchain_job_id}")
    return {
        "onchain_job_id": str(onchain_job_id),
        "buyer": buyer,
        "worker": worker,
        "escrow_amount": int(escrow_amount.split()[0]),
        "requested_payment": int(requested_payment.split()[0]),
        "input_hash": input_hash,
        "output_hash": output_hash,
        "receipt_hash": receipt_hash,
        "status_code": status_int,
        "status": ESCROW_STATUS_LABELS.get(status_int, f"unknown({status_int})"),
    }


def create_escrow_job(worker: str, input_hash: str) -> dict[str, str]:
    settings = get_chain_settings()
    if not settings.chain_write_enabled:
        raise RuntimeError("chain write disabled: RPC_URL, CHAIN_ID, INFERENCE_ESCROW_ADDRESS, BUYER_PRIVATE_KEY, and WORKER_PRIVATE_KEY are required")

    next_job_id = _run_cast(
        [
            "call",
            settings.contract_address or "",
            "nextJobId()(uint256)",
            "--rpc-url",
            settings.rpc_url or "",
        ]
    )
    output = _run_cast(
        [
            "send",
            settings.contract_address or "",
            "createJob(address,bytes32)",
            worker,
            _normalize_bytes32(input_hash),
            "--value",
            settings.escrow_value,
            "--rpc-url",
            settings.rpc_url or "",
            "--private-key",
            settings.buyer_private_key or "",
        ]
    )
    return {
        "onchain_job_id": next_job_id.splitlines()[-1].strip(),
        "tx_hash": _parse_transaction_hash(output) or "unknown",
        "chain_payment_state": "created",
    }


def submit_escrow_result(onchain_job_id: str, output_hash: str, receipt_hash: str) -> dict[str, str]:
    settings = get_chain_settings()
    if not settings.chain_write_enabled:
        raise RuntimeError("chain write disabled")
    output = _run_cast(
        [
            "send",
            settings.contract_address or "",
            "submitResult(uint256,bytes32,bytes32,uint256)",
            onchain_job_id,
            _normalize_bytes32(output_hash),
            _normalize_bytes32(receipt_hash),
            settings.requested_payment_wei,
            "--rpc-url",
            settings.rpc_url or "",
            "--private-key",
            settings.worker_private_key or "",
        ]
    )
    return {
        "tx_hash": _parse_transaction_hash(output) or "unknown",
        "chain_payment_state": "result_submitted",
    }


def release_escrow_payment(onchain_job_id: str) -> dict[str, str]:
    settings = get_chain_settings()
    if not settings.chain_write_enabled:
        raise RuntimeError("chain write disabled")
    output = _run_cast(
        [
            "send",
            settings.contract_address or "",
            "releasePayment(uint256)",
            onchain_job_id,
            "--rpc-url",
            settings.rpc_url or "",
            "--private-key",
            settings.buyer_private_key or "",
        ]
    )
    return {
        "tx_hash": _parse_transaction_hash(output) or "unknown",
        "chain_payment_state": "paid",
    }


def settlement_metadata(job: Job) -> dict[str, str | None]:
    return {
        "input_hash": job.input_hash,
        "output_hash": job.output_hash,
        "receipt_hash": job.receipt_hash,
        "worker": job.worker,
        "worker_name": job.worker_name,
        "model_id": job.model_id,
        "model_source": job.model_source.value,
        "model_revision": job.model_revision,
        "model_hash": job.model_hash,
        "adapter_hash": job.adapter_hash,
        "runtime": job.runtime,
        "price": job.price,
        "payment_state": job.payment_state.value,
        "onchain_job_id": job.onchain_job_id,
        "chain_payment_state": job.chain_payment_state,
        "onchain_tx_hash_create": job.onchain_tx_hash_create,
        "onchain_tx_hash_submit": job.onchain_tx_hash_submit,
        "onchain_tx_hash_release": job.onchain_tx_hash_release,
        "prototype_note": "Payment settlement can be linked to local Anvil; prompts and outputs stay offchain.",
    }
