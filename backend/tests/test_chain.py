from fastapi.testclient import TestClient

from app.main import app


def test_chain_status_is_optional_without_env(monkeypatch) -> None:
    monkeypatch.delenv("RPC_URL", raising=False)
    monkeypatch.delenv("CHAIN_ID", raising=False)
    monkeypatch.delenv("INFERENCE_ESCROW_ADDRESS", raising=False)
    client = TestClient(app)

    response = client.get("/chain/status")

    assert response.status_code == 200
    body = response.json()
    assert body["chain_enabled"] is False
    assert body["latest_block"] is None
    assert "RPC_URL" in body["error"]
