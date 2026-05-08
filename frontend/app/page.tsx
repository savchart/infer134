import Link from "next/link";

import { ComputeReceipt } from "../components/ComputeReceipt";
import { JobForm } from "../components/JobForm";
import { ProviderList } from "../components/ProviderList";
import { StatusTimeline } from "../components/StatusTimeline";
import { WalletConnect } from "../components/WalletConnect";

export default function BuyerDashboard() {
  return (
    <main className="shell">
      <nav className="nav">
        <div>
          <div className="kicker">Infer134</div>
          <h1>Private offchain inference with signed execution receipts and programmable payment settlement.</h1>
        </div>
        <div className="nav-links">
          <Link href="/provider">Worker</Link>
          <Link href="/agent">Agent</Link>
          <Link href="/jobs/job-0001">Job</Link>
        </div>
      </nav>

      <section className="panel">
        <p>
          Infer134 is a verifiable pay-per-inference market for AI agents and companies. Agents submit
          inference jobs to independent compute workers. Workers execute jobs offchain and return signed
          execution receipts; prompts and outputs stay private while hashes and payment state support settlement.
        </p>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <WalletConnect />
        <ProviderList />
        <StatusTimeline />
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <JobForm />
        <div className="panel">
          <div className="kicker">Result</div>
          <p className="muted">Offchain result placeholder from the selected worker.</p>
          <pre>Infer134 mock result: worker accepted the job.</pre>
        </div>
        <ComputeReceipt />
      </section>
    </main>
  );
}
