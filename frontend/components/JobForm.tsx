"use client";

import { useState } from "react";

export function JobForm() {
  const [prompt, setPrompt] = useState("Summarize why privacy-preserving offchain inference matters.");
  const [modelId, setModelId] = useState("mock-llama");

  return (
    <div className="panel">
      <div className="kicker">Create Inference Job</div>
      <label className="field">
        Model
        <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
          <option value="mock-llama">mock-llama · worker catalog · ready</option>
          <option value="custom-solar-adapter">custom-solar-adapter · custom reference · preparation required</option>
        </select>
      </label>
      <label className="field">
        Prompt
        <textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      </label>
      <p className="muted">
        Prompt text stays offchain. The settlement metadata uses only input hash, output hash, receipt hash,
        worker identity, model metadata, price, and payment state.
      </p>
      <p className="muted">Selected model: {modelId}</p>
      <button className="button" type="button">Submit job placeholder</button>
    </div>
  );
}
