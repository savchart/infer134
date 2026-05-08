const states = [
  "payment required",
  "payment accepted as escrowed",
  "worker claimed job",
  "inference running",
  "receipt returned",
  "payment released"
];

export function StatusTimeline() {
  return (
    <div className="panel">
      <div className="kicker">Payment and Work State</div>
      <ol className="timeline">
        {states.map((state) => (
          <li key={state}>{state}</li>
        ))}
      </ol>
    </div>
  );
}

