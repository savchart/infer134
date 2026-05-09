# Infer134

Private AI inference with receipts and programmable payments.

Infer134 is a local-first prototype for buying AI inference from independent compute workers. A buyer selects a worker-published GPU/model offer, sends a prompt offchain, receives a signed execution receipt, and releases payment through explicit local settlement state.

The project is not a decentralized OpenAI clone, a generic GPU cloud, or proof-of-compute. It demonstrates one narrow workflow: private pay-per-inference with readable receipts and an honest trust boundary.

## What It Solves

AI agents and companies increasingly need to buy small units of external work, such as LLM inference. Existing API billing is opaque, while naive onchain settlement can expose too much data.

Infer134 keeps the private work offchain and uses only minimal settlement metadata:

- input hash;
- output hash;
- receipt hash;
- buyer and worker identity;
- payment state.

Prompts, outputs, model weights, and full runtime details stay offchain.

## How It Works

1. A provider publishes runtime-ready GPU/model offers.
2. A buyer chooses an offer and writes a prompt.
3. The browser wallet creates local escrow/payment state on Anvil.
4. The backend verifies the payment state before running inference.
5. The worker returns an offchain output and a signed execution receipt.
6. The buyer can inspect hashes, receipt state, and release payment.

The main UI route is `/client`. The provider route is `/provider`.

## Architecture

- `frontend/`: Next.js and TypeScript UI for buyer, provider, wallet session, receipt, and payment views.
- `backend/`: FastAPI coordinator for workers, offers, jobs, receipts, and local settlement checks.
- `provider-node/`: FastAPI worker runtime with deterministic mock inference and optional local vLLM mode.
- `contracts/`: Foundry contract for local Anvil escrow and hash-based payment metadata.
- `scripts/`: local startup, deployment, and demo scripts.

## Local Demo

Use [demo_setup.md](demo_setup.md) for full startup commands.

Fast path:

```bash
cd infer134
bash scripts/start_dev_stack.sh
```

In another terminal:

```bash
cd infer134/frontend
npm run dev
```

Open:

```text
http://localhost:3000/client
```

For the default worker:

```bash
cd infer134/provider-node
python -m uvicorn app.main:app --reload --port 8010
```

## Trust Boundary

Verified in the MVP:

- prompt and output hashes;
- receipt hash;
- signed execution receipt;
- local payment state;
- worker/model compatibility before execution.

Trusted in the MVP:

- backend coordinator;
- worker claim that it ran inference correctly;
- worker claim about the actual model/runtime used;
- local demo identity and signing abstractions.

Future versions could add real ENS resolution, x402 or stablecoin settlement, worker reputation, disputes, TEEs, ZK proofs, or multi-worker verification.

## Tech Stack

- Next.js, React, TypeScript;
- FastAPI and Python;
- Solidity, Foundry, Anvil;
- browser wallet signing;
- SHA-256 hashes and signed execution receipts;
- optional local vLLM / Hugging Face model runtime;
- deterministic mock inference for local demos.

## Tests

```bash
cd infer134
python -m compileall backend provider-node
bash scripts/test_all.sh
```

Run narrower checks directly when working on one layer:

```bash
cd infer134/backend
python -m pytest -q
```

```bash
cd infer134/provider-node
python -m pytest -q
```

```bash
cd infer134/contracts
forge test
```
