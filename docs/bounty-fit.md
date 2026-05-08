# Infer134 Bounty Fit

## Primary Track: Network Economy

Infer134 creates a small network economy around independent compute workers. Agents discover workers, create jobs, track payment state, and receive execution receipts. The settlement layer is intentionally minimal: hashes, identity, price, and payment state.

Why it fits:

- Identity: workers and agents use ENS-style names.
- Economic coordination: each job has explicit payment state.
- Privacy: sensitive inference data stays offchain.
- Practicality: local worker and backend can run during judging.

## Secondary Track: Future Society

Infer134 supports privacy-respecting access to compute for agents, researchers, and companies. The future-society angle is not generic AI; it is accountable infrastructure for buying private compute without exposing task content.

Why it fits:

- Transparent settlement without public prompts.
- Worker market that could include local, community, or renewable-powered compute.
- Clear trust model for non-expert users.

## Umia: Best Agentic Venture

Infer134 has an agentic workflow: `research-agent.eth` selects a worker and completes a job. The venture path is a marketplace fee on pay-per-inference jobs for agent teams and companies.

Judging story:

- Agent execution is visible.
- Revenue path is plausible.
- Product can become a managed agentic compute market.

## ENS: Best ENS Integration for AI Agents

Current status: mocked ENS-style identity.

Demo fit:

- `research-agent.eth` identifies the buyer agent.
- `gpu-prague.eth` identifies the worker.
- Identity metadata exposes capabilities and worker role.

Future real ENS path:

- Resolve names live through ENS.
- Store public worker capabilities in text records.
- Keep secrets out of public records.
- Use offchain resolvers for private worker metadata.

## ETHPrague: Best Privacy by Design

Privacy is a core architecture choice:

- Prompts stay offchain.
- Outputs stay offchain.
- Only input hash, output hash, receipt hash, identity, price, and payment state are settlement metadata.

Clear caveat:

- The backend is trusted in this MVP.
- Hashes prove integrity, not semantic correctness.

## ETHPrague: Best UX Flow

The `/demo` page translates blockchain and payment mechanics into a readable sequence:

1. Agent identity.
2. Worker discovery.
3. Payment escrowed.
4. Offchain inference.
5. Execution receipt.
6. Verification status.
7. Payment paid.

This avoids raw hex-first UX and makes the state machine understandable.

## Optional: Best Hardware Usage

The worker node is currently simulated/local. The hardware angle becomes stronger if the demo runs the worker on a visible local GPU box, mini PC, or other off-the-shelf device.

Do not claim this bounty unless the demo includes tangible hardware.

