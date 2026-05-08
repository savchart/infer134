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

        <ProviderList />
        <StatusTimeline />
      </section>
    </main>
  );
}

