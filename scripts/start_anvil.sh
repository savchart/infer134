#!/usr/bin/env bash
set -euo pipefail

echo "Starting local Anvil on http://127.0.0.1:8545 with chain id 31337"
echo "WARNING: Anvil dev private keys are local-only test keys. Never use them with real funds."

exec anvil --host 127.0.0.1 --port 8545 --chain-id 31337

