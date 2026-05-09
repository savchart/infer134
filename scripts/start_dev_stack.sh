#!/usr/bin/env bash
set -euo pipefail

# Boot the local stack in one command:
#   1. start anvil (background; reuse an existing one if reachable)
#   2. deploy InferenceEscrow
#   3. start backend (foreground) with chain env wired in
#
# Ctrl+C stops the backend; if anvil was started by this script, it is killed
# on exit too. Anvil started by another terminal stays untouched.
#
# Provider-node (port 8010) and the frontend (port 3000) stay separate —
# launch them in their own terminals from infer134/DEMO_INSTRUCTIONS.md.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="${CHAIN_ID:-31337}"
ANVIL_LOG="${ANVIL_LOG:-/tmp/infer134-anvil.log}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
PROVIDER_NODE_URL="${PROVIDER_NODE_URL:-http://127.0.0.1:8010}"
WORKER_PRIVATE_KEY="${WORKER_PRIVATE_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
WORKER_ADDRESS="${WORKER_ADDRESS:-0x70997970C51812dc3A010C7d01b50e0d17dc79C8}"

ANVIL_PID=""
SPAWNED_ANVIL=0

section() {
  printf '\n== %s ==\n' "$1"
}

cleanup() {
  if [ "$SPAWNED_ANVIL" = "1" ] && [ -n "$ANVIL_PID" ] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    section "Stopping anvil (pid $ANVIL_PID)"
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

rpc_alive() {
  curl -fsS -X POST "$RPC_URL" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}' \
    --connect-timeout 1 > /dev/null 2>&1
}

# --- Pre-flight ---
for tool in anvil cast forge curl python; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "missing required tool on PATH: $tool" >&2
    exit 1
  fi
done

if lsof -ti tcp:"$BACKEND_PORT" >/dev/null 2>&1; then
  echo "port $BACKEND_PORT is already in use; stop the existing backend before running this script" >&2
  exit 1
fi

# --- 1. anvil ---
if rpc_alive; then
  section "Anvil already running at $RPC_URL"
else
  section "Starting anvil in background ($RPC_URL, log: $ANVIL_LOG)"
  : > "$ANVIL_LOG"
  anvil --host 127.0.0.1 --port "${RPC_URL##*:}" --chain-id "$CHAIN_ID" > "$ANVIL_LOG" 2>&1 &
  ANVIL_PID=$!
  SPAWNED_ANVIL=1

  printf 'waiting for anvil RPC'
  for _ in $(seq 1 40); do
    if rpc_alive; then
      printf ' ready\n'
      break
    fi
    if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
      printf '\n'
      echo "anvil exited before RPC came up; see $ANVIL_LOG" >&2
      exit 1
    fi
    printf '.'
    sleep 0.25
  done
  if ! rpc_alive; then
    printf '\n'
    echo "anvil did not become reachable within 10s; see $ANVIL_LOG" >&2
    exit 1
  fi
fi

# --- 2. deploy contract ---
section "Deploying InferenceEscrow"
RPC_URL="$RPC_URL" CHAIN_ID="$CHAIN_ID" bash "$ROOT_DIR/scripts/deploy_local.sh"

DEPLOYMENT_FILE="$ROOT_DIR/contracts/deployments/localhost.json"
if [ ! -f "$DEPLOYMENT_FILE" ]; then
  echo "deployment file not found: $DEPLOYMENT_FILE" >&2
  exit 1
fi
INFERENCE_ESCROW_ADDRESS=$(python -c 'import json,sys;print(json.load(open(sys.argv[1]))["address"])' "$DEPLOYMENT_FILE")
echo "Contract address: $INFERENCE_ESCROW_ADDRESS"

# --- 3. backend ---
section "Starting backend on :$BACKEND_PORT"
cat <<INFO
RPC_URL=$RPC_URL
CHAIN_ID=$CHAIN_ID
INFERENCE_ESCROW_ADDRESS=$INFERENCE_ESCROW_ADDRESS
WORKER_ADDRESS=$WORKER_ADDRESS
PROVIDER_NODE_URL=$PROVIDER_NODE_URL
INFO
echo
echo "Ctrl+C stops the backend (and the anvil started by this script)."
echo

cd "$ROOT_DIR/backend"
RPC_URL="$RPC_URL" \
CHAIN_ID="$CHAIN_ID" \
INFERENCE_ESCROW_ADDRESS="$INFERENCE_ESCROW_ADDRESS" \
WORKER_PRIVATE_KEY="$WORKER_PRIVATE_KEY" \
WORKER_ADDRESS="$WORKER_ADDRESS" \
PROVIDER_NODE_URL="$PROVIDER_NODE_URL" \
  python -m uvicorn app.main:app --reload --port "$BACKEND_PORT"
