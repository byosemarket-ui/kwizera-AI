import { LayoutTemplate, MonitorCog, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { ReactNode } from "react";
import { useShell } from "./ShellContext";
import { getActiveWorkspaceLabel } from "./LeftSidebar";
import { panelEngine } from "./panel-engine";
import { Breadcrumb } from "./navigation/Breadcrumb";
import { QuickActionBar } from "./navigation/QuickActionBar";

interface ProductionWorkspaceProps {
  children: ReactNode;
  onOpenLayoutManager?: () => void;
}

export function ProductionWorkspace({ children, onOpenLayoutManager }: ProductionWorkspaceProps) {
  const { layout, setLayout, layoutManager } = useShell();
  const activeLabel = getActiveWorkspaceLabel(layout.workspace);
  const centerPanels = panelEngine.getPanelsInZone(layout, "center");
  const layoutName = layoutManager?.layouts.find((l) => l.id === layoutManager.activeLayoutId)?.name ?? "Default";

  return (
    <section className="workspace-area production-workspace">
      <div className="workspace-toolbar">
        <div>
          <Breadcrumb />
          <h1>{activeLabel}</h1>
        </div>
        <div className="workspace-controls">
          <button className="soft-button layout-engine-btn" onClick={onOpenLayoutManager} title="Layout manager (Ctrl+Shift+L)">
            <LayoutTemplate size={15} />
            {layoutName}
          </button>
          <button className="soft-button" onClick={() => setLayout({ zen: !layout.zen })}>
            <MonitorCog size={15} />
            {layout.zen ? "Exit focus" : "Focus mode"}
          </button>
          <button className="icon-button" onClick={() => setLayout({ rightOpen: !layout.rightOpen })} title="Toggle AI panel">
            {layout.rightOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
        </div>
      </div>

      <QuickActionBar />

      <div className="production-canvas">
        <div className="production-main-panel" data-panel-id="production-main">
          {children}
        </div>
      </div>

      <div className="panel-engine-meta" aria-hidden="true">
        {centerPanels.length} active center panel{centerPanels.length !== 1 ? "s" : ""}
      </div>
    </section>
  );
}

interface PlaceholderWorkspaceProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export function PlaceholderWorkspace({ title, description, icon }: PlaceholderWorkspaceProps) {
  return (
    <section className="empty-workspace module-placeholder">
      <div className="empty-icon">{icon}</div>
      <span>Layout engine ready</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
