#!/usr/bin/env bash
set -euo pipefail

MODEL_ID="${INFER134_MODEL_ID:-Qwen/Qwen2.5-0.5B-Instruct}"
HOST="${INFER134_VLLM_HOST:-127.0.0.1}"
PORT="${INFER134_VLLM_PORT:-8001}"
API_KEY="${INFER134_VLLM_API_KEY:-infer134-local}"
MAX_MODEL_LEN="${INFER134_VLLM_MAX_MODEL_LEN:-4096}"
GPU_MEMORY_UTILIZATION="${INFER134_VLLM_GPU_MEMORY_UTILIZATION:-0.72}"
ENFORCE_EAGER="${INFER134_VLLM_ENFORCE_EAGER:-1}"
export HF_HOME="${HF_HOME:-.hf-cache}"

echo "Starting local vLLM OpenAI-compatible worker"
echo "Model: $MODEL_ID"
echo "URL: http://$HOST:$PORT/v1"
echo "HF_HOME: $HF_HOME"
echo "Max model length: $MAX_MODEL_LEN"
echo "GPU memory utilization: $GPU_MEMORY_UTILIZATION"
echo "WARNING: this is a local demo runtime. Do not put real secrets in public identity records or logs."
echo "If vLLM exits with 'NVIDIA driver on your system is too old', update the driver or install PyTorch/vLLM wheels compatible with your local CUDA driver."

EXTRA_ARGS=()
if [[ "$ENFORCE_EAGER" == "1" || "$ENFORCE_EAGER" == "true" ]]; then
  EXTRA_ARGS+=(--enforce-eager)
fi

python -m vllm.entrypoints.openai.api_server \
  --host "$HOST" \
  --port "$PORT" \
  --model "$MODEL_ID" \
  --served-model-name "$MODEL_ID" \
  --api-key "$API_KEY" \
  --max-model-len "$MAX_MODEL_LEN" \
  --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
  "${EXTRA_ARGS[@]}"
