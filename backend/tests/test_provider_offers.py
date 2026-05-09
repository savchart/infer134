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


def test_provider_registers_gpu_model_pricing_and_exposes_offers() -> None:
    client = TestClient(app)

    response = client.post(
        "/workers/register",
        json={
            "name": "gpu-prague.eth",
            "address": "0x2000000000000000000000000000000000000002",
            "hardware": "local GPU worker",
            "endpoint": "http://127.0.0.1:8010",
            "gpu_capabilities": [
                {
                    "gpu_id": "rtx-2070-local",
                    "display_name": "NVIDIA RTX 2070",
                    "memory_gb": 8,
                    "runtime": "vllm",
                    "status": "available",
                },
                {
                    "gpu_id": "mock-cpu-fallback",
                    "display_name": "Mock CPU fallback",
                    "memory_gb": 0,
                    "runtime": "mock",
                    "status": "available",
                },
            ],
            "model_capabilities": [
                {
                    "model_id": "Qwen/Qwen2.5-0.5B-Instruct",
                    "model_source": "public_registry",
                    "model_revision": "main",
                    "model_hash": "0xqwen",
                    "runtime": "vllm",
                    "readiness_state": "ready",
                    "cold_start_fee": "0 local ETH",
                    "inference_fee": "0.001 local ETH",
                    "price_per_1m_input_tokens": "0.25 local ETH",
                    "price_per_1m_output_tokens": "0.75 local ETH",
                    "currency": "local ETH",
                },
                {
                    "model_id": "mock-llama",
                    "model_source": "worker_catalog",
                    "model_revision": "local-demo",
                    "model_hash": "0xmock",
                    "runtime": "mock",
                    "readiness_state": "ready",
                    "cold_start_fee": "0 local ETH",
                    "inference_fee": "0.0001 local ETH",
                    "price_per_1m_input_tokens": "0.01 local ETH",
                    "price_per_1m_output_tokens": "0.02 local ETH",
                    "currency": "local ETH",
                },
            ],
        },
    )

    assert response.status_code == 200
    worker = response.json()
    assert worker["gpu_capabilities"][0]["gpu_id"] == "rtx-2070-local"
    assert worker["model_capabilities"][0]["price_per_1m_input_tokens"] == "0.25 local ETH"

    offers_response = client.get("/offers")
    assert offers_response.status_code == 200
    offers = offers_response.json()
    assert len(offers) == 4
    qwen_offer = next(offer for offer in offers if offer["model_id"] == "Qwen/Qwen2.5-0.5B-Instruct")
    assert qwen_offer["worker_name"] == "gpu-prague.eth"
    assert qwen_offer["gpu_name"] in {"NVIDIA RTX 2070", "Mock CPU fallback"}
    assert qwen_offer["price_per_1m_input_tokens"] == "0.25 local ETH"
    assert qwen_offer["price_per_1m_output_tokens"] == "0.75 local ETH"
    assert qwen_offer["currency"] == "local ETH"

    worker_offers_response = client.get(f"/workers/{worker['worker_id']}/offers")
    assert worker_offers_response.status_code == 200
    assert {offer["offer_id"] for offer in worker_offers_response.json()} == {
        offer["offer_id"] for offer in offers
    }


def test_registering_same_gpu_model_offer_updates_existing_worker_without_duplicates() -> None:
    client = TestClient(app)
    payload = {
        "name": "gpu-prague.eth",
        "address": "0x2000000000000000000000000000000000000002",
        "hardware": "local GPU worker",
        "endpoint": "http://127.0.0.1:8010",
        "gpu_capabilities": [
            {
                "gpu_id": "local-rtx-2070",
                "display_name": "NVIDIA RTX 2070",
                "memory_gb": 8,
                "runtime": "vllm",
                "status": "available",
            }
        ],
        "model_capabilities": [
            {
                "model_id": "Qwen/Qwen2.5-0.5B-Instruct",
                "model_source": "public_registry",
                "model_revision": "main",
                "model_hash": "0xqwen",
                "runtime": "vllm",
                "readiness_state": "ready",
                "cold_start_fee": "0 local ETH",
                "inference_fee": "0.001 local ETH",
                "price_per_1m_input_tokens": "0.25 local ETH",
                "price_per_1m_output_tokens": "0.75 local ETH",
                "currency": "local ETH",
            }
        ],
    }

    first_response = client.post("/workers/register", json=payload)
    second_response = client.post("/workers/register", json=payload)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["worker_id"] == second_response.json()["worker_id"]

    workers = client.get("/workers").json()
    offers = client.get("/offers").json()

    assert len(workers) == 1
    assert len(offers) == 1
    assert offers[0]["gpu_id"] == "local-rtx-2070"
    assert offers[0]["model_id"] == "Qwen/Qwen2.5-0.5B-Instruct"


def test_offers_exclude_unavailable_gpus_and_unready_models() -> None:
    client = TestClient(app)

    client.post(
        "/workers/register",
        json={
            "name": "gpu-prague.eth",
            "gpu_capabilities": [
                {"gpu_id": "available-gpu", "display_name": "Available GPU", "status": "available"},
                {"gpu_id": "busy-gpu", "display_name": "Busy GPU", "status": "busy"},
            ],
            "model_capabilities": [
                {
                    "model_id": "ready-model",
                    "model_source": "worker_catalog",
                    "model_hash": "0xready",
                    "readiness_state": "ready",
                    "price_per_1m_input_tokens": "0.10 local ETH",
                    "price_per_1m_output_tokens": "0.30 local ETH",
                },
                {
                    "model_id": "preparing-model",
                    "model_source": "worker_catalog",
                    "model_hash": "0xprep",
                    "readiness_state": "preparing",
                },
            ],
        },
    )

    offers = client.get("/offers").json()

    assert len(offers) == 1
    assert offers[0]["gpu_id"] == "available-gpu"
    assert offers[0]["model_id"] == "ready-model"
