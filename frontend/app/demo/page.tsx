"use client";

import Link from "next/link";
import { useState } from "react";

const demo = {
  agent: {
    name: "research-agent.eth",
    address: "0x1000000000000000000000000000000000000001",
    task: "Buy private inference for a research summary."
  },
  worker: {
    name: "gpu-prague.eth",
    address: "0x2000000000000000000000000000000000000002",
    capabilities: ["mock-llama", "simulated/local worker", "signed execution receipts"],
    hardware: "simulated/local worker, replaceable with Ollama or vLLM",
    modelMode: "worker_catalog",
    runtime: "mock-runtime"
  },
  hashes: {
    input: "0x8e4b4a6f2f2d7a0191d5c51a9a3c0b8f8a2c78466dd84f2ef79ab31a4b1d1340",
    output: "0x5c7e49215fb5c02215dd5c15c37ce52d9d5420196be62fc94596aaac3bbd7991",
    receipt: "0x6fae1b02c0f88f0f4b95c83b7f84fbaac7c2864f836f20d96f32e75d9fb5489a"
  },
  price: "0.01 USDC",
  coldStartFee: "0 USDC",
  inferenceFee: "0.01 USDC",
  modelHash: "0xb44d5a5277ad37918f87a44ed08e3a21592a33d31f9f828dfda649b466786390",
  verification: "Receipt hash and demo worker signature verified"
};

const steps = [
  {
    title: "Agent",
    detail: "research-agent.eth creates a private inference job.",
    state: "job created"
  },
  {
    title: "Worker discovery",
    detail: "gpu-prague.eth is selected from worker metadata and capabilities.",
    state: "worker selected"
  },
  {
    title: "Payment state",
    detail: "Payment state moves from unpaid to escrowed before work starts.",
    state: "escrowed"
  },
  {
    title: "Offchain inference",
    detail: "The worker runs mocked inference. Prompt and output stay offchain.",
    state: "running"
  },
  {
    title: "Execution receipt",
    detail: "The worker returns hashes and a signed execution receipt.",
    state: "receipt verified"
  },
  {
    title: "Settlement",
    detail: "Payment state moves to paid after the receipt is accepted.",
    state: "paid"
  }
];

export default function DemoPage() {
  const [started, setStarted] = useState(false);

  const visibleSteps = started ? steps : steps.slice(0, 1);
  const paymentState = started ? "paid" : "unpaid";

  return (
    <main className="shell">
      <nav className="nav">
        <div>
          <div className="kicker">Infer134 Demo</div>
          <h1>Agent to worker to execution receipt in one guided flow.</h1>
        </div>
        <div className="nav-links">
          <Link href="/">Buyer</Link>
          <Link href="/agent">Agent</Link>
          <Link href="/provider">Worker</Link>
        </div>
      </nav>

      <section className="panel">
        <p>
          This demo shows the judging path: agent identity, worker discovery, payment escrowed, offchain
          inference, signed execution receipt, verification status, and payment paid.
        </p>
        <button className="button" type="button" onClick={() => setStarted(true)}>
          Run guided demo
        </button>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="kicker">Agent Identity</div>
          <strong>{demo.agent.name}</strong>
          <p className="muted">{demo.agent.address}</p>
          <p>{demo.agent.task}</p>
        </div>

        <div className="panel">
          <div className="kicker">Worker Identity</div>
          <strong>{demo.worker.name}</strong>
          <p className="muted">{demo.worker.address}</p>
          <p>{demo.worker.hardware}</p>
          <p className="muted">Model mode: {demo.worker.modelMode} · runtime: {demo.worker.runtime}</p>
          <div className="stack">
            {demo.worker.capabilities.map((capability) => (
              <span className="badge" key={capability}>{capability}</span>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="kicker">Payment State</div>
          <strong>{paymentState}</strong>
          <p className="muted">Price: {demo.price}</p>
          <p className="muted">Cold-start fee: {demo.coldStartFee} · inference fee: {demo.inferenceFee}</p>
          <p>
            The MVP uses local mocked payment state. Production can replace this with real x402 or stablecoin
            settlement.
          </p>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="kicker">Settlement Metadata</div>
          <dl>
            <dt>Input hash</dt>
            <dd>{started ? demo.hashes.input : "pending"}</dd>
            <dt>Model hash</dt>
            <dd>{started ? demo.modelHash : "pending"}</dd>
            <dt>Output hash</dt>
            <dd>{started ? demo.hashes.output : "pending"}</dd>
            <dt>Receipt hash</dt>
            <dd>{started ? demo.hashes.receipt : "pending"}</dd>
          </dl>
        </div>

        <div className="panel">
          <div className="kicker">Verification Status</div>
          <strong>{started ? "verified" : "not started"}</strong>
          <p className="muted">{started ? demo.verification : "Run the guided demo to create the receipt."}</p>
        </div>

        <div className="panel">
          <div className="kicker">Trust Assumptions</div>
          <ul>
            <li>Backend coordinator is trusted in this MVP.</li>
            <li>Hashes prove integrity, not semantic correctness.</li>
            <li>Demo signatures are placeholders, not production cryptography.</li>
            <li>Model hash is a worker claim, not proof of semantic correctness.</li>
            <li>Public identity records must not contain secrets.</li>
          </ul>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="kicker">Guided Flow</div>
        <ol className="timeline">
          {visibleSteps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <span className="badge">{step.state}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
