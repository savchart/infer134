# Infer134 Trust Model

## Summary

Infer134 is privacy-first but not trustless in this MVP. It demonstrates the boundary between private offchain compute and transparent settlement metadata.

## Offchain by Design

- Prompt text.
- Inference output.
- Full execution receipt.
- Worker runtime logs.
- Model weights.
- Private model download credentials or temporary tokens.
- Backend in-memory job state.

## Hashable or Onchain Settlement Metadata

- Input hash.
- Output hash.
- Receipt hash.
- Worker identity.
- Model ID.
- Model source.
- Model revision.
- Model hash.
- Adapter hash when used.
- Price.
- Payment state.

## Verified in the MVP

- The input hash matches the stored prompt.
- The output hash matches the stored output.
- The receipt hash matches canonical receipt fields excluding the signature.
- The demo signature matches the deterministic local signing abstraction.
- Payment state can be verified against the local Anvil escrow contract when deployed.
- The backend checks that the claiming worker advertises the requested model as ready.
- The custom model preparation flow reaches explicit `ready` state.

## Trusted in the MVP

- The backend coordinator.
- The worker claim that it executed the job.
- The worker claim that `model_hash` represents the actual prepared model.
- Any backend-only payment-state transition when the local chain is not configured.
- The semantic correctness and usefulness of the model output.

## Threats

- A worker can return a low-quality or incorrect output.
- A buyer can try not to pay outside the controlled state machine.
- A coordinator can misreport job status in this MVP.
- Public identity records can leak information if they contain secrets.
- Hashes can prove integrity of stored values, but not whether the inference was correct.
- A worker can claim a model hash without actually running that model in this MVP.

## Local Onchain Settlement Boundary

When Anvil is running and `InferenceEscrow` is deployed, native ETH escrow and payment release are real local EVM state. The contract stores only settlement metadata:

- buyer address;
- worker address;
- input hash;
- output hash;
- receipt hash;
- requested payment;
- job status.

The contract does not store prompts, outputs, full receipts, model weights, or private model credentials.

Receipt integrity is still verified locally by the backend. Semantic correctness of inference remains trusted/mocked, and `model_hash` remains a signed worker claim rather than cryptographic proof-of-compute.

## Model Ownership and Preparation

Infer134 has two model modes.

Worker Catalog Mode:

- Workers advertise models they already have ready or can pull from a public registry.
- Buyers select a `model_id`.
- Only compatible workers can claim/run the job.

Custom Model Preparation Mode:

- A buyer or agent submits a model reference.
- The worker prepares the model as a separate paid step.
- The MVP mocks the progression: `requested -> accepted -> preparing -> ready`.
- The resulting `model_hash` is a signed worker claim.

No model weights are stored onchain or in the repository. Real private models would need temporary tokens, pre-signed URLs, encryption, trusted workers, or future TEE-based isolation.

## Identity Boundary

Current identity is an ENS-style mock resolver. It returns `research-agent.eth` and `gpu-prague.eth` metadata from local code.

Production replacement:

- ENS name resolution for addresses.
- ENS text records for public capabilities.
- Offchain or encrypted metadata for sensitive details.

Public ENS records must not contain secrets such as API keys, prompts, private endpoints, or personal data.

## Future Hardening

- Real ENS resolution and text records.
- Real x402 or stablecoin settlement.
- Wallet-backed worker signatures.
- Reputation and worker history.
- Optimistic disputes.
- Multi-worker verification.
- TEE attestations.
- ZK proofs for narrow verifiable workloads.
