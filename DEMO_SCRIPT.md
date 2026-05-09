# Infer134 5-Minute Demo Script

## Goal

Show judges one clear workflow: an AI agent discovers a worker, creates payment state for a job, receives an offchain inference result, verifies an execution receipt, and marks payment as paid.

## 0:00-0:20 Problem

AI agents will increasingly buy small units of work from external services. Inference is a common case, but standard API billing is opaque and raw onchain settlement should not expose prompts or outputs.

## 0:20-0:50 Solution

Infer134 is a pay-per-inference market for agents and companies. Workers execute jobs offchain and return signed execution receipts. The system keeps prompts and outputs private while exposing hashes, worker identity, and payment state as settlement metadata.

## 0:50-2:50 Guided UI Flow

Open `/demo`. The MVP is the buyer journey.

1. Start as `research-agent.eth`.
2. Choose a worker-advertised model such as `Qwen/Qwen2.5-0.5B-Instruct` or mock fallback.
3. Enter the prompt and show `input_hash`.
4. Select `gpu-prague.eth`.
5. Create escrow and show payment state `escrowed`.
6. Run inference and show the offchain output plus `output_hash`.
7. Verify the execution receipt: input hash, output hash, receipt hash, and signature status.
8. Release payment and finish with payment state `paid`.

Call out the mode labels. The UI must never silently fake real connectivity:

- `Backend connected` or `Fixture mode: backend unavailable`.
- `Local Anvil connected` or `Mock settlement: chain unavailable`.
- `Local worker connected` or `Mock inference: provider-node unavailable`.

Call out that this is the UX Flow bounty angle: complex blockchain concepts are translated into plain buyer actions.

## 2:50-3:30 API Flow

Run:

```bash
./scripts/demo_flow.sh
```

Narrate the API steps:

- health check;
- register worker;
- create job;
- list open jobs;
- claim job;
- run inference;
- submit result and execution receipt;
- mark payment paid;
- fetch receipt.

## 3:30-4:25 Architecture and Trust

Explain the architecture:

- Backend coordinator stores offchain state in memory.
- Worker node runs deterministic mock inference by default or local vLLM/Hugging Face inference when enabled.
- Local Anvil contract stores hashes and payment settlement metadata for the escrow narrative.
- Identity resolver is mocked but isolated behind ENS-style endpoints.

Trust model:

- Hashes prove integrity of stored values, not semantic correctness.
- Demo signatures prove the worker signed the receipt, not that the model output is correct.
- Backend is trusted in this MVP.
- Local GPU/model usage is a worker claim unless future TEE, ZK, or multi-worker verification is added.

## 4:25-5:00 ETHPrague Fit

Close with:

- Network Economy: identity plus payment-state settlement for independent compute workers.
- Future Society: privacy-preserving infrastructure for agents and companies to buy compute without exposing sensitive prompts.
- Umia: agentic workflow with venture path.
- ENS: agent and worker identities.
- Privacy by Design: prompts and outputs stay offchain.
- UX Flow: readable payment and verification states.
