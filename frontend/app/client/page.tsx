"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WalletHeader } from "../../components/WalletHeader";
import {
  getChainStatus,
  getHealth,
  getOffers,
  getProviderHealth,
  runSessionJob,
  type AuthSession,
  type BackendJob,
  type ChainStatus,
  type WorkerOffer
} from "../../lib/api";
import { type ConnectionState } from "../../lib/demoData";
import { parseInferenceFeeToWei } from "../../lib/escrow";
import {
  addressesEqual,
  readCurrentWalletState,
  watchWalletState,
  type WalletState
} from "../../lib/walletAuth";

type RunState = "idle" | "booking" | "booked" | "running" | "stopped" | "error";

type EscrowSession = {
  sessionId: string;
  offerId: string;
  workerName: string;
  modelId: string;
  escrowWei: bigint;
  spentWei: bigint;
  remainingWei: bigint;
  status: "active" | "stopped";
};

type SessionRun = {
  id: string;
  prompt: string;
  output: string;
  costWei: bigint;
  inputTokens: number;
  outputTokens: number;
  jobId: string;
};

type MarketplaceStatus = {
  backend: ConnectionState;
  providerNode: ConnectionState;
  chain: ConnectionState;
  chainStatus?: ChainStatus;
};

const defaultPrompt = "Explain signed execution receipts in one sentence.";
const WEI_PER_ETH = BigInt("1000000000000000000");
const PRICE_DENOMINATOR = BigInt("1000000");

function ceilDiv(value: bigint, denominator: bigint) {
  return (value + denominator - BigInt(1)) / denominator;
}

function parseLocalEthAmount(value: string) {
  const normalized = value.replace(/local eth/gi, "").replace(/eth/gi, "").trim();
  const [wholeRaw, fractionRaw = ""] = normalized.split(".");
  const whole = wholeRaw.trim() || "0";
  const fraction = fractionRaw.trim().slice(0, 18).padEnd(18, "0");
  if (!/^\d+$/.test(whole) || !/^\d+$/.test(fraction)) {
    throw new Error("Escrow amount must be a positive local ETH number.");
  }
  return BigInt(whole) * WEI_PER_ETH + BigInt(fraction);
}

function formatWei(wei: bigint, precision = 6) {
  const sign = wei < BigInt(0) ? "-" : "";
  const absolute = wei < BigInt(0) ? -wei : wei;
  const whole = absolute / WEI_PER_ETH;
  const fraction = (absolute % WEI_PER_ETH).toString().padStart(18, "0").slice(0, precision);
  const trimmedFraction = fraction.replace(/0+$/, "");
  return `${sign}${whole}${trimmedFraction ? `.${trimmedFraction}` : ""} local ETH`;
}

function estimateOutputTokens(promptText: string) {
  return Math.max(24, Math.ceil(promptText.trim().length / 3));
}

function estimateSessionCost(offer: WorkerOffer, promptText: string, actualOutputTokens?: number) {
  const inputTokens = Math.max(1, Math.ceil(promptText.trim().length / 4));
  const outputTokens = actualOutputTokens ?? estimateOutputTokens(promptText);
  const inputPriceWei = parseInferenceFeeToWei(offer.price_per_1m_input_tokens);
  const outputPriceWei = parseInferenceFeeToWei(offer.price_per_1m_output_tokens);
  const inputCostWei = ceilDiv(inputPriceWei * BigInt(inputTokens), PRICE_DENOMINATOR);
  const outputCostWei = ceilDiv(outputPriceWei * BigInt(outputTokens), PRICE_DENOMINATOR);
  const totalWei = inputCostWei + outputCostWei;
  return {
    inputTokens,
    outputTokens,
    totalWei: totalWei > BigInt(0) ? totalWei : BigInt(1)
  };
}

function StatusBadge({ label, state }: { label: string; state: ConnectionState }) {
  return (
    <span className={state === "connected" ? "status-pill good" : state === "checking" ? "status-pill" : "status-pill warn"}>
      {label}: {state}
    </span>
  );
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
  const [escrowAmount, setEscrowAmount] = useState("0.01");
  const [escrowSession, setEscrowSession] = useState<EscrowSession | undefined>();
  const [sessionRuns, setSessionRuns] = useState<SessionRun[]>([]);
  const [job, setJob] = useState<BackendJob | undefined>();
  const [runState, setRunState] = useState<RunState>("idle");
  const [notice, setNotice] = useState("");
  const [walletState, setWalletState] = useState<WalletState>({});

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.offer_id === selectedOfferId),
    [offers, selectedOfferId]
  );

  const walletConnected = Boolean(walletState.address);
  const walletMatchesSession = !session || addressesEqual(session.address, walletState.address);
  const activeSession = escrowSession?.status === "active" ? escrowSession : undefined;

  const parsedEscrowWei = useMemo(() => {
    try {
      return parseLocalEthAmount(escrowAmount);
    } catch {
      return BigInt(0);
    }
  }, [escrowAmount]);

  const estimatedUsage = useMemo(() => {
    if (!selectedOffer || !prompt.trim()) {
      return undefined;
    }
    return estimateSessionCost(selectedOffer, prompt);
  }, [prompt, selectedOffer]);

  const blockers: string[] = [];
  if (status.backend !== "connected") {
    blockers.push("Backend is offline (start uvicorn on :8000).");
  }
  if (!selectedOffer) {
    blockers.push("Pick a GPU + model option above.");
  }
  if (!walletConnected) {
    blockers.push("Connect a browser wallet.");
  }
  if (walletConnected && !walletMatchesSession) {
    blockers.push("Wallet account differs from the signed-in session. Click Disconnect in the top-right and reconnect with the active account.");
  }
  if (parsedEscrowWei <= BigInt(0)) {
    blockers.push("Set a positive escrow amount.");
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

  function handleSelectOffer(offerId: string) {
    if (activeSession) {
      setNotice("Stop the current GPU session before switching offers.");
      return;
    }
    setSelectedOfferId(offerId);
  }

  async function bookGpuSession() {
    if (!selectedOffer) {
      setNotice("Choose a GPU + model option before booking.");
      return;
    }
    if (blockers.length > 0) {
      setNotice(blockers[0]);
      return;
    }
    setRunState("booking");
    setNotice("");
    setJob(undefined);
    setSessionRuns([]);

    try {
      const sessionId = `session-${Date.now().toString(36)}`;
      setEscrowSession({
        sessionId,
        offerId: selectedOffer.offer_id,
        workerName: selectedOffer.worker_name,
        modelId: selectedOffer.model_id,
        escrowWei: parsedEscrowWei,
        spentWei: BigInt(0),
        remainingWei: parsedEscrowWei,
        status: "active"
      });
      setRunState("booked");
      setNotice(`GPU booked. Escrow locked: ${formatWei(parsedEscrowWei)}.`);
    } catch (error) {
      setRunState("error");
      setNotice(error instanceof Error ? error.message : "GPU booking failed.");
    }
  }

  async function sendPrompt() {
    if (!selectedOffer || !activeSession) {
      setNotice("Book a GPU session before sending prompts.");
      return;
    }
    if (!prompt.trim()) {
      setNotice("Write a prompt before sending it to the GPU.");
      return;
    }
    const estimate = estimateSessionCost(selectedOffer, prompt);
    if (estimate.totalWei > activeSession.remainingWei) {
      setRunState("error");
      setNotice(`Not enough escrow balance. Need ${formatWei(estimate.totalWei)}, available ${formatWei(activeSession.remainingWei)}.`);
      return;
    }

    setRunState("running");
    setNotice("");
    setJob(undefined);

    try {
      const result = await runSessionJob({
        session_id: activeSession.sessionId,
        prompt,
        offer_id: selectedOffer.offer_id,
        model_id: selectedOffer.model_id,
        buyer_address: session?.address ?? walletState.address,
        buyer_name: session?.ens_style_name ?? "research-agent.eth",
        auth_token: session?.session_token,
        escrow_amount_wei: activeSession.remainingWei.toString()
      });
      const actualOutputTokens = result.job.output_tokens || estimate.outputTokens;
      const actualUsage = estimateSessionCost(selectedOffer, prompt, actualOutputTokens);
      const nextRemaining = activeSession.remainingWei - actualUsage.totalWei;
      const nextSpent = activeSession.spentWei + actualUsage.totalWei;
      const output = result.job.result || "";

      setEscrowSession({
        ...activeSession,
        spentWei: nextSpent,
        remainingWei: nextRemaining
      });
      setSessionRuns((current) => [
        {
          id: result.job.job_id,
          prompt,
          output,
          costWei: actualUsage.totalWei,
          inputTokens: result.job.input_tokens || estimate.inputTokens,
          outputTokens: actualOutputTokens,
          jobId: result.job.job_id
        },
        ...current
      ]);
      setJob(result.job);
      setRunState("booked");
      setNotice(`Output ready. Spent ${formatWei(actualUsage.totalWei)} from escrow.`);
    } catch (error) {
      setRunState("error");
      setNotice(error instanceof Error ? error.message : "Prompt execution failed.");
    }
  }

  function stopSession() {
    if (!activeSession) {
      return;
    }
    setEscrowSession({
      ...activeSession,
      status: "stopped"
    });
    setRunState("stopped");
    setNotice(`Session stopped. Refund ${formatWei(activeSession.remainingWei)}; spent ${formatWei(activeSession.spentWei)}.`);
  }

  const busy = runState === "booking" || runState === "running";
  const canBook = blockers.length === 0 && !busy && !activeSession;
  const canSend =
    Boolean(activeSession) &&
    Boolean(selectedOffer) &&
    prompt.trim().length > 0 &&
    !busy &&
    (!estimatedUsage || (activeSession ? estimatedUsage.totalWei <= activeSession.remainingWei : false));

  return (
    <main className="client-shell">
      <WalletHeader role="client" ensStyleName="research-agent.eth" onSessionChange={setSession} />

      <header className="client-header">
        <div>
          <span className="eyebrow">Agent GPU session</span>
          <h1>Book a GPU with escrow, then prompt until the balance runs out.</h1>
          <p>
            Lock a session budget, send multiple prompts to the selected worker, and stop when you are done.
            Settlement returns the unused escrow after subtracting token usage.
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

      {notice && runState !== "error" ? <div className="notice">{notice}</div> : null}

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
                    onClick={() => handleSelectOffer(offer.offer_id)}
                    disabled={Boolean(activeSession)}
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
                      <dt>Minimum request escrow</dt>
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
              <span className="eyebrow">1. Escrow</span>
              <h2>Book GPU time</h2>
              <p className="muted">
                Escrow is locked for the selected GPU session. Prompts spend from this balance by token usage.
              </p>
            </div>
            <label>
              Escrow amount
              <input
                value={escrowAmount}
                onChange={(event) => setEscrowAmount(event.target.value)}
                disabled={busy || Boolean(activeSession)}
                placeholder="0.01"
              />
            </label>
            <div className="entry-action-bar">
              <button
                className="primary-link action-button"
                type="button"
                onClick={bookGpuSession}
                disabled={!canBook}
              >
                {runState === "booking" ? "Booking GPU..." : activeSession ? "GPU booked" : "Book GPU"}
              </button>
              {activeSession ? (
                <button className="secondary-link action-button" type="button" onClick={stopSession} disabled={busy}>
                  Stop session
                </button>
              ) : null}
            </div>
            {blockers.length ? (
              <ul className="check-list muted-list">
                {blockers.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : !activeSession ? (
              <p className="muted">
                Ready to book {selectedOffer?.gpu_name} for {formatWei(parsedEscrowWei)}.
              </p>
            ) : null}
          </div>

          <div className="panel client-prompt-panel">
            <div>
              <span className="eyebrow">2. Prompt loop</span>
              <h2>Use the GPU while escrow remains</h2>
              <p className="muted">
                Send prompts without re-booking. Each output deducts token cost from the session balance.
              </p>
            </div>
            <textarea rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={busy || !activeSession} />
            <div className="session-balance-grid">
              <div>
                <span>Locked</span>
                <strong>{escrowSession ? formatWei(escrowSession.escrowWei) : formatWei(parsedEscrowWei)}</strong>
              </div>
              <div>
                <span>Spent</span>
                <strong>{escrowSession ? formatWei(escrowSession.spentWei) : "0 local ETH"}</strong>
              </div>
              <div>
                <span>Refundable</span>
                <strong>{escrowSession ? formatWei(escrowSession.remainingWei) : "0 local ETH"}</strong>
              </div>
              <div>
                <span>Next estimate</span>
                <strong>{estimatedUsage ? formatWei(estimatedUsage.totalWei, 8) : "0 local ETH"}</strong>
              </div>
            </div>
            <div className="entry-action-bar">
              <button
                className="primary-link action-button"
                type="button"
                onClick={sendPrompt}
                disabled={!canSend}
              >
                {runState === "running" ? "Running prompt..." : "Send prompt"}
              </button>
            </div>
            {activeSession && estimatedUsage && estimatedUsage.totalWei > activeSession.remainingWei ? (
              <p className="notice error">
                Not enough escrow for the next prompt. Stop the session to return the remaining balance.
              </p>
            ) : null}
          </div>

          {job?.result ? (
            <div className="result-panel">
              <span className="eyebrow">Output</span>
              <p>{job.result}</p>
            </div>
          ) : null}
          {sessionRuns.length ? (
            <div className="result-panel">
              <span className="eyebrow">Session runs</span>
              <div className="session-run-list">
                {sessionRuns.map((run) => (
                  <article key={run.id}>
                    <strong>{formatWei(run.costWei, 8)}</strong>
                    <span>{run.inputTokens} input tokens / {run.outputTokens} output tokens</span>
                    <p>{run.output}</p>
                    <code>{run.jobId}</code>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          {runState === "error" && notice ? (
            <div className="result-panel error">
              <span className="eyebrow">Error</span>
              <p>{notice}</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
