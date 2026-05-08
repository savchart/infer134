# Infer134 5-Minute Pitch

## 20-Second Problem

AI agents and companies need to buy small units of inference from outside workers. Today that means opaque API accounts or ad hoc billing. Putting the whole interaction onchain would leak sensitive prompts and outputs.

## 30-Second Solution

Infer134 is a verifiable pay-per-inference market. Agents submit jobs to independent workers, workers execute offchain, and the buyer receives a signed execution receipt. Prompts and outputs stay private; hashes, receipts, worker identity, and payment state provide a minimal settlement layer.

## 90-Second Demo Flow

1. Open `/demo`.
2. Show `research-agent.eth` as the agent identity.
3. Show worker discovery selecting `gpu-prague.eth`.
4. Show worker capabilities: `mock-llama`, simulated/local worker, signed execution receipts.
5. Move payment state to `escrowed`.
6. Run mocked inference.
7. Show input hash, output hash, receipt hash, and verification status.
8. Move payment state to `paid`.

Emphasize that the prompt and output are offchain, while the hashes and payment state are settlement metadata.

## 60-Second Architecture

- Frontend: guided buyer/agent/worker UX plus `/demo`.
- Backend: trusted coordinator, in-memory jobs, payment-state machine, identity resolver, receipt verification.
- Worker node: deterministic mocked inference that can later be replaced by Ollama, vLLM, or a local model server.
- Contract: local Foundry escrow contract showing how input/output/receipt hashes and payment release map to onchain settlement.

## 60-Second Trust Model

- Verified: input hash, output hash, receipt hash, and demo signature consistency.
- Trusted: backend coordinator, worker execution claim, mocked payment state, and semantic correctness of output.
- Private: prompt, output, and full receipt stay offchain.
- Future hardening: real ENS, x402/stablecoin settlement, reputation, TEE, ZK, optimistic disputes, and multi-worker verification.

## 30-Second Why Now / Market

Agents are becoming economic actors. They need machine-readable ways to discover services, pay per request, and audit what happened. Inference is a practical first market because it is high-volume, measurable, and privacy-sensitive.

## 30-Second Bounty Alignment

- Umia: agentic venture with a clear revenue path.
- ENS: identities for agents and workers.
- Privacy by Design: sensitive data stays offchain.
- UX Flow: normal users see clear states instead of raw blockchain complexity.
- Optional Hardware Usage: the worker can be backed by a local GPU, mini PC, or simulated compute node.

## 30-Second Future Work

Replace mocked identity with ENS, mocked payment with real x402 or stablecoin settlement, mocked signatures with wallet-backed signing, and mocked inference with local Ollama or vLLM. Add reputation, disputes, and stronger compute verification only after the happy path is clear.

