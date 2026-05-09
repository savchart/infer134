from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "infer134-worker-node"
    assert body["worker_name"] == "gpu-prague.eth"
    assert body["runtime"] in {"mock", "vllm"}
    assert body["model"]
