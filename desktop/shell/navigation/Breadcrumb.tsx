import { ChevronRight, Home } from "lucide-react";
import { useShell } from "../ShellContext";
import { navigationEngine } from "./navigation-engine";

export function Breadcrumb() {
  const { layout, core, switchWorkspace } = useShell();
  const segments = navigationEngine.buildBreadcrumb(layout.workspace, core?.activeProject);

  return (
    <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={`${segment.id}-${index}`} className="breadcrumb-segment">
            {index === 0 && <Home size={12} className="breadcrumb-home-icon" />}
            {segment.workspace && !isLast ? (
              <button type="button" onClick={() => switchWorkspace(segment.workspace!)}>
                {segment.label}
              </button>
            ) : (
              <span className={isLast ? "current" : ""}>{segment.label}</span>
            )}
            {!isLast && <ChevronRight size={12} className="breadcrumb-sep" />}
          </span>
        );
      })}
    </nav>
  );
}
