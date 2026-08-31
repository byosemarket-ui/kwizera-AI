import { useEffect, useState } from "react";
import {
  Bell, Bot, Cloud, CloudOff, Command, Cpu, HardDrive, RefreshCw, Search, Settings, Sparkles, WifiOff,
} from "lucide-react";
import type { ProjectStatus } from "./types";
import { useShell } from "./ShellContext";
import { getNavItem } from "./workspace-registry";
import { navigationEngine } from "./navigation/navigation-engine";
import { resolveActiveProjectName } from "./project-context";

const statusLabels: Record<ProjectStatus, string> = {
  idle: "No active project",
  draft: "Draft",
  "in-production": "In Production",
  review: "In Review",
  complete: "Complete",
};

interface WorkspaceHeaderProps {
  onSearchOpen: () => void;
  onPreferencesOpen: () => void;
  onNotificationsToggle: () => void;
  notificationsOpen: boolean;
}

export function WorkspaceHeader({
  onSearchOpen,
  onPreferencesOpen,
  onNotificationsToggle,
  notificationsOpen,
}: WorkspaceHeaderProps) {
  const { core, saveState, autoSave, notifications, layout, projectStatus, performanceSnapshot, switchWorkspace } = useShell();
  const workspaceLabel = getNavItem(layout.workspace).label;
  const status = navigationEngine.buildWorkspaceStatus(core, projectStatus, layout.zen);
  const unread = notifications.filter((n) => !n.read).length;
  const fps = performanceSnapshot?.metrics.fps;
  const ram = performanceSnapshot?.metrics.ramUsage ?? core?.runtimeMetrics?.ramUsage;
  const projectName = resolveActiveProjectName(core?.activeProject);
  const gatewayReachable = core != null;

  return (
    <header className="topbar workspace-header nav-engine-header" role="banner">
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
        <span className="project-status-badge">{statusLabels[projectStatus]}</span>
      </div>

      <button className="global-search" onClick={onSearchOpen} aria-label="Global search">
        <Search size={16} />
        <span>Search projects, assets, knowledge…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="header-status-cluster" aria-label="Workspace status">
        <StatusChip icon={<Bot size={12} />} label="AI" value={status.ai} online={core?.aiCore} />
        <StatusChip icon={<RefreshCw size={12} />} label="Mode" value={status.mode} />
        <StatusChip icon={<Cpu size={12} />} label="Prod" value={status.production} online={projectStatus === "in-production"} />
        <StatusChip
          icon={gatewayReachable ? <Cloud size={12} /> : <WifiOff size={12} />}
          label="Net"
          value={gatewayReachable ? "Local" : "Unreachable"}
          online={gatewayReachable}
        />
        <StatusChip icon={<HardDrive size={12} />} label="HW" value={
          fps != null
            ? `${fps}fps · ${ram ?? core?.runtimeMetrics?.memoryMb ?? "—"}%`
            : core?.runtimeMetrics
              ? `${core.runtimeMetrics.memoryMb}MB`
              : "Local"
        } />
      </div>

      <SaveIndicator state={saveState} autoSave={autoSave} />
      <HeaderClock />

      <div className="top-actions">
        <button className="icon-button" title="Quick commands" onClick={onSearchOpen}>
          <Command size={17} />
        </button>
        <button
          className={`icon-button notification ${notificationsOpen ? "active" : ""}`}
          title="Notification center"
          onClick={onNotificationsToggle}
          aria-expanded={notificationsOpen}
        >
          <Bell size={17} />
          {unread > 0 && <i />}
        </button>
        <div className={`ai-pill ${core?.aiCore ? "online" : ""}`}>
          <span />
          AI {core?.aiCore ? "Ready" : "Offline"}
        </div>
        <button className="avatar" title="User menu" aria-label="User menu">KA</button>
        <button className="icon-button" title="Settings" onClick={onPreferencesOpen}>
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}

function StatusChip({ icon, label, value, online }: { icon: React.ReactNode; label: string; value: string; online?: boolean }) {
  return (
    <div className={`status-chip ${online ? "online" : ""}`} title={`${label}: ${value}`}>
      {icon}
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function SaveIndicator({ state, autoSave }: { state: string; autoSave: boolean }) {
  const labels: Record<string, { icon: typeof Cloud; text: string; className: string }> = {
    saved: { icon: Cloud, text: "Saved", className: "save-saved" },
    saving: { icon: Cloud, text: "Saving…", className: "save-saving" },
    unsaved: { icon: CloudOff, text: "Unsaved", className: "save-unsaved" },
    error: { icon: CloudOff, text: "Save error", className: "save-error" },
  };
  const entry = labels[state] ?? labels.saved;
  const Icon = entry.icon;
  return (
    <div className={`save-indicator ${entry.className}`} title={`Save: ${entry.text}${autoSave ? " · Auto-save on" : ""}`}>
      <Icon size={14} />
      <span>{entry.text}</span>
      {autoSave && <em className="auto-save-badge">Auto</em>}
    </div>
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
