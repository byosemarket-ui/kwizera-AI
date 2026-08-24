import { describe, expect, it, beforeEach, vi } from "vitest";
import { defaultPreferences } from "../../../desktop/desktop-polish/preference-defaults.ts";
import { validateAndRepairPreferences } from "../../../desktop/desktop-polish/preference-validation.ts";
import { DesktopPreferenceManager } from "../../../desktop/desktop-polish/preference-store.ts";
import { navigationStore, defaultNavigationState } from "../../../desktop/shell/navigation/navigation-store.ts";
import { decideSmartStartup } from "../../../desktop/shell/personalization/smart-startup.ts";
import { buildPersonalizedQuickAccess, rankQuickActions } from "../../../desktop/shell/personalization/smart-quick-access.ts";
import {
  applyPreferenceProfile,
  exportPreferenceProfile,
  parsePreferenceProfile,
} from "../../../desktop/shell/personalization/preference-profiles.ts";
import { personalizationEngine } from "../../../desktop/shell/personalization/personalization-engine.ts";
import { buildAiMePersonalizationContext } from "../../../desktop/shell/personalization/aime-personalization-awareness.ts";
import { defaultShellLayout } from "../../../desktop/shell/layout-store.ts";
import type { RestoreReport } from "../../../desktop/shell/workspace-state/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { Object.keys(store).forEach((k) => delete store[k]); },
  });
}

describe("Preference Validation", () => {
  it("repairs corrupt and legacy preferences", () => {
    const corrupt = validateAndRepairPreferences(null);
    expect(corrupt.repaired).toBe(true);
    expect(corrupt.preferences.startupMode).toBe("restore-session");

    const legacy = validateAndRepairPreferences({
      theme: "dark",
      accent: "mint",
      uiScale: 100,
      fontScale: 100,
      highContrast: false,
      reducedMotion: false,
      activeProfile: "default",
      lastWorkspace: "dashboard",
      window: { width: 0, height: 0, x: 0, y: 0 },
    });
    expect(legacy.preferences.lastWorkspace).toBe("home");
    expect(legacy.preferences.language).toBe("en");
    expect(legacy.preferences.autoSavePreferences.enabled).toBe(true);
    expect(legacy.warnings.length).toBeGreaterThan(0);
  });

  it("rejects invalid scale by clamping via repair", () => {
    const result = validateAndRepairPreferences({
      ...defaultPreferences,
      uiScale: 999,
    });
    expect(result.preferences.uiScale).toBe(100);
  });
});

describe("Navigation Memory", () => {
  beforeEach(() => mockStorage());

  it("tracks visit counts and ranks frequent pages", () => {
    let state = defaultNavigationState;
    state = navigationStore.visit(state, "production");
    state = navigationStore.visit(state, "production");
    state = navigationStore.visit(state, "storyboard");
    expect(state.visitCounts.production).toBe(2);
    expect(navigationStore.rankFrequentWorkspaces(state)[0]).toBe("production");
    expect(state.recent[0]).toBe("storyboard");
  });

  it("records commands, panels, projects, and assets", () => {
    let state = defaultNavigationState;
    state = navigationStore.recordCommand(state, "render");
    state = navigationStore.recordPanel(state, "timeline");
    state = navigationStore.recordProject(state, "Nike");
    state = navigationStore.recordAsset(state, "hero.png");
    state = navigationStore.recordAiAction(state, "suggest-layout");
    expect(state.commandCounts.render).toBe(1);
    expect(state.recentPanels[0]).toBe("timeline");
    expect(state.frequentProjects[0]).toBe("Nike");
    expect(state.frequentAssets[0]).toBe("hero.png");
    expect(state.frequentAiActions[0]).toBe("suggest-layout");
  });
});

describe("Smart Startup", () => {
  const baseRestore = (over: Partial<RestoreReport> = {}): RestoreReport => ({
    restored: true,
    source: "session",
    explanation: "Restored session",
    snapshotId: "snap-1",
    recoveredFromCrash: false,
    ...over,
  });

  it("resumes session when configured", () => {
    const decision = decideSmartStartup({
      preferences: { ...defaultPreferences, startupMode: "restore-session" },
      restore: baseRestore(),
      shell: { ...defaultShellLayout, workspace: "storyboard" },
      lastProject: "Demo",
    });
    expect(decision.workspace).toBe("storyboard");
    expect(decision.explanation).toContain("Resumed previous session");
  });

  it("opens dashboard or production by preference", () => {
    expect(decideSmartStartup({
      preferences: { ...defaultPreferences, startupMode: "dashboard" },
      restore: baseRestore(),
      shell: { ...defaultShellLayout, workspace: "storyboard" },
      lastProject: null,
    }).workspace).toBe("home");

    expect(decideSmartStartup({
      preferences: { ...defaultPreferences, startupMode: "production" },
      restore: baseRestore(),
      shell: defaultShellLayout,
      lastProject: null,
    }).workspace).toBe("production");
  });

  it("keeps crash recovery workspace", () => {
    const decision = decideSmartStartup({
      preferences: { ...defaultPreferences, startupMode: "dashboard" },
      restore: baseRestore({ recoveredFromCrash: true }),
      shell: { ...defaultShellLayout, workspace: "production" },
      lastProject: null,
    });
    expect(decision.workspace).toBe("production");
    expect(decision.explanation.toLowerCase()).toContain("crash");
  });
});

describe("Personalized Quick Access", () => {
  it("ranks actions by command usage when smart", () => {
    const nav = {
      ...defaultNavigationState,
      commandCounts: { export: 5, render: 2, save: 1 },
    };
    const ranked = rankQuickActions(nav, { ...defaultPreferences, quickAccessMode: "smart" });
    expect(ranked[0].id).toBe("export");
    const access = buildPersonalizedQuickAccess(nav, { ...defaultPreferences, quickAccessMode: "smart" });
    expect(access.commands[0]).toBe("export");
  });
});

describe("Preference Profiles", () => {
  beforeEach(() => mockStorage());

  it("exports and imports with confirmation gate", () => {
    const pkg = exportPreferenceProfile("Studio", {
      ...defaultPreferences,
      theme: "light",
      startupMode: "production",
    }, {
      favorites: ["home", "production"],
      pinned: true,
      collapsedGroups: [],
      quickAccess: ["production"],
    });
    expect(pkg.checksum).toMatch(/^fnv1a-/);
    expect(parsePreferenceProfile(pkg).ok).toBe(true);

    const denied = applyPreferenceProfile(pkg, false);
    expect(denied.ok).toBe(false);
    expect(denied.confirmed).toBe(false);

    const manager = new DesktopPreferenceManager();
    manager.save(defaultPreferences);
    const imported = personalizationEngine.importProfileInto(pkg, true, defaultNavigationState);
    expect(imported.result.ok).toBe(true);
    expect(imported.preferences?.theme).toBe("light");
    expect(imported.preferences?.startupMode).toBe("production");
    expect(imported.navigation?.pinned).toBe(true);
  });

  it("rejects corrupted profile checksum", () => {
    const pkg = exportPreferenceProfile("Bad", defaultPreferences);
    const broken = { ...pkg, checksum: "fnv1a-deadbeef" };
    expect(parsePreferenceProfile(broken).ok).toBe(false);
  });
});

describe("AI Me Personalization", () => {
  it("explains preferences and startup", () => {
    const ctx = buildAiMePersonalizationContext(
      { ...defaultPreferences, startupMode: "profile", activeProfile: "creative" },
      {
        ...defaultNavigationState,
        visitCounts: { production: 9, "ai-me": 3 },
      },
      {
        mode: "profile",
        workspace: "storyboard",
        openWelcome: false,
        openLastProject: false,
        explanation: "Opened Creative Workspace.",
        applied: true,
      },
    );
    expect(ctx.explanation).toContain("Creative Workspace");
    expect(ctx.recommendation.length).toBeGreaterThan(0);
  });
});
