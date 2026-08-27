import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { DesktopNotification, DesktopPreferences } from "../desktop-polish/types";
import type {
  CoreStatus, LayoutManagerState, NavigationState, ProjectStatus, QuickActionId, SaveState, ShellLayoutState, WorkspaceId,
} from "./types";
import { ShellProvider, useShell } from "./ShellContext";
import { shellLayoutManager } from "./layout-store";
import { mapLegacyWorkspace } from "./workspace-registry";
import { navigationStore } from "./navigation/navigation-store";
import { navigationEngine } from "./navigation/navigation-engine";
import { workspaceLayoutManager } from "./layout/layout-manager";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { BottomPanel } from "./BottomPanel";
import { ProductionWorkspace } from "./ProductionWorkspace";
import { GlobalSearch } from "./navigation/GlobalSearch";
import { FloatingWindowsLayer } from "./layout/FloatingWindows";
import { LayoutManagerPanel } from "./layout/LayoutManagerPanel";
import { workspaceStateEngine } from "./workspace-state/workspace-state-engine";
import { sessionStore } from "./workspace-state/session-store";
import { personalizationEngine } from "./personalization/personalization-engine";
import { workspacePerformanceEngine } from "./performance/performance-engine";
import type { PerformanceSnapshot } from "./performance/types";
import { uxEngine } from "./ux/ux-engine";
import { commandStack } from "./ux/command-stack";
import { confirmationService } from "./ux/confirmation";
import { ConfirmDialog } from "./ux/ConfirmDialog";
import { ShortcutGuide } from "./ux/ShortcutGuide";
import { LiveRegion } from "./ux/LiveRegion";
import type { ConfirmRequest } from "./ux/types";
import { workspaceIntegrationEngine } from "./integration/integration-engine";
import type { IntegrationSnapshot } from "./integration/types";
import { workspaceCertificationEngine } from "./certification/certification-engine";
import type { CertificationSnapshot } from "./certification/types";
import type { RestoreReport } from "./workspace-state/types";
import "./layout/layout-engine.css";
import "./performance/performance.css";
import "./ux/ux.css";
import "./certification/certification.css";

interface AppShellProps {
  preferences: DesktopPreferences;
  setPreferences: (preferences: DesktopPreferences | ((current: DesktopPreferences) => DesktopPreferences)) => void;
  core: CoreStatus | null;
  notifications: DesktopNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<DesktopNotification[]>>;
  notify: (tone: DesktopNotification["tone"], title: string, detail: string, category?: DesktopNotification["category"]) => void;
  onPreferencesOpen: () => void;
  onSearchOpen: () => void;
  onSearchClose?: () => void;
  searchOpen?: boolean;
  onNotificationsToggle: () => void;
  notificationsOpen: boolean;
  onNewProject?: () => void;
  children: ReactNode;
  onLayoutChange?: (layout: ShellLayoutState) => void;
  restoredLayout?: ShellLayoutState | null;
}

export function AppShell({
  preferences,
  setPreferences,
  core,
  notifications,
  setNotifications,
  notify,
  onPreferencesOpen,
  onSearchOpen,
  onSearchClose,
  searchOpen = false,
  onNotificationsToggle,
  notificationsOpen,
  onNewProject,
  children,
  onLayoutChange,
  restoredLayout,
}: AppShellProps) {
  const [layout, setLayoutState] = useState<ShellLayoutState>(() => {
    const loaded = shellLayoutManager.load();
    // Fresh renderer session always starts on Home — never last Step/workspace.
    // Layout chrome (panels, etc.) may still load from persistence.
    return { ...loaded, workspace: "home" };
  });
  const [navigation, setNavigationState] = useState<NavigationState>(() => navigationStore.load());
  const [layoutManager, setLayoutManagerState] = useState<LayoutManagerState>(() => workspaceLayoutManager.load());
  const [layoutManagerOpen, setLayoutManagerOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [autoSave, setAutoSave] = useState(true);
  const [restoreReport, setRestoreReport] = useState<RestoreReport | null>(null);
  const [performanceSnapshot, setPerformanceSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [shortcutGuideOpen, setShortcutGuideOpen] = useState(false);
  const [integrationSnapshot, setIntegrationSnapshot] = useState<IntegrationSnapshot | null>(null);
  const [certificationSnapshot, setCertificationSnapshot] = useState<CertificationSnapshot | null>(null);
  const projectStatus: ProjectStatus = core?.activeProject ? "in-production" : "idle";
  const lastProjectEventRef = useRef<string | null>(null);

  const layoutRef = useRef(layout);
  const navigationRef = useRef(navigation);
  const layoutManagerRef = useRef(layoutManager);
  const preferencesRef = useRef(preferences);
  const bootstrappingRef = useRef(true);
  const restoredOnceRef = useRef(false);

  layoutRef.current = layout;
  navigationRef.current = navigation;
  layoutManagerRef.current = layoutManager;
  preferencesRef.current = preferences;

  useEffect(() => {
    workspaceStateEngine.setProviders({
      getShell: () => layoutRef.current,
      getNavigation: () => navigationRef.current,
      getLayoutManager: () => layoutManagerRef.current,
      getPreferences: () => preferencesRef.current,
      applyShell: (shell) => {
        setLayoutState(shell);
        setNavigationState(navigationStore.load());
        setLayoutManagerState(workspaceLayoutManager.load());
      },
      applyPreferences: (next) => setPreferences(next),
    });

    if (!restoredOnceRef.current) {
      restoredOnceRef.current = true;
      const report = workspaceStateEngine.restoreOnStartup();
      const prefsNow = preferencesRef.current;
      workspaceStateEngine.autoSave.setEnabled(prefsNow.autoSavePreferences?.enabled !== false);
      const applied = personalizationEngine.applySmartStartup(
        prefsNow,
        report,
        layoutRef.current,
        prefsNow.lastOpenedProject ?? null,
      );
      setLayoutState(applied.shell);
      setPreferences(applied.preferences);
      if (!report.restored && applied.preferences.sidebarPinnedDefault) {
        setNavigationState((current) => ({ ...current, pinned: true }));
      }
      const combined: RestoreReport = {
        ...report,
        explanation: [report.explanation, applied.decision.explanation].filter(Boolean).join(" "),
      };
      setRestoreReport(combined);
      notify(
        report.recoveredFromCrash ? "warning" : report.restored || applied.decision.applied ? "success" : "info",
        report.recoveredFromCrash ? "Crash recovery" : "Workspace ready",
        combined.explanation,
        report.recoveredFromCrash ? "warnings" : "production-complete",
      );
      bootstrappingRef.current = false;
    }

    const uninstallCrash = workspaceStateEngine.crashProtection.install();
    const unsub = workspaceStateEngine.autoSave.subscribe((status) => {
      setAutoSave(status.enabled);
      if (status.inProgress) setSaveState("saving");
      else if (status.lastError) setSaveState("error");
      else if (status.dirty) setSaveState("unsaved");
      else setSaveState("saved");
    });

    workspacePerformanceEngine.configure({
      mode: preferencesRef.current.performanceMode ?? "balanced",
      alertsEnabled: preferencesRef.current.autoPerformanceAlerts !== false,
      cacheMaxMb: preferencesRef.current.cacheMaxMb ?? 32,
    });
    workspacePerformanceEngine.onPerformanceAlert((alert) => {
      notify(
        alert.severity === "critical" ? "warning" : "info",
        "Performance",
        `${alert.message} — ${alert.recommendation}`,
        "warnings",
      );
    });
    const unsubPerf = workspacePerformanceEngine.subscribe(setPerformanceSnapshot);
    workspacePerformanceEngine.start();

    uxEngine.start(preferencesRef.current);
    const unsubConfirm = confirmationService.subscribe(setConfirmRequest);

    workspaceIntegrationEngine.start({ notify, core: null });
    const unsubIntegration = workspaceIntegrationEngine.subscribe(setIntegrationSnapshot);

    const unsubCert = workspaceCertificationEngine.subscribe(setCertificationSnapshot);
    // Defer certification until engines are online — never blocks first paint
    const certTimer = window.setTimeout(() => {
      const result = workspaceCertificationEngine.run();
      void workspaceIntegrationEngine.emit({
        type: result.certified ? "notify.success" : "notify.warning",
        source: "workspace",
        targets: ["ai-me", "notifications"],
        payload: {
          action: "foundation.certification",
          certified: result.certified,
          overallScore: result.overallScore,
          readiness: result.readiness,
        },
        priority: "low",
        notify: {
          tone: result.certified ? "success" : "warning",
          title: result.certified ? "Foundation certified" : "Foundation review",
          detail: `Workspace Foundation 1.0 — ${result.overallScore}/100 (${result.readiness})`,
          category: result.certified ? "production-complete" : "warnings",
        },
      });
    }, 400);

    return () => {
      clearTimeout(certTimer);
      uninstallCrash();
      unsub();
      unsubPerf();
      unsubConfirm();
      unsubIntegration();
      unsubCert();
      workspacePerformanceEngine.stop();
      uxEngine.stop();
      workspaceIntegrationEngine.stop();
    };
  }, [notify, setPreferences]);

  useEffect(() => {
    uxEngine.applyPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    workspacePerformanceEngine.configure({
      mode: preferences.performanceMode ?? "balanced",
      alertsEnabled: preferences.autoPerformanceAlerts !== false,
      cacheMaxMb: preferences.cacheMaxMb ?? 32,
    });
  }, [preferences.performanceMode, preferences.autoPerformanceAlerts, preferences.cacheMaxMb]);

  useEffect(() => {
    workspacePerformanceEngine.setCore(core);
    const busy = projectStatus === "in-production" || (core?.runtimeMetrics?.activeJobs ?? 0) > 0;
    workspacePerformanceEngine.setProductionActive(busy);
    workspaceIntegrationEngine.setCore(core);
  }, [core, projectStatus]);

  useEffect(() => {
    const name = core?.activeProject;
    if (!name || name === "No active project" || name === lastProjectEventRef.current) return;
    lastProjectEventRef.current = name;
    void workspaceIntegrationEngine.emit({
      type: "project.loaded",
      source: "workspace",
      payload: { name },
      priority: "normal",
    });
  }, [core?.activeProject]);

  useEffect(() => {
    if (!bootstrappingRef.current) {
      workspacePerformanceEngine.cacheLayoutData(`layout:${layout.workspace}`, {
        workspace: layout.workspace,
        panels: layout.panels.length,
        zen: layout.zen,
      });
    }
  }, [layout.workspace, layout.panels.length, layout.zen]);

  useEffect(() => {
    shellLayoutManager.save(layout);
    onLayoutChange?.(layout);
    if (!bootstrappingRef.current) {
      workspaceStateEngine.updateUi({
        activeSidebar: layout.zen ? "none" : layout.leftCollapsed ? "right" : "left",
        zoomLevel: preferences.uiScale,
      });
      workspaceStateEngine.autoSave.markDirty();
    }
  }, [layout, onLayoutChange, preferences.uiScale]);

  useEffect(() => {
    navigationStore.save(navigation);
    if (!bootstrappingRef.current) workspaceStateEngine.autoSave.markDirty();
  }, [navigation]);

  useEffect(() => {
    workspaceLayoutManager.save(layoutManager);
    if (!bootstrappingRef.current) workspaceStateEngine.autoSave.markDirty();
  }, [layoutManager]);

  useEffect(() => {
    if (restoredLayout) setLayoutState(restoredLayout);
  }, [restoredLayout]);

  useEffect(() => {
    // Do not sync lastWorkspace → UI during bootstrap (avoids flashing last Step before Home).
    if (bootstrappingRef.current) return;
    const external = mapLegacyWorkspace(preferences.lastWorkspace);
    if (external !== layout.workspace) {
      setLayoutState((current) => ({ ...current, workspace: external }));
    }
  }, [preferences.lastWorkspace]);

  useEffect(() => {
    if (navigation.pinned && layout.leftCollapsed) {
      setLayoutState((current) => ({ ...current, leftCollapsed: false }));
    }
  }, [navigation.pinned, layout.leftCollapsed]);

  useEffect(() => {
    workspaceStateEngine.autoSave.setEnabled(preferences.autoSavePreferences?.enabled !== false);
  }, [preferences.autoSavePreferences?.enabled]);

  useEffect(() => {
    document.documentElement.dataset.density = preferences.uiDensity ?? "comfortable";
  }, [preferences.uiDensity]);

  useEffect(() => {
    if (bootstrappingRef.current) return;
    const floating = layout.panels.filter((panel) => panel.mode === "floating");
    if (!floating.length) return;
    setNavigationState((current) => {
      let next = current;
      for (const panel of floating) next = navigationStore.recordPanel(next, panel.id);
      return next;
    });
  }, [layout.panels]);

  useEffect(() => {
    workspaceStateEngine.syncProject(core?.activeProject);
    if (core?.activeProject && !bootstrappingRef.current) {
      sessionStore.pushHistory("project", `Active project: ${core.activeProject}`);
      setPreferences((current) => personalizationEngine.syncProjectMemory(current, core.activeProject));
      setNavigationState((current) => navigationStore.recordProject(current, core.activeProject!));
    }
  }, [core?.activeProject, setPreferences]);

  const setLayout = useCallback((changes: Partial<ShellLayoutState> | ShellLayoutState) => {
    setLayoutState((current) => {
      if (navigation.pinned && "leftCollapsed" in changes && changes.leftCollapsed === true) return current;
      return { ...current, ...changes };
    });
  }, [navigation.pinned]);

  const applyLayoutWithUndo = useCallback((changes: Partial<ShellLayoutState>, label = "Layout change") => {
    setLayoutState((current) => {
      if (navigation.pinned && changes.leftCollapsed === true) return current;
      const next = { ...current, ...changes };
      if (!bootstrappingRef.current) {
        commandStack.pushApplied({
          label,
          undo: () => setLayoutState(current),
          redo: () => setLayoutState(next),
        });
      }
      return next;
    });
  }, [navigation.pinned]);

  const setNavigation = useCallback((
    changes: Partial<NavigationState> | ((current: NavigationState) => NavigationState),
  ) => {
    setNavigationState((current) => (typeof changes === "function" ? changes(current) : { ...current, ...changes }));
  }, []);

  const setLayoutManager = useCallback((
    changes: LayoutManagerState | ((current: LayoutManagerState) => LayoutManagerState),
  ) => {
    setLayoutManagerState((current) => (typeof changes === "function" ? changes(current) : changes));
  }, []);

  const switchWorkspace = useCallback((workspace: WorkspaceId) => {
    setLayoutState((current) => ({ ...current, workspace }));
    setNavigationState((current) => navigationStore.visit(current, workspace));
    setPreferences((current) => ({ ...current, lastWorkspace: workspace }));
    sessionStore.pushHistory("workspace", `Switched to ${workspace}`);
    uxEngine.trackAction(workspace);
    void workspaceIntegrationEngine.emit({
      type: "module.message",
      source: "workspace",
      targets: ["ai-me", "notifications"],
      payload: { action: "workspace.changed", workspace },
      priority: "low",
    });
  }, [setPreferences]);

  useEffect(() => {
    const openGuide = () => setShortcutGuideOpen(true);
    const startTour = () => {
      uxEngine.markTourCompleted();
      setPreferences((current) => ({ ...current, tourCompleted: true }));
      notify("info", "Workspace tour", "Tour tips are in Help. AI Me can walk you through each region.", "information");
      switchWorkspace("help");
    };
    const navigateWorkspace = (event: Event) => {
      const detail = (event as CustomEvent<{ workspace?: WorkspaceId }>).detail;
      if (detail?.workspace) switchWorkspace(detail.workspace);
    };
    window.addEventListener("kwizera:open-shortcut-guide", openGuide);
    window.addEventListener("kwizera:start-workspace-tour", startTour);
    window.addEventListener("kwizera:navigate-workspace", navigateWorkspace);
    return () => {
      window.removeEventListener("kwizera:open-shortcut-guide", openGuide);
      window.removeEventListener("kwizera:start-workspace-tour", startTour);
      window.removeEventListener("kwizera:navigate-workspace", navigateWorkspace);
    };
  }, [notify, setPreferences, switchWorkspace]);

  const toggleFavorite = useCallback((workspace: WorkspaceId) => {
    setNavigationState((current) => navigationStore.toggleFavorite(current, workspace));
  }, []);

  const runQuickAction = useCallback((action: QuickActionId) => {
    uxEngine.trackAction(action);
    setNavigationState((current) => navigationStore.recordCommand(current, action));
    const resolved = navigationEngine.resolveQuickAction(action);
    if (action === "save") {
      setSaveState("saving");
      uxEngine.announce("Saving workspace…", "saving");
      void workspaceStateEngine.autoSave.flush("manual").then((snapshot) => {
        if (snapshot) {
          setSaveState("saved");
          uxEngine.announce("Workspace saved", "success");
          notify("success", "Workspace saved", "Project, layout, session, and AI state stored locally.", "production-complete");
          void workspaceIntegrationEngine.emit({
            type: "sync.completed",
            source: "workspace",
            targets: ["ai-me", "notifications"],
            payload: { trigger: "manual-save", snapshotId: snapshot.id },
            priority: "low",
          });
        } else {
          setSaveState("error");
          uxEngine.announce("Save failed", "error");
          notify("error", "Save failed", "Could not persist workspace state. Previous valid data was kept.", "errors");
          void workspaceIntegrationEngine.emit({
            type: "notify.error",
            source: "workspace",
            targets: ["ai-me", "notifications"],
            payload: { error: "manual-save-failed" },
            priority: "high",
            notify: {
              tone: "error",
              title: "Save failed",
              detail: "Workspace state could not be persisted.",
              category: "errors",
            },
          });
        }
      });
      return;
    }
    if (resolved?.workspace) {
      switchWorkspace(resolved.workspace);
      notify("info", resolved.label, resolved.detail, action.includes("generate") ? "ai-suggestions" : "information");
      return;
    }
    notify("info", resolved?.label ?? action, resolved?.detail ?? "Action prepared.", "updates");
  }, [notify, switchWorkspace]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (!typing && event.key === "?" && !mod) {
        event.preventDefault();
        setShortcutGuideOpen(true);
        return;
      }
      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        const label = uxEngine.undo();
        if (label) notify("info", "Undo", label, "updates");
        return;
      }
      if ((mod && event.shiftKey && key === "z") || (mod && key === "y")) {
        event.preventDefault();
        const label = uxEngine.redo();
        if (label) notify("info", "Redo", label, "updates");
        return;
      }
      if (mod && event.shiftKey && key === "b") {
        event.preventDefault();
        if (!navigation.pinned) applyLayoutWithUndo({ leftCollapsed: !layout.leftCollapsed }, "Toggle sidebar");
      }
      if (mod && event.shiftKey && key === "l") {
        event.preventDefault();
        setLayoutManagerOpen((open) => !open);
      }
      if (mod && key === "n") {
        event.preventDefault();
        runQuickAction("new-project");
        onNewProject?.();
      }
      if (mod && key === "o") {
        event.preventDefault();
        switchWorkspace("open-project");
      }
      if (mod && key === "s") {
        event.preventDefault();
        runQuickAction("save");
      }
      if (mod && event.shiftKey && key === "a") {
        event.preventDefault();
        switchWorkspace("ai-me");
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        const previous = navigation.history[1]?.workspace;
        if (previous) switchWorkspace(previous);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [applyLayoutWithUndo, layout.leftCollapsed, navigation.history, navigation.pinned, notify, onNewProject, runQuickAction, switchWorkspace]);

  const shellClass = useMemo(() => {
    const classes = ["studio-shell", "layout-engine-shell", "nav-engine-shell"];
    if (layout.leftCollapsed) classes.push("left-collapsed");
    if (!layout.rightOpen) classes.push("right-closed");
    if (layout.zen) classes.push("zen");
    if (layout.bottomExpanded) classes.push("bottom-expanded");
    if (navigation.pinned) classes.push("sidebar-pinned");
    return classes.join(" ");
  }, [layout, navigation.pinned]);

  const shellStyle = {
    "--bottom-panel-height": layout.bottomExpanded ? `${layout.bottomHeight}px` : "28px",
  } as React.CSSProperties;

  const contextValue = {
    layout,
    preferences,
    core,
    notifications,
    saveState,
    autoSave,
    projectStatus,
    navigation,
    layoutManager,
    restoreReport,
    performanceSnapshot,
    integrationSnapshot,
    certificationSnapshot,
    setLayout,
    switchWorkspace,
    setPreferences,
    notify,
    setNotifications,
    setNavigation,
    setLayoutManager,
    toggleFavorite,
    runQuickAction,
  };

  return (
    <ShellProvider value={contextValue}>
      <main
        className={shellClass}
        style={shellStyle}
        tabIndex={-1}
        data-workspace={layout.workspace}
        data-layout-version="3"
        data-nav-engine="1"
        data-layout-engine="1"
        data-workspace-state="1"
        data-performance-engine="1"
        data-ux-engine="1"
        data-integration-engine="1"
        data-foundation-cert={certificationSnapshot?.certified ? "1" : "0"}
        data-foundation-score={String(certificationSnapshot?.overallScore ?? "")}
        data-active-layout={layoutManager.activeLayoutId}
        data-perf-mode={performanceSnapshot?.effectiveMode ?? preferences.performanceMode}
        id="workspace-main"
      >
        <WorkspaceHeader
          onSearchOpen={onSearchOpen}
          onPreferencesOpen={onPreferencesOpen}
          onNotificationsToggle={onNotificationsToggle}
          notificationsOpen={notificationsOpen}
        />

        <LeftSidebar onPreferencesOpen={onPreferencesOpen} onNewProject={onNewProject} />

        <ProductionWorkspace onOpenLayoutManager={() => setLayoutManagerOpen(true)}>
          {children}
        </ProductionWorkspace>

        {layout.rightOpen && !layout.zen && (
          <RightSidebar onClose={() => setLayout({ rightOpen: false })} />
        )}

        <BottomPanel />

        <FloatingWindowsLayer />
        <LayoutManagerPanel open={layoutManagerOpen} onClose={() => setLayoutManagerOpen(false)} />

        <GlobalSearch
          open={searchOpen}
          onClose={() => onSearchClose?.()}
          onSelectWorkspace={(workspace) => {
            switchWorkspace(workspace);
            onSearchClose?.();
          }}
        />

        <DragDropOverlay />
        <ConfirmDialog request={confirmRequest} />
        <ShortcutGuide open={shortcutGuideOpen} onClose={() => setShortcutGuideOpen(false)} />
        <LiveRegion />
      </main>
    </ShellProvider>
  );
}

function DragDropOverlay() {
  const [dragging, setDragging] = useState(false);
  const { notify } = useShell();

  return (
    <>
      <div
        className="shell-drop-target"
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const files = Array.from(event.dataTransfer.files ?? []).map((f) => f.name);
          notify(
            "info",
            "Drop received",
            files.length
              ? `Prepared ${files.length} item(s) for workspace routing: ${files.slice(0, 3).join(", ")}.`
              : "Items are prepared for future workspace routing.",
            "updates",
          );
          uxEngine.announce(files.length ? `Dropped ${files.length} files` : "Drop received", "success");
        }}
      />
      {dragging && (
        <div className="desktop-drop-overlay" role="status">
          <Sparkles size={25} />
          <strong>Drop to prepare workspace routing</strong>
          <span>Files, assets, panels, timeline items, and future AI objects are supported by this foundation.</span>
        </div>
      )}
    </>
  );
}
