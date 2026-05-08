import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import STORE


@pytest.fixture(autouse=True)
def reset_store(monkeypatch: pytest.MonkeyPatch) -> None:
    STORE.workers.clear()
    STORE.jobs.clear()
    STORE.receipts.clear()
    STORE._worker_seq = 1
    STORE._job_seq = 1
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
        },
    )
    assert create_response.status_code == 200
    created_job = create_response.json()["job"]
    job_id = created_job["job_id"]
    assert created_job["status"] == "created"
    assert created_job["payment_state"] == "escrowed"
    assert created_job["payment_trace"] == ["unpaid", "escrowed"]

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

