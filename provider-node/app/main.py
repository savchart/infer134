from __future__ import annotations

from fastapi import FastAPI

from app.inference import InferenceRequest, future_worker_backends, run_mock_inference


app = FastAPI(
    title="Infer134 Worker Node",
    description="Local compute worker with deterministic mocked inference.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "infer134-worker-node",
        "worker_name": "gpu-prague.eth",
        "model": "mock-llama",
        "hardware": "simulated/local worker",
        "future_backends": future_worker_backends(),
    }


@app.post("/infer")
def infer(request: InferenceRequest):
    return run_mock_inference(request)
