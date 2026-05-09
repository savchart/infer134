"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  getOffers,
  getProviderHealth,
  getProviderModels,
  type AuthRole,
  type AuthSession,
  type ProviderModel,
  type WorkerOffer
} from "../lib/api";
import { connectWalletSessionForAddress, disconnectWalletSession, requestWalletAddress } from "../lib/walletAuth";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const fallback8gbModels: ProviderModel[] = [
  {
    model_id: "Qwen/Qwen2.5-0.5B-Instruct",
    source: "huggingface",
    status: "allowed",
    runtime_ready: false,
    runtime: "vllm",
    notes: "Small public HF instruct model suitable for an 8GB local GPU demo."
  },
  {
    model_id: "Qwen/Qwen3-0.6B",
    source: "huggingface",
    status: "allowed",
    runtime_ready: false,
    runtime: "vllm",
    notes: "Compact Qwen model that fits the hackathon 8GB GPU path."
  },
  {
    model_id: "HuggingFaceTB/SmolLM2-360M-Instruct",
    source: "huggingface",
    status: "allowed",
    runtime_ready: false,
    runtime: "vllm",
    notes: "Lightweight HF instruct model for constrained local workers."
  }
];

function repeated<T>(items: T[]) {
  return [...items, ...items];
}

export default function HomePage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatus, setWalletStatus] = useState<"idle" | "connecting" | "connected" | "unavailable" | "error">("idle");
  const [walletError, setWalletError] = useState("");
  const [roleBusy, setRoleBusy] = useState<AuthRole | undefined>();
  const [session, setSession] = useState<AuthSession | undefined>();
  const [offers, setOffers] = useState<WorkerOffer[]>([]);
  const [gpuMode, setGpuMode] = useState("checking live GPU marketplace");
  const [models, setModels] = useState<ProviderModel[]>(fallback8gbModels);
  const [modelMode, setModelMode] = useState("8GB HF catalog preview");

  const gpuTickerItems = useMemo(() => {
    if (offers.length) {
      return repeated(offers);
    }
    return repeated([
      {
        offer_id: "empty-live-gpu-marketplace",
        worker_name: "No live GPU offers yet",
        gpu_name: "Start provider-node and publish capacity",
        gpu_memory_gb: 0,
        model_id: "waiting for provider",
        runtime: gpuMode,
        inference_fee: "not listed"
      } as WorkerOffer
    ]);
  }, [gpuMode, offers]);

  useEffect(() => {
    let mounted = true;

    async function loadGpuMarketplace() {
      try {
        await getProviderHealth();
      } catch {
        if (mounted) {
          setOffers([]);
          setGpuMode("provider-node offline");
        }
        return;
      }

      try {
        const nextOffers = await getOffers();
        if (mounted) {
          setOffers(nextOffers);
          setGpuMode(nextOffers.length ? "live GPU marketplace" : "provider-node online, no published GPU offers");
        }
      } catch {
        if (mounted) {
          setOffers([]);
          setGpuMode("provider-node online, backend catalog unavailable");
        }
      }
    }

    async function loadModels() {
      try {
        const providerModels = await getProviderModels();
        const hfModels = providerModels.filter((model) => model.source === "huggingface");
        if (mounted) {
          setModels(hfModels.length ? hfModels : fallback8gbModels);
          setModelMode(hfModels.length ? "live provider-node HF allowlist" : "8GB HF catalog preview");
        }
      } catch {
        if (mounted) {
          setModels(fallback8gbModels);
          setModelMode("8GB HF catalog preview, provider-node offline");
        }
      }
    }

    loadGpuMarketplace();
    loadModels();

    return () => {
      mounted = false;
    };
  }, []);

  async function connectWallet(): Promise<string | undefined> {
    setWalletStatus("connecting");
    setWalletError("");
    try {
      const address = await requestWalletAddress();
      setWalletAddress(address);
      setWalletStatus("connected");
      return address;
    } catch (error) {
      setWalletAddress("");
      setWalletStatus(error instanceof Error && error.message.includes("No browser wallet") ? "unavailable" : "error");
      setWalletError(error instanceof Error ? error.message : "Wallet connection failed.");
      return undefined;
    }
  }

  async function continueAs(role: AuthRole) {
    setRoleBusy(role);
    setWalletError("");
    try {
      const address = walletAddress || (await connectWallet());
      if (!address) {
        return;
      }
      const nextSession = await connectWalletSessionForAddress(
        address,
        role,
        role === "provider" ? "gpu-prague.eth" : "research-agent.eth"
      );
      setSession(nextSession);
      router.push(role === "provider" ? "/provider" : "/client");
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Role authorization failed.");
    } finally {
      setRoleBusy(undefined);
    }
  }

  async function disconnectWallet() {
    setWalletError("");
    await Promise.all([
      disconnectWalletSession("client", session?.role === "client" ? session.session_token : undefined),
      disconnectWalletSession("provider", session?.role === "provider" ? session.session_token : undefined)
    ]);
    setWalletAddress("");
    setSession(undefined);
    setWalletStatus("idle");
  }

  return (
    <main className="entry-shell">
      <nav className="landing-nav">
        <div>
          <span className="eyebrow">Infer134</span>
          <strong>GPU marketplace</strong>
        </div>
        <div className="landing-wallet">
          {walletAddress ? (
            <div className="wallet-mini signed-in">
              <span className="status-pill good">wallet connected</span>
              <code>{shortAddress(walletAddress)}</code>
              {session ? <span className="muted">{session.role} session ready</span> : <span className="muted">choose an action to sign role</span>}
            </div>
          ) : null}
          <button className="secondary-link action-button" type="button" onClick={connectWallet} disabled={walletStatus === "connecting"}>
            {walletStatus === "connecting" ? "Connecting..." : walletAddress ? "Reconnect wallet" : "Connect wallet"}
          </button>
          {walletAddress ? (
            <button className="secondary-link action-button" type="button" onClick={disconnectWallet}>
              Disconnect
            </button>
          ) : null}
        </div>
      </nav>

      <section className="entry-hero">
        <div>
          <span className="eyebrow">Private offchain inference</span>
          <h1>GPU marketplace for signed inference receipts.</h1>
          <p>
            Agents and companies choose worker-published GPU + LLM options, send prompts offchain,
            receive execution receipts, and settle payment state locally.
          </p>
          {walletError ? <p className="wallet-error">{walletError}</p> : null}
          <div className="hero-actions">
            <button className="primary-link action-button" type="button" onClick={() => continueAs("provider")} disabled={Boolean(roleBusy)}>
              {roleBusy === "provider" ? (walletAddress ? "Signing provider session..." : "Connecting wallet...") : "Add GPU"}
            </button>
            <button className="secondary-link action-button" type="button" onClick={() => continueAs("client")} disabled={Boolean(roleBusy)}>
              {roleBusy === "client" ? (walletAddress ? "Signing client session..." : "Connecting wallet...") : "Write prompt"}
            </button>
          </div>
        </div>
        <div className="entry-status">
          <span className="status-pill good">local MVP</span>
          <span className="status-pill">Anvil settlement</span>
          <span className="status-pill">offchain prompts</span>
        </div>
      </section>

      <section className="ticker-section">
        <div className="ticker-heading">
          <div>
            <span className="eyebrow">Available GPU capacity</span>
            <h2>Live GPU marketplace</h2>
          </div>
          <span className="status-pill">{gpuMode}</span>
        </div>
        <div className="ticker-window">
          <div className="ticker-track">
            {gpuTickerItems.map((offer, index) => (
              <article className="ticker-card gpu-card" key={`${offer.offer_id}-${index}`}>
                <span className={offers.length ? "status-pill good" : "status-pill warn"}>
                  {offers.length ? offer.worker_status : "waiting"}
                </span>
                <strong>{offer.gpu_name}</strong>
                <p>{offer.worker_name}</p>
                <code>{offer.model_id}</code>
                <span>{offer.gpu_memory_gb ? `${offer.gpu_memory_gb} GB VRAM` : "no capacity listed"}</span>
                <span>{offer.inference_fee}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ticker-section">
        <div className="ticker-heading">
          <div>
            <span className="eyebrow">8GB LLM catalog</span>
            <h2>HF models suitable for local workers</h2>
          </div>
          <span className="status-pill">{modelMode}</span>
        </div>
        <div className="model-list-grid">
          {models.map((model) => (
              <article className="ticker-card model-card" key={model.model_id}>
                <span className="status-pill good">available</span>
                <strong>{model.model_id}</strong>
                <p>{model.notes}</p>
                <span>{model.source}</span>
                <span>{model.runtime}</span>
              </article>
          ))}
        </div>
      </section>
    </main>
  );
}
