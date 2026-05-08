type ComputeReceiptProps = {
  jobId?: string;
  inputHash?: string;
  outputHash?: string;
  receiptHash?: string;
  worker?: string;
  paymentState?: string;
};

export function ComputeReceipt({
  jobId = "job-0001",
  inputHash = "0x...",
  outputHash = "0x...",
  receiptHash = "0x...",
  worker = "gpu-prague.eth",
  paymentState = "payable"
}: ComputeReceiptProps) {
  return (
    <div className="panel">
      <div className="kicker">Signed Execution Receipt</div>
      <dl>
        <dt>Job</dt>
        <dd>{jobId}</dd>
        <dt>Worker</dt>
        <dd>{worker}</dd>
        <dt>Input hash</dt>
        <dd>{inputHash}</dd>
        <dt>Output hash</dt>
        <dd>{outputHash}</dd>
        <dt>Receipt hash</dt>
        <dd>{receiptHash}</dd>
        <dt>Payment state</dt>
        <dd>{paymentState}</dd>
      </dl>
      <p className="muted">
        Hashes verify integrity of stored values. The demo signature does not prove semantic correctness.
      </p>
    </div>
  );
}

