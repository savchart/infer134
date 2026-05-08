# Infer134 5-Minute Demo Script

## Goal

Show judges one clear workflow: an AI agent discovers a worker, creates payment state for a job, receives an offchain inference result, verifies an execution receipt, and marks payment as paid.

## 0:00-0:20 Problem

AI agents will increasingly buy small units of work from external services. Inference is a common case, but standard API billing is opaque and raw onchain settlement should not expose prompts or outputs.

## 0:20-0:50 Solution

Infer134 is a pay-per-inference market for agents and companies. Workers execute jobs offchain and return signed execution receipts. The system keeps prompts and outputs private while exposing hashes, worker identity, and payment state as settlement metadata.

## 0:50-2:20 Guided UI Flow

Open `/demo` and press the demo button.

1. Agent identity appears: `research-agent.eth`.
2. Worker discovery selects `gpu-prague.eth`.
3. Worker capabilities are shown: `mock-llama`, simulated/local worker, execution receipts.
4. Payment state moves from `unpaid` to `escrowed`.
5. Inference runs offchain.
6. Input hash, output hash, and receipt hash appear.
7. Receipt verification is shown as passed.
8. Payment state moves to `paid`.

Call out that this is the UX Flow bounty angle: complex blockchain concepts are translated into plain states.

## 2:20-3:20 API Flow

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

## 3:20-4:20 Architecture and Trust

Explain the architecture:

- Backend coordinator stores offchain state in memory.
- Worker node simulates a local compute worker.
- Contract stores hashes and payment settlement metadata for the local escrow narrative.
- Identity resolver is mocked but isolated behind ENS-style endpoints.

Trust model:

- Hashes prove integrity of stored values, not semantic correctness.
- Demo signatures prove the worker signed the receipt, not that the model output is correct.
- Backend is trusted in this MVP.

## 4:20-5:00 ETHPrague Fit

Close with:

- Network Economy: identity plus payment-state settlement for independent compute workers.
- Future Society: privacy-preserving infrastructure for agents and companies to buy compute without exposing sensitive prompts.
- Umia: agentic workflow with venture path.
- ENS: agent and worker identities.
- Privacy by Design: prompts and outputs stay offchain.
- UX Flow: readable payment and verification states.

