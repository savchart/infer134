"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ReceiptCard } from "../../components/ReceiptCard";
import { VerificationPanel } from "../../components/VerificationPanel";
import { WalletHeader } from "../../components/WalletHeader";
import {
  claimJob,
  createJob,
  getChainStatus,
  getHealth,
  getOffers,
  getProviderHealth,
  payJob,
  runJob,
  submitJob,
  type AuthSession,
  type BackendJob,
  type ChainStatus,
  type ReceiptPayload,
  type WorkerOffer
} from "../../lib/api";
import { sha256Hex, type ConnectionState, type ExecutionReceipt } from "../../lib/demoData";

type RunState = "idle" | "creating" | "running" | "receipt_ready" | "paid" | "error";

type MarketplaceStatus = {
  backend: ConnectionState;
  providerNode: ConnectionState;
  chain: ConnectionState;
  chainStatus?: ChainStatus;
};

const defaultPrompt = "Explain signed execution receipts in one sentence.";

function normalizeReceipt(receipt: ReceiptPayload): ExecutionReceipt {
  return {
    job_id: receipt.job_id,
    buyer: receipt.buyer,
    buyer_name: receipt.buyer_name,
    worker: receipt.worker,
    worker_name: receipt.worker_name,
    model_id: receipt.model_id,
    runtime: receipt.runtime,
    input_hash: receipt.input_hash,
    output_hash: receipt.output_hash,
    receipt_hash: receipt.receipt_hash,
    price: receipt.price,
    payment_state: receipt.payment_state,
    timestamp: receipt.timestamp,
    signature: receipt.signature
  };
}

function StatusBadge({ label, state }: { label: string; state: ConnectionState }) {
  return (
    <span className={state === "connected" ? "status-pill good" : state === "checking" ? "status-pill" : "status-pill warn"}>
      {label}: {state}
    </span>
  );
}

function shortHash(value?: string | null) {
  if (!value) {
    return "pending";
  }
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

export default function ClientMarketplacePage() {
  const [session, setSession] = useState<AuthSession | undefined>();
  const [status, setStatus] = useState<MarketplaceStatus>({
    backend: "checking",
    providerNode: "checking",
    chain: "checking"
  });
  const [offers, setOffers] = useState<WorkerOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [inputHash, setInputHash] = useState("");
  const [job, setJob] = useState<BackendJob | undefined>();
  const [receipt, setReceipt] = useState<ExecutionReceipt | undefined>();
  const [receiptVerified, setReceiptVerified] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [notice, setNotice] = useState("");

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.offer_id === selectedOfferId),
    [offers, selectedOfferId]
  );

  useEffect(() => {
    let mounted = true;

    async function loadMarketplace() {
      setNotice("");

      getHealth()
        .then(() => {
          if (mounted) {
            setStatus((current) => ({ ...current, backend: "connected" }));
          }
        })
        .catch(() => {
          if (mounted) {
            setStatus((current) => ({ ...current, backend: "unavailable" }));
          }
        });

      getChainStatus()
        .then((chainStatus) => {
          if (mounted) {
            setStatus((current) => ({
              ...current,
              chain: chainStatus.chain_enabled && !chainStatus.error ? "connected" : "unavailable",
              chainStatus
            }));
          }
        })
        .catch(() => {
          if (mounted) {
            setStatus((current) => ({ ...current, chain: "unavailable" }));
          }
        });

      try {
        await getProviderHealth();
      } catch {
        if (mounted) {
          setOffers([]);
          setSelectedOfferId("");
          setStatus((current) => ({ ...current, providerNode: "unavailable" }));
          setNotice("No provider-node is online, so there are no available GPU options.");
        }
        return;
      }

      if (!mounted) {
        return;
      }

      setStatus((current) => ({ ...current, providerNode: "connected" }));

      try {
        const nextOffers = await getOffers();
        if (!mounted) {
          return;
        }
        setOffers(nextOffers);
        setSelectedOfferId((current) => current || nextOffers[0]?.offer_id || "");
        setNotice(nextOffers.length ? "" : "Provider-node is online, but no GPU + model offers have been published yet.");
      } catch (error) {
        if (mounted) {
          setOffers([]);
          setSelectedOfferId("");
          setNotice(`Backend catalog unavailable. ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
    }

    loadMarketplace();

    return () => {
      mounted = false;
    };
  }, []);

  async function refreshInputHash() {
    const nextHash = await sha256Hex(prompt);
    setInputHash(nextHash);
    return nextHash;
  }

  async function runInference() {
    if (!selectedOffer) {
      setNotice("Choose an available GPU + model option before running inference.");
      return;
    }

    setRunState("creating");
    setNotice("");
    setReceipt(undefined);
    setReceiptVerified(false);

    try {
      const nextInputHash = await refreshInputHash();
      const created = await createJob(prompt, selectedOffer.model_id, session?.session_token, selectedOffer.inference_fee);
      const claimed = await claimJob(created.job.job_id, selectedOffer.worker_id);
      setJob({
        ...claimed,
        input_hash: claimed.input_hash || nextInputHash,
        price: selectedOffer.inference_fee
      });

      setRunState("running");
      const runResult = await runJob(created.job.job_id, selectedOffer.worker_id);
      const submitted = await submitJob(created.job.job_id);
      const nextReceipt = normalizeReceipt(submitted.receipt);
      setJob({
        ...submitted.job,
        result: submitted.job.result ?? runResult.job.result,
        price: submitted.job.price || selectedOffer.inference_fee
      });
      setReceipt(nextReceipt);
      setReceiptVerified(Boolean(submitted.receipt_verified));
      setRunState("receipt_ready");
      setNotice("Worker returned an offchain result and signed execution receipt. Payment is ready to release.");
    } catch (error) {
      setRunState("error");
      setNotice(error instanceof Error ? error.message : "Inference request failed.");
    }
  }

  async function releasePayment() {
    if (!job) {
      return;
    }

    setRunState("running");
    setNotice("");
    try {
      const paid = await payJob(job.job_id);
      setJob(paid.job);
      if (receipt) {
        setReceipt({
          ...receipt,
          payment_state: "paid"
        });
      }
      setRunState("paid");
      setNotice("Payment released. Prompt and output stayed offchain; hashes and payment state are settlement metadata.");
    } catch (error) {
      setRunState("error");
      setNotice(error instanceof Error ? error.message : "Payment release failed.");
    }
  }

  return (
    <main className="client-shell">
      <WalletHeader role="client" ensStyleName="research-agent.eth" onSessionChange={setSession} />

      <header className="client-header">
        <div>
          <span className="eyebrow">Buyer marketplace</span>
          <h1>Choose compute, write a prompt, receive a signed execution receipt.</h1>
          <p>
            Available options come from live provider-node capacity published by workers.
            No provider-node means no GPU options are shown.
          </p>
        </div>
        <div className="header-actions">
          <Link className="nav-pill" href="/">
            Home
          </Link>
          <Link className="nav-pill" href="/provider">
            Add GPU
          </Link>
        </div>
      </header>

      <section className="client-status-row">
        <StatusBadge label="Backend" state={status.backend} />
        <StatusBadge label="Provider-node" state={status.providerNode} />
        <StatusBadge label="Local Anvil" state={status.chain} />
      </section>

      {notice ? <div className={runState === "error" ? "notice error" : "notice"}>{notice}</div> : null}

      <div className="client-layout">
        <section className="client-main">
          <div className="panel">
            <div className="offer-header">
              <div>
                <span className="eyebrow">Available options</span>
                <h2>GPU + model + price</h2>
              </div>
              <span className="status-pill">{offers.length} options</span>
            </div>

            {status.providerNode === "unavailable" ? (
              <div className="empty-offers">
                <strong>No provider-node online</strong>
                <p>Start provider-node on port 8010, then refresh this page. GPU options are not faked here.</p>
              </div>
            ) : offers.length ? (
              <div className="buyer-offer-grid">
                {offers.map((offer) => (
                  <button
                    className={`buyer-offer-card ${selectedOfferId === offer.offer_id ? "selected" : ""}`}
                    key={offer.offer_id}
                    type="button"
                    onClick={() => setSelectedOfferId(offer.offer_id)}
                  >
                    <span className={offer.worker_status === "available" ? "status-pill good" : "status-pill warn"}>
                      {offer.worker_status}
                    </span>
                    <strong>{offer.worker_name}</strong>
                    <p>{offer.gpu_name} · {offer.gpu_memory_gb} GB · {offer.runtime}</p>
                    <code>{offer.model_id}</code>
                    <dl>
                      <dt>Price</dt>
                      <dd>{offer.price_per_1m_input_tokens} / 1M tokens</dd>
                      <dt>Request fee</dt>
                      <dd>{offer.inference_fee}</dd>
                    </dl>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-offers">
                <strong>No options published</strong>
                <p>Provider-node is online, but a provider has not published GPU + model pricing yet.</p>
              </div>
            )}
          </div>

          <div className="panel client-prompt-panel">
            <div>
              <span className="eyebrow">Inference request</span>
              <h2>Write prompt</h2>
              <p className="muted">Prompt stays offchain. Only input_hash is used as settlement metadata.</p>
            </div>
            <textarea rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            <div className="entry-action-bar">
              <button className="secondary-link action-button" type="button" onClick={refreshInputHash}>
                Compute input_hash
              </button>
              <button
                className="primary-link action-button"
                type="button"
                onClick={runInference}
                disabled={!selectedOffer || !prompt.trim() || runState === "creating" || runState === "running"}
              >
                {runState === "creating" || runState === "running" ? "Running..." : "Run inference"}
              </button>
            </div>
            {inputHash ? <code className="hash-block">{inputHash}</code> : null}
          </div>

          {job?.result ? (
            <div className="result-panel">
              <span className="eyebrow">Offchain result</span>
              <p>{job.result}</p>
              <code>{job.output_hash}</code>
            </div>
          ) : null}

          <ReceiptCard receipt={receipt} />
          <VerificationPanel
            receiptReady={Boolean(receipt)}
            paymentState={job?.payment_state ?? "unpaid"}
            signatureEnabled={Boolean(receipt?.signature)}
          />
        </section>

        <aside className="client-side-card">
          <div className="wallet-summary-panel">
            <div className="kicker">Client wallet</div>
            {session ? (
              <>
                <span className="status-pill good">wallet signed</span>
                <p className="muted">
                  Buyer requests will use {session.ens_style_name ?? "research-agent.eth"} at {session.address}.
                </p>
              </>
            ) : (
              <>
                <span className="status-pill warn">not connected</span>
                <p className="muted">Connect the client wallet from the top-right control for wallet-linked jobs.</p>
              </>
            )}
          </div>

          <div className="live-state-card">
            <span className="eyebrow">Current selection</span>
            <dl className="state-list">
              <dt>Worker</dt>
              <dd>{selectedOffer?.worker_name ?? "not selected"}</dd>
              <dt>GPU</dt>
              <dd>{selectedOffer ? `${selectedOffer.gpu_name} (${selectedOffer.gpu_memory_gb} GB)` : "not selected"}</dd>
              <dt>Model</dt>
              <dd>{selectedOffer?.model_id ?? "not selected"}</dd>
              <dt>Price</dt>
              <dd>{selectedOffer?.inference_fee ?? "not selected"}</dd>
              <dt>Payment state</dt>
              <dd>
                <span className={`payment-state ${job?.payment_state ?? "unpaid"}`}>
                  {job?.payment_state ?? "unpaid"}
                </span>
              </dd>
              <dt>Input hash</dt>
              <dd>
                <code>{shortHash(job?.input_hash ?? inputHash)}</code>
              </dd>
              <dt>Output hash</dt>
              <dd>
                <code>{shortHash(job?.output_hash)}</code>
              </dd>
              <dt>Receipt hash</dt>
              <dd>
                <code>{shortHash(job?.receipt_hash ?? receipt?.receipt_hash)}</code>
              </dd>
            </dl>
            <button
              className="primary-button"
              type="button"
              onClick={releasePayment}
              disabled={!job || !receipt || job.payment_state === "paid" || runState === "running"}
            >
              {job?.payment_state === "paid" ? "Payment paid" : "Release payment"}
            </button>
          </div>

          <div className="notice">
            <strong>What stays offchain</strong>
            <p>Prompt and output stay in the app/backend flow. The UI shows hashes, receipt, worker identity, and payment state.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
