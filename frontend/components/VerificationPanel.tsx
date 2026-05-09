type VerificationPanelProps = {
  receiptReady: boolean;
  paymentState: string;
  signatureEnabled: boolean;
};

export function VerificationPanel({ receiptReady, paymentState, signatureEnabled }: VerificationPanelProps) {
  return (
    <section className="verification-panel" aria-label="What is verified and trusted">
      <div>
        <span className="eyebrow">Verified</span>
        <ul className="check-list">
          <li className={receiptReady ? "active" : ""}>input hash matches prompt</li>
          <li className={receiptReady ? "active" : ""}>output hash matches result</li>
          <li className={receiptReady ? "active" : ""}>receipt hash matches receipt</li>
          <li className={signatureEnabled ? "active" : ""}>
            worker signature {signatureEnabled ? "checked" : "available when signing is enabled"}
          </li>
          <li className={paymentState === "paid" ? "active" : ""}>payment state: {paymentState}</li>
        </ul>
      </div>

      <div>
        <span className="eyebrow">Trusted in this MVP</span>
        <ul className="check-list muted-list">
          <li>worker actually used claimed GPU/model</li>
          <li>worker computed honestly</li>
          <li>backend coordinated the job correctly</li>
          <li>model output is semantically correct</li>
        </ul>
      </div>

      <div>
        <span className="eyebrow">Demo-only</span>
        <ul className="check-list muted-list">
          <li>real ENS is mocked</li>
          <li>real x402 is not implemented</li>
          <li>real USDC settlement is not implemented</li>
          <li>proof-of-compute is out of scope</li>
        </ul>
      </div>
    </section>
  );
}
