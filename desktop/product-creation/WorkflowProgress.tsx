/** Compact 3-phase product video workflow progress indicator. */

const MACRO_STEPS = [
  { n: 1, label: "Product" },
  { n: 2, label: "Video Plan" },
  { n: 3, label: "Generate" },
] as const;

export type WorkflowInternalStep = 1 | 2 | 3 | 4 | 5;

export interface WorkflowProgressProps {
  /** Internal workspace step (1=Product Setup … 5=Production). Mapped to 3 user-facing phases. */
  currentStep: WorkflowInternalStep;
  projectName?: string;
}

function macroPhase(step: WorkflowInternalStep): 1 | 2 | 3 {
  if (step <= 1) return 1;
  if (step === 2) return 2;
  return 3;
}

const PHASE_LABELS: Record<1 | 2 | 3, string> = {
  1: "PRODUCT",
  2: "VIDEO PLAN",
  3: "GENERATE & FINISH",
};

export function WorkflowProgress({ currentStep, projectName }: WorkflowProgressProps) {
  const phase = macroPhase(currentStep);

  return (
    <header className="kw-workflow-progress" aria-label="Product video workflow">
      <div className="kw-workflow-progress__top">
        <span className="kw-workflow-progress__step-label">
          STEP {phase} OF 3 · {PHASE_LABELS[phase]}
        </span>
        {projectName ? (
          <span className="kw-workflow-progress__project" title={projectName}>
            {projectName}
          </span>
        ) : null}
      </div>
      <ol className="kw-workflow-progress__track" aria-hidden="true">
        {MACRO_STEPS.map((step) => {
          const done = step.n < phase;
          const active = step.n === phase;
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
              {step.n < MACRO_STEPS.length ? <span className="kw-workflow-progress__line" /> : null}
            </li>
          );
        })}
      </ol>
      <div className="kw-workflow-progress__labels">
        {MACRO_STEPS.map((step) => (
          <span
            key={step.n}
            className={step.n === phase ? "is-active" : step.n < phase ? "is-done" : ""}
          >
            {step.label}
          </span>
        ))}
      </div>
    </header>
  );
}
