import { useEffect, useState } from "react";
import {
  Bell, Menu, Search, Settings, Sparkles, X,
} from "lucide-react";
import { useShell } from "./ShellContext";
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
 * Customer-facing header — brand, search, notifications, account.
 * Internal diagnostics stay out of this surface.
 */
export function WorkspaceHeader({
  onSearchOpen,
  onPreferencesOpen,
  onNotificationsToggle,
  notificationsOpen,
  customerNavOpen = false,
  onCustomerNavToggle,
}: WorkspaceHeaderProps) {
  const { notifications, switchWorkspace, core } = useShell();
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

      <div className="header-project-block" title={projectName ? `Project: ${projectName}` : "No project selected"}>
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

      <div className="top-actions">
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

// Keep export for any residual imports; not rendered in customer header.
export { HeaderClock };
