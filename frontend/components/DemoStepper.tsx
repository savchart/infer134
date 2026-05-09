type DemoStepperProps = {
  steps: string[];
  currentStep: number;
  completedSteps: Set<number>;
  isComplete: boolean;
};

export function DemoStepper({ steps, currentStep, completedSteps, isComplete }: DemoStepperProps) {
  return (
    <aside className="demo-stepper" aria-label="Infer134 buyer journey">
      <div className="stepper-heading">
        <span className="eyebrow">Buyer journey</span>
        <strong>8-step MVP path</strong>
      </div>
      <ol>
        {steps.map((step, index) => {
          const done = completedSteps.has(index) || (isComplete && index <= currentStep);
          const current = index === currentStep && !isComplete;
          const status = done ? "done" : current ? "current" : "pending";
          return (
            <li className={`stepper-item ${status}`} key={step}>
              <span className="stepper-index">{index + 1}</span>
              <span>
                <strong>{step}</strong>
                <em>{status}</em>
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
