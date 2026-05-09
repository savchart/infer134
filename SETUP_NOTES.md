# Setup Notes

## Local Tool Inventory

- Python: 3.12.3
- Node: v16.20.2
- npm: 8.19.4
- Forge: 0.2.0
- Anvil: 0.2.0
- Docker: 28.1.1

No required setup tool was missing during scaffold creation.

## Runtime Dependency Status

The active Python environment and the existing parent `.venv` did not have `pydantic` installed, so a direct backend runtime smoke check could not run before installing project dependencies. Install the backend and worker node packages with `python -m pip install -e .` in each service directory before running the FastAPI apps.

Provider-node mock mode is available for tests and demos without external services. The local `provider-node/.venv` does not currently have `vllm` installed, so `INFER134_RUNTIME=vllm` will fail until vLLM is installed in the worker environment.

`nvidia-smi` is available on this machine and reports an NVIDIA GeForce RTX 2070-class GPU with CUDA 12.6 driver support. This is enough to attempt a local vLLM demo after installing compatible vLLM/PyTorch packages.

Local Anvil chain write mode needs these environment values in the backend shell:

- `RPC_URL`
- `CHAIN_ID`
- `INFERENCE_ESCROW_ADDRESS`
- `BUYER_PRIVATE_KEY`
- `WORKER_PRIVATE_KEY`
- `WORKER_ADDRESS`

Only local Anvil dev keys should be used. The `WORKER_ADDRESS` must match `WORKER_PRIVATE_KEY`.

## Assumptions

- The project directory is named `infer134/`, matching the user-facing product name.
- Backend payment state falls back to mock mode when local Anvil contract writes are not configured.
- The local contract uses native ETH escrow on Anvil to demonstrate payment settlement metadata.
- Backend pricing uses local ETH-style strings for the current escrow demo; no token is implemented.
- ENS-style names are mocked in `backend/app/identity.py` and `frontend/lib/identity.ts`.
- The backend coordinator is trusted in this MVP.
- Prompt and output values are stored only in backend memory and are not sent to the contract.
- The demo signature is deterministic placeholder cryptography, not production signing.

## Python Dependencies

The backend and worker node use:

- `fastapi`
- `uvicorn`
- `pydantic`
- `pytest`
- `httpx`

These are intentionally minimal for PyCharm-friendly local debugging.

## Frontend Dependencies

The frontend uses a minimal Next.js TypeScript scaffold. Node is currently v16.20.2, so the project pins Next.js 13.x rather than newer versions that require Node 18+.

## Future Setup Work

- Add real x402 support.
- Add real stablecoin settlement.
- Replace demo signatures with `eth-account` or wallet-backed signing.
- Install and tune vLLM for the local GPU worker demo.
- Add persistent storage.
- Add real ENS resolution.
