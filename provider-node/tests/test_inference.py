from fastapi.testclient import TestClient

from app.main import app


def test_infer_returns_deterministic_hashes_and_worker_metadata(monkeypatch) -> None:
    monkeypatch.setenv("INFER134_RUNTIME", "mock")
    client = TestClient(app)
    payload = {
        "prompt": "Summarize payment-state verification.",
        "worker_address": "0x2000000000000000000000000000000000000002",
        "worker_name": "gpu-prague.eth",
        "model": "mock-llama",
        "model_id": "mock-llama",
        "model_revision": "local-demo",
        "price": "0.001 local ETH",
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
    assert first["runtime"] == "mock"
    assert first["execution_backend"] == "mock_worker"
    assert first["worker"] == payload["worker_address"]
    assert first["worker_name"] == "gpu-prague.eth"
    assert first["input_tokens"] > 0
    assert first["output_tokens"] > 0
    assert first["worker_payload_hash"].startswith("0x")
    assert first["worker_signature"].startswith("0x")


def test_infer_changes_output_hash_for_different_model_id(monkeypatch) -> None:
    monkeypatch.setenv("INFER134_RUNTIME", "mock")
    client = TestClient(app)
    base_payload = {
        "prompt": "Same prompt, different model.",
        "worker_address": "0x2000000000000000000000000000000000000002",
        "worker_name": "gpu-prague.eth",
        "model": "mock-llama",
        "model_revision": "main",
        "price": "0.001 local ETH",
    }

    first = client.post("/infer", json={**base_payload, "model_id": "mock-llama"}).json()
    second = client.post(
        "/infer",
        json={**base_payload, "model": "Qwen/Qwen2.5-0.5B-Instruct", "model_id": "Qwen/Qwen2.5-0.5B-Instruct"},
    ).json()

    assert first["input_hash"] == second["input_hash"]
    assert first["output_hash"] != second["output_hash"]
    assert second["model_id"] == "Qwen/Qwen2.5-0.5B-Instruct"


def test_unsupported_model_is_rejected(monkeypatch) -> None:
    monkeypatch.setenv("INFER134_RUNTIME", "mock")
    client = TestClient(app)

    response = client.post(
        "/infer",
        json={
            "prompt": "Use an arbitrary model.",
            "model": "unknown/model",
            "model_id": "unknown/model",
        },
    )

    assert response.status_code == 400
    assert "unsupported model_id" in response.json()["detail"]


def test_models_endpoint_lists_allowlisted_models(monkeypatch) -> None:
    monkeypatch.setenv("INFER134_RUNTIME", "mock")
    client = TestClient(app)

    response = client.get("/models")

    assert response.status_code == 200
    models = response.json()
    model_ids = {model["model_id"] for model in models}
    assert "Qwen/Qwen2.5-0.5B-Instruct" in model_ids
    assert "HuggingFaceTB/SmolLM2-360M-Instruct" in model_ids
    assert "mock-llama" in model_ids
    readiness = {model["model_id"]: model["runtime_ready"] for model in models}
    assert readiness["mock-llama"] is True
    assert readiness["Qwen/Qwen2.5-0.5B-Instruct"] is False


def test_vllm_models_are_not_ready_when_backend_is_unavailable(monkeypatch) -> None:
    monkeypatch.setenv("INFER134_RUNTIME", "vllm")
    monkeypatch.setenv("INFER134_MODEL_ID", "Qwen/Qwen2.5-0.5B-Instruct")
    monkeypatch.setenv("INFER134_VLLM_BASE_URL", "http://127.0.0.1:9/v1")
    monkeypatch.setenv("INFER134_VLLM_READINESS_TIMEOUT", "0.05")
    client = TestClient(app)

    health_response = client.get("/health")
    models_response = client.get("/models")

    assert health_response.status_code == 200
    assert health_response.json()["runtime_ready"] is False
    assert "vLLM /models unavailable" in health_response.json()["backend_error"]

    assert models_response.status_code == 200
    models = models_response.json()
    readiness = {model["model_id"]: model["runtime_ready"] for model in models}
    assert readiness["Qwen/Qwen2.5-0.5B-Instruct"] is False
    assert readiness["HuggingFaceTB/SmolLM2-360M-Instruct"] is False
    assert readiness["mock-llama"] is False
