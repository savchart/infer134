#!/usr/bin/env bash
set -euo pipefail

# End-to-end pay-and-run demo via curl.
# Requires: anvil running, InferenceEscrow deployed, backend on :8000, provider-node on :8010.
# The buyer escrow tx is signed with a local Anvil dev key (BUYER_PRIVATE_KEY).

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
ESCROW_VALUE="${ESCROW_VALUE:-1000000000000000}"
PROMPT="${PROMPT:-Explain why offchain inference with execution receipts is useful for AI agents.}"

if ! command -v cast >/dev/null 2>&1; then
  echo "cast (from foundry) is required on PATH" >&2
  exit 1
fi

if [ -z "${BUYER_PRIVATE_KEY:-}" ]; then
  BUYER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  echo "Using default Anvil dev buyer key. Override with BUYER_PRIVATE_KEY for non-default accounts."
fi

if [ -z "${INFERENCE_ESCROW_ADDRESS:-}" ]; then
  if [ -f "$(dirname "$0")/../contracts/deployments/localhost.json" ]; then
    INFERENCE_ESCROW_ADDRESS="$(python -c 'import json,sys; print(json.load(open(sys.argv[1]))["address"])' \
      "$(dirname "$0")/../contracts/deployments/localhost.json")"
  fi
fi

if [ -z "${INFERENCE_ESCROW_ADDRESS:-}" ]; then
  echo "INFERENCE_ESCROW_ADDRESS is not set and no contracts/deployments/localhost.json was found." >&2
  echo "Run scripts/deploy_local.sh first or export INFERENCE_ESCROW_ADDRESS=0x..." >&2
  exit 1
fi

print_step() {
  printf '\n== %s ==\n' "$1"
}

json_get() {
  python -c "import json,sys; data=json.load(sys.stdin); print(data$1)"
}

print_step "1. Backend health"
curl -sS "$API_BASE_URL/health"
printf '\n'

print_step "2. Register worker (offers come from this registration)"
worker_response="$(curl -sS -X POST "$API_BASE_URL/workers/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"gpu-prague.eth","model":"mock-llama","hardware":"simulated/local worker","price":"0.001 local ETH"}')"
printf '%s\n' "$worker_response"
worker_id="$(printf '%s' "$worker_response" | json_get "['worker_id']")"
worker_address="$(printf '%s' "$worker_response" | json_get "['address']")"

print_step "3. List offers"
offers_response="$(curl -sS "$API_BASE_URL/offers")"
printf '%s\n' "$offers_response"
offer_id="$(printf '%s' "$offers_response" | json_get "[0]['offer_id']")"
model_id="$(printf '%s' "$offers_response" | json_get "[0]['model_id']")"

print_step "4. Compute input hash (sha256 of prompt)"
input_hash="0x$(printf '%s' "$PROMPT" | shasum -a 256 | awk '{print $1}')"
printf 'input_hash=%s\n' "$input_hash"

print_step "5. Buyer signs createJob{value} on InferenceEscrow"
send_output="$(cast send "$INFERENCE_ESCROW_ADDRESS" \
  "createJob(address,bytes32)" \
  "$worker_address" "$input_hash" \
  --value "$ESCROW_VALUE" \
  --rpc-url "$RPC_URL" \
  --private-key "$BUYER_PRIVATE_KEY" \
  --json)"
printf '%s\n' "$send_output"
tx_hash="$(printf '%s' "$send_output" | json_get "['transactionHash']")"

print_step "6. Parse JobCreated event for onchain_job_id"
# JobCreated topic0 = keccak256("JobCreated(uint256,address,address,bytes32,uint256)")
topic0="0x08e6e98d4b4e6cb7a4c98fc40a1dfde1d3a6661db3ad3e5d23b43219896489ec"
log_topic1="$(cast receipt "$tx_hash" --rpc-url "$RPC_URL" --json \
  | python -c "
import json, sys
data = json.load(sys.stdin)
target = '$INFERENCE_ESCROW_ADDRESS'.lower()
for log in data.get('logs', []):
    if log['address'].lower() != target:
        continue
    topics = log.get('topics', [])
    if topics and topics[0].lower() == '$topic0'.lower():
        print(topics[1])
        break
")"
onchain_job_id="$(python -c "print(int('$log_topic1', 16))")"
printf 'tx_hash=%s\nonchain_job_id=%s\n' "$tx_hash" "$onchain_job_id"

print_step "7. POST /jobs/run-paid"
run_response="$(curl -sS -X POST "$API_BASE_URL/jobs/run-paid" \
  -H 'Content-Type: application/json' \
  -d "$(python -c "
import json
print(json.dumps({
    'onchain_job_id': '$onchain_job_id',
    'tx_hash': '$tx_hash',
    'prompt': '''$PROMPT''',
    'offer_id': '$offer_id',
    'model_id': '$model_id',
}))
")")"
printf '%s\n' "$run_response"
job_id="$(printf '%s' "$run_response" | json_get "['job']['job_id']")"

print_step "8. Fetch receipt"
curl -sS "$API_BASE_URL/jobs/$job_id/receipt"
printf '\n'

print_step "9. Buyer releases payment onchain"
release_output="$(cast send "$INFERENCE_ESCROW_ADDRESS" \
  "releasePayment(uint256)" \
  "$onchain_job_id" \
  --rpc-url "$RPC_URL" \
  --private-key "$BUYER_PRIVATE_KEY" \
  --json)"
printf '%s\n' "$release_output"

unused_var="$worker_id"
:
