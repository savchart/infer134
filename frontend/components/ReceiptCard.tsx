import type { ExecutionReceipt } from "../lib/demoData";

type ReceiptCardProps = {
  receipt?: ExecutionReceipt;
};

export function ReceiptCard({ receipt }: ReceiptCardProps) {
  if (!receipt) {
    return (
      <div className="receipt-card empty">
        <span className="eyebrow">Execution receipt</span>
        <p>Receipt fields appear after the worker returns output and the backend or fixture creates hashes.</p>
      </div>
    );
  }

  return (
    <div className="receipt-card">
      <div className="receipt-header">
        <span className="eyebrow">Execution receipt</span>
        <span className="status-pill good">hashable metadata</span>
      </div>
      <pre>{JSON.stringify(receipt, null, 2)}</pre>
    </div>
  );
}
