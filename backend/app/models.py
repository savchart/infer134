from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class PaymentState(str, Enum):
    UNPAID = "unpaid"
    ESCROWED = "escrowed"
    PAYABLE = "payable"
    PAID = "paid"
    CANCELLED = "cancelled"


class JobStatus(str, Enum):
    CREATED = "created"
    CLAIMED = "claimed"
    RUNNING = "running"
    RESULT_READY = "result_ready"
    SUBMITTED = "submitted"
    PAID = "paid"
    CANCELLED = "cancelled"


class ModelReadinessState(str, Enum):
    REQUESTED = "requested"
    ACCEPTED = "accepted"
    PREPARING = "preparing"
    READY = "ready"
    FAILED = "failed"


class ModelSourceType(str, Enum):
    WORKER_CATALOG = "worker_catalog"
    PUBLIC_REGISTRY = "public_registry"
    CUSTOM_REFERENCE = "custom_reference"
    ADAPTER = "adapter"


class ModelSpec(BaseModel):
    model_id: str = "mock-llama"
    display_name: str = "Mock Llama"
    model_source: ModelSourceType = ModelSourceType.WORKER_CATALOG
    source_ref: str = "worker://gpu-prague/mock-llama"
    model_revision: str = "local-demo"
    model_hash: str = "0x"
    adapter_hash: str | None = None
    runtime: str = "mock-runtime"
    readiness_state: ModelReadinessState = ModelReadinessState.READY
    cold_start_fee: str = "0 USDC"
    inference_fee: str = "0.01 USDC"
    trust_notes: list[str] = Field(default_factory=list)


class WorkerModelCapability(BaseModel):
    model_id: str = "mock-llama"
    model_source: ModelSourceType = ModelSourceType.WORKER_CATALOG
    model_revision: str = "local-demo"
    model_hash: str = "0x"
    adapter_hash: str | None = None
    runtime: str = "mock-runtime"
    readiness_state: ModelReadinessState = ModelReadinessState.READY
    cold_start_fee: str = "0 USDC"
    inference_fee: str = "0.01 USDC"


class ModelPreparationJob(BaseModel):
    preparation_job_id: str
    model_id: str
    buyer: str
    buyer_name: str
    worker_id: str | None = None
    worker: str | None = None
    worker_name: str | None = None
    model_source: ModelSourceType = ModelSourceType.CUSTOM_REFERENCE
    source_ref: str
    model_revision: str = "custom-demo"
    model_hash: str
    adapter_hash: str | None = None
    runtime: str = "mock-runtime"
    readiness_state: ModelReadinessState = ModelReadinessState.REQUESTED
    readiness_trace: list[str] = Field(default_factory=list)
    cold_start_fee: str = "0.05 USDC"
    inference_fee: str = "0.02 USDC"
    trust_notes: list[str] = Field(default_factory=list)


class Worker(BaseModel):
    worker_id: str
    name: str = "gpu-prague.eth"
    address: str
    model: str = "mock-llama"
    hardware: str = "simulated/local worker"
    price: str = "0.01 USDC"
    status: str = "available"
    endpoint: str = "http://127.0.0.1:8010"
    model_capabilities: list[WorkerModelCapability] = Field(default_factory=list)


class RegisterWorkerRequest(BaseModel):
    name: str = "gpu-prague.eth"
    address: str | None = None
    model: str = "mock-llama"
    hardware: str = "simulated/local worker"
    price: str = "0.01 USDC"
    status: str = "available"
    endpoint: str = "http://127.0.0.1:8010"
    model_capabilities: list[WorkerModelCapability] | None = None


class RegisterModelRequest(BaseModel):
    model_id: str
    display_name: str | None = None
    model_source: ModelSourceType = ModelSourceType.PUBLIC_REGISTRY
    source_ref: str
    model_revision: str = "main"
    model_hash: str | None = None
    adapter_hash: str | None = None
    runtime: str = "mock-runtime"
    readiness_state: ModelReadinessState = ModelReadinessState.READY
    cold_start_fee: str = "0 USDC"
    inference_fee: str = "0.01 USDC"


class PrepareModelRequest(BaseModel):
    model_id: str
    source_ref: str
    buyer_name: str = "research-agent.eth"
    buyer_address: str | None = None
    worker_id: str | None = None
    model_source: ModelSourceType = ModelSourceType.CUSTOM_REFERENCE
    model_revision: str = "custom-demo"
    adapter_hash: str | None = None
    runtime: str = "mock-runtime"
    cold_start_fee: str = "0.05 USDC"
    inference_fee: str = "0.02 USDC"


class CreateJobRequest(BaseModel):
    prompt: str
    buyer_name: str = "research-agent.eth"
    buyer_address: str | None = None
    worker_id: str | None = None
    model_id: str = "mock-llama"
    price: str | None = None
    onchain_job_id: str | None = None
    onchain_tx_hash_create: str | None = None
    chain_payment_state: str | None = None


class ClaimJobRequest(BaseModel):
    worker_id: str


class RunJobRequest(BaseModel):
    worker_id: str | None = None


class SubmitJobRequest(BaseModel):
    output: str | None = None
    output_hash: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    model: str | None = None
    model_id: str | None = None
    model_source: ModelSourceType | None = None
    model_revision: str | None = None
    model_hash: str | None = None
    adapter_hash: str | None = None
    runtime: str | None = None
    cold_start_fee: str | None = None
    inference_fee: str | None = None
    onchain_tx_hash_submit: str | None = None
    chain_payment_state: str | None = None


class PayJobRequest(BaseModel):
    note: str = "mock buyer release"
    onchain_tx_hash_release: str | None = None
    chain_payment_state: str | None = None


class AgentTaskRequest(BaseModel):
    task_prompt: str
    buyer_name: str = "research-agent.eth"


class Job(BaseModel):
    job_id: str
    onchain_job_id: str | None = None
    onchain_tx_hash_create: str | None = None
    onchain_tx_hash_submit: str | None = None
    onchain_tx_hash_release: str | None = None
    chain_payment_state: str = "not_linked"
    buyer: str
    buyer_name: str
    worker_id: str | None = None
    worker: str | None = None
    worker_name: str | None = None
    prompt: str
    input_hash: str
    prompt_hash: str
    result: str | None = None
    output_hash: str | None = None
    receipt_hash: str | None = None
    status: JobStatus = JobStatus.CREATED
    payment_state: PaymentState = PaymentState.UNPAID
    payment_trace: list[str] = Field(default_factory=lambda: [PaymentState.UNPAID.value])
    input_tokens: int = 0
    output_tokens: int = 0
    price: str = "0.01 USDC"
    model: str = "mock-llama"
    model_id: str = "mock-llama"
    model_source: ModelSourceType = ModelSourceType.WORKER_CATALOG
    model_revision: str = "local-demo"
    model_hash: str = "0x"
    adapter_hash: str | None = None
    runtime: str = "mock-runtime"
    cold_start_fee: str = "0 USDC"
    inference_fee: str = "0.01 USDC"
    worker_signature: str | None = None
    receipt_verified: bool = False
    trust_notes: list[str] = Field(default_factory=list)


class ExecutionReceipt(BaseModel):
    job_id: str
    model: str = "mock-llama"
    model_id: str = "mock-llama"
    model_source: str = ModelSourceType.WORKER_CATALOG.value
    model_revision: str = "local-demo"
    model_hash: str = "0x"
    adapter_hash: str | None = None
    runtime: str = "mock-runtime"
    input_hash: str
    output_hash: str
    worker: str
    worker_name: str
    buyer: str
    buyer_name: str
    price: str
    cold_start_fee: str = "0 USDC"
    inference_fee: str = "0.01 USDC"
    payment_state: str = PaymentState.PAYABLE.value
    timestamp: str
    signature: str
    receipt_hash: str


class ReceiptResponse(BaseModel):
    receipt: ExecutionReceipt
    receipt_verified: bool
    job_payment_state: str
    verification: dict[str, Any]
