import pytest
from fastapi.testclient import TestClient

from app import jobs as jobs_module
from app.main import app
from app.receipts import sha256_hex
from app.store import STORE


@pytest.fixture(autouse=True)
def reset_store(monkeypatch: pytest.MonkeyPatch) -> None:
    STORE.workers.clear()
    STORE.models.clear()
    STORE.model_preparations.clear()
    STORE.jobs.clear()
    STORE.receipts.clear()
    STORE.auth_challenges.clear()
    STORE.auth_sessions.clear()
    STORE._worker_seq = 1
    STORE._job_seq = 1
    STORE._preparation_seq = 1
    STORE._auth_seq = 1
    monkeypatch.setenv("PROVIDER_NODE_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("RPC_URL", "http://127.0.0.1:8545")
    monkeypatch.setenv("CHAIN_ID", "31337")
    monkeypatch.setenv("INFERENCE_ESCROW_ADDRESS", "0x5fbdb2315678afecb367f032d93f642f64180aa3")


def authenticate(client: TestClient, role: str, address: str, name: str) -> dict:
    challenge_response = client.post(
        "/auth/challenge",
        json={"address": address, "role": role, "ens_style_name": name},
    )
    assert challenge_response.status_code == 200
    challenge = challenge_response.json()
    assert challenge["message"].startswith("Infer134 local wallet authentication")

    verify_response = client.post(
        "/auth/verify",
        json={
            "challenge_id": challenge["challenge_id"],
            "address": address,
            "role": role,
            "signature": "0x" + "ab" * 65,
        },
    )
    assert verify_response.status_code == 200
    return verify_response.json()["session"]


def test_wallet_challenge_and_session_flow() -> None:
    client = TestClient(app)

    session = authenticate(
        client,
        role="client",
        address="0x1000000000000000000000000000000000000001",
        name="research-agent.eth",
    )

    assert session["role"] == "client"
    assert session["address"] == "0x1000000000000000000000000000000000000001"
    assert session["verification_status"] == "demo_signature_recorded"

    fetched = client.get(f"/auth/session/{session['session_token']}")
    assert fetched.status_code == 200
    assert fetched.json()["session_token"] == session["session_token"]

    logout = client.post("/auth/logout", json={"session_token": session["session_token"]})
    assert logout.status_code == 200
    assert logout.json() == {"logged_out": True}


def test_client_session_sets_job_buyer(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    buyer_address = "0x1111111111111111111111111111111111111111"
    worker_address = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
    session = authenticate(
        client,
        role="client",
        address=buyer_address,
        name="research-agent.eth",
    )

    register_response = client.post(
        "/workers/register",
        json={
            "name": "gpu-prague.eth",
            "address": worker_address,
            "model": "mock-llama",
        },
    )
    assert register_response.status_code == 200
    offer = client.get("/offers").json()[0]

    prompt = "Use wallet-authenticated buyer."

    def fake_verify(_job_id: str) -> dict:
        return {
            "onchain_job_id": "1",
            "buyer": buyer_address,
            "worker": worker_address,
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
            "onchain_job_id": "1",
            "buyer": buyer_address,
            "worker": worker_address,
            "tx_hash": tx_hash,
            "block_number": 1,
        }

    def fake_submit(*_args, **_kwargs) -> dict:
        return {"tx_hash": "0xsubmit", "chain_payment_state": "result_submitted"}

    monkeypatch.setattr(jobs_module, "verify_escrow_job", fake_verify)
    monkeypatch.setattr(jobs_module, "parse_job_created_event", fake_parse)
    monkeypatch.setattr(jobs_module, "submit_escrow_result", fake_submit)

    response = client.post(
        "/jobs/run-paid",
        json={
            "onchain_job_id": "1",
            "tx_hash": "0xdeadbeef",
            "prompt": prompt,
            "offer_id": offer["offer_id"],
            "model_id": offer["model_id"],
            "auth_token": session["session_token"],
        },
    )

    assert response.status_code == 200
    job = response.json()["job"]
    assert job["buyer"] == buyer_address
    assert job["buyer_name"] == "research-agent.eth"
    assert job["auth_verification_status"] == "demo_signature_recorded"


def test_provider_session_sets_worker_address() -> None:
    client = TestClient(app)
    session = authenticate(
        client,
        role="provider",
        address="0x2222222222222222222222222222222222222222",
        name="gpu-prague.eth",
    )

    response = client.post(
        "/workers/register",
        json={
            "name": "ignored-worker.eth",
            "address": "0x3333333333333333333333333333333333333333",
            "model": "mock-llama",
            "auth_token": session["session_token"],
        },
    )

    assert response.status_code == 200
    worker = response.json()
    assert worker["name"] == "gpu-prague.eth"
    assert worker["address"] == "0x2222222222222222222222222222222222222222"
    assert worker["auth_verification_status"] == "demo_signature_recorded"
