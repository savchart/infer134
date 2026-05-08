#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT_DIR="$ROOT_DIR/contracts"
DEPLOYMENTS_DIR="$CONTRACT_DIR/deployments"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="${CHAIN_ID:-31337}"
DEPLOYER_PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
ABI_PATH="contracts/out/InferenceEscrow.sol/InferenceEscrow.json"

section() {
  printf '\n== %s ==\n' "$1"
}

section "Check local Anvil"
if ! cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "Local Anvil is not reachable at $RPC_URL"
  echo "Start it first with: bash scripts/start_anvil.sh"
  exit 1
fi

section "Build contracts"
(cd "$CONTRACT_DIR" && forge build)

section "Deploy InferenceEscrow"
deploy_output="$(cd "$CONTRACT_DIR" && forge create \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  src/InferenceEscrow.sol:InferenceEscrow)"
printf '%s\n' "$deploy_output"

contract_address="$(printf '%s\n' "$deploy_output" | awk '/Deployed to:/ {print $3}')"
if [ -z "$contract_address" ]; then
  echo "Could not parse deployed contract address from forge output"
  exit 1
fi

mkdir -p "$DEPLOYMENTS_DIR"
deployed_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python - "$DEPLOYMENTS_DIR/localhost.json" "$CHAIN_ID" "$RPC_URL" "$contract_address" "$deployed_at" "$ABI_PATH" <<'PY'
import json
import sys

path, chain_id, rpc_url, address, deployed_at, abi_path = sys.argv[1:]
with open(path, "w", encoding="utf-8") as output:
    json.dump(
        {
            "chainId": int(chain_id),
            "rpcUrl": rpc_url,
            "contractName": "InferenceEscrow",
            "address": address,
            "deployedAt": deployed_at,
            "abiPath": abi_path,
        },
        output,
        indent=2,
    )
    output.write("\n")
PY

section "Deployment metadata"
cat "$DEPLOYMENTS_DIR/localhost.json"

echo
echo "Backend env:"
echo "RPC_URL=$RPC_URL CHAIN_ID=$CHAIN_ID INFERENCE_ESCROW_ADDRESS=$contract_address"

