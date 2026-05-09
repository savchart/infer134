# Infer134 Pitch Deck

## Slide 1 - Title

**Infer134**

Private AI inference with receipts and programmable payments.

**Tagline:** Private GPU markets without platform lock-in.

---

## Slide 2 - Problem

AI agents and large companies increasingly need to buy external work: GPU
inference, model runs, tool execution, and specialized compute.

Today this is awkward:

- centralized APIs hide pricing and settlement details;
- raw GPU marketplaces are not built for agent-sized tasks;
- onchain payments can expose too much private workload data;
- large companies do not want to reinforce a small GPU/cloud monopoly;
- many teams cannot send proprietary prompts, documents, or customer data to a
  single closed inference provider;
- providers need a way to sell capacity without becoming a full cloud platform.

Agents and enterprises need a small, verifiable, pay-as-used compute market
that gives them supplier choice without leaking private data.

---

## Slide 3 - Solution

Infer134 lets a buyer, agent, or company book a GPU session with escrow, send
prompts while balance remains, and settle by actual token usage.

The private work stays offchain. The verifiable metadata stays small:

- worker identity;
- selected GPU/model offer;
- input hash;
- output hash;
- receipt hash;
- escrow, spent amount, and refundable balance.

The result is a simple primitive: **book compute first, pay by usage after**.

For enterprises, this creates a procurement path that does not require routing
every sensitive inference request through one dominant GPU platform.

---

## Slide 4 - Demo Flow

1. A provider publishes GPU and model capacity.
2. A buyer selects a live GPU/model offer.
3. The buyer locks an escrow budget for the session.
4. The buyer sends prompts while the balance is available.
5. The backend routes work to the provider node and returns signed receipts.
6. The session ends with refund = escrow - token spend.

This matches how agents and internal enterprise workflows actually operate:
they do not always know the exact number of calls before a task starts.

---

## Slide 5 - Product

Infer134 has three local demo surfaces:

- **Home:** role entry for client and provider.
- **Provider:** publish GPU/model capacity for agents.
- **Client:** book GPU sessions, send prompts, inspect output and escrow state.

The current flow focuses on agent service provision rather than a generic chat
app: providers expose capability, buyers reserve work, and receipts make the
work auditable.

---

## Slide 6 - Architecture

**Frontend**

Next.js UI for wallet session, provider offers, client GPU booking, prompt
loop, output, and escrow ledger.

**Backend**

FastAPI coordinator for workers, offers, jobs, receipts, and session execution.

**Provider node**

Local worker runtime with deterministic mock inference and optional vLLM mode.

**Contracts**

Solidity escrow MVP on local Anvil for hash-based payment metadata.

---

## Slide 7 - Network Economy Track

Infer134 fits Network Economy because it creates a market primitive for
machine-to-machine services.

What becomes possible:

- agents can buy GPU work from independent providers;
- enterprises can diversify GPU supply without exposing private workload data
  to a single platform;
- providers can monetize idle or specialized compute;
- price discovery happens per model, GPU, and runtime;
- sessions support uncertain workloads, not just one fixed request;
- receipts create the basis for reputation, disputes, and future automated
  settlement.

The long-term direction is a service market where compute is listed, booked,
consumed, and settled programmatically by agents, teams, and enterprises.

---

## Slide 8 - Ethereum Core Track

Infer134 fits Ethereum Core by using Ethereum-style settlement for an offchain
compute workflow.

The project demonstrates:

- escrow-gated work;
- hash commitments for private inputs and outputs;
- explicit payment state;
- buyer/worker settlement boundaries;
- local Anvil and Foundry contract development;
- a path from local MVP to real L2 or mainnet settlement.

The important design choice is not to put prompts or model outputs onchain.
Ethereum anchors payment and commitments; inference stays private and offchain.

---

## Slide 9 - Future Society Track

Infer134 fits Future Society because autonomous agents will need safe ways to
hire digital labor.

The project addresses a near-future coordination problem:

- agents need external compute they can trust enough to use;
- companies need alternatives to monopoly GPU access without giving up data
  control;
- humans need readable receipts for what agents paid for;
- providers need clear boundaries for what they served;
- private user intent should not be publicly leaked through settlement.

Infer134 gives buyers a safer purchasing loop: escrow, run, verify receipt,
refund unused balance.

---

## Slide 10 - Why Now

Three shifts are happening at the same time:

- small local and independent GPU providers are becoming practical;
- agents are moving from single prompts to multi-step workflows;
- companies are looking for resilient GPU procurement that does not deepen
  dependence on a few dominant platforms;
- crypto rails are well suited for escrow and programmable settlement.

Infer134 sits at the intersection: agent workloads, enterprise privacy,
independent compute, and minimal onchain settlement.

---

## Slide 11 - What We Built

Built so far:

- provider GPU/model offer publishing;
- client marketplace for live offers;
- wallet session UX;
- local escrow/payment state;
- multi-prompt GPU session ledger;
- signed execution receipts;
- FastAPI backend and provider-node;
- local Anvil + Solidity escrow contract;
- deterministic mock runtime and optional vLLM runtime path.

---

## Slide 12 - Roadmap

Next steps:

- real onchain session escrow with partial settlement and refund;
- provider reputation from receipt history;
- dispute and timeout paths;
- ENS-based provider and buyer identity;
- stablecoin or x402-style payment rail;
- stronger execution verification with TEEs, redundancy, or proofs;
- agent SDK for automated booking and prompt loops.
- enterprise policy controls for allowed providers, models, and data classes.

---

## Slide 13 - Closing

Infer134 turns AI inference into a programmable service that agents and
companies can book, use, and settle safely.

**Core idea:** independent GPU providers should be able to sell work without
forcing buyers to support GPU monopolies, expose private prompts, or rely on
opaque platform billing.
