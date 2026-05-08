from __future__ import annotations

import json
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
        "rpc_url": settings.rpc_url,
        "chain_id": settings.chain_id,
        "contract_address": settings.contract_address,
        "latest_block": None,
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
