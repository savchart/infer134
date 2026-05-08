from __future__ import annotations

from pydantic import BaseModel

from app.receipts import (
    demo_worker_signature,
    deterministic_timestamp,
    sha256_hex,
    worker_payload_hash,
)


DEFAULT_WORKER_ADDRESS = "0x2000000000000000000000000000000000000002"
DEFAULT_WORKER_NAME = "gpu-prague.eth"
DEFAULT_MODEL = "mock-llama"
DEFAULT_PRICE = "0.01 USDC"


class InferenceRequest(BaseModel):
    prompt: str
    worker_address: str = DEFAULT_WORKER_ADDRESS
    worker_name: str = DEFAULT_WORKER_NAME
    model: str = DEFAULT_MODEL
    price: str = DEFAULT_PRICE


class InferenceResponse(BaseModel):
    output: str
    input_hash: str
    output_hash: str
    input_tokens: int
    output_tokens: int
    model: str
    worker: str
    worker_name: str
    price: str
    timestamp: str
    worker_payload_hash: str
    worker_signature: str


def estimate_tokens(text: str) -> int:
    return max(1, len(text.split()))


def deterministic_output(prompt: str, model: str) -> str:
    digest = sha256_hex(prompt + "|" + model)[2:18]
    return (
        "Infer134 mock result "
        + digest
        + ": worker accepted the request and returned an offchain inference output."
    )


def run_mock_inference(request: InferenceRequest) -> InferenceResponse:
    output = deterministic_output(request.prompt, request.model)
    input_hash = sha256_hex(request.prompt)
    output_hash = sha256_hex(output)
    timestamp = deterministic_timestamp(request.prompt + request.worker_address + request.model)
    payload = {
        "input_hash": input_hash,
        "output_hash": output_hash,
        "model": request.model,
        "worker": request.worker_address,
        "worker_name": request.worker_name,
        "price": request.price,
        "timestamp": timestamp,
    }
    payload_hash = worker_payload_hash(payload)
    signature = demo_worker_signature(request.worker_address, payload_hash)
    return InferenceResponse(
        output=output,
        input_hash=input_hash,
        output_hash=output_hash,
        input_tokens=estimate_tokens(request.prompt),
        output_tokens=estimate_tokens(output),
        model=request.model,
        worker=request.worker_address,
        worker_name=request.worker_name,
        price=request.price,
        timestamp=timestamp,
        worker_payload_hash=payload_hash,
        worker_signature=signature,
    )


def future_worker_backends() -> list[str]:
    return [
        "mock deterministic inference",
        "Ollama local model server",
        "vLLM local or LAN model server",
    ]
