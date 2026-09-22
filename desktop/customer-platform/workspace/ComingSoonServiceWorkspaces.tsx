import { useShell } from "../../shell/ShellContext";
import { StatusBadge } from "../components/ui";
import { ServiceWorkspace } from "./ServiceWorkspace";
import { AUDIO_SERVICE_STEPS, AUDIO_TYPE_CATALOG, DESIGN_SERVICE_STEPS, DESIGN_TYPE_CATALOG } from "./types";

function ComingSoonCatalog({
  items,
  heading,
}: {
  items: readonly string[];
  heading: string;
}) {
  return (
    <div className="cp-sw-coming-panel">
      <StatusBadge status="COMING_SOON" />
      <h2 className="cp-section-title">{heading}</h2>
      <p className="cp-body">
        This workspace is ready for future tools. Nothing here generates fake results — each type will plug into the shared service workspace when implemented.
      </p>
      <ul className="cp-sw-soon-grid" role="list">
        {items.map((item) => (
          <li key={item} role="listitem" className="cp-sw-soon-card">
            <strong className="cp-card-title">{item}</strong>
            <StatusBadge status="COMING_SOON" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DesignStudioServiceWorkspace() {
  const { switchWorkspace } = useShell();
  return (
    <ServiceWorkspace
      meta={{
        serviceKey: "design-studio",
        title: "Design Studio",
        description: "Create flyers, posters, banners and more. Design engines are coming soon.",
      }}
      steps={DESIGN_SERVICE_STEPS}
      currentStepId="choose"
      phase="input"
      onBack={() => switchWorkspace("home")}
      onHelp={() => switchWorkspace("help")}
      onCancel={() => switchWorkspace("home")}
      cancelLabel="Back to Home"
    >
      <ComingSoonCatalog heading="Choose a design type" items={DESIGN_TYPE_CATALOG} />
    </ServiceWorkspace>
  );
}

export function AudioServiceWorkspace() {
  const { switchWorkspace } = useShell();
  return (
    <ServiceWorkspace
      meta={{
        serviceKey: "audio",
        title: "Audio",
        description: "Music, voice, and speech tools. Audio creation engines are coming soon.",
      }}
      steps={AUDIO_SERVICE_STEPS}
      currentStepId="choose"
      phase="input"
      onBack={() => switchWorkspace("home")}
      onHelp={() => switchWorkspace("help")}
      onCancel={() => switchWorkspace("home")}
      cancelLabel="Back to Home"
    >
      <ComingSoonCatalog heading="Choose an audio tool" items={AUDIO_TYPE_CATALOG} />
    </ServiceWorkspace>
  );
}
