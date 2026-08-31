import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPreferences } from "../../../desktop/desktop-polish/preference-defaults.ts";
import { defaultShellLayout, shellLayoutManager } from "../../../desktop/shell/layout-store.ts";
import { defaultNavigationState } from "../../../desktop/shell/navigation/navigation-store.ts";
import { workspaceLayoutManager } from "../../../desktop/shell/layout/layout-manager.ts";
import { emptyProjectMemory, projectMemoryStore } from "../../../desktop/shell/workspace-state/project-memory.ts";
import { sessionStore } from "../../../desktop/shell/workspace-state/session-store.ts";
import { checksumPayload, validateSnapshot } from "../../../desktop/shell/workspace-state/state-validation.ts";
import { WorkspaceStateEngine } from "../../../desktop/shell/workspace-state/workspace-state-engine.ts";
import {
  patchPreferencesForHomeStartup,
  patchShellForHomeStartup,
  PERSISTED_NAVIGATION_VERSION_KEY,
  resetPersistedNavigationInStorage,
  sanitizeSnapshotForColdStart,
  STARTUP_HOME_WORKSPACE,
} from "../../../desktop/shell/startup-navigation.ts";
import type { WorkspaceStateSnapshot } from "../../../desktop/shell/workspace-state/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { Object.keys(store).forEach((k) => delete store[k]); },
  });
  return store;
}

function buildSnapshot(workspace: string, projectName = "Oxford"): WorkspaceStateSnapshot {
  const base = {
    version: 1 as const,
    id: "snap-test",
    savedAt: new Date().toISOString(),
    saveMode: "auto" as const,
    cleanShutdown: true,
    session: sessionStore.startSession(workspace as WorkspaceStateSnapshot["shell"]["workspace"], projectName, "default"),
    shell: { ...defaultShellLayout, workspace: workspace as WorkspaceStateSnapshot["shell"]["workspace"] },
    navigation: defaultNavigationState,
    layoutManager: workspaceLayoutManager.load(),
    preferences: { ...defaultPreferences, lastWorkspace: workspace as WorkspaceStateSnapshot["shell"]["workspace"] },
    dashboard: null,
    projectMemory: { ...emptyProjectMemory(), projectName },
    ui: { activeSidebar: "left" as const, activeTabs: {}, scrollPositions: {}, selectedItems: [], zoomLevel: 100 },
  };
  return { ...base, checksum: checksumPayload(base) };
}

describe("startup navigation reset", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockStorage();
  });

  it("forces home workspace in shell and preferences patches", () => {
    const shell = patchShellForHomeStartup({ ...defaultShellLayout, workspace: "product-information" });
    expect(shell.workspace).toBe(STARTUP_HOME_WORKSPACE);

    const prefs = patchPreferencesForHomeStartup({ ...defaultPreferences, lastWorkspace: "marketing" });
    expect(prefs.lastWorkspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(prefs.theme).toBe(defaultPreferences.theme);
  });

  it("sanitizes cold-start snapshots without removing project memory", () => {
    const snapshot = buildSnapshot("storyboard");
    const sanitized = sanitizeSnapshotForColdStart(snapshot);
    expect(sanitized.shell.workspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(sanitized.preferences.lastWorkspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(sanitized.projectMemory.projectName).toBe("Oxford");
  });

  it("recomputes checksum after cold-start sanitization so applySnapshot succeeds", () => {
    const snapshot = buildSnapshot("product-information");
    expect(validateSnapshot(snapshot).valid).toBe(true);
    const sanitized = sanitizeSnapshotForColdStart(snapshot);
    expect(validateSnapshot(sanitized).valid).toBe(true);
    expect(sanitized.checksum).not.toBe(snapshot.checksum);
  });

  it("resets only navigation keys in localStorage", () => {
    shellLayoutManager.save({ ...defaultShellLayout, workspace: "generated-videos" });
    resetPersistedNavigationInStorage();
    expect(shellLayoutManager.load().workspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(localStorage.getItem(PERSISTED_NAVIGATION_VERSION_KEY)).toBe("2");
  });
});

describe("startup restore with existing persisted session", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockStorage();
  });

  function createEngine() {
    const engine = new WorkspaceStateEngine();
    let shell = { ...defaultShellLayout, workspace: STARTUP_HOME_WORKSPACE };
    let navigation = { ...defaultNavigationState };
    let layoutManager = workspaceLayoutManager.load();
    let preferences = { ...defaultPreferences };
    engine.setProviders({
      getShell: () => shell,
      getNavigation: () => navigation,
      getLayoutManager: () => layoutManager,
      getPreferences: () => preferences,
      applyShell: (next) => { shell = next; },
      applyPreferences: (next) => { preferences = next; },
    });
    return { engine, getShell: () => shell };
  }

  it("restores existing account snapshot to Home without throwing", () => {
    const { engine, getShell } = createEngine();
    const snapshot = buildSnapshot("marketing");
    localStorage.setItem("kwizera.workspace-state.snapshot.v1", JSON.stringify(snapshot));
    const report = engine.restoreOnStartup();
    expect(report.restored).toBe(true);
    expect(getShell().workspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(projectMemoryStore.load().projectName).toBe("Oxford");
  });

  it("recovers unclean shutdown with emergency snapshot and opens Home", () => {
    const { engine, getShell } = createEngine();
    const snapshot = buildSnapshot("rendering");
    localStorage.setItem("kwizera.workspace-state.emergency.v1", JSON.stringify(snapshot));
    localStorage.setItem("kwizera.workspace-crash-flag.v1", JSON.stringify({ unclean: true, at: new Date().toISOString() }));
    const report = engine.restoreOnStartup();
    expect(report.recoveredFromCrash).toBe(true);
    expect(getShell().workspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(projectMemoryStore.load().projectName).toBe("Oxford");
  });

  it("ignores corrupt snapshot checksum without wiping standalone project memory", () => {
    const { engine, getShell } = createEngine();
    projectMemoryStore.save({ ...emptyProjectMemory(), projectName: "Keep Me", productionProgress: 55 });
    const corrupt = buildSnapshot("product-information");
    corrupt.checksum = "fnv1a-deadbeef";
    localStorage.setItem("kwizera.workspace-state.snapshot.v1", JSON.stringify(corrupt));
    const report = engine.restoreOnStartup();
    expect(report.restored).toBe(false);
    expect(getShell().workspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(projectMemoryStore.load().projectName).toBe("Keep Me");
    expect(projectMemoryStore.load().productionProgress).toBe(55);
  });

  it("fresh account with no snapshot starts on Home", () => {
    const { engine, getShell } = createEngine();
    const report = engine.restoreOnStartup();
    expect(report.restored).toBe(false);
    expect(report.source).toBe("fresh");
    expect(getShell().workspace).toBe(STARTUP_HOME_WORKSPACE);
  });
});
