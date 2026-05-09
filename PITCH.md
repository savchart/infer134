# Infer134 5-Minute Pitch

## 20-Second Problem

AI agents and companies need to buy small units of inference from outside workers. Today that means opaque API accounts or ad hoc billing. Putting the whole interaction onchain would leak sensitive prompts and outputs.

## 30-Second Solution

Infer134 is a verifiable pay-per-inference market. The buyer's wallet signs an escrow transaction on a local contract, the backend verifies the onchain state and only then runs inference offchain, and the buyer receives a signed execution receipt. Prompts and outputs stay private; hashes, receipts, worker identity, and payment state provide a minimal settlement layer.

## 90-Second Demo Flow

1. Open `/` and connect a wallet as `research-agent.eth` — single signature opens the buyer page.
2. Open `/client`. Live `/offers` ticker shows the worker `gpu-prague.eth` with its GPU, model, and price.
3. Pick the offer, type a prompt — the page computes `input_hash = sha256(prompt)`.
4. Click **Pay & run**. MetaMask asks to sign `createJob(workerAddress, inputHash){value}` on local Anvil.
5. The page parses the `JobCreated` event for `onchain_job_id` and posts `{onchain_job_id, tx_hash, prompt, offer_id}` to `POST /jobs/run-paid`.
6. The backend verifies the escrow status, that `inputHash` matches `sha256(prompt)`, that the worker matches the offer, runs inference through provider-node, and submits the worker-signed receipt onchain.
7. UI shows the offchain output, hashes, receipt verification status, and a phase indicator.
8. Optional: the buyer's wallet signs `releasePayment(uint256)` to send escrowed ETH to the worker.

Emphasize that **inference cannot run without the verified onchain escrow** — the backend won't run the model just because someone calls the API.

## 60-Second Architecture

- Frontend: Next.js 13 with `/` (wallet entry + live offers), `/client` (single-step pay-and-run), `/provider` (publish offers). Browser wallet signs both the auth challenge and the on-chain transaction directly via `window.ethereum`.
- Backend: trusted FastAPI coordinator. `POST /jobs/run-paid` reads `jobs(uint256)` via `cast call` and `eth_getTransactionReceipt` to verify the escrow before running inference; submits the receipt onchain via `WORKER_PRIVATE_KEY`.
- Worker node: deterministic mock inference by default, optional local vLLM with allowlisted public Hugging Face models.
- Contract: Foundry `InferenceEscrow.sol` on local Anvil holding native ETH escrow plus input/output/receipt hashes.

## 60-Second Trust Model

- Verified: input hash matches the stored prompt, output hash matches the stored output, receipt hash matches canonical receipt fields, demo signature is consistent, and the buyer-signed escrow tx exists onchain with the right `inputHash` and worker.
- Trusted: backend coordinator, worker execution claim, mocked semantic correctness of output, and the worker's claim about the actual GPU/model.
- Private: prompt, output, and full receipt stay offchain.
- Future hardening: real ENS, SIWE-grade auth, x402/stablecoin settlement, reputation, TEE, ZK, optimistic disputes, multi-worker verification.

## 30-Second Why Now / Market

Agents are becoming economic actors. They need machine-readable ways to discover services, pay per request, and audit what happened. Inference is a practical first market because it is high-volume, measurable, and privacy-sensitive.

## 30-Second Bounty Alignment

- Umia: agentic venture with a clear marketplace revenue path.
- ENS: identities for agents and workers, ready for real ENS resolution.
- Privacy by Design: sensitive data stays offchain.
- UX Flow: one button, one signature, plain phase indicator instead of raw blockchain mechanics.
- Optional Hardware Usage: the worker can be backed by a local GPU box during the live demo.

## 30-Second Future Work

Replace mocked ENS with real resolution, the demo signature with `eth-account` / SIWE-grade signer recovery, native-ETH escrow with x402 / stablecoin settlement, and the in-memory backend with persistent storage. Add reputation, disputes, and stronger compute verification only after the happy path is solid.
