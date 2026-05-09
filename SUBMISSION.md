# Infer134 Submission Checklist

## Devfolio Basics

- Project name: Infer134
- Tagline: Private offchain inference with signed execution receipts and programmable payment settlement.
- Open-source repository: https://github.com/savchart/infer134
- Demo video: TBD
- Live demo URL: TBD
- Contract address: TBD if deployed locally or on a permitted demo network
- Team members: TBD

## Tracks

- Primary track: Network Economy
- Secondary track: Future Society

## Bounties

- Umia: Best Agentic Venture
- ENS: Best ENS Integration for AI Agents
- ETHPrague: Best Privacy by Design
- ETHPrague: Best UX Flow
- Optional: ETHPrague Best Hardware Usage

## Submission Notes

- Code is public and open source for judging.
- Demo is local-first and does not depend on paid APIs.
- Real ENS, real x402, TEE, ZK, staking, reputation, and production decentralization are explicitly out of scope for this prototype.
- The judging demo should use `/client` for the guided buyer flow (single Pay & run button, wallet-signed escrow) and `scripts/demo_flow.sh` for the API path (`cast send` + `curl /jobs/run-paid`).

## Manual-Aligned Requirements

- Submit through Devfolio.
- Provide the open-source code link.
- Keep the presentation under 5 minutes.
- If a contract is deployed for the demo, provide the contract address.

## Final Pre-Submission Pass

- [ ] Confirm repository is public.
- [ ] Confirm README explains what is mocked and trusted.
- [ ] Confirm `/client` loads locally and Pay & run reaches `payable` state with the local Anvil + provider-node stack (`bash scripts/start_dev_stack.sh` covers chain + backend in one command).
- [ ] Confirm backend and worker node tests pass.
- [ ] Confirm Foundry test passes.
- [ ] Record demo video link.
- [ ] Record contract address if deployed.
- [ ] Select tracks and bounties in Devfolio.
- [ ] Add team member names.

