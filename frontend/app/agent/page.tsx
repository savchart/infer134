import Link from "next/link";

import { ComputeReceipt } from "../../components/ComputeReceipt";
import { StatusTimeline } from "../../components/StatusTimeline";

export default function AgentDashboard() {
  return (
    <main className="shell">
      <nav className="nav">
        <div>
          <div className="kicker">Agent Dashboard</div>
          <h1>research-agent.eth</h1>
        </div>
        <div className="nav-links">
          <Link href="/">Buyer</Link>
          <Link href="/provider">Worker</Link>
        </div>
      </nav>

      <section className="grid">
        <div className="panel">
          <div className="kicker">Task Prompt</div>
          <textarea rows={6} defaultValue="Find the cheapest available worker and run an inference job." />
          <button className="button secondary" type="button">Let agent choose worker</button>
        </div>

        <div className="panel">
          <div className="kicker">Selected Worker</div>
          <strong>gpu-prague.eth</strong>
          <p className="muted">mock-llama · simulated/local worker · 0.01 USDC</p>
        </div>

        <div className="panel">
          <div className="kicker">Result</div>
          <pre>Infer134 mock result: agent completed the pay-per-inference flow.</pre>
        </div>

        <ComputeReceipt paymentState="paid" />
        <StatusTimeline />
      </section>
    </main>
  );
}
