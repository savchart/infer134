"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getProviderHealth,
  getProviderModels,
  getWorkerOffers,
  registerWorkerProfile,
  type AuthSession,
  type GpuCapability,
  type ProviderModel,
  type RegisterWorkerPayload,
  type WorkerModelCapability,
  type WorkerOffer
} from "../../lib/api";
import { WalletHeader } from "../../components/WalletHeader";

type SelectableGpu = GpuCapability & {
  recommendedFor: string;
};

type SelectableModel = {
  model_id: string;
  label: string;
  model_source: WorkerModelCapability["model_source"];
  model_revision: string;
  model_hash: string;
  runtime: string;
  notes: string;
};

const selectableGpus: SelectableGpu[] = [
  {
    gpu_id: "local-rtx-2070",
    display_name: "NVIDIA RTX 2070",
    memory_gb: 8,
    runtime: "vllm",
    status: "available",
    notes: "Local GPU worker for the hackathon demo.",
    recommendedFor: "small HF instruct models"
  },
  {
    gpu_id: "local-mac-cpu",
    display_name: "Mac CPU",
    memory_gb: 0,
    runtime: "vllm",
    status: "available",
    notes: "CPU-backed local model server for Macs without an NVIDIA GPU.",
    recommendedFor: "small HF models through vLLM CPU mode"
  },
  {
    gpu_id: "mock-cpu-fallback",
    display_name: "Mock CPU fallback",
    memory_gb: 0,
    runtime: "mock",
    status: "available",
    notes: "Deterministic fallback when local model runtime is unavailable.",
    recommendedFor: "fixture demos"
  }
];

const selectableModels: SelectableModel[] = [
  {
    model_id: "Qwen/Qwen2.5-0.5B-Instruct",
    label: "Qwen 2.5 0.5B Instruct",
    model_source: "public_registry",
    model_revision: "main",
    model_hash: "0x5b60a68f5a1b8d0e556f33e9065c9a553a7d03f9040eb96b46e4512fbf8d80a9",
    runtime: "vllm",
    notes: "Allowlisted public Hugging Face model for local vLLM demos."
  },
  {
    model_id: "HuggingFaceTB/SmolLM2-360M-Instruct",
    label: "SmolLM2 360M Instruct",
    model_source: "public_registry",
    model_revision: "main",
    model_hash: "0xf017c5d5f1a7890f45f6f0e2dc08d9190a760f48ac7514c059b78f962fef43aa",
    runtime: "vllm",
    notes: "Compact public Hugging Face model for constrained local GPUs."
  },
  {
    model_id: "mock-llama",
    label: "Mock model fallback",
    model_source: "worker_catalog",
    model_revision: "local-demo",
    model_hash: "0xb44d5a5277ad37918f87a44ed08e3a21592a33d31f9f828dfda649b466786390",
    runtime: "mock",
    notes: "Deterministic local fallback; no model weights are loaded."
  }
];

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function capabilityFromModel(
  model: SelectableModel,
  pricePerInput: string,
  pricePerOutput: string,
  coldStartFee: string
): WorkerModelCapability {
  return {
    model_id: model.model_id,
    model_source: model.model_source,
    model_revision: model.model_revision,
    model_hash: model.model_hash,
    runtime: model.runtime,
    readiness_state: "ready",
    cold_start_fee: coldStartFee,
    inference_fee: pricePerOutput,
    price_per_1m_input_tokens: pricePerInput,
    price_per_1m_output_tokens: pricePerOutput,
    currency: "local ETH"
  };
}

function fixtureOffers(
  workerName: string,
  workerAddress: string,
  endpoint: string,
  gpus: GpuCapability[],
  models: WorkerModelCapability[]
): WorkerOffer[] {
  return gpus.flatMap((gpu) =>
    models.map((model) => ({
      offer_id: `preview:${gpu.gpu_id}:${model.model_id.replace("/", "__")}`,
      worker_id: "worker-preview",
      worker_name: workerName,
      worker_address: workerAddress,
      worker_status: "available",
      gpu_id: gpu.gpu_id,
      gpu_name: gpu.display_name,
      gpu_memory_gb: gpu.memory_gb,
      gpu_status: gpu.status,
      model_id: model.model_id,
      model_source: model.model_source,
      model_revision: model.model_revision,
      model_hash: model.model_hash,
      runtime: model.runtime,
      readiness_state: model.readiness_state,
      cold_start_fee: model.cold_start_fee,
      inference_fee: model.inference_fee,
      price_per_1m_input_tokens: model.price_per_1m_input_tokens,
      price_per_1m_output_tokens: model.price_per_1m_output_tokens,
      currency: model.currency,
      endpoint
    }))
  );
}

export default function ProviderDashboard() {
  const [workerName, setWorkerName] = useState("gpu-prague.eth");
  const [workerAddress, setWorkerAddress] = useState("0x2000000000000000000000000000000000000002");
  const [endpoint, setEndpoint] = useState("http://127.0.0.1:8010");
  const [selectedGpuIds, setSelectedGpuIds] = useState<string[]>(["local-rtx-2070"]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(["Qwen/Qwen2.5-0.5B-Instruct"]);
  const [pricePerInput, setPricePerInput] = useState("0.25 local ETH");
  const [pricePerOutput, setPricePerOutput] = useState("0.75 local ETH");
  const [coldStartFee, setColdStartFee] = useState("0 local ETH");
  const [offers, setOffers] = useState<WorkerOffer[]>([]);
  const [notice, setNotice] = useState("Configure GPU + model bundles, then register worker offers.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providerSession, setProviderSession] = useState<AuthSession | undefined>();
  const [providerNodeOnline, setProviderNodeOnline] = useState<"checking" | "online" | "offline">("checking");
  const [providerRuntime, setProviderRuntime] = useState("checking");
  const [providerRuntimeModel, setProviderRuntimeModel] = useState("");
  const [providerModels, setProviderModels] = useState<ProviderModel[]>([]);

  function selectedRuntimeIsAvailable(runtime: string) {
    return selectableGpus.some((gpu) => selectedGpuIds.includes(gpu.gpu_id) && gpu.runtime === runtime);
  }

  function modelAvailability(model: SelectableModel): { enabled: boolean; reason: string } {
    if (providerNodeOnline !== "online") {
      return { enabled: false, reason: "Start provider-node before publishing models." };
    }
    if (providerRuntime === "mock") {
      return model.model_id === "mock-llama"
        ? { enabled: true, reason: "mock runtime is active" }
        : { enabled: false, reason: "Start provider-node with INFER134_RUNTIME=vllm to publish HF models." };
    }
    if (providerRuntime === "vllm") {
      if (!selectedRuntimeIsAvailable("vllm")) {
        return { enabled: false, reason: "Select RTX 2070 or Mac CPU capacity to publish vLLM models." };
      }
      if (model.model_id === "mock-llama") {
        return { enabled: false, reason: "Mock fallback is only publishable when provider-node runtime is mock." };
      }
      const providerModel = providerModels.find((item) => item.model_id === model.model_id);
      if (providerModel?.runtime_ready) {
        return { enabled: true, reason: "vLLM runtime reports this model ready" };
      }
      return { enabled: false, reason: "Model is allowlisted but not runtime_ready on provider-node." };
    }
    return { enabled: false, reason: "Provider-node runtime is still being checked." };
  }

  useEffect(() => {
    let mounted = true;

    getProviderHealth()
      .then((health) => {
        if (mounted) {
          setProviderNodeOnline("online");
          setProviderRuntime(health.runtime ?? "unknown");
          setProviderRuntimeModel(health.model ?? "");
          setNotice(`Provider-node online. Runtime: ${health.runtime ?? "unknown"}. Select compatible GPU capacity and models.`);
        }
        return getProviderModels();
      })
      .then((models) => {
        if (mounted) {
          setProviderModels(models);
        }
      })
      .catch(() => {
        if (mounted) {
          setProviderNodeOnline("offline");
          setProviderRuntime("offline");
          setProviderRuntimeModel("");
          setProviderModels([]);
          setSelectedGpuIds([]);
          setNotice("Provider-node offline. Start the local provider-node before GPU capacity can be added.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (providerNodeOnline !== "online") {
      setSelectedModelIds([]);
      return;
    }
    const enabledModelIds = selectableModels
      .filter((model) => modelAvailability(model).enabled)
      .map((model) => model.model_id);

    setSelectedModelIds((current) => {
      const stillEnabled = current.filter((modelId) => enabledModelIds.includes(modelId));
      return stillEnabled.length ? stillEnabled : enabledModelIds.slice(0, 1);
    });
  }, [providerModels, providerNodeOnline, providerRuntime, selectedGpuIds]);

  const selectedGpus = useMemo(
    () => (providerNodeOnline === "online" ? selectableGpus.filter((gpu) => selectedGpuIds.includes(gpu.gpu_id)) : []),
    [providerNodeOnline, selectedGpuIds]
  );
  const selectedModels = useMemo(
    () => selectableModels.filter((model) => selectedModelIds.includes(model.model_id) && modelAvailability(model).enabled),
    [providerModels, providerNodeOnline, providerRuntime, selectedModelIds]
  );
  const modelCapabilities = useMemo(
    () => selectedModels.map((model) => capabilityFromModel(model, pricePerInput, pricePerOutput, coldStartFee)),
    [coldStartFee, pricePerInput, pricePerOutput, selectedModels]
  );
  const previewOffers = useMemo(
    () => fixtureOffers(workerName, workerAddress, endpoint, selectedGpus, modelCapabilities),
    [endpoint, modelCapabilities, selectedGpus, workerAddress, workerName]
  );

  async function registerWorkerOffers() {
    if (providerNodeOnline !== "online") {
      setNotice("Provider-node offline. No GPU capacity can be published until the worker node is running.");
      return;
    }

    setIsSubmitting(true);
    const payload: RegisterWorkerPayload = {
      name: workerName,
      address: workerAddress,
      model: modelCapabilities[0]?.model_id ?? "mock-llama",
      hardware: selectedGpus.map((gpu) => gpu.display_name).join(", ") || "not selected",
      price: pricePerOutput,
      status: "available",
      endpoint,
      gpu_capabilities: selectedGpus,
      model_capabilities: modelCapabilities,
      auth_token: providerSession?.session_token
    };

    try {
      const worker = await registerWorkerProfile(payload);
      const backendOffers = await getWorkerOffers(worker.worker_id);
      setOffers(backendOffers);
      setNotice(`Backend connected. Published or updated ${backendOffers.length} selectable GPU + model offers.`);
    } catch (error) {
      setOffers(previewOffers);
      setNotice(
        `Fixture preview: backend unavailable or registration failed. ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="provider-shell">
      <WalletHeader
        role="provider"
        ensStyleName={workerName}
        onSessionChange={(session) => {
          setProviderSession(session);
          if (session?.address) {
            setWorkerAddress(session.address);
          }
          if (session?.ens_style_name) {
            setWorkerName(session.ens_style_name);
          }
        }}
      />

      <nav className="nav">
        <div>
          <div className="kicker">Worker setup</div>
          <h1>Publish GPU + model offers</h1>
        </div>
        <div className="nav-links">
          <Link href="/client">Buyer marketplace</Link>
          <Link href="/agent">Agent</Link>
        </div>
      </nav>

      <section className="provider-hero">
        <div>
          <span className="eyebrow">Infer134 provider flow</span>
          <h2>Choose hardware, choose models, set token pricing.</h2>
          <p>
            Providers publish explicit bundles so buyers can later select the exact worker, GPU,
            model, runtime, and price per 1M tokens before creating a job.
          </p>
        </div>
        <div className="notice">{notice}</div>
      </section>

      <section className="provider-grid">
        <div className="panel wallet-summary-panel">
          <div className="kicker">Provider wallet</div>
          {providerSession ? (
            <>
              <span className="status-pill good">wallet signed</span>
              <p className="muted">
                Offers will be linked to {providerSession.ens_style_name ?? workerName} at {providerSession.address}.
              </p>
            </>
          ) : (
            <>
              <span className="status-pill warn">not connected</span>
              <p className="muted">Connect the provider wallet from the top-right control before publishing wallet-linked offers.</p>
            </>
          )}
        </div>
        <div className="panel">
          <div className="kicker">Authorization Mode</div>
          <p className="muted">
            {providerSession
              ? "Provider offers will be linked to the wallet-authenticated worker address."
              : "Provider offers can still be previewed in fixture mode, but backend registration will not be wallet-linked."}
          </p>
          <p className="muted">
            Provider-node runtime: {providerRuntime}
            {providerRuntimeModel ? ` · loaded model: ${providerRuntimeModel}` : ""}
          </p>
          <p className="muted">
            Wallet signature is recorded for the local MVP. Production signer recovery and SIWE are future work.
          </p>
        </div>
      </section>

      <section className="provider-grid">
        <div className="panel provider-form">
          <div className="kicker">Identity</div>
          <label className="field">
            ENS-style worker name
            <input value={workerName} onChange={(event) => setWorkerName(event.target.value)} />
          </label>
          <label className="field">
            Worker address
            <input value={workerAddress} onChange={(event) => setWorkerAddress(event.target.value)} />
          </label>
          <label className="field">
            Provider-node endpoint
            <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
          </label>
        </div>

        <div className="panel provider-form">
          <div className="kicker">Pricing</div>
          <label className="field">
            Input price / 1M tokens
            <input value={pricePerInput} onChange={(event) => setPricePerInput(event.target.value)} />
          </label>
          <label className="field">
            Output price / 1M tokens
            <input value={pricePerOutput} onChange={(event) => setPricePerOutput(event.target.value)} />
          </label>
          <label className="field">
            Cold-start fee
            <input value={coldStartFee} onChange={(event) => setColdStartFee(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="provider-grid">
        <div className="panel">
          <div className="kicker">Available GPUs</div>
          <p className="muted">
            Provider-node status: {providerNodeOnline}. No node means no available GPU capacity.
          </p>
          {providerNodeOnline !== "online" ? (
            <div className="empty-offers">
              <strong>No GPU detected from provider-node</strong>
              <p>Start the worker node on port 8010, then refresh this page to add GPU capacity.</p>
            </div>
          ) : null}
          <div className="select-card-grid">
            {(providerNodeOnline === "online" ? selectableGpus : []).map((gpu) => (
              <label className={`select-card ${selectedGpuIds.includes(gpu.gpu_id) ? "selected" : ""}`} key={gpu.gpu_id}>
                <input
                  checked={selectedGpuIds.includes(gpu.gpu_id)}
                  onChange={() => setSelectedGpuIds((current) => toggleValue(current, gpu.gpu_id))}
                  type="checkbox"
                />
                <strong>{gpu.display_name}</strong>
                <span>{gpu.memory_gb ? `${gpu.memory_gb} GB VRAM` : "no GPU memory"}</span>
                <span>{gpu.runtime}</span>
                <p>{gpu.recommendedFor}</p>
              </label>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="kicker">Available Models</div>
          <p className="muted">
            Runtime gate: mock runtime can publish only mock-llama. vLLM runtime can publish only HF models marked runtime_ready by provider-node.
          </p>
          <p className="muted">
            Mac CPU can publish Qwen or Smol only when provider-node is running against a real local vLLM CPU server.
          </p>
          <div className="select-card-grid">
            {selectableModels.map((model) => {
              const availability = modelAvailability(model);
              return (
              <label
                className={`select-card ${selectedModelIds.includes(model.model_id) ? "selected" : ""} ${
                  availability.enabled ? "" : "disabled"
                }`}
                key={model.model_id}
              >
                <input
                  checked={selectedModelIds.includes(model.model_id)}
                  disabled={!availability.enabled}
                  onChange={() => setSelectedModelIds((current) => toggleValue(current, model.model_id))}
                  type="checkbox"
                />
                <strong>{model.label}</strong>
                <code>{model.model_id}</code>
                <span>{model.model_source} · {model.runtime}</span>
                <span className={availability.enabled ? "status-pill good" : "status-pill warn"}>
                  {availability.enabled ? "available" : "disabled"}
                </span>
                <p>{model.notes}</p>
                <p>{availability.reason}</p>
              </label>
            );
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="offer-header">
          <div>
            <div className="kicker">Offer Preview</div>
            <h2>Selectable bundles for buyers</h2>
          </div>
          <button
            className="button"
            disabled={providerNodeOnline !== "online" || !selectedGpus.length || !selectedModels.length || isSubmitting}
            onClick={registerWorkerOffers}
            type="button"
          >
            {isSubmitting ? "Publishing..." : "Publish or update worker offers"}
          </button>
        </div>

        <div className="offer-grid">
          {(offers.length ? offers : previewOffers).map((offer) => (
            <article className="offer-card" key={offer.offer_id}>
              <span className="badge">{offer.worker_status}</span>
              <h3>{offer.worker_name}</h3>
              <p className="muted">{offer.gpu_name} · {offer.gpu_memory_gb} GB · {offer.runtime}</p>
              <code>{offer.model_id}</code>
              <dl>
                <dt>Input</dt>
                <dd>{offer.price_per_1m_input_tokens} / 1M tokens</dd>
                <dt>Output</dt>
                <dd>{offer.price_per_1m_output_tokens} / 1M tokens</dd>
                <dt>Cold start</dt>
                <dd>{offer.cold_start_fee}</dd>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
