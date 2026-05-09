# Repository Working Rules

## Scope

- Keep changes scoped to the current user goal.
- Prefer read-only investigation before editing.
- Before making non-trivial edits, identify the target files and the intended verification commands.
- This is a hackathon prototype; prioritize one reliable happy path over broad architecture.
- Optimize for ETHPrague demo clarity:
  - AI agents
  - agentic payments
  - signed execution receipts
  - privacy by design
  - local compute workers
  - understandable buyer UX

## Product Direction

- The MVP should be a guided buyer journey:
  request -> model selection -> worker selection -> escrow -> inference -> receipt -> verification -> payment release -> result.
- Do not turn the project into a generic landing page, dashboard, cloud platform, or full decentralized compute protocol.
- Do not claim the system is trustless, fully decentralized, or proof-of-compute unless those properties are actually implemented.
- Clearly separate:
  - verified facts
  - trusted assumptions
  - mocked/demo-only behavior

## Safety

- Do not commit or push unless explicitly asked.
- Do not create or configure a remote Git origin unless explicitly asked.
- Do not use public networks unless explicitly asked.
- Do not call paid external AI APIs.
- Do not add secrets, API keys, private keys, tokens, or credentials to tracked files.
- Do not create `.idea/`.
- Do not rename the repository directory unless explicitly asked.
- Do not introduce large dependencies unless they are necessary for the current goal.

## Local Development

- Keep everything local-first.
- Use local Anvil for contract demos.
- Use native ETH on Anvil for escrow until stablecoin settlement is added later.
- Use mocked inference by default unless a local worker such as Ollama or vLLM is explicitly wired in.
- If real local inference is enabled, prefer worker-owned Hugging Face allowlisted models.
- Do not support arbitrary user-supplied model IDs unless explicitly requested.
- Python commands should use `python -m ...`.
- Prefer simple Python packages that are easy to open and debug in PyCharm.
- Keep normal tests independent of Anvil, vLLM, GPU availability, and external networks.

## Data and Privacy

- Prompts and outputs must stay offchain.
- Onchain or hashable settlement metadata may include:
  - input hash
  - output hash
  - receipt hash
  - worker identity
  - buyer identity
  - payment amount
  - payment state
- Do not store model weights, private prompts, private outputs, or secrets onchain.
- Treat model execution claims as signed worker claims, not cryptographic proof.

## Verification

- List verification commands before implementation changes.
- Run the narrowest useful checks first.
- Prefer deterministic local tests.
- If a tool is missing, record it in `SETUP_NOTES.md` and continue where possible.
- Useful checks include:
  - `python -m compileall backend provider-node`
  - `cd backend && python -m pytest -q`
  - `cd provider-node && python -m pytest -q`
  - `cd contracts && forge test`
  - `cd frontend && npm run typecheck`
  - `cd frontend && npm run lint`
  - `git status --short`