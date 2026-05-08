"use client";

import { useState } from "react";

export function JobForm() {
  const [prompt, setPrompt] = useState("Summarize why privacy-preserving offchain inference matters.");

  return (
    <div className="panel">
      <div className="kicker">Create Inference Job</div>
      <label className="field">
        Prompt
        <textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      </label>
      <p className="muted">
        Prompt text stays offchain. The settlement metadata uses only input hash, output hash, receipt hash,
        worker identity, price, and payment state.
      </p>
      <button className="button" type="button">Submit job placeholder</button>
    </div>
  );
}

