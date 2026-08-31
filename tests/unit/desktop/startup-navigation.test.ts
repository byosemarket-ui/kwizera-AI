import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPreferences } from "../../../desktop/desktop-polish/preference-defaults.ts";
import { defaultShellLayout, shellLayoutManager } from "../../../desktop/shell/layout-store.ts";
import {
  patchPreferencesForHomeStartup,
  patchShellForHomeStartup,
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
    const snapshot = {
      version: 1 as const,
      id: "snap-test",
      savedAt: new Date().toISOString(),
      saveMode: "auto" as const,
      cleanShutdown: true,
      session: { id: "sess-1", startedAt: "", workspace: "storyboard", projectName: "Oxford", layoutId: null, closedAt: null },
      shell: { ...defaultShellLayout, workspace: "storyboard" },
      navigation: { favorites: [], history: [], recent: [], visitCounts: {}, pinned: false, collapsedGroups: [], quickAccess: [], commandCounts: {}, recentPanels: [], frequentProjects: [], frequentAssets: [], frequentAiActions: [] },
      layoutManager: { activeLayoutId: "default", layouts: [] },
      preferences: { ...defaultPreferences, lastWorkspace: "storyboard" },
      dashboard: null,
      projectMemory: { projectName: "Oxford", lastOpenedAt: "", recentProjects: ["Oxford"] },
      ui: { activeSidebar: "left", activeTabs: {}, scrollPositions: {}, selectedItems: [], zoomLevel: 100 },
      checksum: "test",
    } satisfies WorkspaceStateSnapshot;

    const sanitized = sanitizeSnapshotForColdStart(snapshot);
    expect(sanitized.shell.workspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(sanitized.preferences.lastWorkspace).toBe(STARTUP_HOME_WORKSPACE);
    expect(sanitized.projectMemory.projectName).toBe("Oxford");
  });

  it("resets only navigation keys in localStorage", () => {
    shellLayoutManager.save({ ...defaultShellLayout, workspace: "generated-videos" });
    resetPersistedNavigationInStorage();
    expect(shellLayoutManager.load().workspace).toBe(STARTUP_HOME_WORKSPACE);
  });
});
