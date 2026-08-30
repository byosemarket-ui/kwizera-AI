/** Compact 5-step product video workflow progress indicator. */

const STEPS = [
  { n: 1, label: "Product Setup" },
  { n: 2, label: "Video Settings" },
  { n: 3, label: "Video Style" },
  { n: 4, label: "Final Review" },
  { n: 5, label: "Production" },
] as const;

export interface WorkflowProgressProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  projectName?: string;
}

export function WorkflowProgress({ currentStep, projectName }: WorkflowProgressProps) {
  return (
    <header className="kw-workflow-progress" aria-label="Product video workflow">
      <div className="kw-workflow-progress__top">
        <span className="kw-workflow-progress__step-label">
          STEP {currentStep} OF 5 · {STEPS[currentStep - 1]?.label.toUpperCase()}
        </span>
        {projectName ? (
          <span className="kw-workflow-progress__project" title={projectName}>
            {projectName}
          </span>
        ) : null}
      </div>
      <ol className="kw-workflow-progress__track" aria-hidden="true">
        {STEPS.map((step) => {
          const done = step.n < currentStep;
          const active = step.n === currentStep;
          return (
            <li
              key={step.n}
              className={[
                "kw-workflow-progress__node",
                done ? "is-done" : "",
                active ? "is-active" : "",
              ].filter(Boolean).join(" ")}
            >
              <span className="kw-workflow-progress__dot" />
              {step.n < STEPS.length ? <span className="kw-workflow-progress__line" /> : null}
            </li>
          );
        })}
      </ol>
      <div className="kw-workflow-progress__labels">
        {STEPS.map((step) => (
          <span
            key={step.n}
            className={step.n === currentStep ? "is-active" : step.n < currentStep ? "is-done" : ""}
          >
            {step.label}
          </span>
        ))}
      </div>
    </header>
  );
}
