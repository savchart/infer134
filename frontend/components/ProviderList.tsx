const workers = [
  {
    name: "gpu-prague.eth",
    model: "mock-llama",
    hardware: "simulated/local worker",
    price: "0.01 USDC",
    status: "available",
    models: ["mock-llama · worker_catalog · ready", "custom references · accepted for preparation"]
  }
];

export function ProviderList() {
  return (
    <div className="panel">
      <div className="kicker">Workers</div>
      <div className="stack">
        {workers.map((worker) => (
          <div key={worker.name}>
            <strong>{worker.name}</strong>
            <p className="muted">
              {worker.model} · {worker.hardware} · {worker.price}
            </p>
            <p className="muted">Models: {worker.models.join(" | ")}</p>
            <span className="badge">{worker.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
