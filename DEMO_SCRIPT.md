# Infer134 5-Minute Demo Script

## Goal

Show judges one clear workflow: a buyer signs an escrow transaction in their wallet, the backend verifies it onchain, runs inference offchain, and returns a signed execution receipt — with optional onchain payment release at the end.

## 0:00-0:20 Problem

AI agents will increasingly buy small units of work from external services. Inference is a common case, but standard API billing is opaque and raw onchain settlement should not expose prompts or outputs.

## 0:20-0:50 Solution

Infer134 is a pay-per-inference market for agents and companies. The buyer's wallet signs an escrow transaction; the backend gates inference on the verified onchain state. Workers execute jobs offchain and return signed execution receipts. Prompts and outputs stay private while hashes, worker identity, and payment state are settlement metadata.

## 0:50-2:50 Guided UI Flow

Open `/` and connect a wallet. Sign the auth challenge to enter `/client` — this is the buyer journey.

1. The live `/offers` ticker shows worker `gpu-prague.eth` with its GPU, model, and price.
2. Pick the offer (e.g. `Qwen/Qwen2.5-0.5B-Instruct` on the local RTX 2070, or the mock fallback).
3. Type the prompt. The page computes `input_hash = sha256(prompt)` locally.
4. Click **Pay & run**.
5. MetaMask asks the buyer to sign `createJob(workerAddress, inputHash){value}` on local Anvil. Confirm.
6. The page polls for the receipt, parses the `JobCreated` event for `onchain_job_id`, then posts `{onchain_job_id, tx_hash, prompt, offer_id}` to `POST /jobs/run-paid`.
7. The backend verifies the escrow: status `Created`, `inputHash` matches `sha256(prompt)`, worker matches the offer, the tx receipt's buyer matches the escrow buyer.
8. Inference runs through provider-node; the backend signs the receipt and submits it onchain via `WORKER_PRIVATE_KEY`.
9. UI shows the offchain output, hashes, and a phase indicator (`paying → running → ready → released`).
10. Optional: click **Release payment**, MetaMask signs `releasePayment(uint256)`, ETH leaves the escrow to the worker.

Call out the preflight checklist on `/client`: backend up, anvil up, wallet connected, on chain 31337, account matches session. The button is disabled with concrete reasons until every check is green — the UI never silently fakes connectivity.

This is the UX Flow bounty angle: complex blockchain concepts collapse into one button + one signature.

## 2:50-3:30 API Flow

Run:

```bash
./scripts/demo_flow.sh
```

Narrate the API path:

- backend health check;
- register a worker so an offer is published;
- list offers;
- compute `input_hash` for the prompt;
- `cast send InferenceEscrow.createJob(address,bytes32){value}` from the Anvil dev buyer key;
- parse `onchain_job_id` from the `JobCreated` log on the tx receipt;
- `curl POST /jobs/run-paid` with `{onchain_job_id, tx_hash, prompt, offer_id}`;
- backend returns the result, signed receipt, and the worker's onchain submit tx;
- `cast send InferenceEscrow.releasePayment(uint256)` to settle the escrow.

## 3:30-4:25 Architecture and Trust

Architecture:

- Frontend signs both the auth challenge (`personal_sign`) and the escrow transaction (`eth_sendTransaction`) directly via `window.ethereum` — no extra wallet libraries.
- Backend coordinator stores offchain state in memory, reads onchain `jobs(uint256)` via `cast call` to verify the escrow, runs inference through provider-node, and submits the receipt onchain via the worker key.
- Worker node runs deterministic mock inference by default or a local vLLM/Hugging Face model when enabled.
- Local Anvil contract `InferenceEscrow.sol` holds native ETH escrow plus input/output/receipt hashes.

Trust model:

- Verified: input hash, output hash, receipt hash, demo signature consistency, and the buyer-signed escrow on local Anvil.
- Trusted: backend coordinator, worker's claim about the actual GPU/model, semantic correctness of the output.
- The wallet auth signature is recorded as evidence but is not run through ECDSA recovery — production replacement is SIWE-grade auth.

## 4:25-5:00 ETHPrague Fit

Close with:

- **Network Economy:** identity, privacy, and onchain-gated payment for an independent worker market.
- **Future Society:** privacy-preserving infrastructure for agents and companies to buy compute without exposing sensitive prompts.
- **Umia:** agentic workflow + plausible marketplace revenue path.
- **ENS:** worker and agent ENS-style identities, ready for real resolution.
- **Privacy by Design:** prompts and outputs stay offchain; only hashes hit settlement.
- **UX Flow:** one button, one signature, readable preflight checklist, plain phase indicator.
