"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  claimJob,
  createJob,
  getChainStatus,
  getHealth,
  getProviderHealth,
  payJob,
  registerWorker,
  runJob,
  submitJob,
  type BackendJob,
  type BackendWorker,
  type AuthSession,
  type ReceiptPayload
} from "../lib/api";
import {
  buildFixtureReceipt,
  demoModels,
  demoWorker,
  deterministicFixtureOutput,
  fixtureSignature,
  fixtureTxHash,
  initialJobState,
  sha256Hex,
  type ConnectionState,
  type DemoJobState,
  type DemoModel,
  type ExecutionReceipt,
  type PaymentState
} from "../lib/demoData";
import { DemoStepper } from "./DemoStepper";
import { LiveJobState } from "./LiveJobState";
import { ReceiptCard } from "./ReceiptCard";
import { VerificationPanel } from "./VerificationPanel";
import { WalletConnect } from "./WalletConnect";

const stepTitles = [
  "Start",
  "Choose model",
  "Enter prompt",
  "Select worker",
  "Create escrow",
  "Run inference",
  "Verify receipt",
  "Release payment"
];

const progressMessages = ["Sending prompt offchain", "Worker running model", "Output received"];

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizePaymentState(value: string): PaymentState {
  if (value === "paid" || value === "payable" || value === "escrowed" || value === "unpaid") {
    return value;
  }
  return "unpaid";
}

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

function stateFromBackendJob(
  backendJob: BackendJob,
  model: DemoModel,
  worker: BackendWorker | undefined,
  current: DemoJobState
): DemoJobState {
  const chainBacked =
    backendJob.chain_payment_state !== "mock_settlement" &&
    backendJob.chain_payment_state !== "not_linked" &&
    Boolean(backendJob.onchain_tx_hash_create || backendJob.onchain_tx_hash_submit || backendJob.onchain_tx_hash_release);

  return {
    ...current,
    jobId: backendJob.job_id,
    buyerAddress: backendJob.buyer,
    buyerName: backendJob.buyer_name,
    modelId: backendJob.model_id || model.modelId,
    modelRuntime: backendJob.runtime || model.runtime,
    modelSource: model.source,
    workerId: backendJob.worker_id ?? worker?.worker_id ?? current.workerId,
    workerName: backendJob.worker_name ?? worker?.name ?? current.workerName,
    workerAddress: backendJob.worker ?? worker?.address ?? current.workerAddress,
    inputHash: backendJob.input_hash || current.inputHash,
    output: backendJob.result ?? current.output,
    outputHash: backendJob.output_hash ?? current.outputHash,
    receiptHash: backendJob.receipt_hash ?? current.receiptHash,
    txHash: backendJob.onchain_tx_hash_create ?? current.txHash,
    paymentState: normalizePaymentState(backendJob.payment_state),
    mode: "backend-connected",
    settlementMode: chainBacked ? "local-anvil" : "mock-settlement"
  };
}

export function DemoWizard() {
  const [connections, setConnections] = useState<{
    backend: ConnectionState;
    chain: ConnectionState;
    worker: ConnectionState;
  }>({
    backend: "checking",
    chain: "checking",
    worker: "checking"
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [selectedModelId, setSelectedModelId] = useState(demoModels[0].modelId);
  const [prompt, setPrompt] = useState(initialJobState.prompt);
  const [job, setJob] = useState<DemoJobState>(initialJobState);
  const [busyLabel, setBusyLabel] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [receiptVerified, setReceiptVerified] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [clientSession, setClientSession] = useState<AuthSession | undefined>();

  const selectedModel = useMemo(
    () => demoModels.find((model) => model.modelId === selectedModelId) ?? demoModels[0],
    [selectedModelId]
  );

  useEffect(() => {
    let mounted = true;

    getHealth()
      .then(() => {
        if (mounted) {
          setConnections((current) => ({ ...current, backend: "connected" }));
        }
      })
      .catch(() => {
        if (mounted) {
          setConnections((current) => ({ ...current, backend: "unavailable" }));
        }
      });

    getChainStatus()
      .then((status) => {
        if (mounted) {
          setConnections((current) => ({
            ...current,
            chain: status.chain_enabled && !status.error ? "connected" : "unavailable"
          }));
        }
      })
      .catch(() => {
        if (mounted) {
          setConnections((current) => ({ ...current, chain: "unavailable" }));
        }
      });

    getProviderHealth()
      .then(() => {
        if (mounted) {
          setConnections((current) => ({ ...current, worker: "connected" }));
        }
      })
      .catch(() => {
        if (mounted) {
          setConnections((current) => ({ ...current, worker: "unavailable" }));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setJob((current) => ({
      ...current,
      mode: connections.backend === "connected" ? "backend-connected" : "fixture",
      settlementMode: connections.chain === "connected" ? "local-anvil" : "mock-settlement",
      inferenceMode: connections.worker === "connected" ? "local-worker" : "mock-inference"
    }));
  }, [connections]);

  function completeStep(nextStep: number) {
    setCompletedSteps((current) => new Set(current).add(currentStep));
    setCurrentStep(nextStep);
  }

  function startRequest() {
    setNotice("");
    completeStep(1);
  }

  function chooseModel() {
    setJob((current) => ({
      ...current,
      modelId: selectedModel.modelId,
      modelRuntime: selectedModel.runtime,
      modelSource: selectedModel.source
    }));
    completeStep(2);
  }

  async function continueWithPrompt() {
    setBusyLabel("Computing input_hash");
    const inputHash = await sha256Hex(prompt);
    setJob((current) => ({
      ...current,
      prompt,
      inputHash,
      paymentState: "unpaid"
    }));
    setBusyLabel("");
    completeStep(3);
  }

  function selectWorker() {
    setJob((current) => ({
      ...current,
      workerId: demoWorker.workerId,
      workerName: demoWorker.workerName,
      workerAddress: demoWorker.address
    }));
    completeStep(4);
  }

  async function createEscrow() {
    setBusyLabel("Creating payment state");
    setNotice("");
    let nextJob: DemoJobState = {
      ...job,
      modelId: selectedModel.modelId,
      modelRuntime: selectedModel.runtime,
      modelSource: selectedModel.source,
      workerId: demoWorker.workerId,
      workerName: demoWorker.workerName,
      workerAddress: demoWorker.address,
      txHash: fixtureTxHash,
      paymentState: "escrowed"
    };

    if (connections.backend === "connected") {
      try {
        const worker = await registerWorker(selectedModel);
        const created = await createJob(prompt, selectedModel.modelId, clientSession?.session_token);
        const claimed = await claimJob(created.job.job_id, worker.worker_id);
        const chainBacked =
          claimed.chain_payment_state !== "mock_settlement" &&
          claimed.chain_payment_state !== "not_linked" &&
          Boolean(claimed.onchain_tx_hash_create);
        nextJob = stateFromBackendJob(claimed, selectedModel, worker, {
          ...nextJob,
          txHash: claimed.onchain_tx_hash_create ?? fixtureTxHash,
          settlementMode: chainBacked ? "local-anvil" : "mock-settlement"
        });
        setNotice(
          chainBacked
            ? "Backend connected. Local Anvil escrow transaction is linked to this job."
            : "Backend connected. Mock settlement: chain writes are unavailable or not configured."
        );
      } catch (error) {
        nextJob = {
          ...nextJob,
          mode: "fixture",
          settlementMode: "mock-settlement"
        };
        setNotice(
          `Fixture mode: backend escrow flow failed. ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    } else {
      setNotice("Fixture mode: backend unavailable. Using deterministic demo escrow state.");
    }

    setJob(nextJob);
    setBusyLabel("");
    completeStep(5);
  }

  async function runInference() {
    setBusyLabel("Running inference");
    setNotice("");
    setProgress([]);
    for (const message of progressMessages) {
      setProgress((current) => [...current, message]);
      await sleep(250);
    }

    if (connections.backend === "connected" && job.jobId && job.workerId) {
      try {
        const runResult = await runJob(job.jobId, job.workerId);
        const submitted = await submitJob(job.jobId);
        const receipt = normalizeReceipt(submitted.receipt);
        const nextJob = stateFromBackendJob(submitted.job, selectedModel, undefined, {
          ...job,
          output: submitted.job.result ?? runResult.job.result ?? undefined,
          outputHash: submitted.job.output_hash ?? undefined,
          receiptHash: submitted.receipt.receipt_hash,
          signature: submitted.receipt.signature,
          timestamp: submitted.receipt.timestamp,
          receipt,
          paymentState: "payable"
        });
        setJob({
          ...nextJob,
          receipt,
          output: submitted.job.result ?? runResult.job.result ?? nextJob.output,
          outputHash: submitted.receipt.output_hash,
          receiptHash: submitted.receipt.receipt_hash,
          signature: submitted.receipt.signature,
          timestamp: submitted.receipt.timestamp,
          paymentState: "payable"
        });
        setNotice(
          connections.worker === "connected"
            ? "Local worker connected. Backend returned inference output and execution receipt."
            : "Mock inference: provider-node unavailable. Backend used its local fallback."
        );
        setBusyLabel("");
        completeStep(6);
        return;
      } catch (error) {
        setNotice(
          `Mock inference: provider-node or backend run failed. ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else {
      setNotice("Mock inference: provider-node unavailable or backend unavailable.");
    }

    const output = deterministicFixtureOutput(prompt, selectedModel.modelId);
    const outputHash = await sha256Hex(output);
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const receiptHash = await sha256Hex(
      [
        job.jobId ?? "job-fixture-0001",
        job.inputHash ?? "",
        outputHash,
        selectedModel.modelId,
        demoWorker.address,
        timestamp
      ].join("|")
    );
    const fixtureJob: DemoJobState = {
      ...job,
      jobId: job.jobId ?? "job-fixture-0001",
      modelId: selectedModel.modelId,
      modelRuntime: selectedModel.runtime,
      modelSource: selectedModel.source,
      workerId: demoWorker.workerId,
      workerName: demoWorker.workerName,
      workerAddress: demoWorker.address,
      output,
      outputHash,
      receiptHash,
      signature: fixtureSignature,
      timestamp,
      paymentState: "payable",
      mode: "fixture",
      inferenceMode: "mock-inference"
    };
    setJob({
      ...fixtureJob,
      receipt: buildFixtureReceipt(fixtureJob)
    });
    setBusyLabel("");
    completeStep(6);
  }

  function verifyReceipt() {
    const receipt = job.receipt ?? buildFixtureReceipt(job);
    setJob((current) => ({
      ...current,
      receipt,
      receiptHash: receipt.receipt_hash,
      signature: receipt.signature,
      timestamp: receipt.timestamp
    }));
    setReceiptVerified(true);
    completeStep(7);
  }

  async function releasePayment() {
    setBusyLabel("Releasing payment");
    setNotice("");
    if (connections.backend === "connected" && job.jobId) {
      try {
        const paid = await payJob(job.jobId);
        const chainPaid = paid.job.chain_payment_state === "paid" && Boolean(paid.job.onchain_tx_hash_release);
        setJob((current) => ({
          ...current,
          paymentState: "paid",
          txHash: paid.job.onchain_tx_hash_release ?? current.txHash,
          settlementMode: chainPaid ? "local-anvil" : "mock-settlement",
          receipt: current.receipt
            ? {
                ...current.receipt,
                payment_state: "paid"
              }
            : current.receipt
        }));
        setNotice(
          chainPaid
            ? "Payment released through the local Anvil escrow contract."
            : "Payment released in backend state. Mock settlement: chain writes are unavailable or not configured."
        );
      } catch (error) {
        setJob((current) => ({
          ...current,
          paymentState: "paid",
          mode: "fixture"
        }));
        setNotice(
          `Fixture transition: backend payment release failed. ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else {
      setJob((current) => ({
        ...current,
        paymentState: "paid",
        mode: "fixture"
      }));
      setNotice("Fixture transition: worker received demo payment state.");
    }

    setBusyLabel("");
    setCompletedSteps((current) => new Set(current).add(7));
    setIsComplete(true);
  }

  function resetDemo() {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setJob({
      ...initialJobState,
      mode: connections.backend === "connected" ? "backend-connected" : "fixture",
      settlementMode: connections.chain === "connected" ? "local-anvil" : "mock-settlement",
      inferenceMode: connections.worker === "connected" ? "local-worker" : "mock-inference"
    });
    setPrompt(initialJobState.prompt);
    setSelectedModelId(demoModels[0].modelId);
    setProgress([]);
    setReceiptVerified(false);
    setIsComplete(false);
    setNotice("");
  }

  function renderStep() {
    if (currentStep === 0) {
      return (
        <section className="wizard-card">
          <span className="eyebrow">Step 1</span>
          <h1>Start a private inference request</h1>
          <p className="lead">
            You need private inference without sending prompt/output to a centralized provider.
          </p>
          <div className="identity-card">
            <span>Buyer identity</span>
            <strong>{clientSession?.ens_style_name ?? initialJobState.buyerName}</strong>
            <code>{clientSession?.address ?? initialJobState.buyerAddress}</code>
          </div>
          <WalletConnect role="client" ensStyleName="research-agent.eth" onSessionChange={setClientSession} />
          <button className="primary-button" type="button" onClick={startRequest}>
            Start inference request
          </button>
        </section>
      );
    }

    if (currentStep === 1) {
      return (
        <section className="wizard-card">
          <span className="eyebrow">Step 2</span>
          <h1>Choose a worker-advertised model</h1>
          <p className="lead">Only allowlisted public HF models and the local mock fallback are selectable.</p>
          <div className="choice-grid">
            {demoModels.map((model) => (
              <button
                className={`choice-card ${selectedModelId === model.modelId ? "selected" : ""}`}
                key={model.modelId}
                type="button"
                onClick={() => setSelectedModelId(model.modelId)}
              >
                <span className="eyebrow">{model.source}</span>
                <strong>{model.label}</strong>
                <code>{model.modelId}</code>
                <span>{model.runtime}</span>
                <p>{model.notes}</p>
              </button>
            ))}
          </div>
          <button className="primary-button" type="button" onClick={chooseModel}>
            Continue with selected model
          </button>
        </section>
      );
    }

    if (currentStep === 2) {
      return (
        <section className="wizard-card">
          <span className="eyebrow">Step 3</span>
          <h1>Enter the offchain prompt</h1>
          <label className="demo-field">
            Prompt
            <textarea rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>
          <p className="note">
            Prompt stays offchain. Only input_hash is used as settlement metadata.
          </p>
          {job.inputHash ? <code className="hash-block">{job.inputHash}</code> : null}
          <button className="primary-button" type="button" onClick={continueWithPrompt} disabled={!prompt.trim()}>
            Compute input_hash and continue
          </button>
        </section>
      );
    }

    if (currentStep === 3) {
      return (
        <section className="wizard-card">
          <span className="eyebrow">Step 4</span>
          <h1>Select an independent compute worker</h1>
          <button className="worker-card selected" type="button" onClick={selectWorker}>
            <span className="status-pill good">{demoWorker.status}</span>
            <strong>{demoWorker.workerName}</strong>
            <code>{demoWorker.address}</code>
            <dl>
              <dt>Runtime</dt>
              <dd>{connections.worker === "connected" ? "vLLM local worker" : "mock fallback"}</dd>
              <dt>Supported model</dt>
              <dd>{selectedModel.modelId}</dd>
              <dt>Price</dt>
              <dd>{demoWorker.price}</dd>
            </dl>
          </button>
        </section>
      );
    }

    if (currentStep === 4) {
      return (
        <section className="wizard-card">
          <span className="eyebrow">Step 5</span>
          <h1>Create escrow payment state</h1>
          <p className="lead">
            The buyer locks demo payment state before the worker starts. Local Anvil is used when available.
          </p>
          <div className="artifact-grid">
            <div>
              <span>Escrow amount</span>
              <strong>{job.escrowAmount}</strong>
            </div>
            <div>
              <span>Payment state</span>
              <strong>{job.paymentState}</strong>
            </div>
            <div>
              <span>Tx hash</span>
              <code>{job.txHash ?? "pending"}</code>
            </div>
          </div>
          <button className="primary-button" type="button" onClick={createEscrow}>
            Create local escrow
          </button>
        </section>
      );
    }

    if (currentStep === 5) {
      return (
        <section className="wizard-card">
          <span className="eyebrow">Step 6</span>
          <h1>Ask the worker to run inference</h1>
          <p className="lead">The prompt moves offchain to the worker. Only hashes become settlement metadata.</p>
          <div className="progress-list">
            {progressMessages.map((message) => (
              <span className={progress.includes(message) ? "active" : ""} key={message}>
                {message}
              </span>
            ))}
          </div>
          {job.output ? (
            <div className="result-panel">
              <span className="eyebrow">Model output</span>
              <p>{job.output}</p>
              <code>{job.outputHash}</code>
            </div>
          ) : null}
          <button className="primary-button" type="button" onClick={runInference}>
            Ask worker to run inference
          </button>
        </section>
      );
    }

    if (currentStep === 6) {
      return (
        <section className="wizard-card">
          <span className="eyebrow">Step 7</span>
          <h1>Verify the execution receipt</h1>
          <ReceiptCard receipt={job.receipt} />
          <VerificationPanel
            receiptReady={Boolean(job.receipt)}
            paymentState={job.paymentState}
            signatureEnabled={Boolean(job.signature)}
          />
          <button className="primary-button" type="button" onClick={verifyReceipt}>
            Verify receipt and continue
          </button>
        </section>
      );
    }

    return (
      <section className="wizard-card">
        <span className="eyebrow">Step 8</span>
        <h1>Release payment and finish</h1>
        <p className="lead">
          Inference complete. Prompt/output stayed offchain. Settlement metadata and receipt are available.
        </p>
        <div className="artifact-grid">
          <div>
            <span>Payment state</span>
            <strong>{job.paymentState}</strong>
          </div>
          <div>
            <span>Worker received payment</span>
            <strong>{job.paymentState === "paid" ? "yes" : "pending"}</strong>
          </div>
          <div>
            <span>Receipt verified</span>
            <strong>{receiptVerified ? "yes" : "pending"}</strong>
          </div>
        </div>
        {isComplete ? (
          <button className="secondary-button" type="button" onClick={resetDemo}>
            Reset demo
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={releasePayment}>
            Release payment
          </button>
        )}
      </section>
    );
  }

  return (
    <main className="demo-shell">
      <header className="demo-header">
        <div>
          <span className="eyebrow">Infer134 MVP</span>
          <h1>Buy private offchain inference step by step.</h1>
          <p>
            Request, choose a model, select a worker, escrow payment, run inference, verify the receipt,
            and release payment.
          </p>
        </div>
        <div className="header-actions">
          <Link className="nav-pill" href="/">
            Home
          </Link>
          <span className={clientSession ? "status-pill good" : "status-pill warn"}>
            {clientSession ? "Wallet-authenticated client" : "Fixture client allowed"}
          </span>
          <span className="status-pill">Prompt/output offchain</span>
        </div>
      </header>

      <div className="demo-layout">
        <DemoStepper
          steps={stepTitles}
          currentStep={currentStep}
          completedSteps={completedSteps}
          isComplete={isComplete}
        />
        <div className="wizard-column">
          {notice ? <div className="notice">{notice}</div> : null}
          {busyLabel ? <div className="notice active">{busyLabel}</div> : null}
          {renderStep()}
          <VerificationPanel
            receiptReady={Boolean(job.receipt)}
            paymentState={job.paymentState}
            signatureEnabled={Boolean(job.signature)}
          />
        </div>
        <LiveJobState job={job} backend={connections.backend} chain={connections.chain} worker={connections.worker} />
      </div>
    </main>
  );
}
