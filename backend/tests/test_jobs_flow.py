import pytest
from fastapi.testclient import TestClient

from app import jobs as jobs_module
from app.main import app
from app.receipts import sha256_hex
from app.store import STORE


CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
BUYER_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
WORKER_ADDRESS = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"


@pytest.fixture(autouse=True)
def reset_store(monkeypatch: pytest.MonkeyPatch) -> None:
    STORE.workers.clear()
    STORE.models.clear()
    STORE.model_preparations.clear()
    STORE.jobs.clear()
    STORE.receipts.clear()
    STORE._worker_seq = 1
    STORE._job_seq = 1
    STORE._preparation_seq = 1
    monkeypatch.setenv("PROVIDER_NODE_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("RPC_URL", "http://127.0.0.1:8545")
    monkeypatch.setenv("CHAIN_ID", "31337")
    monkeypatch.setenv("INFERENCE_ESCROW_ADDRESS", CONTRACT_ADDRESS)


def _register_worker(client: TestClient) -> dict:
    response = client.post(
        "/workers/register",
        json={
            "name": "gpu-prague.eth",
            "address": WORKER_ADDRESS,
            "hardware": "local GPU worker",
            "endpoint": "http://127.0.0.1:8010",
            "gpu_capabilities": [
                {
                    "gpu_id": "local-rtx-2070",
                    "display_name": "NVIDIA RTX 2070",
                    "memory_gb": 8,
                    "runtime": "mock",
                    "status": "available",
                }
            ],
            "model_capabilities": [
                {
                    "model_id": "mock-llama",
                    "model_source": "worker_catalog",
                    "model_revision": "local-demo",
                    "model_hash": "0xmock",
                    "runtime": "mock-runtime",
                    "readiness_state": "ready",
                    "cold_start_fee": "0 local ETH",
                    "inference_fee": "0.001 local ETH",
                    "price_per_1m_input_tokens": "0.10 local ETH",
                    "price_per_1m_output_tokens": "0.30 local ETH",
                    "currency": "local ETH",
                }
            ],
        },
    )
    assert response.status_code == 200
    return response.json()


def _patch_chain(monkeypatch: pytest.MonkeyPatch, *, prompt: str, onchain_job_id: str = "1") -> dict:
    """Monkeypatch chain helpers used by run_paid_job; return captured submit calls."""
    captured: dict[str, list] = {"submits": []}

    def fake_verify(job_id: str) -> dict:
        return {
            "onchain_job_id": str(job_id),
            "buyer": BUYER_ADDRESS,
            "worker": WORKER_ADDRESS,
            "escrow_amount": 1_000_000_000_000_000,
            "requested_payment": 0,
            "input_hash": sha256_hex(prompt),
            "output_hash": "0x" + "0" * 64,
            "receipt_hash": "0x" + "0" * 64,
            "status_code": 0,
            "status": "created",
        }

    def fake_parse(tx_hash: str) -> dict:
        return {
            "onchain_job_id": str(onchain_job_id),
            "buyer": BUYER_ADDRESS,
            "worker": WORKER_ADDRESS,
            "tx_hash": tx_hash,
            "block_number": 1,
        }

    def fake_submit(job_id: str, output_hash: str, receipt_hash: str) -> dict:
        captured["submits"].append({"job_id": job_id, "output_hash": output_hash, "receipt_hash": receipt_hash})
        return {"tx_hash": "0xsubmit", "chain_payment_state": "result_submitted"}

    monkeypatch.setattr(jobs_module, "verify_escrow_job", fake_verify)
    monkeypatch.setattr(jobs_module, "parse_job_created_event", fake_parse)
    monkeypatch.setattr(jobs_module, "submit_escrow_result", fake_submit)
    return captured


def test_run_paid_job_runs_inference_when_escrow_matches(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    _register_worker(client)
    offer = client.get("/offers").json()[0]

    prompt = "Explain signed execution receipts in one sentence."
    captured = _patch_chain(monkeypatch, prompt=prompt)

    response = client.post(
        "/jobs/run-paid",
        json={
            "onchain_job_id": "1",
            "tx_hash": "0xdeadbeef",
            "prompt": prompt,
            "offer_id": offer["offer_id"],
            "model_id": offer["model_id"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    job = body["job"]
    assert job["status"] == "submitted"
    assert job["payment_state"] == "payable"
    assert job["payment_trace"] == ["unpaid", "escrowed", "payable"]
    assert job["onchain_job_id"] == "1"
    assert job["onchain_tx_hash_create"] == "0xdeadbeef"
    assert job["onchain_tx_hash_submit"] == "0xsubmit"
    assert job["chain_payment_state"] == "result_submitted"
    assert body["receipt"]["receipt_hash"].startswith("0x")
    assert body["receipt_verified"] is True
    assert body["escrow_amount_wei"] == "1000000000000000"
    assert len(captured["submits"]) == 1
    assert captured["submits"][0]["receipt_hash"] == job["receipt_hash"]


def test_run_paid_job_rejects_input_hash_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    _register_worker(client)
    offer = client.get("/offers").json()[0]

    _patch_chain(monkeypatch, prompt="something else entirely")

    response = client.post(
        "/jobs/run-paid",
        json={
            "onchain_job_id": "1",
            "tx_hash": "0xdeadbeef",
            "prompt": "the actual prompt the buyer typed",
            "offer_id": offer["offer_id"],
            "model_id": offer["model_id"],
        },
    )

    assert response.status_code == 400
    assert "input_hash" in response.json()["detail"]
    assert STORE.jobs == {}


def test_run_paid_job_returns_503_when_chain_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RPC_URL", raising=False)
    monkeypatch.delenv("CHAIN_ID", raising=False)
    monkeypatch.delenv("INFERENCE_ESCROW_ADDRESS", raising=False)

    client = TestClient(app)
    _register_worker(client)
    offer = client.get("/offers").json()[0]

    response = client.post(
        "/jobs/run-paid",
        json={
            "onchain_job_id": "1",
            "tx_hash": "0xdeadbeef",
            "prompt": "anything",
            "offer_id": offer["offer_id"],
        },
    )

    assert response.status_code == 503
    assert "chain not enabled" in response.json()["detail"]


def test_run_paid_job_rejects_unknown_offer(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    _register_worker(client)

    _patch_chain(monkeypatch, prompt="anything")

    response = client.post(
        "/jobs/run-paid",
        json={
            "onchain_job_id": "1",
            "tx_hash": "0xdeadbeef",
            "prompt": "anything",
            "offer_id": "no-such-offer",
        },
    )

    assert response.status_code == 400
    assert "offer not found" in response.json()["detail"]


def test_worker_model_capability_and_custom_preparation_flow() -> None:
    client = TestClient(app)

    worker_response = client.post(
        "/workers/register",
        json={
            "name": "gpu-prague.eth",
            "model_capabilities": [
                {
                    "model_id": "worker-ready-small",
                    "model_source": "worker_catalog",
                    "model_revision": "demo-v1",
                    "model_hash": "0xready",
                    "runtime": "mock-runtime",
                    "readiness_state": "ready",
                    "cold_start_fee": "0 USDC",
                    "inference_fee": "0.02 USDC",
                }
            ],
        },
    )
    assert worker_response.status_code == 200
    worker = worker_response.json()
    assert worker["model_capabilities"][0]["model_id"] == "worker-ready-small"

    worker_models = client.get(f"/workers/{worker['worker_id']}/models")
    assert worker_models.status_code == 200
    assert worker_models.json()[0]["readiness_state"] == "ready"

    preparation_response = client.post(
        "/models/prepare",
        json={
            "model_id": "custom-solar-adapter",
            "source_ref": "hf://public/demo/custom-solar-adapter",
            "model_revision": "adapter-v1",
            "runtime": "mock-runtime",
            "cold_start_fee": "0.05 USDC",
            "inference_fee": "0.03 USDC",
            "worker_id": worker["worker_id"],
        },
    )
    assert preparation_response.status_code == 200
    preparation = preparation_response.json()["preparation"]
    assert preparation["readiness_state"] == "ready"
    assert preparation["readiness_trace"] == ["requested", "accepted", "preparing", "ready"]
    assert preparation["model_hash"].startswith("0x")
