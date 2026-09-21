import { useEffect, useState } from "react";
import {
  Bell, Command, Menu, Search, Settings, Sparkles, X,
} from "lucide-react";
import { useShell } from "./ShellContext";
import { getNavItem } from "./workspace-registry";
import { resolveActiveProjectName } from "./project-context";

interface WorkspaceHeaderProps {
  onSearchOpen: () => void;
  onPreferencesOpen: () => void;
  onNotificationsToggle: () => void;
  notificationsOpen: boolean;
  customerNavOpen?: boolean;
  onCustomerNavToggle?: () => void;
}

/**
 * Customer-facing header.
 * Internal model/queue diagnostics stay out of this surface.
 */
export function WorkspaceHeader({
  onSearchOpen,
  onPreferencesOpen,
  onNotificationsToggle,
  notificationsOpen,
  customerNavOpen = false,
  onCustomerNavToggle,
}: WorkspaceHeaderProps) {
  const { notifications, layout, switchWorkspace, core } = useShell();
  const workspaceLabel = getNavItem(layout.workspace).label;
  const unread = notifications.filter((n) => !n.read).length;
  const projectName = resolveActiveProjectName(core?.activeProject);

  return (
    <header className="topbar workspace-header nav-engine-header customer-header" role="banner" data-customer-header="true">
      {onCustomerNavToggle ? (
        <button
          type="button"
          className="cp-mobile-nav-toggle"
          aria-label={customerNavOpen ? "Close customer navigation" : "Open customer navigation"}
          aria-expanded={customerNavOpen}
          aria-controls="customer-mobile-nav"
          onClick={onCustomerNavToggle}
        >
          {customerNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      ) : null}
      <button
        type="button"
        className="brand"
        aria-label="KWIZERA AI Studio home"
        onClick={() => switchWorkspace("home")}
      >
        <span className="brand-mark"><Sparkles size={17} /></span>
        <span>KWIZERA</span>
        <em>AI STUDIO</em>
      </button>

      <div className="header-workspace-name" title="Current workspace">
        <span className="header-meta-label">Workspace</span>
        <strong>{workspaceLabel}</strong>
      </div>

      <div className="header-project-block">
        <div className="project-switcher">
          <span className="project-dot" />
          <span className="project-name">{projectName ?? "No project"}</span>
        </div>
      </div>

      <button className="global-search" onClick={onSearchOpen} aria-label="Search services and projects">
        <Search size={16} />
        <span>Search services and projects…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <HeaderClock />

      <div className="top-actions">
        <button className="icon-button" title="Quick commands" aria-label="Quick commands" onClick={onSearchOpen}>
          <Command size={17} />
        </button>
        <button
          className={`icon-button notification ${notificationsOpen ? "active" : ""}`}
          title="Notifications"
          aria-label="Notifications"
          onClick={onNotificationsToggle}
          aria-expanded={notificationsOpen}
        >
          <Bell size={17} />
          {unread > 0 && <i />}
        </button>
        <button className="avatar" title="Account" aria-label="Account menu">KA</button>
        <button className="icon-button" title="Settings" aria-label="Settings" onClick={onPreferencesOpen}>
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}

function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <time className="header-clock" dateTime={now.toISOString()}>
      <span>{now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
      <b>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>
    </time>
  );
}
