# Demo Instructions — запуск стенда

Все команды выполняются из корня `infer134/`. Порядок запуска терминалов важен только в одном месте: Anvil должен подняться раньше, чем `deploy_local.sh` (Терминал 1, шаги 1.1 → 1.2). Остальные сервисы можно стартовать параллельно.

Перед первым запуском один раз поставьте зависимости:

```bash
cd infer134/backend       && python -m pip install -e .
cd ..
cd infer134/provider-node && python -m pip install -e .
cd ..
cd infer134/frontend      && npm install
cd ..
```

---

## Shortcut — Anvil + деплой + backend одной командой

`scripts/start_dev_stack.sh` объединяет Терминал 1 (1.1 + 1.2) и Терминал 2:

```bash
cd infer134
bash scripts/start_dev_stack.sh
```

Скрипт:
1. Стартует Anvil в фоне (если он ещё не поднят) — лог в `/tmp/infer134-anvil.log`.
2. Деплоит `InferenceEscrow`.
3. Запускает backend на `:8000` с уже подставленными `RPC_URL`, `CHAIN_ID`, `INFERENCE_ESCROW_ADDRESS`, `WORKER_PRIVATE_KEY`, `WORKER_ADDRESS`, `PROVIDER_NODE_URL`.

`Ctrl+C` останавливает backend; если Anvil был запущен этим же скриптом, он тоже завершится. Anvil, поднятый в другом терминале, не трогается.

Нужны `anvil`, `cast`, `forge`, `python`, `curl` на `PATH`. Если порт `:8000` занят — скрипт сразу падает с подсказкой; останавливайте старый бэкенд через `Ctrl+C` перед перезапуском.

Терминалы 3 (frontend), 4 (provider-node), 5 (vLLM) запускаются отдельно — см. ниже.

---

## Терминал 1 — Local Blockchain (Anvil + InferenceEscrow)

Запускает локальный EVM-узел и деплоит контракт эскроу.

**1.1. Запустить Anvil (этот процесс должен оставаться живым):**

```bash
cd infer134
bash scripts/start_anvil.sh
```

Должно появиться: `Listening on 127.0.0.1:8545`, chain id `31337`.

**1.2. В отдельной вкладке/окне (или новом Терминале 1b) задеплоить контракт:**

```bash
cd infer134
bash scripts/deploy_local.sh
```

Скрипт пишет адрес в `contracts/deployments/localhost.json` и печатает строку вида:

```text
RPC_URL=http://127.0.0.1:8545 CHAIN_ID=31337 INFERENCE_ESCROW_ADDRESS=0x...
```

Скопируйте `INFERENCE_ESCROW_ADDRESS` — он понадобится в Терминале 2.

> Ничего не коммитить и не использовать реальные ключи. Anvil dev-ключи — только для локалки.

---

## Терминал 2 — Backend (FastAPI coordinator, порт 8000)

Зависит от Терминала 4 (`PROVIDER_NODE_URL`) и опционально Терминала 1 (для ончейн-эскроу).

**Минимальный запуск (без ончейна, с моком vLLM):**

```bash
cd infer134/backend
PROVIDER_NODE_URL=http://127.0.0.1:8010 \
  python -m uvicorn app.main:app --reload --port 8000
```

**Полный запуск с локальным Anvil-эскроу** (значения `INFERENCE_ESCROW_ADDRESS` берутся из шага 1.2; `BUYER_PRIVATE_KEY` / `WORKER_PRIVATE_KEY` — это dev-ключи Anvil из её стартового вывода, **только локально**):

```bash
cd infer134/backend
PROVIDER_NODE_URL=http://127.0.0.1:8010 \
RPC_URL=http://127.0.0.1:8545 \
CHAIN_ID=31337 \
INFERENCE_ESCROW_ADDRESS=0x...                                      # из шага 1.2
BUYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
WORKER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
WORKER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  python -m uvicorn app.main:app --reload --port 8000
```

Проверка:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/chain/status
```

> `WORKER_ADDRESS` обязан соответствовать `WORKER_PRIVATE_KEY`, иначе контракт отклонит submit от воркера.

---

## Терминал 3 — Frontend (Next.js, порт 3000)

```bash
cd infer134/frontend
npm run dev
```

Откройте `http://localhost:3000/demo` — основной buyer-wizard.

Если бэкенд недоступен, фронт автоматически уходит в **fixture mode** (детерминированные хэши, мок-вывод) и подписывает это в UI. Полезные переменные окружения:

- `NEXT_PUBLIC_API_BASE_URL` — адрес бэкенда (по умолчанию проксируется через Next.js, оставьте пустым для локалки).
- `NEXT_PUBLIC_PROVIDER_NODE_URL` — необязательно, для прямой проверки статуса воркера.

---

## Терминал 4 — Provider Node (worker, порт 8010)

**Mock-режим** (по умолчанию, без GPU и vLLM — годится для всего демо, кроме «настоящего» инференса):

```bash
cd infer134/provider-node
python -m uvicorn app.main:app --reload --port 8010
```

**vLLM-режим** (нужен запущенный Терминал 5):

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

Проверка:

```bash
curl http://127.0.0.1:8010/health
```

---

## Терминал 5 — vLLM OpenAI-совместимый сервер (порт 8001)

Нужен только если Терминал 4 стартует в `INFER134_RUNTIME=vllm`. Требует установленного `vllm` и совместимой CUDA.

```bash
cd infer134
bash scripts/start_vllm_worker.sh
```

По умолчанию: модель `Qwen/Qwen2.5-0.5B-Instruct`, host `127.0.0.1:8001`, API-ключ `infer134-local`, `HF_HOME=.hf-cache`. Переопределить можно через переменные окружения (см. начало `scripts/start_vllm_worker.sh`).

Разрешённые модели для демо: `Qwen/Qwen2.5-0.5B-Instruct`, `Qwen/Qwen3-0.6B`, `HuggingFaceTB/SmolLM2-360M-Instruct`. Произвольные `model_id` от пользователя бэкенд не принимает.

> Если vLLM падает с «NVIDIA driver too old» — обновить драйвер или поставить совместимые с локальной CUDA сборки PyTorch/vLLM.

---

## Быстрая проверка end-to-end (после старта Терминалов 1, 2, 4)

```bash
cd infer134
./scripts/demo_flow.sh
```

Скрипт прогоняет полный цикл через curl: health → register worker → create job → claim → run → submit → pay → receipt.

Альтернатива — UI-флоу: откройте `http://localhost:3000/demo` (Терминал 3) и пройдите шаги мастера.

---

## Минимальные конфигурации демо

| Сценарий | Терминалы |
|----------|-----------|
| Самое простое (fixture mode на UI) | 3 |
| API-демо без ончейна, mock-инференс | 2, 4 (+ 3 для UI) |
| API-демо c ончейн-эскроу, mock-инференс | `start_dev_stack.sh`, 4 (+ 3) |
| Полный демо c реальным локальным инференсом | `start_dev_stack.sh`, 3, 4, 5 |

## Остановка

`Ctrl+C` в каждом терминале. Anvil и `STORE` бэкенда — in-memory: после рестарта состояние пустое. Это by design.
