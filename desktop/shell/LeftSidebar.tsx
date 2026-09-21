import { ChevronLeft, ChevronRight, MoreHorizontal, Pin, PinOff } from "lucide-react";
import type { WorkspaceId } from "./types";
import { useShell } from "./ShellContext";
import { getNavItem } from "./workspace-registry";
import { CustomerNavSection } from "../customer-platform";

interface LeftSidebarProps {
  onPreferencesOpen: () => void;
  onNewProject?: () => void;
}

/**
 * Customer desktop sidebar — customer navigation only.
 * The admin surface is never listed here (id !== "admin" in customer nav).
 * Internal studio groups remain reachable via existing workspace routes / search,
 * but are not listed in the customer IA.
 */
export function LeftSidebar({ onPreferencesOpen, onNewProject }: LeftSidebarProps) {
  const {
    layout, switchWorkspace, setLayout, navigation, setNavigation, notify,
  } = useShell();

  const handleSelect = (id: WorkspaceId, action?: "navigate" | "modal") => {
    if (id === "admin") {
      window.location.assign("/admin/dashboard");
      return;
    }
    if (action === "modal" || id === "new-project") {
      onNewProject?.();
      switchWorkspace("new-project");
      return;
    }
    switchWorkspace(id);
  };

  const togglePin = () => {
    setNavigation((current) => ({ ...current, pinned: !current.pinned }));
    notify("info", navigation.pinned ? "Sidebar unpinned" : "Sidebar pinned", "Pin keeps the sidebar expanded across sessions.");
  };

  return (
    <aside
      className={`left-sidebar shell-left-sidebar customer-left-sidebar ${navigation.pinned ? "pinned" : ""}`}
      aria-label="Customer navigation"
      data-customer-sidebar="true"
    >
      <div className="sidebar-top">
        <span className="sidebar-caption">Navigation</span>
        <div className="sidebar-top-actions">
          <button
            className="icon-button"
            title={navigation.pinned ? "Unpin sidebar" : "Pin sidebar"}
            onClick={togglePin}
            aria-pressed={navigation.pinned}
          >
            {navigation.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          {!navigation.pinned && (
            <button
              className="sidebar-collapse icon-button"
              onClick={() => setLayout({ leftCollapsed: !layout.leftCollapsed })}
              title={layout.leftCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!layout.leftCollapsed}
            >
              {layout.leftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>
      </div>

      <nav className="nav-tree" tabIndex={0} aria-label="Customer pages">
        <CustomerNavSection
          onNavigate={(workspace) => handleSelect(workspace as WorkspaceId)}
          currentWorkspace={layout.workspace}
          collapsed={layout.leftCollapsed}
        />
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={onPreferencesOpen} aria-label="Desktop preferences">
          <MoreHorizontal size={18} />
          <span>Preferences</span>
        </button>
      </div>
    </aside>
  );
}

export function getActiveWorkspaceLabel(workspace: WorkspaceId): string {
  return getNavItem(workspace).label;
}
