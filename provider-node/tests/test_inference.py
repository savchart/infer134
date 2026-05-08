from fastapi.testclient import TestClient

from app.main import app


def test_infer_returns_deterministic_hashes_and_worker_metadata() -> None:
    client = TestClient(app)
    payload = {
        "prompt": "Summarize payment-state verification.",
        "worker_address": "0x2000000000000000000000000000000000000002",
        "worker_name": "gpu-prague.eth",
        "model": "mock-llama",
        "model_id": "mock-llama",
        "model_revision": "local-demo",
        "runtime": "mock-runtime",
        "price": "0.01 USDC",
    }

    first_response = client.post("/infer", json=payload)
    second_response = client.post("/infer", json=payload)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    first = first_response.json()
    second = second_response.json()

    assert first["output"] == second["output"]
    assert first["input_hash"] == second["input_hash"]
    assert first["output_hash"] == second["output_hash"]
    assert first["model_hash"] == second["model_hash"]
    assert first["input_hash"].startswith("0x")
    assert first["output_hash"].startswith("0x")
    assert first["model"] == "mock-llama"
    assert first["model_id"] == "mock-llama"
    assert first["model_revision"] == "local-demo"
    assert first["runtime"] == "mock-runtime"
    assert first["worker"] == payload["worker_address"]
    assert first["worker_name"] == "gpu-prague.eth"
    assert first["input_tokens"] > 0
    assert first["output_tokens"] > 0
    assert first["worker_payload_hash"].startswith("0x")
    assert first["worker_signature"].startswith("0x")


def test_infer_changes_output_hash_for_different_model_id() -> None:
    client = TestClient(app)
    base_payload = {
        "prompt": "Same prompt, different model.",
        "worker_address": "0x2000000000000000000000000000000000000002",
        "worker_name": "gpu-prague.eth",
        "model": "mock-llama",
        "model_revision": "local-demo",
        "runtime": "mock-runtime",
        "price": "0.01 USDC",
    }

    first = client.post("/infer", json={**base_payload, "model_id": "mock-llama"}).json()
    second = client.post("/infer", json={**base_payload, "model_id": "custom-solar-adapter"}).json()

    assert first["input_hash"] == second["input_hash"]
    assert first["output_hash"] != second["output_hash"]
    assert second["model_id"] == "custom-solar-adapter"
