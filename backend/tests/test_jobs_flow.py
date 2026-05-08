import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import STORE


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


def test_worker_job_receipt_payment_flow() -> None:
    client = TestClient(app)

    worker_response = client.post(
        "/workers/register",
        json={
            "name": "gpu-prague.eth",
            "model": "mock-llama",
            "hardware": "simulated/local worker",
            "price": "0.01 USDC",
        },
    )
    assert worker_response.status_code == 200
    worker = worker_response.json()
    assert worker["worker_id"] == "worker-0001"
    assert worker["name"] == "gpu-prague.eth"

    create_response = client.post(
        "/jobs",
        json={
            "prompt": "Explain private offchain inference for agents.",
            "buyer_name": "research-agent.eth",
            "model_id": "mock-llama",
        },
    )
    assert create_response.status_code == 200
    created_job = create_response.json()["job"]
    job_id = created_job["job_id"]
    assert created_job["status"] == "created"
    assert created_job["payment_state"] == "escrowed"
    assert created_job["payment_trace"] == ["unpaid", "escrowed"]
    assert created_job["model_id"] == "mock-llama"

    open_response = client.get("/jobs/open")
    assert open_response.status_code == 200
    assert [job["job_id"] for job in open_response.json()] == [job_id]

    claim_response = client.post(
        f"/jobs/{job_id}/claim",
        json={"worker_id": worker["worker_id"]},
    )
    assert claim_response.status_code == 200
    claimed_job = claim_response.json()
    assert claimed_job["status"] == "claimed"
    assert claimed_job["worker_name"] == "gpu-prague.eth"
    assert claimed_job["model_hash"].startswith("0x")

    run_response = client.post(
        f"/jobs/{job_id}/run",
        json={"worker_id": worker["worker_id"]},
    )
    assert run_response.status_code == 200
    run_payload = run_response.json()
    assert run_payload["job"]["status"] == "result_ready"
    assert run_payload["job"]["result"].startswith("Infer134 mock result:")
    assert run_payload["job"]["output_hash"].startswith("0x")

    submit_response = client.post(f"/jobs/{job_id}/submit", json={})
    assert submit_response.status_code == 200
    submit_payload = submit_response.json()
    assert submit_payload["job"]["status"] == "submitted"
    assert submit_payload["job"]["payment_state"] == "payable"
    assert submit_payload["receipt_verified"] is True
    assert submit_payload["receipt"]["receipt_hash"].startswith("0x")
    assert submit_payload["receipt"]["model_id"] == "mock-llama"
    assert submit_payload["receipt"]["model_hash"].startswith("0x")
    assert submit_payload["receipt"]["runtime"] == "mock-runtime"

    pay_response = client.post(f"/jobs/{job_id}/pay", json={})
    assert pay_response.status_code == 200
    paid_job = pay_response.json()["job"]
    assert paid_job["status"] == "paid"
    assert paid_job["payment_state"] == "paid"
    assert paid_job["payment_trace"] == ["unpaid", "escrowed", "payable", "paid"]

    receipt_response = client.get(f"/jobs/{job_id}/receipt")
    assert receipt_response.status_code == 200
    receipt_payload = receipt_response.json()
    assert receipt_payload["job_payment_state"] == "paid"
    assert receipt_payload["receipt_verified"] is True
    assert receipt_payload["receipt"]["job_id"] == job_id
    assert receipt_payload["verification"]["semantic_correctness"] == "not verified"
    assert receipt_payload["verification"]["model_hash_claim"].startswith("trusted worker claim")


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

    compatible_job = client.post(
        "/jobs",
        json={
            "prompt": "Use the ready worker catalog model.",
            "model_id": "worker-ready-small",
        },
    )
    assert compatible_job.status_code == 200
    job_id = compatible_job.json()["job"]["job_id"]
    claim_response = client.post(f"/jobs/{job_id}/claim", json={"worker_id": worker["worker_id"]})
    assert claim_response.status_code == 200
    assert claim_response.json()["model_id"] == "worker-ready-small"

    unsupported_job = client.post(
        "/jobs",
        json={
            "prompt": "Try a model this worker cannot run.",
            "model_id": "mock-llama",
        },
    )
    assert unsupported_job.status_code == 200
    unsupported_job_id = unsupported_job.json()["job"]["job_id"]
    unsupported_claim = client.post(
        f"/jobs/{unsupported_job_id}/claim",
        json={"worker_id": worker["worker_id"]},
    )
    assert unsupported_claim.status_code == 400
    assert "does not support ready model" in unsupported_claim.json()["detail"]

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

    prepared_job = client.post(
        "/jobs",
        json={
            "prompt": "Run the prepared custom model.",
            "model_id": "custom-solar-adapter",
        },
    )
    assert prepared_job.status_code == 200
    prepared_job_id = prepared_job.json()["job"]["job_id"]
    prepared_claim = client.post(f"/jobs/{prepared_job_id}/claim", json={"worker_id": worker["worker_id"]})
    assert prepared_claim.status_code == 200
    assert prepared_claim.json()["cold_start_fee"] == "0.05 USDC"
