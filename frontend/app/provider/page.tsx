import Link from "next/link";

import { ProviderList } from "../../components/ProviderList";
import { StatusTimeline } from "../../components/StatusTimeline";

export default function ProviderDashboard() {
  return (
    <main className="shell">
      <nav className="nav">
        <div>
          <div className="kicker">Worker Dashboard</div>
          <h1>gpu-prague.eth</h1>
        </div>
        <div className="nav-links">
          <Link href="/">Buyer</Link>
          <Link href="/agent">Agent</Link>
        </div>
      </nav>

      <section className="grid">
        <div className="panel">
          <div className="kicker">Registration</div>
          <label className="field">
            ENS-style identity
            <input defaultValue="gpu-prague.eth" />
          </label>
          <label className="field">
            Address
            <input defaultValue="0x2000000000000000000000000000000000000002" />
          </label>
          <button className="button" type="button">Register worker placeholder</button>
        </div>

        <div className="panel">
          <div className="kicker">Hardware</div>
          <p><strong>Model:</strong> mock-llama</p>
          <p><strong>Hardware:</strong> simulated/local worker</p>
          <p><strong>Status:</strong> available</p>
        </div>

        <div className="panel">
          <div className="kicker">Supported Models</div>
          <dl>
            <dt>mock-llama</dt>
            <dd>worker_catalog · ready/cached · mock-runtime · 0.01 USDC inference fee</dd>
            <dt>custom reference</dt>
            <dd>custom_reference · preparation required · estimated cold-start fee 0.05 USDC</dd>
          </dl>
        </div>

        <div className="panel">
          <div className="kicker">Custom Model Request</div>
          <label className="field">
            Model source
            <input defaultValue="hf://public/demo/custom-solar-adapter" />
          </label>
          <label className="field">
            Revision
            <input defaultValue="adapter-v1" />
          </label>
          <label className="field">
            Runtime
            <input defaultValue="mock-runtime" />
          </label>
          <p className="muted">Estimated cold-start fee: 0.05 USDC. Preparation is mocked for the MVP.</p>
        </div>

        <ProviderList />
        <StatusTimeline />
      </section>
    </main>
  );
}
