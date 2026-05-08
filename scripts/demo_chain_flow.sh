#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_FILE="$ROOT_DIR/contracts/deployments/localhost.json"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
BUYER_PRIVATE_KEY="${BUYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
WORKER_PRIVATE_KEY="${WORKER_PRIVATE_KEY:-0x59c6995e998f97a5a0044966f0945380d700e2d960e87f8e7c7b4f6f4b9d6d9}"
WORKER_ADDRESS="${WORKER_ADDRESS:-0x70997970C51812dc3A010C7d01b50e0d17dc79C8}"
ESCROW_VALUE="${ESCROW_VALUE:-1ether}"
REQUESTED_PAYMENT_WEI="${REQUESTED_PAYMENT_WEI:-400000000000000000}"

section() {
  printf '\n== %s ==\n' "$1"
}

if [ ! -f "$DEPLOYMENT_FILE" ]; then
  echo "Deployment metadata not found: $DEPLOYMENT_FILE"
  echo "Run first: bash scripts/deploy_local.sh"
  exit 1
fi

CONTRACT_ADDRESS="$(python - "$DEPLOYMENT_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    print(json.load(fh)["address"])
PY
)"

section "Local chain"
cast block-number --rpc-url "$RPC_URL"
echo "InferenceEscrow: $CONTRACT_ADDRESS"
echo "Worker: $WORKER_ADDRESS"
echo "WARNING: using local Anvil dev keys only."

INPUT_HASH="$(cast keccak "private prompt stays offchain")"
OUTPUT_HASH="$(cast keccak "offchain mocked output")"
RECEIPT_HASH="$(cast keccak "signed execution receipt")"
JOB_ID="$(cast call "$CONTRACT_ADDRESS" "nextJobId()(uint256)" --rpc-url "$RPC_URL")"

section "1. Buyer creates onchain escrow job"
cast send "$CONTRACT_ADDRESS" \
  "createJob(address,bytes32)" \
  "$WORKER_ADDRESS" \
  "$INPUT_HASH" \
  --value "$ESCROW_VALUE" \
  --rpc-url "$RPC_URL" \
  --private-key "$BUYER_PRIVATE_KEY"

section "2. Read created job"
cast call "$CONTRACT_ADDRESS" \
  "jobs(uint256)(address,address,uint256,uint256,bytes32,bytes32,bytes32,uint8)" \
  "$JOB_ID" \
  --rpc-url "$RPC_URL"

section "3. Worker submits output_hash and receipt_hash"
cast send "$CONTRACT_ADDRESS" \
  "submitResult(uint256,bytes32,bytes32,uint256)" \
  "$JOB_ID" \
  "$OUTPUT_HASH" \
  "$RECEIPT_HASH" \
  "$REQUESTED_PAYMENT_WEI" \
  --rpc-url "$RPC_URL" \
  --private-key "$WORKER_PRIVATE_KEY"

section "4. Buyer releases payment"
cast send "$CONTRACT_ADDRESS" \
  "releasePayment(uint256)" \
  "$JOB_ID" \
  --rpc-url "$RPC_URL" \
  --private-key "$BUYER_PRIVATE_KEY"

section "5. Read final paid job"
cast call "$CONTRACT_ADDRESS" \
  "jobs(uint256)(address,address,uint256,uint256,bytes32,bytes32,bytes32,uint8)" \
  "$JOB_ID" \
  --rpc-url "$RPC_URL"

section "Settlement metadata"
echo "input_hash=$INPUT_HASH"
echo "output_hash=$OUTPUT_HASH"
echo "receipt_hash=$RECEIPT_HASH"
echo "status=Paid"
echo "prompt/output remain offchain"

