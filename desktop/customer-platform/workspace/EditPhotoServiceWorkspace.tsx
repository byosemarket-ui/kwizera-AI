import { useShell } from "../../shell/ShellContext";
import { VisualAnalysisWorkspace } from "../../visual-analysis/VisualAnalysisWorkspace";
import { ServiceWorkspace } from "./ServiceWorkspace";
import { IMAGE_SERVICE_STEPS } from "./types";

/**
 * Customer Edit Photo workspace.
 * Reuses existing visual analysis / image intelligence — no duplicate image pipeline.
 */
export function EditPhotoServiceWorkspace() {
  const { switchWorkspace } = useShell();

  return (
    <ServiceWorkspace
      meta={{
        serviceKey: "edit-photo",
        title: "Edit Photo",
        description: "Enhance, edit and prepare your photos with the studio image tools.",
      }}
      steps={IMAGE_SERVICE_STEPS}
      currentStepId="edit"
      phase="input"
      onBack={() => switchWorkspace("home")}
      onHelp={() => switchWorkspace("help")}
      onCancel={() => switchWorkspace("home")}
      cancelLabel="Back to Home"
      footerNote="Edits use your existing project assets."
    >
      <div className="cp-sw-engine" data-engine="visual-analysis">
        <VisualAnalysisWorkspace />
      </div>
    </ServiceWorkspace>
  );
}
