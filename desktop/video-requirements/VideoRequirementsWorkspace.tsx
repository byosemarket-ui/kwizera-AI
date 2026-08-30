import { WorkflowProgress } from "../product-creation/WorkflowProgress";
import { useShell } from "../shell/ShellContext";
import "../product-setup/product-setup.css";

/** STEP 2 placeholder — Video Requirements (full implementation in a future task). */
export function VideoRequirementsWorkspace() {
  const { switchWorkspace } = useShell();

  return (
    <div className="product-setup">
      <WorkflowProgress currentStep={2} />
      <div className="product-setup__intro">
        <span className="kw-workflow-progress__step-label">STEP 2 OF 5 · VIDEO REQUIREMENTS</span>
        <h1>Video Requirements</h1>
        <p>
          This step will capture platform, duration, style, and marketing objective for your product video.
          It is not yet implemented — your Step 1 product data has been saved and is ready.
        </p>
      </div>
      <section className="product-setup__section product-setup__summary">
        <p>Step 1 product setup is complete. Continue with legacy marketing and video production workspaces from the sidebar, or return to refine your product setup.</p>
        <div className="product-setup__drop-actions" style={{ marginTop: 16, justifyContent: "flex-start" }}>
          <button type="button" onClick={() => switchWorkspace("new-project")}>← Back to Product Setup</button>
          <button type="button" onClick={() => switchWorkspace("marketing")}>Open Marketing Input</button>
          <button type="button" onClick={() => switchWorkspace("generated-videos")}>Open Video Production</button>
        </div>
      </section>
    </div>
  );
}
