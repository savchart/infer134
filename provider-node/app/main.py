from __future__ import annotations

from fastapi import FastAPI, HTTPException

from app.inference import (
    InferenceRequest,
    configured_model_id,
    future_worker_backends,
    list_allowed_models,
    run_inference,
    runtime_backend_status,
    runtime_mode,
)


app = FastAPI(
    title="Infer134 Worker Node",
    description="Local compute worker with vLLM/Hugging Face inference and deterministic mock fallback.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, object]:
    backend_status = runtime_backend_status()
    return {
        "status": "ok",
        "service": "infer134-worker-node",
        "worker_name": "gpu-prague.eth",
        "runtime": runtime_mode(),
        "runtime_ready": backend_status["runtime_ready"],
        "backend_error": backend_status["error"],
        "served_models": backend_status["served_models"],
        "model": configured_model_id(),
        "hardware": "local GPU worker or deterministic mock fallback",
        "future_backends": future_worker_backends(),
    }


@app.get("/models")
def models() -> list[dict[str, object]]:
    return list_allowed_models()


@app.post("/infer")
def infer(request: InferenceRequest):
    try:
        return run_inference(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
