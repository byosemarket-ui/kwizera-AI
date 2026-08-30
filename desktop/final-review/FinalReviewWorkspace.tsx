import { WorkflowProgress } from "../product-creation/WorkflowProgress";
import { useShell } from "../shell/ShellContext";
import { readScopedHandoff } from "../product-creation/workflow";
import { STEP4_HANDOFF_KEY, type Step4HandoffPayload } from "../video-style/types";
import "../video-style/video-style.css";

/** STEP 4 — Final Video Review (consumes STEP 3 handoff) */
export function FinalReviewWorkspace() {
  const { switchWorkspace } = useShell();
  const handoff = readScopedHandoff<Step4HandoffPayload>(STEP4_HANDOFF_KEY);

  return (
    <div className="vs-page">
      <WorkflowProgress currentStep={4} projectName={handoff?.projectName} />
      <div className="vr-intro">
        <span className="kw-workflow-progress__step-label">STEP 4 OF 5 · FINAL VIDEO REVIEW</span>
        <h1>Final Video Review</h1>
        <p>Review your production plan before rendering. Product, commercial, and scene data flow automatically from earlier steps.</p>
      </div>
      {handoff ? (
        <section className="vr-section">
          <h2>Production Plan Ready</h2>
          <ul>
            <li>Plan ID: {handoff.planId.slice(0, 8)}…</li>
            <li>Product ID: {handoff.productId.slice(0, 8)}…</li>
            <li>Scenes: {handoff.sceneCount}</li>
            <li>Mode: {handoff.productionMode.replace(/_/g, " ")}</li>
            <li>Platform: {handoff.platformId.replace(/_/g, " ")}</li>
            <li>Duration: {handoff.durationSeconds}s</li>
          </ul>
          <div className="vr-duration-row">
            <button type="button" className="vr-chip" onClick={() => switchWorkspace("video-style")}>
              ← Back to Step 3
            </button>
            <button type="button" className="vr-chip" onClick={() => switchWorkspace("generated-videos")}>
              Open Video Production →
            </button>
          </div>
        </section>
      ) : (
        <section className="vr-section">
          <p>Complete Video Style &amp; Production Plan (Step 3) first.</p>
          <button type="button" className="vr-chip" onClick={() => switchWorkspace("video-style")}>
            Go to Step 3
          </button>
        </section>
      )}
    </div>
  );
}
