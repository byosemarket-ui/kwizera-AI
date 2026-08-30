import { WorkflowProgress } from "../product-creation/WorkflowProgress";
import { useShell } from "../shell/ShellContext";
import { readScopedHandoff } from "../product-creation/workflow";
import { STEP3_HANDOFF_KEY, type Step3HandoffPayload } from "../video-requirements/types";
import "../video-requirements/video-requirements.css";

/** STEP 3 placeholder — Video Style & Production Review */
export function VideoStyleWorkspace() {
  const { switchWorkspace } = useShell();
  const handoff = readScopedHandoff<Step3HandoffPayload>(STEP3_HANDOFF_KEY);

  return (
    <div className="vr-page">
      <WorkflowProgress currentStep={3} projectName={handoff?.projectName} />
      <div className="vr-intro">
        <span className="kw-workflow-progress__step-label">STEP 3 OF 5 · VIDEO STYLE &amp; PRODUCTION REVIEW</span>
        <h1>Video Style &amp; Production Review</h1>
        <p>
          Your marketing brief is saved. Step 3 will review video style and production planning automatically.
          This step is not yet fully implemented.
        </p>
      </div>
      {handoff && (
        <section className="vr-section">
          <h2>Brief Ready</h2>
          <ul>
            <li>Product ID: {handoff.productId.slice(0, 8)}…</li>
            <li>Assets: {handoff.assetIds.length} original image{handoff.assetIds.length === 1 ? "" : "s"}</li>
            <li>Platform: {handoff.platformId.replace(/_/g, " ")}</li>
            <li>Duration: {handoff.durationSeconds}s</li>
            <li>Objective: {handoff.objective}</li>
            <li>Language: {handoff.language}</li>
          </ul>
        </section>
      )}
      <section className="vr-section">
        <div className="vr-duration-row">
          <button type="button" className="vr-chip" onClick={() => switchWorkspace("video-requirements")}>
            ← Back to Step 2
          </button>
          <button type="button" className="vr-chip" onClick={() => switchWorkspace("storyboard")}>
            Open Creative Planner
          </button>
          <button type="button" className="vr-chip" onClick={() => switchWorkspace("generated-videos")}>
            Open Video Production
          </button>
        </div>
      </section>
    </div>
  );
}
