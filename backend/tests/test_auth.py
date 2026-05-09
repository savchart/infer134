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
    STORE.auth_challenges.clear()
    STORE.auth_sessions.clear()
    STORE._worker_seq = 1
    STORE._job_seq = 1
    STORE._preparation_seq = 1
    STORE._auth_seq = 1
    monkeypatch.setenv("PROVIDER_NODE_URL", "http://127.0.0.1:9")


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


def test_client_session_sets_job_buyer() -> None:
    client = TestClient(app)
    session = authenticate(
        client,
        role="client",
        address="0x1111111111111111111111111111111111111111",
        name="research-agent.eth",
    )

    response = client.post(
        "/jobs",
        json={
            "prompt": "Use wallet-authenticated buyer.",
            "model_id": "mock-llama",
            "auth_token": session["session_token"],
        },
    )

    assert response.status_code == 200
    job = response.json()["job"]
    assert job["buyer"] == "0x1111111111111111111111111111111111111111"
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
