start_dev_stack.sh
==================

Run commands from the repository root:

```bash
cd infer134
```

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
cd infer134/frontend
npm run dev
```

Open:

```text
http://localhost:3000/client
```

## Provider Node

For the default deterministic mock worker, run in another terminal:

```bash
cd infer134/provider-node
python -m uvicorn app.main:app --reload --port 8010
```

For local vLLM mode, start the model server first:

```bash
cd infer134
bash scripts/start_vllm_worker.sh
```

Then start provider-node with vLLM runtime:

```bash
cd infer134/provider-node
INFER134_RUNTIME=vllm \
INFER134_MODEL_ID=Qwen/Qwen2.5-0.5B-Instruct \
INFER134_MODEL_REVISION=main \
INFER134_VLLM_BASE_URL=http://127.0.0.1:8001/v1 \
INFER134_VLLM_API_KEY=infer134-local \
HF_HOME=.hf-cache \
  python -m uvicorn app.main:app --reload --port 8010
```

## Manual Backend Only

If you do not need local chain settlement, run backend manually:

```bash
cd infer134/backend
PROVIDER_NODE_URL=http://127.0.0.1:8010 \
  python -m uvicorn app.main:app --reload --port 8000
```

## Checks

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/chain/status
curl http://127.0.0.1:8010/health
```

Run the API demo after backend and provider-node are up:

```bash
cd infer134
./scripts/demo_flow.sh
```
