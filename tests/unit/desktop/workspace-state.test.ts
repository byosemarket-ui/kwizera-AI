import { describe, expect, it, beforeEach, vi } from "vitest";
import { WorkspaceStateEngine } from "../../../desktop/shell/workspace-state/workspace-state-engine.ts";
import { projectMemoryStore, emptyProjectMemory } from "../../../desktop/shell/workspace-state/project-memory.ts";
import { sessionStore } from "../../../desktop/shell/workspace-state/session-store.ts";
import { checksumPayload, validateSnapshot } from "../../../desktop/shell/workspace-state/state-validation.ts";
import { buildAiMeStateContext, explainAutoSaveForAiMe } from "../../../desktop/shell/workspace-state/aime-state-awareness.ts";
import { defaultShellLayout } from "../../../desktop/shell/layout-store.ts";
import { defaultNavigationState } from "../../../desktop/shell/navigation/navigation-store.ts";
import { workspaceLayoutManager } from "../../../desktop/shell/layout/layout-manager.ts";
import { defaultPreferences } from "../../../desktop/desktop-polish/preference-store.ts";
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

function createEngine() {
  const engine = new WorkspaceStateEngine();
  let shell = { ...defaultShellLayout };
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
  return {
    engine,
    setShell: (next: typeof shell) => { shell = next; },
    getShell: () => shell,
  };
}

describe("Workspace State Validation", () => {
  beforeEach(() => mockStorage());

  it("rejects missing and corrupt snapshots", () => {
    expect(validateSnapshot(null).valid).toBe(false);
    expect(validateSnapshot({ version: 2 }).valid).toBe(false);
    const base = {
      version: 1 as const,
      id: "snap-1",
      savedAt: new Date().toISOString(),
      saveMode: "manual" as const,
      cleanShutdown: true,
      session: sessionStore.startSession("home", "Demo", "default"),
      shell: defaultShellLayout,
      navigation: defaultNavigationState,
      layoutManager: workspaceLayoutManager.load(),
      preferences: defaultPreferences,
      projectMemory: emptyProjectMemory(),
      ui: { activeSidebar: "left" as const, activeTabs: {}, scrollPositions: {}, selectedItems: [], zoomLevel: 100 },
    };
    const good: WorkspaceStateSnapshot = { ...base, checksum: checksumPayload(base) };
    expect(validateSnapshot(good).valid).toBe(true);
    expect(validateSnapshot({ ...good, checksum: "fnv1a-deadbeef" }).valid).toBe(false);
  });
});

describe("Project Memory", () => {
  beforeEach(() => mockStorage());

  it("syncs active project without wiping progress", () => {
    projectMemoryStore.save({
      ...emptyProjectMemory(),
      projectId: "local-demo",
      projectName: "Demo",
      productionProgress: 42,
      storyboardProgress: 20,
    });
    const synced = projectMemoryStore.syncFromRuntime("Demo");
    expect(synced.productionProgress).toBe(42);
    expect(synced.projectName).toBe("Demo");
    const next = projectMemoryStore.syncFromRuntime("Launch Kit");
    expect(next.projectName).toBe("Launch Kit");
    expect(next.productionProgress).toBe(42);
  });

  it("records AI decisions and uploads", () => {
    projectMemoryStore.recordAiDecision("Prefer cinematic lighting");
    projectMemoryStore.recordUploadedImage("hero.png", 1024);
    const memory = projectMemoryStore.load();
    expect(memory.aiDecisions[0].summary).toContain("cinematic");
    expect(memory.uploadedImages[0].name).toBe("hero.png");
  });
});

describe("Session Management", () => {
  beforeEach(() => mockStorage());

  it("starts, touches, and closes sessions", () => {
    const session = sessionStore.startSession("production", "Demo", "default");
    expect(sessionStore.getCurrent()?.id).toBe(session.id);
    const touched = sessionStore.touch(session.id);
    expect(touched?.lastActiveAt).toBeTruthy();
    sessionStore.closeSession(true);
    expect(sessionStore.getCurrent()).toBeNull();
    expect(sessionStore.loadRegistry().lastClosedProject).toBe("Demo");
  });

  it("keeps workspace history entries", () => {
    sessionStore.pushHistory("workspace", "Switched to production");
    sessionStore.pushHistory("ai", "Recommended creative layout");
    expect(sessionStore.loadHistory().entries.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Auto Save & Restore", () => {
  beforeEach(() => mockStorage());

  it("persists a validated snapshot and restores it", () => {
    const { engine, setShell, getShell } = createEngine();
    projectMemoryStore.syncFromRuntime("Studio Project");
    setShell({ ...defaultShellLayout, workspace: "production", zen: true });
    const snapshot = engine.persist("manual");
    expect(snapshot.checksum).toMatch(/^fnv1a-/);
    expect(validateSnapshot(snapshot).valid).toBe(true);

    setShell({ ...defaultShellLayout, workspace: "home", zen: false });
    engine.applySnapshot(snapshot);
    expect(getShell().workspace).toBe("production");
    expect(getShell().zen).toBe(true);
    expect(projectMemoryStore.load().projectName).toBe("Studio Project");
  });

  it("marks dirty and flushes via auto save", async () => {
    vi.useFakeTimers();
    const { engine } = createEngine();
    engine.autoSave.markDirty();
    expect(engine.autoSave.getStatus().dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(engine.autoSave.getStatus().dirty).toBe(false);
    expect(engine.autoSave.getStatus().lastSavedAt).toBeTruthy();
    vi.useRealTimers();
  });

  it("writes emergency snapshot and recovers unclean shutdown", () => {
    const { engine, setShell } = createEngine();
    setShell({ ...defaultShellLayout, workspace: "rendering" });
    engine.persist("emergency");
    localStorage.setItem("kwizera.workspace-crash-flag.v1", JSON.stringify({ unclean: true, at: new Date().toISOString() }));
    const report = engine.restoreOnStartup();
    expect(report.restored).toBe(true);
    expect(report.recoveredFromCrash).toBe(true);
    expect(report.source).toBe("emergency");
    expect(report.explanation.toLowerCase()).toContain("emergency");
  });

  it("does not overwrite valid project memory with empty corrupt data", () => {
    const { engine } = createEngine();
    projectMemoryStore.save({
      ...emptyProjectMemory(),
      projectName: "Keep Me",
      productionProgress: 88,
    });
    const snapshot = engine.persist("incremental");
    expect(snapshot.projectMemory.projectName).toBe("Keep Me");
    expect(snapshot.projectMemory.productionProgress).toBe(88);
  });
});

describe("AI Me State Awareness", () => {
  beforeEach(() => mockStorage());

  it("explains session, autosave, and restore", () => {
    sessionStore.startSession("home", "Demo", "default");
    projectMemoryStore.syncFromRuntime("Demo");
    const ctx = buildAiMeStateContext({
      enabled: true,
      mode: "auto",
      lastSavedAt: new Date().toISOString(),
      lastError: null,
      dirty: false,
      inProgress: false,
    }, {
      restored: true,
      source: "session",
      explanation: "Restored last session.",
      snapshotId: "snap-1",
      recoveredFromCrash: false,
    });
    expect(ctx.explanation).toContain("Demo");
    expect(ctx.recommendation.length).toBeGreaterThan(0);
    expect(explainAutoSaveForAiMe({
      enabled: true, mode: "auto", lastSavedAt: null, lastError: null, dirty: true, inProgress: false,
    })).toContain("dirty");
  });
});
