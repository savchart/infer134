import type { ConnectionState, DemoJobState } from "../lib/demoData";

type LiveJobStateProps = {
  job: DemoJobState;
  backend: ConnectionState;
  chain: ConnectionState;
  worker: ConnectionState;
};

function shortHash(value?: string) {
  if (!value) {
    return "pending";
  }
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function connectionLabel(kind: "backend" | "chain" | "worker", state: ConnectionState) {
  if (kind === "backend") {
    return state === "connected" ? "Backend connected" : "Fixture mode: backend unavailable";
  }
  if (kind === "chain") {
    return state === "connected" ? "Local Anvil connected" : "Mock settlement: chain unavailable";
  }
  return state === "connected" ? "Local worker connected" : "Mock inference: provider-node unavailable";
}

export function LiveJobState({ job, backend, chain, worker }: LiveJobStateProps) {
  return (
    <aside className="live-state-card">
      <div>
        <span className="eyebrow">Live job state</span>
        <h2>{job.jobId ?? "No job yet"}</h2>
      </div>

      <div className="connection-list">
        <span className={`status-pill ${backend === "connected" ? "good" : "warn"}`}>
          {connectionLabel("backend", backend)}
        </span>
        <span className={`status-pill ${chain === "connected" ? "good" : "warn"}`}>
          {connectionLabel("chain", chain)}
        </span>
        <span className={`status-pill ${worker === "connected" ? "good" : "warn"}`}>
          {connectionLabel("worker", worker)}
        </span>
      </div>

      <dl className="state-list">
        <dt>Buyer</dt>
        <dd>{job.buyerName}</dd>
        <dt>Model</dt>
        <dd>{job.modelId ?? "pending"}</dd>
        <dt>Worker</dt>
        <dd>{job.workerName ?? "pending"}</dd>
        <dt>Input hash</dt>
        <dd className="hash-text">{shortHash(job.inputHash)}</dd>
        <dt>Output hash</dt>
        <dd className="hash-text">{shortHash(job.outputHash)}</dd>
        <dt>Receipt hash</dt>
        <dd className="hash-text">{shortHash(job.receiptHash)}</dd>
        <dt>Payment state</dt>
        <dd>
          <span className={`payment-state ${job.paymentState}`}>{job.paymentState}</span>
        </dd>
        <dt>Mode</dt>
        <dd>{job.mode}</dd>
      </dl>
    </aside>
  );
}
