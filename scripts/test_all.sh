#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

section() {
  printf '\n== %s ==\n' "$1"
}

if [ -d "$ROOT_DIR/backend" ]; then
  section "Backend tests"
  (cd "$ROOT_DIR/backend" && python -m pytest -q)
fi

if [ -d "$ROOT_DIR/provider-node" ]; then
  section "Worker node tests"
  (cd "$ROOT_DIR/provider-node" && python -m pytest -q)
fi

if [ -d "$ROOT_DIR/contracts" ]; then
  if command -v forge >/dev/null 2>&1; then
    section "Foundry tests"
    (cd "$ROOT_DIR/contracts" && forge test)
  else
    section "Foundry tests skipped"
    printf 'forge is not available on PATH\n'
  fi
fi

if [ -f "$ROOT_DIR/frontend/package.json" ] && grep -q '"typecheck"' "$ROOT_DIR/frontend/package.json"; then
  section "Frontend typecheck"
  (cd "$ROOT_DIR/frontend" && npm run typecheck)
fi
