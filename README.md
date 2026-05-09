# Infer134

Private offchain inference with signed execution receipts and transparent local onchain settlement.

Infer134 is a verifiable pay-per-inference market for AI agents and companies. Agents submit inference jobs to independent compute workers. Workers execute the job offchain and return a signed execution receipt. Prompts and outputs stay private; hashes, receipts, worker identity, and payment state provide a minimal local onchain settlement layer.

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
- **Stablecoin/onchain settlement:** the MVP uses native ETH escrow on local Anvil for payment state. Real stablecoin or x402 settlement is future work.
- **Real-world network economies:** independent workers can register with ENS-style identities such as `gpu-prague.eth`.
- **UX for normal users and companies:** the UI explains what is offchain, what is hashable, what is verified, and what remains trusted.

## ETHPrague Positioning

Infer134 is positioned as submission-ready infrastructure for agentic payment flows, not as a general AI platform. The project maps to ETHPrague's solarpunk and real-world impact framing by showing a privacy-preserving market where independent compute workers can sell useful work without forcing buyers to reveal sensitive prompts.

Judging criteria mapping:

- **Technicality:** backend job lifecycle, worker node, receipt hashing/signing abstraction, contract escrow test, and local tests.
- **Originality:** pay-per-inference settlement metadata for AI agents without putting prompts or outputs onchain.
- **Practicality:** local demo path with deterministic workers and clear extension points for ENS, x402, stablecoins, and local model servers.
- **UX/aesthetics:** `/client` collapses pay-per-inference into one button — wallet signs `createJob{value}`, the backend gates inference on the verified onchain escrow, and the buyer sees readable states: paying, running, ready, paid.
- **Wow factor:** agents can buy private compute from named workers and receive execution receipts that are easy to inspect.

## Primary Track: Network Economy

Infer134's primary track is **Network Economy**. The project combines identity, privacy, and payment-state settlement for an independent worker market. It focuses on a concrete economic primitive: agents and companies paying per inference job while exposing only minimal settlement metadata.

## Secondary Track: Future Society

The secondary track is **Future Society**. Infer134 supports privacy-respecting compute access for agents, researchers, and companies. It favors transparent settlement and worker accountability without making sensitive prompts public.

## Bounty Fit

- **Umia: Best Agentic Venture:** deterministic agent route, worker selection, paid job flow, and a plausible marketplace revenue path.
- **ENS: Best ENS Integration for AI Agents:** mocked ENS-style identities for `research-agent.eth` and `gpu-prague.eth`, plus explicit resolver endpoints that can be replaced with real ENS/text records.
- **ETHPrague: Best Privacy by Design:** prompts and outputs stay offchain; settlement metadata uses hashes and payment state.
- **ETHPrague: Best UX Flow:** `/client` is one Pay & run click — the buyer's wallet signs the escrow, the backend verifies onchain state, inference runs, and the receipt is shown without exposing raw contract complexity.
- **Optional Best Hardware Usage:** strongest only if the worker node is shown running on tangible local hardware during the demo.

## 5-Minute Demo Flow

1. **Problem, 20 seconds:** agents need to buy inference without opaque billing or public prompts.
2. **Solution, 30 seconds:** Infer134 gives each job a worker, payment state, and execution receipt.
3. **Guided UI, 90 seconds:** open `/client`, pick a GPU + model offer, write a prompt, and click **Pay & run**. The wallet signs `createJob{value}` on local Anvil, the backend verifies the onchain escrow, runs inference, and returns the signed receipt.
4. **API path, 60 seconds:** run `scripts/demo_flow.sh` to show the same path through `cast send` + `curl /jobs/run-paid`.
5. **Architecture, 60 seconds:** backend coordinator, worker node, local contract, identity resolver, receipt verifier.
6. **Trust model and bounties, 60 seconds:** explain what is verified, trusted, offchain, and future work.

## What x402-Style Means in This MVP

Infer134 does not implement the real x402 protocol yet.

For this MVP, x402-style means:

- pay-per-request semantics;
- explicit payment state;
- an API flow that resembles `payment required -> payment accepted -> work executed -> receipt returned`;
- clean boundaries so real x402 or stablecoin settlement can be added later.

## Model Lifecycle

Infer134 supports two model modes for the hackathon demo.

### Worker Catalog Mode

Worker Catalog Mode is the default MVP path. Workers advertise models they already have ready, cached, or can pull from a public registry. A buyer creates a job with `model_id`, and only workers with a ready matching model capability can claim or run that job.

Demo example:

- worker: `gpu-prague.eth`;
- model: `Qwen/Qwen2.5-0.5B-Instruct` or `mock-llama`;
- source: `public_registry` for Hugging Face allowlisted models, `worker_catalog` for local mock fallback;
- readiness: `ready`;
- runtime: `vllm` or `mock`;
- inference fee: `0.001 local ETH`.

### Custom Model Preparation Mode

Custom Model Preparation Mode lets a buyer or agent request a custom model by providing a model reference. The worker prepares that model as a separate paid preparation step before inference.

For the MVP, preparation is mocked and deterministic:

```text
requested -> accepted -> preparing -> ready
```

No model upload, private model download, Hugging Face auth, or model-weight storage is implemented.

### Fees

- `cold_start_fee`: the model preparation or pull-to-worker fee.
- `inference_fee`: the per-job inference fee after the model is ready.

### Model Privacy and Claims

- Model weights are not stored onchain.
- Model weights are not stored by this backend.
- Model metadata, hashes, readiness state, and receipt claims are stored locally.
- `model_hash` is a signed worker claim in this MVP. It does not prove semantic correctness or real execution.
- Real private models would need temporary tokens, pre-signed URLs, encryption, trusted workers, or future TEE support.

## Provider Offer Catalog

Workers publish buyer-selectable offers made from explicit capability bundles:

- worker identity, such as `gpu-prague.eth`;
- GPU capability, such as `NVIDIA RTX 2070`;
- model capability, such as `Qwen/Qwen2.5-0.5B-Instruct`;
- runtime, such as `vllm` or `mock`;
- readiness state;
- cold-start fee;
- input and output price per 1M tokens.

The provider page at `/provider` lets a demo worker choose available GPUs, choose allowlisted models, and set per-1M-token pricing. The backend keeps this in memory and exposes:

```text
GET /offers
GET /workers/{worker_id}/offers
```

This is not production billing. It is the catalog layer the buyer flow can use before creating an escrowed inference job.

## Wallet Authentication

Infer134 includes a minimal local wallet-auth flow for the MVP:

- clients connect a browser wallet on `/` and sign a challenge before opening `/client`;
- providers connect a browser wallet and sign a challenge before publishing worker offers on `/provider`;
- backend stores an in-memory session token tied to `client` or `provider` role;
- the auth session is optional in the buyer flow — `/jobs/run-paid` can be called anonymously, since the actual buyer authority is the wallet that signed the on-chain `createJob{value}` transaction;
- after a backend restart, stored localStorage tokens are silently treated as anonymous and the UI re-prompts for a fresh signature.

Endpoints:

```text
POST /auth/challenge
POST /auth/verify
GET /auth/session/{session_token}
POST /auth/logout
```

This is not production SIWE. The MVP records the wallet signature and session, but does not recover the signer address server-side. Production work should add signer recovery, SIWE domain binding, expiry enforcement, replay protection, and wallet-scoped authorization checks.

## Demo Flow

The primary MVP route is `/client` — a single-step pay-and-run buyer page.

1. Buyer connects a wallet on the homepage and signs an `Infer134` auth challenge to open `/client`.
2. Buyer picks an offer (worker + GPU + model + price) from live `/offers` published by provider-node.
3. Buyer writes a prompt; the page computes `input_hash = sha256(prompt)`.
4. Buyer clicks **Pay & run**. The wallet signs `createJob(workerAddress, inputHash){value}` on local Anvil; the page parses the `JobCreated` event for `onchain_job_id` and posts `{onchain_job_id, tx_hash, prompt, offer_id}` to `/jobs/run-paid`.
5. Backend verifies the onchain escrow (status, `inputHash` == sha256(prompt), worker matches the offer, tx receipt buyer matches escrow buyer), then runs inference and signs the receipt; the worker key submits `submitResult` onchain.
6. UI shows the offchain output, hashes, and a phase indicator.
7. Optional: the buyer's wallet signs `releasePayment(uint256)` to release ETH from escrow to the worker.

`/client` blocks Pay & run with a concrete reason whenever any precondition fails: backend offline, Anvil/escrow unconfigured, no offer or prompt, wallet not connected, wallet on the wrong chain, or wallet account different from the signed-in session.

## MVP Architecture

- `backend/`: FastAPI coordinator with in-memory storage, worker registry, model registry, the `POST /jobs/run-paid` endpoint that gates inference on the verified onchain escrow, and execution receipt verification.
- `provider-node/`: FastAPI worker node with deterministic mock inference by default and optional local vLLM/Hugging Face inference.
- `contracts/`: Foundry `InferenceEscrow.sol` for local Anvil escrow and hash-based settlement metadata.
- `frontend/`: Next.js 13 / TypeScript app with `/` (wallet entry + live offers ticker), `/client` (single-step pay-and-run buyer page), and `/provider` (publish GPU + model offers).
- `scripts/start_dev_stack.sh`: one-command orchestrator (anvil + deploy + backend with env wired in).
- `scripts/demo_flow.sh`: end-to-end demo via `cast send createJob{value}` + `curl /jobs/run-paid` + `cast send releasePayment`.

The backend is trusted in this MVP. It coordinates workers, stores offchain prompts/results/receipts, reads the onchain escrow state via `cast call jobs(uint256)` to gate inference, and submits the worker's receipt onchain via `WORKER_PRIVATE_KEY`.

## Trust Assumptions and Threat Model

- A worker can return bad output.
- A buyer can try not to pay.
- The coordinator/backend is trusted in this MVP.
- Prompts and results are not put onchain.
- Hashes prove integrity of stored values, not semantic correctness.
- A signature proves the worker signed a receipt, not that inference is correct.
- Payment state can be represented by the local Anvil contract when deployed.
- The local worker node is a simulated compute worker unless you replace it with Ollama, vLLM, or another local model server.
- Future work could add reputation, TEE, ZK, optimistic disputes, multi-worker verification, real x402, or stablecoin settlement.

## What Stays Offchain

- Prompt text.
- Inference output.
- Full execution receipt.
- Worker runtime details.
- Model weights.
- Private model download credentials.
- Backend in-memory state.

## What Would Be Onchain in Production

- Input hash.
- Output hash.
- Receipt hash.
- Worker identity/address.
- Model ID, model source, model revision, model hash, adapter hash when used.
- Price or payment state.
- Escrow lifecycle events.
- Stablecoin or x402 payment acceptance and release state.
- Optional dispute or reputation events.

## Local Blockchain Testnet

Infer134 uses Anvil as a local Ethereum testnet for the realistic escrow/payment-state demo. It does not use public testnets and does not use real funds.

The fastest path is the orchestrator script, which starts Anvil, deploys `InferenceEscrow`, and starts the backend with the right env in one command:

```bash
cd infer134
bash scripts/start_dev_stack.sh
```

If you prefer running the pieces yourself:

```bash
cd infer134
bash scripts/start_anvil.sh        # terminal 1: anvil on :8545
bash scripts/deploy_local.sh       # terminal 1b: writes contracts/deployments/localhost.json
```

Then start the backend with the chain config wired in. For the buyer-signed pay-and-run flow you only need `WORKER_PRIVATE_KEY` (the buyer signs `createJob{value}` from the browser wallet):

```bash
cd infer134/backend
RPC_URL=http://127.0.0.1:8545 \
CHAIN_ID=31337 \
INFERENCE_ESCROW_ADDRESS=<address from contracts/deployments/localhost.json> \
WORKER_PRIVATE_KEY=<anvil-dev-worker-private-key> \
WORKER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
PROVIDER_NODE_URL=http://127.0.0.1:8010 \
  python -m uvicorn app.main:app --reload --port 8000
```

`WORKER_ADDRESS` must match `WORKER_PRIVATE_KEY`, and the provider you registered on `/provider` must use that same address — otherwise `submitResult` reverts with `NotWorker`. `BUYER_PRIVATE_KEY` is only required by the autonomous `POST /agent/tasks` route (where the backend acts as the buyer).

Optional contract-only demo:

```bash
cd infer134
bash scripts/demo_chain_flow.sh
```

Do not use real private keys. Anvil dev keys are local-only test keys.

Check chain status:

```bash
curl http://127.0.0.1:8000/chain/status
```

What the local chain stores:

- `inputHash`
- `outputHash`
- `receiptHash`
- buyer address
- worker address
- native ETH escrow amount and requested payment
- job status

What stays offchain:

- raw prompt;
- raw output;
- full execution receipt;
- model weights.

Anvil dev private keys are local-only test keys. Never use them with real funds.

## Real Local Worker Inference with HF Models

Provider-node supports two runtime modes:

- `INFER134_RUNTIME=mock`: deterministic local output for tests and fixture demos.
- `INFER134_RUNTIME=vllm`: calls a local vLLM OpenAI-compatible server on `127.0.0.1`.

Allowed public Hugging Face demo models:

- `Qwen/Qwen2.5-0.5B-Instruct`
- `Qwen/Qwen3-0.6B`
- `HuggingFaceTB/SmolLM2-360M-Instruct`

The buyer chooses from worker-advertised models. Workers own the runtime and may pull allowlisted public models into a local Hugging Face cache. Buyers do not upload model weights, and model weights are never stored onchain.

Start the local vLLM model server:

```bash
cd infer134
bash scripts/start_vllm_worker.sh
```

Start provider-node in vLLM mode:

```bash
cd infer134/provider-node
INFER134_RUNTIME=vllm \
INFER134_MODEL_ID=Qwen/Qwen2.5-0.5B-Instruct \
INFER134_MODEL_REVISION=main \
INFER134_VLLM_BASE_URL=http://127.0.0.1:8001/v1 \
INFER134_VLLM_API_KEY=infer134-local \
HF_HOME=.hf-cache \
python -m uvicorn app.main:app --reload --port 8010
```

If vLLM is not running, provider-node only fails when `INFER134_RUNTIME=vllm` is selected. Normal tests use mock mode and do not download models.

Real local inference improves the hardware demo, but it does not cryptographically prove the claimed GPU or model was used. That remains trusted unless future TEE, ZK, optimistic dispute, or multi-worker verification is added.

## What Is Verified

- The receipt hash matches canonical receipt contents excluding the signature.
- The input hash matches the stored prompt.
- The output hash matches the stored output.
- The demo signature matches the deterministic local signing abstraction.
- Worker/model compatibility is enforced by the backend before claim/run.
- Custom model preparation exposes explicit readiness state.

## What Is Trusted

- The backend coordinator.
- The worker's claim that it ran inference.
- The worker's claim that `model_hash` represents the prepared model.
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
cd infer134/backend
python -m pip install -e .
```

Install worker node dependencies:

```bash
cd infer134/provider-node
python -m pip install -e .
```

Install frontend dependencies:

```bash
cd infer134/frontend
npm install
```

## Run Locally

Terminal 1, worker node:

```bash
cd infer134/provider-node
python -m uvicorn app.main:app --reload --port 8010
```

Terminal 2, backend:

```bash
cd infer134/backend
PROVIDER_NODE_URL=http://127.0.0.1:8010 python -m uvicorn app.main:app --reload --port 8000
```

Terminal 3, frontend:

```bash
cd infer134/frontend
npm run dev
```

## Frontend Demo

Routes:

- `/`: wallet entrypoint. Users connect a wallet, sign an auth challenge, and pick a role (buyer or provider). Live `/offers` ticker shows what providers have published.
- `/client`: single-step pay-and-run buyer page. Pick offer → write prompt → Pay & run. Wallet signs `createJob{value}`, the backend gates inference on the verified onchain escrow, then UI shows result + receipt + optional Release payment.
- `/provider`: provider setup flow for publishing GPU + model offers. The address you sign in with becomes the worker address, so it must match `WORKER_PRIVATE_KEY` on the backend.

The buyer page surfaces preflight blockers (backend up, anvil up, wallet connected, on chain 31337, account matches session) before enabling Pay & run, and reads the live MetaMask account + chain id so changes are reflected immediately.

API base URL is the same-origin Next.js proxy at `/api/infer134/...`, configurable via `NEXT_PUBLIC_API_BASE_URL`. Provider-node liveness check uses `NEXT_PUBLIC_PROVIDER_NODE_URL`.

Contracts with local Anvil:

```bash
cd infer134/contracts
forge test
anvil
```

## API Demo

After starting Anvil, deploying the contract, and bringing up provider-node + backend (or simply running `bash scripts/start_dev_stack.sh`):

```bash
cd infer134
./scripts/demo_flow.sh
```

The script registers a worker, picks the first offer, computes the prompt's input hash, signs `createJob{value}` with the Anvil dev buyer key via `cast send`, parses `onchain_job_id` from the `JobCreated` log, calls `POST /jobs/run-paid`, fetches the receipt, and signs `releasePayment(uint256)`.

## Submission Checklist

See [`SUBMISSION.md`](SUBMISSION.md) for the canonical checklist. Short version:

- [ ] Public repo: https://github.com/savchart/infer134.
- [ ] Demo video recorded.
- [ ] Tracks: Network Economy (primary), Future Society (secondary).
- [ ] Bounties: Umia, ENS, Best Privacy by Design, Best UX Flow, optional Best Hardware Usage.
- [ ] Team members listed on Devfolio.
- [ ] Pitch: [`PITCH.md`](PITCH.md). Demo script: [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). Trust model: [`docs/trust-model.md`](docs/trust-model.md). Bounty fit: [`docs/bounty-fit.md`](docs/bounty-fit.md). Local startup: [`DEMO_INSTRUCTIONS.md`](DEMO_INSTRUCTIONS.md).

## Testing

Tests are local-only. They do not call external APIs, public networks, Docker, or blockchain nodes.

Backend tests:

```bash
cd infer134/backend
python -m pytest -q
```

Worker node tests:

```bash
cd infer134/provider-node
python -m pytest -q
```

Contract tests:

```bash
cd infer134/contracts
forge test
```

All local checks:

```bash
cd infer134
bash scripts/test_all.sh
```

## Verification Commands

```bash
cd infer134
python -m compileall backend provider-node
bash scripts/test_all.sh
```

The frontend typecheck requires `npm install` first. `scripts/test_all.sh` runs it only when the `typecheck` script is present.
