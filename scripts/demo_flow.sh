#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"

print_step() {
  printf '\n== %s ==\n' "$1"
}

json_get() {
  python -c "import json,sys; data=json.load(sys.stdin); print(data$1)"
}

print_step "1. Backend health"
curl -sS "$API_BASE_URL/health"
printf '\n'

print_step "2. Register worker"
worker_response="$(curl -sS -X POST "$API_BASE_URL/workers/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"gpu-prague.eth","model":"mock-llama","hardware":"simulated/local worker","price":"0.01 USDC"}')"
printf '%s\n' "$worker_response"
worker_id="$(printf '%s' "$worker_response" | json_get "['worker_id']")"

print_step "3. Create job"
job_response="$(curl -sS -X POST "$API_BASE_URL/jobs" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Explain why offchain inference with execution receipts is useful for AI agents.","buyer_name":"research-agent.eth"}')"
printf '%s\n' "$job_response"
job_id="$(printf '%s' "$job_response" | json_get "['job']['job_id']")"

print_step "4. List open jobs"
curl -sS "$API_BASE_URL/jobs/open"
printf '\n'

print_step "5. Claim job"
curl -sS -X POST "$API_BASE_URL/jobs/$job_id/claim" \
  -H 'Content-Type: application/json' \
  -d "{\"worker_id\":\"$worker_id\"}"
printf '\n'

print_step "6. Run job through worker node or local fallback"
curl -sS -X POST "$API_BASE_URL/jobs/$job_id/run" \
  -H 'Content-Type: application/json' \
  -d "{\"worker_id\":\"$worker_id\"}"
printf '\n'

print_step "7. Submit result and create receipt"
curl -sS -X POST "$API_BASE_URL/jobs/$job_id/submit" \
  -H 'Content-Type: application/json' \
  -d '{}'
printf '\n'

print_step "8. Pay job"
curl -sS -X POST "$API_BASE_URL/jobs/$job_id/pay" \
  -H 'Content-Type: application/json' \
  -d '{}'
printf '\n'

print_step "9. Fetch receipt"
curl -sS "$API_BASE_URL/jobs/$job_id/receipt"
printf '\n'
