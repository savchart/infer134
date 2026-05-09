# Local Demo Setup

> All shell commands below assume your current directory is `infer134/`.
> If you are at the repo root (`eth_prague_26/`), `cd infer134` once at the start
> and stay there. The instructions never re-enter `infer134/`.

## Fast Local Stack

Start local Anvil, deploy `InferenceEscrow`, and run the backend on port `8000`:

```bash
bash scripts/start_dev_stack.sh
```

The script:

- reuses Anvil if `http://127.0.0.1:8545` is already reachable;
- otherwise starts Anvil in the background and writes logs to `/tmp/infer134-anvil.log`;
- deploys the local escrow contract;
- starts the FastAPI backend with chain and provider-node environment wired in.

Stop it with `Ctrl+C`. If the script started Anvil, it stops that Anvil process too.

## Frontend

Run the Next.js UI in another terminal:

```bash
( cd frontend && npm run dev )
```

Open:

```text
http://localhost:3000/client
```

## Provider Node — Mock Mode

For the default deterministic mock worker, run in another terminal:

```bash
( cd provider-node && python -m uvicorn app.main:app --reload --port 8010 )
```

This needs only the base provider-node dependencies. Install once:

```bash
( cd provider-node && python -m pip install -e . )
```

## Provider Node — vLLM Mode

vLLM is **not** in the provider-node base dependencies (it is a heavy GPU
package). Use the virtualenv from the project root:
`/home/savchart/PycharmProjects/eth_prague_26/.venv`.

From `infer134/`, activate it and install the provider-node vLLM extras:

```bash
source ../.venv/bin/activate
( cd provider-node && python -m pip install -e '.[vllm]' )
```

Verify it imports:

```bash
source ../.venv/bin/activate
python -c "import vllm; print(vllm.__version__)"
```

If vLLM exits with `NVIDIA driver on your system is too old`, update the GPU
driver or pin compatible PyTorch / vLLM wheels for your CUDA driver.

Then start the model server (terminal A):

```bash
source ../.venv/bin/activate
bash scripts/start_vllm_worker.sh
```

And the provider-node in vLLM runtime (terminal B):

```bash
source ../.venv/bin/activate
cd provider-node
INFER134_RUNTIME=vllm \
INFER134_MODEL_ID=Qwen/Qwen2.5-0.5B-Instruct \
INFER134_MODEL_REVISION=main \
INFER134_VLLM_BASE_URL=http://127.0.0.1:8001/v1 \
INFER134_VLLM_API_KEY=infer134-local \
HF_HOME=.hf-cache \
  python -m uvicorn app.main:app --reload --port 8010
cd ..
```

Allowlisted models: `Qwen/Qwen2.5-0.5B-Instruct`, `Qwen/Qwen3-0.6B`,
`HuggingFaceTB/SmolLM2-360M-Instruct`. Buyers cannot request arbitrary models.

## Manual Backend Only

If you do not need local chain settlement, run backend manually:

```bash
( cd backend && PROVIDER_NODE_URL=http://127.0.0.1:8010 python -m uvicorn app.main:app --reload --port 8000 )
```

## Checks

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/chain/status
curl http://127.0.0.1:8010/health
```

Run the API demo after backend and provider-node are up:

```bash
./scripts/demo_flow.sh
```
