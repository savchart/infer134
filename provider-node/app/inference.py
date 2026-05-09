from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Protocol

from pydantic import BaseModel, Field

from app.receipts import (
    demo_worker_signature,
    deterministic_timestamp,
    sha256_hex,
    worker_payload_hash,
)


DEFAULT_WORKER_ADDRESS = "0x2000000000000000000000000000000000000002"
DEFAULT_WORKER_NAME = "gpu-prague.eth"
DEFAULT_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
DEFAULT_PRICE = "0.001 local ETH"
DEFAULT_MODEL_REVISION = "main"

ALLOWED_MODELS = {
    "Qwen/Qwen2.5-0.5B-Instruct": {
        "source": "huggingface",
        "notes": "Default small public HF model for local vLLM demos.",
    },
    "Qwen/Qwen3-0.6B": {
        "source": "huggingface",
        "notes": "Allowlisted public Qwen model for local worker demos.",
    },
    "HuggingFaceTB/SmolLM2-360M-Instruct": {
        "source": "huggingface",
        "notes": "Compact public HF instruct model for constrained local GPUs.",
    },
    "mock-llama": {
        "source": "mock",
        "notes": "Deterministic local fallback; no model weights are loaded.",
    },
}


class InferenceRequest(BaseModel):
    prompt: str
    worker_address: str = DEFAULT_WORKER_ADDRESS
    worker_name: str = DEFAULT_WORKER_NAME
    model: str = DEFAULT_MODEL
    model_id: str = DEFAULT_MODEL
    model_source: str | None = None
    model_revision: str = DEFAULT_MODEL_REVISION
    model_hash: str | None = None
    adapter_hash: str | None = None
    runtime: str | None = None
    cold_start_fee: str = "0 local ETH"
    inference_fee: str = DEFAULT_PRICE
    price: str = DEFAULT_PRICE
    max_tokens: int = Field(default=128, ge=1, le=2048)
    temperature: float = Field(default=0, ge=0, le=2)


class InferenceResponse(BaseModel):
    output: str
    runtime: str
    model: str
    model_id: str
    model_source: str
    model_revision: str
    model_hash: str
    adapter_hash: str | None = None
    execution_backend: str
    input_hash: str
    output_hash: str
    input_tokens: int
    output_tokens: int
    worker: str
    worker_name: str
    price: str
    cold_start_fee: str
    inference_fee: str
    timestamp: str
    worker_payload_hash: str
    worker_signature: str


class InferenceRuntime(Protocol):
    runtime_name: str
    execution_backend: str

    def run(self, request: InferenceRequest) -> str:
        ...


def runtime_mode() -> str:
    return os.getenv("INFER134_RUNTIME", "mock").strip().lower()


def configured_model_id() -> str:
    return os.getenv("INFER134_MODEL_ID", DEFAULT_MODEL)


def configured_model_revision() -> str:
    return os.getenv("INFER134_MODEL_REVISION", DEFAULT_MODEL_REVISION)


def ensure_allowed_model(model_id: str) -> None:
    if model_id not in ALLOWED_MODELS:
        allowed = ", ".join(sorted(ALLOWED_MODELS))
        raise ValueError(f"unsupported model_id '{model_id}'. Allowed models: {allowed}")


def model_source_for(model_id: str) -> str:
    return str(ALLOWED_MODELS[model_id]["source"])


def estimate_tokens(text: str) -> int:
    return max(1, len(text.split()))


def deterministic_model_hash(model_id: str, revision: str, runtime: str, adapter_hash: str | None) -> str:
    return sha256_hex("model|" + model_id + "|" + revision + "|" + runtime + "|" + (adapter_hash or ""))


def deterministic_output(prompt: str, model_id: str) -> str:
    digest = sha256_hex(prompt + "|" + model_id)[2:18]
    return (
        "Infer134 mock result "
        + digest
        + ": worker accepted the request and returned an offchain inference output."
    )


class MockInferenceRuntime:
    runtime_name = "mock"
    execution_backend = "mock_worker"

    def run(self, request: InferenceRequest) -> str:
        return deterministic_output(request.prompt, request.model_id)


class VLLMInferenceRuntime:
    runtime_name = "vllm"
    execution_backend = "local_gpu_worker"

    def __init__(self) -> None:
        self.base_url = vllm_base_url()
        self.api_key = vllm_api_key()

    def run(self, request: InferenceRequest) -> str:
        readiness = vllm_backend_status(request.model_id)
        if not readiness["runtime_ready"]:
            raise RuntimeError(
                "vLLM backend is not ready for "
                + request.model_id
                + ": "
                + str(readiness.get("error") or "served model was not reported by /models")
                + ". If vLLM logs mention 'NVIDIA driver on your system is too old', update the driver "
                + "or install PyTorch/vLLM wheels compatible with the local CUDA driver."
            )

        body = json.dumps(
            {
                "model": request.model_id,
                "messages": [
                    {
                        "role": "user",
                        "content": request.prompt,
                    }
                ],
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
            }
        ).encode("utf-8")
        http_request = urllib.request.Request(
            self.base_url + "/chat/completions",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(http_request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (OSError, TimeoutError, urllib.error.URLError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"vLLM request failed: {exc}") from exc

        try:
            return str(payload["choices"][0]["message"]["content"]).strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("vLLM response did not include choices[0].message.content") from exc


def select_runtime() -> InferenceRuntime:
    mode = runtime_mode()
    if mode == "mock":
        return MockInferenceRuntime()
    if mode == "vllm":
        return VLLMInferenceRuntime()
    raise ValueError("INFER134_RUNTIME must be 'mock' or 'vllm'")


def vllm_base_url() -> str:
    return os.getenv("INFER134_VLLM_BASE_URL", "http://127.0.0.1:8001/v1").rstrip("/")


def vllm_api_key() -> str:
    return os.getenv("INFER134_VLLM_API_KEY", "infer134-local")


def vllm_readiness_timeout() -> float:
    raw_timeout = os.getenv("INFER134_VLLM_READINESS_TIMEOUT", "1.0")
    try:
        return max(0.05, float(raw_timeout))
    except ValueError:
        return 1.0


def _served_model_ids(payload: object) -> list[str]:
    if not isinstance(payload, dict):
        return []
    data = payload.get("data")
    if not isinstance(data, list):
        return []

    model_ids: list[str] = []
    for item in data:
        if isinstance(item, dict) and isinstance(item.get("id"), str):
            model_ids.append(str(item["id"]))
    return model_ids


def vllm_backend_status(model_id: str | None = None) -> dict[str, object]:
    current_model = model_id or configured_model_id()
    http_request = urllib.request.Request(
        vllm_base_url() + "/models",
        headers={"Authorization": f"Bearer {vllm_api_key()}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(http_request, timeout=vllm_readiness_timeout()) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return {
            "runtime": "vllm",
            "runtime_ready": False,
            "served_models": [],
            "error": f"vLLM /models returned HTTP {exc.code}",
        }
    except (OSError, TimeoutError, urllib.error.URLError, json.JSONDecodeError) as exc:
        return {
            "runtime": "vllm",
            "runtime_ready": False,
            "served_models": [],
            "error": f"vLLM /models unavailable at {vllm_base_url()}: {exc}",
        }

    served_models = _served_model_ids(payload)
    model_ready = current_model in served_models
    return {
        "runtime": "vllm",
        "runtime_ready": model_ready,
        "served_models": served_models,
        "error": None if model_ready else f"{current_model} is not served by vLLM",
    }


def runtime_backend_status() -> dict[str, object]:
    current_runtime = runtime_mode()
    if current_runtime == "mock":
        return {
            "runtime": "mock",
            "runtime_ready": True,
            "served_models": ["mock-llama"],
            "error": None,
        }
    if current_runtime == "vllm":
        return vllm_backend_status(configured_model_id())
    return {
        "runtime": current_runtime,
        "runtime_ready": False,
        "served_models": [],
        "error": "INFER134_RUNTIME must be 'mock' or 'vllm'",
    }


def build_response(request: InferenceRequest, runtime: InferenceRuntime, output: str) -> InferenceResponse:
    model_revision = request.model_revision or configured_model_revision()
    model_source = model_source_for(request.model_id)
    model_hash = request.model_hash or deterministic_model_hash(
        request.model_id,
        model_revision,
        runtime.runtime_name,
        request.adapter_hash,
    )
    input_hash = sha256_hex(request.prompt)
    output_hash = sha256_hex(output)
    timestamp = deterministic_timestamp(request.prompt + request.worker_address + request.model_id + runtime.runtime_name)
    payload: dict[str, Any] = {
        "input_hash": input_hash,
        "output_hash": output_hash,
        "model": request.model,
        "model_id": request.model_id,
        "model_source": model_source,
        "model_revision": model_revision,
        "model_hash": model_hash,
        "adapter_hash": request.adapter_hash,
        "runtime": runtime.runtime_name,
        "execution_backend": runtime.execution_backend,
        "worker": request.worker_address,
        "worker_name": request.worker_name,
        "price": request.price,
        "cold_start_fee": request.cold_start_fee,
        "inference_fee": request.inference_fee,
        "timestamp": timestamp,
    }
    payload_hash = worker_payload_hash(payload)
    signature = demo_worker_signature(request.worker_address, payload_hash)
    return InferenceResponse(
        output=output,
        runtime=runtime.runtime_name,
        model=request.model,
        model_id=request.model_id,
        model_source=model_source,
        model_revision=model_revision,
        model_hash=model_hash,
        adapter_hash=request.adapter_hash,
        execution_backend=runtime.execution_backend,
        input_hash=input_hash,
        output_hash=output_hash,
        input_tokens=estimate_tokens(request.prompt),
        output_tokens=estimate_tokens(output),
        worker=request.worker_address,
        worker_name=request.worker_name,
        price=request.price,
        cold_start_fee=request.cold_start_fee,
        inference_fee=request.inference_fee,
        timestamp=timestamp,
        worker_payload_hash=payload_hash,
        worker_signature=signature,
    )


def run_inference(request: InferenceRequest) -> InferenceResponse:
    ensure_allowed_model(request.model_id)
    runtime = select_runtime()
    if runtime.runtime_name == "vllm" and model_source_for(request.model_id) != "huggingface":
        raise ValueError("vLLM runtime only accepts allowlisted Hugging Face models")
    output = runtime.run(request)
    return build_response(request, runtime, output)


def list_allowed_models() -> list[dict[str, object]]:
    current_runtime = runtime_mode()
    current_model = configured_model_id()
    backend_status = runtime_backend_status()
    served_models = set(str(model_id) for model_id in backend_status.get("served_models", []))
    return [
        {
            "model_id": model_id,
            "source": data["source"],
            "status": "allowed",
            "runtime_ready": (
                model_id == "mock-llama"
                if current_runtime == "mock"
                else current_runtime == "vllm" and model_id == current_model and model_id in served_models
            ),
            "runtime": current_runtime,
            "notes": data["notes"],
        }
        for model_id, data in ALLOWED_MODELS.items()
    ]


def future_worker_backends() -> list[str]:
    return [
        "mock deterministic inference",
        "vLLM OpenAI-compatible local server",
        "Ollama local model server",
    ]
