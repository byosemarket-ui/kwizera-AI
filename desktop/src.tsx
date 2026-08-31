import { useCallback, useEffect, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  ChevronRight, Command, Contrast, Download, MonitorCog, Palette, PanelsTopLeft,
  RotateCcw, Settings, Upload, X, AlertTriangle,
} from "lucide-react";
import { DesktopNotificationManager, DesktopPreferenceManager } from "./desktop-polish/preference-store";
import { workspaceProfiles } from "./desktop-polish/profiles";
import type { DesktopNotification, DesktopPreferences, StartupMode, WorkspaceProfileId } from "./desktop-polish/types";
import { AppShell } from "./shell/AppShell";
import { ShellWorkspaceContent } from "./shell/ShellWorkspaceContent";
import type { CoreStatus, ShellLayoutState } from "./shell/types";
import { workspaceStateEngine } from "./shell/workspace-state/workspace-state-engine";
import { personalizationEngine } from "./shell/personalization/personalization-engine";
import { uxEngine } from "./shell/ux/ux-engine";
import { navigationStore } from "./shell/navigation/navigation-store";
import { buildAiMeWorkspaceContext, serializeAiMeContext } from "./shell/aime-awareness";
import { NotificationCenter } from "./shell/navigation/NotificationCenter";
import { mapLegacyWorkspace } from "./shell/workspace-registry";
import { installBootstrapRecovery } from "./shell/bootstrap-recovery";
import { resetPersistedNavigationInStorage } from "./shell/startup-navigation";
import "./desktop-polish/desktop-polish.css";
import "./workspace.css";
import "./shell/shell.css";

const preferenceManager = new DesktopPreferenceManager();
const notificationManager = new DesktopNotificationManager();

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[KWIZERA] Root render failed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="startup-recovery-panel" style={{ minHeight: "100vh", margin: 0, borderRadius: 0 }}>
          <AlertTriangle size={32} />
          <h2>KWIZERA AI STUDIO — recovery</h2>
          <p>{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => {
              resetPersistedNavigationInStorage();
              window.location.reload();
            }}
          >
            Reload application
          </button>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [preferences, setPreferences] = useState<DesktopPreferences>(() => preferenceManager.load());
  const [core, setCore] = useState<CoreStatus | null>(null);
  const [layoutSnapshot, setLayoutSnapshot] = useState<ShellLayoutState | null>(null);
  const [restoredLayout, setRestoredLayout] = useState<ShellLayoutState | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [notifications, setNotifications] = useState<DesktopNotification[]>(() => notificationManager.load());

  useEffect(() => {
    preferenceManager.save(preferences);
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.accent = preferences.accent;
    document.documentElement.dataset.density = preferences.uiDensity ?? "comfortable";
    document.documentElement.classList.toggle("high-contrast", preferences.highContrast);
    document.documentElement.classList.toggle("reduce-motion", preferences.reducedMotion);
    document.documentElement.style.setProperty("--desktop-scale", String(preferences.uiScale / 100));
    document.documentElement.style.setProperty("--desktop-font-scale", String(preferences.fontScale / 100));
  }, [preferences]);

  useEffect(() => { notificationManager.save(notifications); }, [notifications]);

  useEffect(() => {
    const updateWindow = () => setPreferences((current) => ({
      ...current,
      window: { width: window.innerWidth, height: window.innerHeight, x: window.screenX, y: window.screenY },
    }));
    updateWindow();
    window.addEventListener("resize", updateWindow);
    return () => window.removeEventListener("resize", updateWindow);
  }, []);

  useEffect(() => {
    const update = () => fetch("/api/desktop-workspace/status")
      .then((response) => (response.ok ? response.json() : null))
      .then(setCore)
      .catch(() => setCore(null));
    update();
    const timer = window.setInterval(update, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        setPreferencesOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setPreferencesOpen(false);
        setNotificationsOpen(false);
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const notify = useCallback(
    (tone: DesktopNotification["tone"], title: string, detail: string, category?: DesktopNotification["category"]) => {
      const item = notificationManager.create(tone, title, detail, category);
      if (!notificationManager.isCategoryEnabled(preferenceManager.load(), item.category)) return;
      setNotifications((current) => [item, ...current]);
    },
    [],
  );

  const switchProfile = (profileId: WorkspaceProfileId) => {
    const profile = workspaceProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    const workspace = mapLegacyWorkspace(profile.workspace);
    setPreferences((current) => ({
      ...current,
      activeProfile: profileId,
      lastWorkspace: workspace,
      defaultLayoutId: profile.layoutId ?? current.defaultLayoutId,
    }));
    window.dispatchEvent(new CustomEvent("kwizera:navigate-workspace", { detail: { workspace } }));
    notify("info", `${profile.label} applied`, profile.detail, "updates");
  };

  const restoreDesktop = async () => {
    const confirmed = await uxEngine.confirm(
      "restore-workspace",
      "Restore workspace snapshot?",
      "This replaces the current layout and preferences with the last valid snapshot. Production jobs are not cancelled.",
    );
    if (!confirmed) {
      notify("info", "Restore cancelled", "Workspace left unchanged.", "information");
      return;
    }
    const report = workspaceStateEngine.rollbackTo(
      workspaceStateEngine.loadLatestSnapshot()?.id ?? "",
    );
    if (report.restored) {
      const snap = workspaceStateEngine.loadLatestSnapshot();
      if (snap) {
        setPreferences(snap.preferences);
        setRestoredLayout({ ...snap.shell, workspace: "home" });
        setLayoutSnapshot({ ...snap.shell, workspace: "home" });
      }
      notify("success", "Workspace restored", report.explanation, "production-complete");
      return;
    }
    const backup = preferenceManager.restore<{ layout: ShellLayoutState; preferences: DesktopPreferences }>();
    if (backup) {
      setPreferences(backup.preferences);
      setRestoredLayout({ ...backup.layout, workspace: "home" });
      setLayoutSnapshot({ ...backup.layout, workspace: "home" });
      notify("success", "Workspace restored", "Legacy desktop snapshot has been applied.", "production-complete");
    } else {
      notify("warning", "Nothing to restore", "No valid workspace snapshot is available.", "warnings");
    }
  };

  const exportProfile = () => {
    const pkg = personalizationEngine.exportProfile("Exported Profile", preferences, navigationStore.load());
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kwizera-profile-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", "Profile exported", `Saved “${pkg.label}” as a local preference package.`, "updates");
  };

  const importProfileFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const confirmed = await uxEngine.confirm(
            "restore-workspace",
            "Import preference profile?",
            "Importing this profile will overwrite current preferences. A backup is created first.",
          );
          if (!confirmed) {
            notify("info", "Import cancelled", "Preferences were not changed.", "information");
            return;
          }
          personalizationEngine.backupCurrent(preferences, navigationStore.load());
          const imported = personalizationEngine.importProfileInto(raw, true, navigationStore.load());
          if (!imported.result.ok || !imported.preferences) {
            notify("error", "Import failed", imported.result.errors.join("; ") || imported.result.explanation, "errors");
            return;
          }
          setPreferences(imported.preferences);
          if (imported.navigation) navigationStore.save(imported.navigation);
          notify("success", "Profile imported", imported.result.explanation, "production-complete");
        } catch {
          notify("error", "Import failed", "Could not parse preference profile file.", "errors");
        }
      })();
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <AppShell
          preferences={preferences}
          setPreferences={setPreferences}
          core={core}
          notifications={notifications}
          setNotifications={setNotifications}
          notify={notify}
          onPreferencesOpen={() => setPreferencesOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
          onSearchClose={() => setSearchOpen(false)}
          searchOpen={searchOpen}
          onNotificationsToggle={() => setNotificationsOpen(!notificationsOpen)}
          notificationsOpen={notificationsOpen}
          onNewProject={() => undefined}
          onLayoutChange={setLayoutSnapshot}
          restoredLayout={restoredLayout}
        >
          <ShellWorkspaceContent core={core} />
        </AppShell>
      </div>

      {preferencesOpen && (
        <DesktopPreferencesPanel
          preferences={preferences}
          onChange={setPreferences}
          onProfile={switchProfile}
          onRestore={restoreDesktop}
          onExportProfile={exportProfile}
          onImportProfile={importProfileFromFile}
          onBackupProfile={() => {
            const pkg = personalizationEngine.backupCurrent(preferences, navigationStore.load());
            notify("success", "Backup profile saved", `Stored “${pkg.label}” locally.`, "updates");
          }}
          onClose={() => setPreferencesOpen(false)}
        />
      )}
      {notificationsOpen && (
        <NotificationCenter
          notifications={notifications}
          onClear={() => setNotifications([])}
          onClose={() => setNotificationsOpen(false)}
          onMarkRead={(id) => setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))}
        />
      )}
      {contextMenu && (
        <DesktopContextMenu
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onPreferences={() => { setContextMenu(null); setPreferencesOpen(true); }}
          onSearch={() => { setContextMenu(null); setSearchOpen(true); }}
        />
      )}
    </>
  );
}

function DesktopPreferencesPanel({ preferences, onChange, onProfile, onRestore, onExportProfile, onImportProfile, onBackupProfile, onClose }: {
  preferences: DesktopPreferences;
  onChange: (preferences: DesktopPreferences) => void;
  onProfile: (profile: WorkspaceProfileId) => void;
  onRestore: () => void;
  onExportProfile: () => void;
  onImportProfile: (file: File) => void;
  onBackupProfile: () => void;
  onClose: () => void;
}) {
  const update = (changes: Partial<DesktopPreferences>) => onChange({ ...preferences, ...changes });
  return (
    <div className="desktop-modal-backdrop" onMouseDown={onClose}>
      <section className="desktop-preferences" onMouseDown={(event) => event.stopPropagation()} aria-label="Desktop preferences">
        <header>
          <div><span>DESKTOP PERSONALIZATION</span><h2>Workspace preferences</h2></div>
          <button onClick={onClose} title="Close preferences"><X size={16} /></button>
        </header>
        <div className="preference-body">
          <section>
            <h3><Command size={15} />Workspace profiles</h3>
            <div className="profile-list">
              {workspaceProfiles.map((profile) => (
                <button key={profile.id} className={preferences.activeProfile === profile.id ? "active" : ""} onClick={() => onProfile(profile.id)}>
                  <span><b>{profile.label}</b><small>{profile.detail}</small></span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            <div className="backup-row" style={{ marginTop: 10 }}>
              <button onClick={onExportProfile}><Download size={14} />Export profile</button>
              <label className="soft-button" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <Upload size={14} />Import profile
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImportProfile(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <button onClick={onBackupProfile}><RotateCcw size={14} />Backup profile</button>
            </div>
          </section>
          <section>
            <h3><MonitorCog size={15} />Smart startup</h3>
            <div className="preference-grid">
              <label>
                Startup mode
                <select
                  value={preferences.startupMode}
                  onChange={(event) => update({ startupMode: event.target.value as StartupMode })}
                >
                  <option value="restore-session">Remember session (still opens Home on launch)</option>
                  <option value="last-project">Open last project</option>
                  <option value="dashboard">Open dashboard</option>
                  <option value="production">Open production</option>
                  <option value="welcome">Show welcome (Home)</option>
                  <option value="profile">Use active profile</option>
                </select>
              </label>
              <label>
                Language
                <select value={preferences.language} onChange={(event) => update({ language: event.target.value as DesktopPreferences["language"] })}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="rw">Kinyarwanda</option>
                </select>
              </label>
              <label>
                Production mode
                <select value={preferences.preferredProductionMode} onChange={(event) => update({ preferredProductionMode: event.target.value as DesktopPreferences["preferredProductionMode"] })}>
                  <option value="guided">Guided</option>
                  <option value="pro">Pro</option>
                  <option value="focus">Focus</option>
                </select>
              </label>
              <label>
                Quick access
                <select value={preferences.quickAccessMode} onChange={(event) => update({ quickAccessMode: event.target.value as DesktopPreferences["quickAccessMode"] })}>
                  <option value="smart">Smart (usage-based)</option>
                  <option value="static">Static</option>
                </select>
              </label>
              <label>
                Density
                <select value={preferences.uiDensity} onChange={(event) => update({ uiDensity: event.target.value as DesktopPreferences["uiDensity"] })}>
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
              <label>
                Default export profile
                <input value={preferences.defaultExportProfile} onChange={(event) => update({ defaultExportProfile: event.target.value })} />
              </label>
            </div>
            <label className="toggle-preference">
              <span><b>Show welcome on startup</b><small>Highlight Home guidance after launch</small></span>
              <input type="checkbox" checked={preferences.showWelcomeOnStartup} onChange={(event) => update({ showWelcomeOnStartup: event.target.checked })} />
            </label>
            <label className="toggle-preference">
              <span><b>Pin sidebar by default</b><small>Used on fresh sessions</small></span>
              <input type="checkbox" checked={preferences.sidebarPinnedDefault} onChange={(event) => update({ sidebarPinnedDefault: event.target.checked })} />
            </label>
            <label className="toggle-preference">
              <span><b>Auto save</b><small>Background workspace protection</small></span>
              <input
                type="checkbox"
                checked={preferences.autoSavePreferences.enabled}
                onChange={(event) => update({
                  autoSavePreferences: { ...preferences.autoSavePreferences, enabled: event.target.checked },
                })}
              />
            </label>
          </section>
          <section>
            <h3><MonitorCog size={15} />Performance</h3>
            <div className="preference-grid">
              <label>
                Performance mode
                <select
                  value={preferences.performanceMode}
                  onChange={(event) => update({ performanceMode: event.target.value as DesktopPreferences["performanceMode"] })}
                >
                  <option value="balanced">Balanced</option>
                  <option value="performance">Performance</option>
                  <option value="quality">Quality</option>
                  <option value="power-saving">Power saving</option>
                  <option value="auto">Auto (workload-aware)</option>
                </select>
              </label>
              <label>
                Cache budget (MB)
                <input
                  type="number"
                  min={8}
                  max={256}
                  value={preferences.cacheMaxMb}
                  onChange={(event) => update({ cacheMaxMb: Number(event.target.value) || 32 })}
                />
              </label>
            </div>
            <label className="toggle-preference">
              <span><b>Performance alerts</b><small>Notify on RAM / GPU / disk pressure without stopping production</small></span>
              <input
                type="checkbox"
                checked={preferences.autoPerformanceAlerts}
                onChange={(event) => update({ autoPerformanceAlerts: event.target.checked })}
              />
            </label>
          </section>
          <section>
            <h3><Palette size={15} />Appearance</h3>
            <div className="preference-grid">
              <label>
                Theme
                <select value={preferences.theme} onChange={(event) => update({ theme: event.target.value as DesktopPreferences["theme"] })}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </label>
              <label>
                Accent
                <div className="accent-picker">
                  {(["mint", "sky", "amber", "rose"] as const).map((accent) => (
                    <button key={accent} aria-label={`${accent} accent`} className={`${accent} ${preferences.accent === accent ? "active" : ""}`} onClick={() => update({ accent })} />
                  ))}
                </div>
              </label>
              <ScaleControl label="UI scale" value={preferences.uiScale} onChange={(uiScale) => update({ uiScale })} />
              <ScaleControl label="Font scale" value={preferences.fontScale} onChange={(fontScale) => update({ fontScale })} />
            </div>
          </section>
          <section>
            <h3><Contrast size={15} />Accessibility & notifications</h3>
            <label className="toggle-preference">
              <span><b>High contrast</b><small>Increase visual separation</small></span>
              <input type="checkbox" checked={preferences.highContrast} onChange={(event) => update({ highContrast: event.target.checked })} />
            </label>
            <label className="toggle-preference">
              <span><b>Reduced motion</b><small>Minimize non-essential animation</small></span>
              <input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => update({ reducedMotion: event.target.checked })} />
            </label>
            <label className="toggle-preference">
              <span><b>Smart tooltips</b><small>Purpose, usage, and expected results</small></span>
              <input type="checkbox" checked={preferences.tooltipsEnabled} onChange={(event) => update({ tooltipsEnabled: event.target.checked })} />
            </label>
            <label className="toggle-preference">
              <span><b>Confirm destructive actions</b><small>Delete, reset, restore, replace</small></span>
              <input type="checkbox" checked={preferences.confirmDestructive} onChange={(event) => update({ confirmDestructive: event.target.checked })} />
            </label>
            <label className="toggle-preference">
              <span><b>Keyboard hints</b><small>Show shortcut guidance in UX surfaces</small></span>
              <input type="checkbox" checked={preferences.showKeyboardHints} onChange={(event) => update({ showKeyboardHints: event.target.checked })} />
            </label>
            <label className="toggle-preference">
              <span><b>AI suggestions</b><small>Notification category</small></span>
              <input
                type="checkbox"
                checked={preferences.notificationPreferences.aiSuggestions}
                onChange={(event) => update({
                  notificationPreferences: {
                    ...preferences.notificationPreferences,
                    aiSuggestions: event.target.checked,
                  },
                })}
              />
            </label>
            <label className="toggle-preference">
              <span><b>Production complete</b><small>Notify when jobs finish</small></span>
              <input
                type="checkbox"
                checked={preferences.notificationPreferences.productionComplete}
                onChange={(event) => update({
                  notificationPreferences: {
                    ...preferences.notificationPreferences,
                    productionComplete: event.target.checked,
                  },
                })}
              />
            </label>
          </section>
          <section>
            <h3><MonitorCog size={15} />Workspace backup</h3>
            <div className="backup-row">
              <span>Layout, preferences, navigation memory, and session save automatically. Profiles export/import with confirmation.</span>
              <button onClick={onRestore}><RotateCcw size={14} />Restore snapshot</button>
            </div>
          </section>
          <footer>
            <span><kbd>Ctrl</kbd> <kbd>K</kbd> Search · <kbd>Ctrl</kbd> <kbd>,</kbd> Preferences · <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>B</kbd> Sidebar</span>
            <button onClick={onClose}>Done</button>
          </footer>
        </div>
      </section>
    </div>
  );
}

function ScaleControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <div className="scale-control">
        <input type="range" min="85" max="125" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <b>{value}%</b>
      </div>
    </label>
  );
}

function DesktopContextMenu({ position, onClose, onPreferences, onSearch }: {
  position: { x: number; y: number };
  onClose: () => void;
  onPreferences: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="desktop-context" style={{ left: position.x, top: position.y }} onMouseLeave={onClose} role="menu">
      <button role="menuitem" onClick={onSearch}><Command size={14} />Global search</button>
      <button role="menuitem" onClick={onPreferences}><Settings size={14} />Desktop preferences</button>
      <button role="menuitem" onClick={onClose}><PanelsTopLeft size={14} />Navigation engine active</button>
      <button role="menuitem" onClick={onClose}><Palette size={14} />Customize appearance</button>
      <span />
      <button role="menuitem" onClick={onClose}><RotateCcw size={14} />Restore workspace snapshot</button>
    </div>
  );
}

export function getWorkspaceContextForAiMe(layout: ShellLayoutState, core: CoreStatus | null) {
  return serializeAiMeContext(buildAiMeWorkspaceContext(layout, core));
}

installBootstrapRecovery();
createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
