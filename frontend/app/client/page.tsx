"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WalletHeader } from "../../components/WalletHeader";
import {
  getChainStatus,
  getHealth,
  getOffers,
  getProviderHealth,
  runPaidJob,
  type AuthSession,
  type BackendJob,
  type ChainStatus,
  type WorkerOffer
} from "../../lib/api";
import { sha256Hex, type ConnectionState } from "../../lib/demoData";
import {
  createEscrowJob,
  parseInferenceFeeToWei,
  releaseEscrowPayment
} from "../../lib/escrow";
import {
  addressesEqual,
  isLocalAnvilChain,
  readCurrentWalletState,
  requestWalletAddress,
  watchWalletState,
  type WalletState
} from "../../lib/walletAuth";

type RunState = "idle" | "paying" | "running" | "ready" | "released" | "error";

type MarketplaceStatus = {
  backend: ConnectionState;
  providerNode: ConnectionState;
  chain: ConnectionState;
  chainStatus?: ChainStatus;
};

const defaultPrompt = "Explain signed execution receipts in one sentence.";

const PHASE_LABELS: Record<RunState, string> = {
  idle: "Pick a GPU + model option and write a prompt",
  paying: "Awaiting wallet confirmation for escrow tx…",
  running: "Backend verifying escrow and running inference…",
  ready: "Result ready — release payment to settle onchain",
  released: "Paid",
  error: "Error"
};

function StatusBadge({ label, state }: { label: string; state: ConnectionState }) {
  return (
    <span className={state === "connected" ? "status-pill good" : state === "checking" ? "status-pill" : "status-pill warn"}>
      {label}: {state}
    </span>
  );
}

function shortHash(value?: string | null) {
  if (!value) {
    return undefined;
  }
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
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
  const [job, setJob] = useState<BackendJob | undefined>();
  const [txHash, setTxHash] = useState<string | undefined>();
  const [onchainJobId, setOnchainJobId] = useState<string | undefined>();
  const [releaseTxHash, setReleaseTxHash] = useState<string | undefined>();
  const [runState, setRunState] = useState<RunState>("idle");
  const [notice, setNotice] = useState("");
  const [walletState, setWalletState] = useState<WalletState>({});

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.offer_id === selectedOfferId),
    [offers, selectedOfferId]
  );

  const contractAddress = status.chainStatus?.contract_address ?? undefined;
  const chainEnabled = status.chain === "connected" && Boolean(contractAddress);
  const paymentState = job?.payment_state ?? (runState === "released" ? "paid" : "unpaid");

  const walletConnected = Boolean(walletState.address);
  const walletOnAnvil = isLocalAnvilChain(walletState.chainIdHex);
  const walletMatchesSession = !session || addressesEqual(session.address, walletState.address);

  const blockers: string[] = [];
  if (status.backend !== "connected") {
    blockers.push("Backend is offline (start uvicorn on :8000).");
  }
  if (!chainEnabled) {
    blockers.push("Local Anvil + InferenceEscrow are not configured on the backend.");
  }
  if (!selectedOffer) {
    blockers.push("Pick a GPU + model option above.");
  }
  if (!prompt.trim()) {
    blockers.push("Write a prompt.");
  }
  if (!walletConnected) {
    blockers.push("Connect a browser wallet.");
  } else if (!walletOnAnvil) {
    blockers.push("Switch the wallet to Local Anvil (chain id 31337). MetaMask will be asked automatically when you click Pay & run.");
  }
  if (walletConnected && !walletMatchesSession) {
    blockers.push("Wallet account differs from the signed-in session. Click Disconnect in the top-right and reconnect with the active account.");
  }

  useEffect(() => {
    let mounted = true;

    async function loadMarketplace() {
      setNotice("");

      getHealth()
        .then(() => mounted && setStatus((current) => ({ ...current, backend: "connected" })))
        .catch(() => mounted && setStatus((current) => ({ ...current, backend: "unavailable" })));

      getChainStatus()
        .then((chainStatus) => {
          if (!mounted) {
            return;
          }
          setStatus((current) => ({
            ...current,
            chain: chainStatus.chain_enabled && !chainStatus.error ? "connected" : "unavailable",
            chainStatus
          }));
        })
        .catch(() => mounted && setStatus((current) => ({ ...current, chain: "unavailable" })));

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

    readCurrentWalletState().then((initial) => {
      if (mounted) {
        setWalletState(initial);
      }
    });
    const unsubscribeWallet = watchWalletState((next) => {
      setWalletState((current) => ({ ...current, ...next }));
    });

    return () => {
      mounted = false;
      unsubscribeWallet();
    };
  }, []);

  async function payAndRun() {
    if (!selectedOffer) {
      setNotice("Choose a GPU + model option before paying.");
      return;
    }
    if (!chainEnabled || !contractAddress) {
      setNotice("Local Anvil is not connected. Start anvil and deploy InferenceEscrow to enable Pay & run.");
      return;
    }
    if (!prompt.trim()) {
      setNotice("Enter a prompt before paying.");
      return;
    }

    setRunState("paying");
    setNotice("");
    setJob(undefined);
    setTxHash(undefined);
    setOnchainJobId(undefined);
    setReleaseTxHash(undefined);

    try {
      const buyerAddress = session?.address ?? (await requestWalletAddress());
      const inputHashHex = await sha256Hex(prompt);
      const valueWei = parseInferenceFeeToWei(selectedOffer.inference_fee);

      setNotice(`Sending escrow tx for ${selectedOffer.inference_fee}. Confirm in your wallet.`);
      const escrow = await createEscrowJob({
        contractAddress,
        workerAddress: selectedOffer.worker_address,
        inputHashHex,
        valueWei,
        fromAddress: buyerAddress
      });
      setTxHash(escrow.txHash);
      setOnchainJobId(escrow.onchainJobId);

      setRunState("running");
      setNotice(`Escrow tx mined (${escrow.txHash.slice(0, 10)}…). Backend is verifying onchain state and running inference.`);

      const result = await runPaidJob({
        onchain_job_id: escrow.onchainJobId,
        tx_hash: escrow.txHash,
        prompt,
        offer_id: selectedOffer.offer_id,
        model_id: selectedOffer.model_id,
        buyer_address: buyerAddress,
        auth_token: session?.session_token
      });

      setJob(result.job);
      setRunState("ready");
      setNotice(
        result.receipt_verified
          ? "Inference complete. Receipt verified locally; click Release payment to settle onchain."
          : "Inference complete, but receipt verification failed. Inspect the panels below before releasing."
      );
    } catch (error) {
      setRunState("error");
      setNotice(error instanceof Error ? error.message : "Pay & run failed.");
    }
  }

  async function releasePayment() {
    if (!onchainJobId || !contractAddress) {
      return;
    }
    setRunState("running");
    setNotice("");
    try {
      const buyerAddress = session?.address ?? (await requestWalletAddress());
      const release = await releaseEscrowPayment({
        contractAddress,
        onchainJobId,
        fromAddress: buyerAddress
      });
      setReleaseTxHash(release.txHash);
      setRunState("released");
      if (job) {
        setJob({ ...job, payment_state: "paid", chain_payment_state: "paid", onchain_tx_hash_release: release.txHash });
      }
      setNotice(`Payment released to worker. Release tx: ${release.txHash.slice(0, 10)}…`);
    } catch (error) {
      setRunState("error");
      setNotice(error instanceof Error ? error.message : "Release payment failed.");
    }
  }

  const busy = runState === "paying" || runState === "running";
  const canPay =
    blockers.length === 0 &&
    !busy &&
    runState !== "ready" &&
    runState !== "released";

  const inputHashShort = shortHash(job?.input_hash);
  const outputHashShort = shortHash(job?.output_hash);
  const receiptHashShort = shortHash(job?.receipt_hash);
  const escrowTxShort = shortHash(txHash);
  const releaseTxShort = shortHash(releaseTxHash);

  return (
    <main className="client-shell">
      <WalletHeader role="client" ensStyleName="research-agent.eth" onSessionChange={setSession} />

      <header className="client-header">
        <div>
          <span className="eyebrow">Buyer marketplace</span>
          <h1>Pay-per-inference: pay first, prompt runs only after escrow is verified.</h1>
          <p>
            Your wallet signs <code>createJob{"{value}"}</code> on the local InferenceEscrow contract.
            The backend reads the onchain state and runs inference only when the escrow matches your prompt.
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
                      <dt>Escrow per request</dt>
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
              <h2>Write prompt and pay</h2>
              <p className="muted">
                Prompt stays offchain. Your wallet sends the escrow tx; the backend gates inference on onchain state.
              </p>
            </div>
            <textarea rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={busy} />
            <div className="entry-action-bar">
              <button
                className="primary-link action-button"
                type="button"
                onClick={payAndRun}
                disabled={!canPay}
              >
                {runState === "paying"
                  ? "Sending escrow tx..."
                  : runState === "running"
                  ? "Running inference..."
                  : runState === "ready"
                  ? "Inference complete"
                  : "Pay & run"}
              </button>
            </div>
            {blockers.length ? (
              <ul className="check-list muted-list">
                {blockers.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : runState === "idle" ? (
              <p className="muted">
                Ready: wallet on {walletState.chainIdHex ? `chain ${parseInt(walletState.chainIdHex, 16)}` : "Anvil"}, prompt and offer set.
              </p>
            ) : null}
          </div>

          {job?.result ? (
            <div className="result-panel">
              <span className="eyebrow">Offchain result</span>
              <p>{job.result}</p>
              <code>{job.output_hash}</code>
            </div>
          ) : null}
        </section>

        <aside className="client-side-card">
          <div className="live-state-card">
            <span className="eyebrow">Current state</span>
            <p className={`payment-state ${paymentState}`}>{PHASE_LABELS[runState]}</p>
            <dl className="state-list">
              <dt>Active wallet</dt>
              <dd>
                {walletState.address ? (
                  <code title={walletState.address}>{shortHash(walletState.address)}</code>
                ) : (
                  <span className="status-pill warn">not connected</span>
                )}
              </dd>
              <dt>Network</dt>
              <dd>
                {walletState.chainIdHex ? (
                  <span className={walletOnAnvil ? "status-pill good" : "status-pill warn"}>
                    {walletOnAnvil ? "Anvil 31337" : `chain ${parseInt(walletState.chainIdHex, 16)}`}
                  </span>
                ) : (
                  <span className="status-pill warn">no chain</span>
                )}
              </dd>
              <dt>Payment state</dt>
              <dd>
                <span className={`payment-state ${paymentState}`}>{paymentState}</span>
              </dd>
              {onchainJobId ? (
                <>
                  <dt>Onchain job id</dt>
                  <dd><code>{onchainJobId}</code></dd>
                </>
              ) : null}
              {escrowTxShort ? (
                <>
                  <dt>Escrow tx</dt>
                  <dd><code>{escrowTxShort}</code></dd>
                </>
              ) : null}
              {inputHashShort ? (
                <>
                  <dt>Input hash</dt>
                  <dd><code>{inputHashShort}</code></dd>
                </>
              ) : null}
              {outputHashShort ? (
                <>
                  <dt>Output hash</dt>
                  <dd><code>{outputHashShort}</code></dd>
                </>
              ) : null}
              {receiptHashShort ? (
                <>
                  <dt>Receipt hash</dt>
                  <dd><code>{receiptHashShort}</code></dd>
                </>
              ) : null}
              {releaseTxShort ? (
                <>
                  <dt>Release tx</dt>
                  <dd><code>{releaseTxShort}</code></dd>
                </>
              ) : null}
            </dl>
            <button
              className="primary-button"
              type="button"
              onClick={releasePayment}
              disabled={runState !== "ready" || !onchainJobId}
            >
              {runState === "released" ? "Payment released" : "Release payment"}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
