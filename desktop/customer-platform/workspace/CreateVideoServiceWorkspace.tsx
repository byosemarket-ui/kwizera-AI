import { useShell } from "../../shell/ShellContext";
import { ProductSetupWorkspace } from "../../product-setup/ProductSetupWorkspace";
import { ServiceWorkspace } from "./ServiceWorkspace";
import { VIDEO_SERVICE_STEPS } from "./types";

/**
 * Customer Create Video workspace.
 * Reuses Product Setup → Video Requirements → Style → Final Review engines.
 * Does not rebuild low-level video production or encoding pipelines.
 */
export function CreateVideoServiceWorkspace() {
  const { switchWorkspace } = useShell();

  return (
    <ServiceWorkspace
      meta={{
        serviceKey: "create-video",
        title: "Create Video",
        description: "Add your photos, then create a professional video with KWIZERA AI STUDIO.",
        helpHint: "Upload product photos to begin. You can save and return anytime.",
      }}
      steps={VIDEO_SERVICE_STEPS}
      currentStepId="upload"
      phase="input"
      onBack={() => switchWorkspace("home")}
      onHelp={() => switchWorkspace("help")}
      onCancel={() => switchWorkspace("home")}
      cancelLabel="Back to Home"
      footerNote="Your project saves through the studio project system."
    >
      <div className="cp-sw-engine" data-engine="product-setup">
        <ProductSetupWorkspace customerMode />
      </div>
    </ServiceWorkspace>
  );
}
