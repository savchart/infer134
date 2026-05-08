type ComputeReceiptProps = {
  jobId?: string;
  inputHash?: string;
  outputHash?: string;
  receiptHash?: string;
  worker?: string;
  paymentState?: string;
  modelId?: string;
  modelHash?: string;
  runtime?: string;
  coldStartFee?: string;
  inferenceFee?: string;
};

export function ComputeReceipt({
  jobId = "job-0001",
  inputHash = "0x...",
  outputHash = "0x...",
  receiptHash = "0x...",
  worker = "gpu-prague.eth",
  paymentState = "payable",
  modelId = "mock-llama",
  modelHash = "0x...",
  runtime = "mock-runtime",
  coldStartFee = "0 USDC",
  inferenceFee = "0.01 USDC"
}: ComputeReceiptProps) {
  return (
    <div className="panel">
      <div className="kicker">Signed Execution Receipt</div>
      <dl>
        <dt>Job</dt>
        <dd>{jobId}</dd>
        <dt>Worker</dt>
        <dd>{worker}</dd>
        <dt>Model</dt>
        <dd>{modelId}</dd>
        <dt>Model hash</dt>
        <dd>{modelHash}</dd>
        <dt>Runtime</dt>
        <dd>{runtime}</dd>
        <dt>Cold-start fee</dt>
        <dd>{coldStartFee}</dd>
        <dt>Inference fee</dt>
        <dd>{inferenceFee}</dd>
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
        Hashes verify integrity of stored values. Model hash is a trusted worker claim in this MVP and does
        not prove semantic correctness or real execution.
      </p>
    </div>
  );
}
