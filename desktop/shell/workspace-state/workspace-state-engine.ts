import type { DesktopPreferences } from "../../desktop-polish/types";
import { dashboardWidgetStore } from "../../dashboard/widget-store";
import type { LayoutManagerState, NavigationState, ShellLayoutState } from "../types";
import { shellLayoutManager } from "../layout-store";
import { navigationStore } from "../navigation/navigation-store";
import { workspaceLayoutManager } from "../layout/layout-manager";
import { DesktopPreferenceManager } from "../../desktop-polish/preference-store";
import { AutoSaveEngine } from "./auto-save-engine";
import { CrashProtection } from "./crash-protection";
import { projectMemoryStore } from "./project-memory";
import { sessionStore } from "./session-store";
import { checksumPayload, validateSnapshot } from "./state-validation";
import type {
  ProjectMemoryRecord, RestoreReport, SaveMode, WorkspaceSession,
  WorkspaceStateSnapshot, WorkspaceUiState,
} from "./types";
import {
  coldStartRestoreExplanation,
  fallbackShellLayout,
  markNavigationSchemaCurrent,
  patchPreferencesForHomeStartup,
  resetPersistedNavigationInStorage,
  sanitizeSnapshotForColdStart,
} from "../startup-navigation";

const SNAPSHOT_KEY = "kwizera.workspace-state.snapshot.v1";
const EMERGENCY_KEY = "kwizera.workspace-state.emergency.v1";
const LEGACY_BACKUP_KEY = "kwizera.desktop.workspace-backup.v1";

const defaultUi = (): WorkspaceUiState => ({
  activeSidebar: "left",
  activeTabs: {},
  scrollPositions: {},
  selectedItems: [],
  zoomLevel: 100,
});

export interface WorkspaceStateProviders {
  getShell: () => ShellLayoutState;
  getNavigation: () => NavigationState;
  getLayoutManager: () => LayoutManagerState;
  getPreferences: () => DesktopPreferences;
  applyShell?: (shell: ShellLayoutState) => void;
  applyPreferences?: (preferences: DesktopPreferences) => void;
}

export class WorkspaceStateEngine {
  readonly autoSave: AutoSaveEngine;
  readonly crashProtection: CrashProtection;
  private ui: WorkspaceUiState = defaultUi();
  private preferenceManager = new DesktopPreferenceManager();

  constructor(private providers?: WorkspaceStateProviders) {
    this.autoSave = new AutoSaveEngine(this);
    this.crashProtection = new CrashProtection(this);
  }

  setProviders(providers: WorkspaceStateProviders): void {
    this.providers = providers;
  }

  updateUi(patch: Partial<WorkspaceUiState>): void {
    this.ui = { ...this.ui, ...patch };
    this.autoSave.markDirty();
  }

  getUi(): WorkspaceUiState {
    return this.ui;
  }

  getProjectMemory(): ProjectMemoryRecord {
    return projectMemoryStore.load();
  }

  syncProject(activeProject: string | null | undefined): ProjectMemoryRecord {
    const memory = projectMemoryStore.syncFromRuntime(activeProject);
    this.autoSave.markDirty();
    return memory;
  }

  ensureSession(shell: ShellLayoutState, projectName: string | null, layoutId: string | null): WorkspaceSession {
    const current = sessionStore.getCurrent();
    if (current && !current.closedAt) {
      return sessionStore.touch(current.id) ?? current;
    }
    const session = sessionStore.startSession(shell.workspace, projectName, layoutId);
    sessionStore.pushHistory("session", `Session started (${shell.workspace})`);
    return session;
  }

  buildSnapshot(mode: SaveMode): WorkspaceStateSnapshot {
    if (!this.providers) throw new Error("Workspace state providers are not configured");
    const shell = this.providers.getShell();
    const navigation = this.providers.getNavigation();
    const layoutManager = this.providers.getLayoutManager();
    const preferences = this.providers.getPreferences();
    const projectMemory = projectMemoryStore.load();
    const session = this.ensureSession(shell, projectMemory.projectName, layoutManager.activeLayoutId);
    const id = `snap-${Date.now().toString(36)}`;
    const base = {
      version: 1 as const,
      id,
      savedAt: new Date().toISOString(),
      saveMode: mode,
      cleanShutdown: mode !== "emergency",
      session,
      shell,
      navigation,
      layoutManager,
      preferences,
      dashboard: dashboardWidgetStore.load(),
      projectMemory,
      ui: this.ui,
    };
    return { ...base, checksum: checksumPayload(base) };
  }

  persist(mode: SaveMode): WorkspaceStateSnapshot {
    const snapshot = this.buildSnapshot(mode);
    const validation = validateSnapshot(snapshot);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    // Write providers first — never overwrite valid project memory with empty corrupt data
    shellLayoutManager.save(snapshot.shell);
    navigationStore.save(snapshot.navigation);
    workspaceLayoutManager.save(snapshot.layoutManager);
    this.preferenceManager.save(snapshot.preferences);
    if (snapshot.dashboard) dashboardWidgetStore.save(snapshot.dashboard);
    projectMemoryStore.save(snapshot.projectMemory);

    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    if (mode === "emergency") {
      localStorage.setItem(EMERGENCY_KEY, JSON.stringify(snapshot));
    }

    // Keep legacy backup compatible for preferences UI
    this.preferenceManager.backup({
      layout: snapshot.shell,
      preferences: snapshot.preferences,
      navigation: snapshot.navigation,
      layoutManager: snapshot.layoutManager,
      projectMemory: snapshot.projectMemory,
      session: snapshot.session,
      ui: snapshot.ui,
      snapshotId: snapshot.id,
    });

    sessionStore.pushHistory(
      mode === "emergency" ? "session" : "workspace",
      mode === "emergency" ? "Emergency state saved" : `Workspace ${mode} save`,
      snapshot.id,
    );
    return snapshot;
  }

  loadLatestSnapshot(): WorkspaceStateSnapshot | null {
    const candidates = [EMERGENCY_KEY, SNAPSHOT_KEY];
    for (const key of candidates) {
      try {
        const raw = JSON.parse(localStorage.getItem(key) ?? "null");
        const result = validateSnapshot(raw);
        if (result.valid) return raw as WorkspaceStateSnapshot;
      } catch {
        /* try next */
      }
    }
    return this.loadLegacyBackup();
  }

  private loadLegacyBackup(): WorkspaceStateSnapshot | null {
    try {
      const raw = JSON.parse(localStorage.getItem(LEGACY_BACKUP_KEY) ?? "null") as {
        savedAt?: string;
        snapshot?: {
          layout?: ShellLayoutState;
          preferences?: DesktopPreferences;
          navigation?: NavigationState;
          layoutManager?: LayoutManagerState;
          projectMemory?: ProjectMemoryRecord;
          session?: WorkspaceSession;
          ui?: WorkspaceUiState;
        };
      } | null;
      if (!raw?.snapshot?.layout || !raw.snapshot.preferences) return null;
      const shell = raw.snapshot.layout;
      const preferences = raw.snapshot.preferences;
      const navigation = raw.snapshot.navigation ?? navigationStore.load();
      const layoutManager = raw.snapshot.layoutManager ?? workspaceLayoutManager.load();
      const projectMemory = raw.snapshot.projectMemory ?? projectMemoryStore.load();
      const session = raw.snapshot.session ?? sessionStore.getLatestValid() ?? sessionStore.startSession(shell.workspace, projectMemory.projectName, layoutManager.activeLayoutId);
      const base = {
        version: 1 as const,
        id: `legacy-${Date.now().toString(36)}`,
        savedAt: raw.savedAt ?? new Date().toISOString(),
        saveMode: "auto" as const,
        cleanShutdown: true,
        session,
        shell,
        navigation,
        layoutManager,
        preferences,
        dashboard: dashboardWidgetStore.load(),
        projectMemory,
        ui: raw.snapshot.ui ?? defaultUi(),
      };
      return { ...base, checksum: checksumPayload(base) };
    } catch {
      return null;
    }
  }

  private quarantineBrokenSnapshot(snapshot: WorkspaceStateSnapshot | null, reason: string): void {
    try {
      if (snapshot?.projectMemory) projectMemoryStore.save(snapshot.projectMemory);
      if (snapshot?.dashboard) dashboardWidgetStore.save(snapshot.dashboard);
      if (snapshot?.preferences) this.preferenceManager.save(patchPreferencesForHomeStartup(snapshot.preferences));
    } catch (error) {
      console.warn("[KWIZERA] Could not preserve data during snapshot quarantine:", error);
    }
    try {
      shellLayoutManager.save(fallbackShellLayout());
      localStorage.removeItem(SNAPSHOT_KEY);
      localStorage.removeItem(EMERGENCY_KEY);
    } catch (error) {
      console.warn("[KWIZERA] Could not quarantine broken snapshot:", error);
    }
    console.warn("[KWIZERA] Quarantined broken workspace snapshot:", reason);
    markNavigationSchemaCurrent();
  }

  private applySnapshotSafe(
    snapshot: WorkspaceStateSnapshot,
    options?: { applyToUi?: boolean },
  ): { applied: boolean; sanitized: WorkspaceStateSnapshot } {
    try {
      const sanitized = sanitizeSnapshotForColdStart(snapshot);
      this.applySnapshot(sanitized, options);
      markNavigationSchemaCurrent();
      return { applied: true, sanitized };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.quarantineBrokenSnapshot(snapshot, message);
      return { applied: false, sanitized: sanitizeSnapshotForColdStart(snapshot) };
    }
  }

  restoreOnStartup(): RestoreReport {
    // Ensure persisted navigation keys never reopen the last screen on a fresh launch.
    resetPersistedNavigationInStorage();

    const unclean = this.crashProtection.wasUncleanShutdown();
    const emergency = (() => {
      try {
        const raw = JSON.parse(localStorage.getItem(EMERGENCY_KEY) ?? "null");
        return validateSnapshot(raw).valid ? (raw as WorkspaceStateSnapshot) : null;
      } catch {
        return null;
      }
    })();
    const latest = this.loadLatestSnapshot();

    if (unclean && emergency) {
      const { applied, sanitized } = this.applySnapshotSafe(emergency, { applyToUi: false });
      this.crashProtection.clearFlag();
      if (applied) {
        sessionStore.pushHistory("session", "Restored after unexpected shutdown", emergency.id);
        return {
          restored: true,
          source: "emergency",
          explanation: coldStartRestoreExplanation(
            `Recovered emergency workspace data from ${new Date(emergency.savedAt).toLocaleString()}.`,
            sanitized.projectMemory.projectName,
          ),
          snapshotId: emergency.id,
          recoveredFromCrash: true,
        };
      }
      this.ensureSession(fallbackShellLayout(), sanitized.projectMemory.projectName, sanitized.layoutManager.activeLayoutId);
      return {
        restored: false,
        source: "fresh",
        explanation: coldStartRestoreExplanation(
          "Emergency snapshot could not be applied safely; project data was preserved and Home is ready.",
          sanitized.projectMemory.projectName,
        ),
        snapshotId: null,
        recoveredFromCrash: true,
      };
    }

    if (latest) {
      const { applied, sanitized } = this.applySnapshotSafe(latest, { applyToUi: false });
      this.crashProtection.clearFlag();
      if (applied) {
        this.ensureSession(sanitized.shell, sanitized.projectMemory.projectName, sanitized.layoutManager.activeLayoutId);
        return {
          restored: true,
          source: unclean ? "emergency" : "session",
          explanation: coldStartRestoreExplanation(
            `Restored last session (${latest.session.id.slice(0, 12)}…).`,
            sanitized.projectMemory.projectName,
          ),
          snapshotId: latest.id,
          recoveredFromCrash: unclean,
        };
      }
      this.ensureSession(fallbackShellLayout(), sanitized.projectMemory.projectName, sanitized.layoutManager.activeLayoutId);
      return {
        restored: false,
        source: "fresh",
        explanation: coldStartRestoreExplanation(
          "Previous navigation snapshot was invalid; project data was preserved and Home is ready.",
          sanitized.projectMemory.projectName,
        ),
        snapshotId: null,
        recoveredFromCrash: unclean,
      };
    }

    const shell = shellLayoutManager.load();
    this.ensureSession(shell, projectMemoryStore.load().projectName, workspaceLayoutManager.load().activeLayoutId);
    markNavigationSchemaCurrent();
    return {
      restored: false,
      source: "fresh",
      explanation: "No previous session snapshot found. Starting a fresh local workspace session.",
      snapshotId: null,
      recoveredFromCrash: false,
    };
  }

  applySnapshot(snapshot: WorkspaceStateSnapshot, options?: { applyToUi?: boolean }): void {
    const validation = validateSnapshot(snapshot);
    if (!validation.valid) throw new Error(`Cannot apply corrupt snapshot: ${validation.errors.join("; ")}`);
    shellLayoutManager.save(snapshot.shell);
    navigationStore.save(snapshot.navigation);
    workspaceLayoutManager.save(snapshot.layoutManager);
    this.preferenceManager.save(snapshot.preferences);
    if (snapshot.dashboard) dashboardWidgetStore.save(snapshot.dashboard);
    projectMemoryStore.save(snapshot.projectMemory);
    this.ui = snapshot.ui;
    if (options?.applyToUi !== false) {
      this.providers?.applyShell?.(snapshot.shell);
      this.providers?.applyPreferences?.(snapshot.preferences);
    }
  }

  markCleanShutdown(clean: boolean): void {
    if (clean) sessionStore.closeSession(true);
  }

  rollbackTo(snapshotId: string): RestoreReport {
    const latest = this.loadLatestSnapshot();
    if (!latest || latest.id !== snapshotId) {
      const history = sessionStore.loadHistory().entries.find((e) => e.snapshotId === snapshotId);
      if (!history) {
        return {
          restored: false,
          source: "none",
          explanation: "Requested snapshot is not available for rollback.",
          snapshotId: null,
          recoveredFromCrash: false,
        };
      }
    }
    if (!latest) {
      return {
        restored: false,
        source: "none",
        explanation: "No snapshot available.",
        snapshotId: null,
        recoveredFromCrash: false,
      };
    }
    this.applySnapshot(latest);
    sessionStore.pushHistory("workspace", `Rollback to snapshot ${snapshotId}`, snapshotId);
    return {
      restored: true,
      source: "backup",
      explanation: `Rolled back to snapshot ${snapshotId}.`,
      snapshotId,
      recoveredFromCrash: false,
    };
  }
}

export const workspaceStateEngine = new WorkspaceStateEngine();
