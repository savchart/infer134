import Link from "next/link";

import { ComputeReceipt } from "../../../components/ComputeReceipt";
import { StatusTimeline } from "../../../components/StatusTimeline";
import { WalletHeader } from "../../../components/WalletHeader";

type JobPageProps = {
  params: {
    id: string;
  };
};

export default function JobPage({ params }: JobPageProps) {
  return (
    <main className="shell">
      <WalletHeader role="client" ensStyleName="research-agent.eth" />

      <nav className="nav">
        <div>
          <div className="kicker">Job Status</div>
          <h1>{params.id}</h1>
        </div>
        <div className="nav-links">
          <Link href="/">Buyer</Link>
          <Link href="/provider">Worker</Link>
          <Link href="/agent">Agent</Link>
        </div>
      </nav>

      <section className="grid">
        <StatusTimeline />
        <ComputeReceipt jobId={params.id} paymentState="paid" />
        <div className="panel">
          <div className="kicker">Settlement Explanation</div>
          <p>
            Prompt and output remain offchain. Input hash, output hash, receipt hash, worker identity,
            price, and payment state are the settlement metadata.
          </p>
          <p className="muted">
            This prototype verifies hash integrity and a demo signature. It trusts the backend and worker
            for correctness.
          </p>
        </div>
      </section>
    </main>
  );
}
