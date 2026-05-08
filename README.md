# Infer134

Private offchain inference with signed execution receipts and programmable payment settlement.

Infer134 is a verifiable pay-per-inference market for AI agents and companies. Agents submit inference jobs to independent compute workers. Workers execute the job offchain and return a signed execution receipt. Prompts and outputs stay private; hashes, receipts, and payment state provide a minimal verification and settlement layer.

This is not "decentralized OpenAI" and not a GPU cloud on blockchain. The prototype is a local-first demo of pay-per-request inference, execution receipts, and transparent payment state for agentic workflows.

## Problem Statement

AI agents increasingly need to buy small units of work from external services. Inference is a natural example: a buyer wants a model run, a worker has compute, and both sides need a clear payment and verification trail. Existing API billing is account-based and opaque; blockchain settlement is transparent but should not expose prompts or outputs.

Infer134 demonstrates a narrow happy path:

- a buyer creates an inference job;
- a compute worker claims and runs it;
- the system stores only hashes and payment state as settlement metadata;
- the buyer receives an offchain output plus a signed execution receipt.

## ETHPrague Alignment

- **AI agents:** the `/agent/tasks` API route gives a deterministic local agent flow that chooses a worker and completes a paid inference job.
- **Agentic payments:** payment state is explicit and pay-per-request: `unpaid -> escrowed -> payable -> paid`.
- **Security, auditing, verification:** every receipt has deterministic hashes and a demo signature.
- **Privacy by design:** prompts and outputs stay offchain; only input/output/receipt hashes are settlement metadata.
- **Stablecoin/onchain settlement:** the MVP uses mocked USDC-style pricing in the backend and native ETH payment state in the local flow. The local Anvil contract demonstrates ETH escrow for settlement metadata. Real stablecoin or x402 settlement is future work.
- **Real-world network economies:** independent workers can register with ENS-style identities such as `gpu-prague.eth`.
- **UX for normal users and companies:** the UI explains what is offchain, what is hashable, what is verified, and what remains trusted.

## What x402-Style Means in This MVP

Infer134 does not implement the real x402 protocol yet.

For this MVP, x402-style means:

- pay-per-request semantics;
- explicit payment state;
- an API flow that resembles `payment required -> payment accepted -> work executed -> receipt returned`;
- clean boundaries so real x402 or stablecoin settlement can be added later.

## Demo Flow

1. Buyer creates an inference job.
2. Worker sees the open job.
3. Worker claims the job.
4. Worker runs mocked inference.
5. Worker submits the output.
6. Backend creates a signed execution receipt.
7. Buyer sees the result and receipt.
8. Payment state changes visibly.
9. UI/API explains what is offchain, hashable, verified, and trusted.

## MVP Architecture

- `backend/`: FastAPI coordinator with in-memory storage, worker registry, job lifecycle, agent route, and execution receipt verification.
- `provider-node/`: FastAPI worker node with deterministic mocked inference.
- `contracts/`: Foundry contract for local Anvil escrow and hash-based settlement metadata.
- `frontend/`: minimal Next.js TypeScript placeholders for buyer, worker, agent, and job-status views.
- `scripts/demo_flow.sh`: curl-based local API demo.

The backend is trusted in this MVP. It coordinates workers, stores offchain prompts/results/receipts, and updates mocked payment state.

## Trust Assumptions and Threat Model

- A worker can return bad output.
- A buyer can try not to pay.
- The coordinator/backend is trusted in this MVP.
- Prompts and results are not put onchain.
- Hashes prove integrity of stored values, not semantic correctness.
- A signature proves the worker signed a receipt, not that inference is correct.
- The local worker node is a simulated compute worker unless you replace it with Ollama, vLLM, or another local model server.
- Future work could add reputation, TEE, ZK, optimistic disputes, multi-worker verification, real x402, or stablecoin settlement.

## What Is Offchain

- Prompt text.
- Inference output.
- Full execution receipt.
- Worker runtime details.
- Backend in-memory state.

## What Would Be Onchain or Hashable

- Input hash.
- Output hash.
- Receipt hash.
- Worker identity/address.
- Price or payment state.
- Escrow lifecycle events.

## What Is Verified

- The receipt hash matches canonical receipt contents excluding the signature.
- The input hash matches the stored prompt.
- The output hash matches the stored output.
- The demo signature matches the deterministic local signing abstraction.

## What Is Trusted

- The backend coordinator.
- The worker's claim that it ran inference.
- The mocked payment state in the backend.
- The semantic quality of the output.

## Explicitly Out of Scope

- Real x402 protocol support.
- Public testnets or mainnet.
- Custom token.
- Staking or slashing.
- Real proof-of-compute.
- Production-grade decentralization.
- ZK proofs.
- TEE attestations.
- P2P discovery.
- Reputation.
- Paid external AI APIs.
- Production ENS resolution.

## Local Setup

Python services are designed for PyCharm and direct module execution.

Optional virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

Install backend dependencies:

```bash
cd infermesh/backend
python -m pip install -e .
```

Install worker node dependencies:

```bash
cd infermesh/provider-node
python -m pip install -e .
```

Install frontend dependencies:

```bash
cd infermesh/frontend
npm install
```

## Run Locally

Terminal 1, worker node:

```bash
cd infermesh/provider-node
python -m uvicorn app.main:app --reload --port 8010
```

Terminal 2, backend:

```bash
cd infermesh/backend
PROVIDER_NODE_URL=http://127.0.0.1:8010 python -m uvicorn app.main:app --reload --port 8000
```

Terminal 3, frontend:

```bash
cd infermesh/frontend
npm run dev
```

Contracts with local Anvil:

```bash
cd infermesh/contracts
forge test
anvil
```

## API Demo

After starting the worker node and backend:

```bash
cd infermesh
./scripts/demo_flow.sh
```

The script demonstrates health checks, worker registration, job creation, open job listing, claiming, running, submitting, payment, and receipt fetching.

## Testing

Tests are local-only. They do not call external APIs, public networks, Docker, or blockchain nodes.

Backend tests:

```bash
cd infermesh/backend
python -m pytest -q
```

Worker node tests:

```bash
cd infermesh/provider-node
python -m pytest -q
```

Contract tests:

```bash
cd infermesh/contracts
forge test
```

All local checks:

```bash
cd infermesh
bash scripts/test_all.sh
```

## Verification Commands

```bash
cd infermesh
python -m compileall backend provider-node
bash scripts/test_all.sh
```

The frontend typecheck requires `npm install` first. `scripts/test_all.sh` runs it only when the `typecheck` script is present.
