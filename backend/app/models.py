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


class Worker(BaseModel):
    worker_id: str
    name: str = "gpu-prague.eth"
    address: str
    model: str = "mock-llama"
    hardware: str = "simulated/local worker"
    price: str = "0.01 USDC"
    status: str = "available"
    endpoint: str = "http://127.0.0.1:8010"


class RegisterWorkerRequest(BaseModel):
    name: str = "gpu-prague.eth"
    address: str | None = None
    model: str = "mock-llama"
    hardware: str = "simulated/local worker"
    price: str = "0.01 USDC"
    status: str = "available"
    endpoint: str = "http://127.0.0.1:8010"


class CreateJobRequest(BaseModel):
    prompt: str
    buyer_name: str = "research-agent.eth"
    buyer_address: str | None = None
    worker_id: str | None = None
    price: str | None = None


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


class PayJobRequest(BaseModel):
    note: str = "mock buyer release"


class AgentTaskRequest(BaseModel):
    task_prompt: str
    buyer_name: str = "research-agent.eth"


class Job(BaseModel):
    job_id: str
    onchain_job_id: str | None = None
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
    worker_signature: str | None = None
    receipt_verified: bool = False
    trust_notes: list[str] = Field(default_factory=list)


class ExecutionReceipt(BaseModel):
    job_id: str
    model: str = "mock-llama"
    input_hash: str
    output_hash: str
    worker: str
    worker_name: str
    buyer: str
    buyer_name: str
    price: str
    payment_state: str = PaymentState.PAYABLE.value
    timestamp: str
    signature: str
    receipt_hash: str


class ReceiptResponse(BaseModel):
    receipt: ExecutionReceipt
    receipt_verified: bool
    job_payment_state: str
    verification: dict[str, Any]
