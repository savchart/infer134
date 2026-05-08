# Repository Working Rules

## Scope

- Keep changes scoped to the current user goal.
- Prefer read-only investigation before editing.
- This is a hackathon prototype; prioritize one working happy path over broad architecture.
- Optimize for ETHPrague demo clarity: AI agents, agentic payments, execution receipts, privacy by design, local compute workers, and understandable UX.

## Safety

- Do not commit or push unless explicitly asked.
- Do not use public networks unless explicitly asked.
- Do not add secrets.
- Do not call paid external AI APIs.
- Do not create `.idea/`.
- Do not rename the repository directory unless explicitly asked.

## Local Development

- Keep everything local-first.
- Use local Anvil for contract demos.
- Use native ETH on Anvil for escrow until stablecoin settlement is added later.
- Use mocked inference unless a local worker such as Ollama or vLLM is explicitly wired in.
- Python commands should use `python -m ...`.
- Prefer simple Python packages that are easy to open and debug in PyCharm.

## Verification

- List verification commands before implementation changes.
- Run the narrowest useful checks first.
- If a tool is missing, record it in `SETUP_NOTES.md` and continue where possible.
