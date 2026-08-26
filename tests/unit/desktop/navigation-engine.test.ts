import { describe, expect, it, beforeEach, vi } from "vitest";
import { navigationEngine, QUICK_ACTIONS, KEYBOARD_SHORTCUTS } from "../../../desktop/shell/navigation/navigation-engine.ts";
import { navigationStore, defaultNavigationState } from "../../../desktop/shell/navigation/navigation-store.ts";
import { getNavByGroup, mapLegacyWorkspace, workspaceNav } from "../../../desktop/shell/workspace-registry.ts";
import { buildAiMeWorkspaceContext, guideUserToWorkspace } from "../../../desktop/shell/aime-awareness.ts";
import { defaultShellLayout } from "../../../desktop/shell/layout-store.ts";
import { ALL_WORKSPACE_IDS } from "../../../desktop/shell/types.ts";

describe("Navigation Registry", () => {
  it("registers all professional navigation destinations", () => {
    expect(workspaceNav.length).toBeGreaterThanOrEqual(20);
    expect(ALL_WORKSPACE_IDS).toHaveLength(workspaceNav.length);
    const labels = workspaceNav.map((n) => n.label);
    expect(labels).toContain("Home");
    expect(labels).toContain("Knowledge Packs");
    expect(labels).toContain("Production Plan");
    expect(labels).toContain("Production Queue");
    expect(labels).toContain("Creative Planner");
    expect(labels).toContain("Generated Images");
    expect(labels).toContain("Exports");
    expect(labels).toContain("Help");
  });

  it("groups navigation into professional sections", () => {
    const groups = getNavByGroup();
    const names = groups.map((g) => g.label);
    expect(names).toEqual(expect.arrayContaining([
      "Dashboard", "Projects", "Knowledge", "Production", "Creative", "Assets", "Outputs", "Settings",
    ]));
  });

  it("maps legacy workspace IDs without loss", () => {
    expect(mapLegacyWorkspace("dashboard")).toBe("home");
    expect(mapLegacyWorkspace("ai")).toBe("ai-me");
    expect(mapLegacyWorkspace("marketing")).toBe("marketing");
    expect(mapLegacyWorkspace("storyboard")).toBe("storyboard");
  });
});

describe("Navigation Store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
    });
  });

  it("persists favorites, recent, and pin state", () => {
    let state = defaultNavigationState;
    state = navigationStore.visit(state, "production");
    state = navigationStore.toggleFavorite(state, "storyboard");
    state = navigationStore.togglePin(state);
    navigationStore.save(state);
    const loaded = navigationStore.load();
    expect(loaded.recent[0]).toBe("production");
    expect(loaded.favorites).toContain("storyboard");
    expect(loaded.pinned).toBe(true);
  });

  it("toggles group collapse", () => {
    const next = navigationStore.toggleGroup(defaultNavigationState, "assets");
    expect(next.collapsedGroups).toContain("assets");
    expect(navigationStore.toggleGroup(next, "assets").collapsedGroups).not.toContain("assets");
  });
});

describe("Navigation Engine", () => {
  it("builds breadcrumbs with project context", () => {
    const crumbs = navigationEngine.buildBreadcrumb("production", "Nike Shoes");
    expect(crumbs.map((c) => c.label)).toEqual(["Home", "Projects", "Nike Shoes", "Production"]);
  });

  it("searches navigation, commands, and content categories", () => {
    const results = navigationEngine.search("image", {
      projectNames: ["Nike Shoes"],
      assetHints: ["Hero shot"],
    });
    expect(results.some((r) => r.category === "navigation")).toBe(true);
    expect(results.some((r) => r.category === "commands" || r.category === "images" || r.category === "assets")).toBe(true);
  });

  it("returns intelligent suggestions from recent and favorites", () => {
    const suggestions = navigationEngine.getSuggestions({
      ...defaultNavigationState,
      recent: ["ai-me", "production"],
      favorites: ["home"],
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].detail).toMatch(/Frequently used|Recently used|Favorite/);
  });

  it("exposes quick actions and keyboard shortcuts", () => {
    expect(QUICK_ACTIONS.map((a) => a.id)).toEqual(expect.arrayContaining([
      "new-project", "import-images", "analyze-product", "generate-story",
      "generate-images", "generate-video", "render", "export", "save",
    ]));
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThanOrEqual(6);
  });

  it("builds workspace status snapshot", () => {
    const status = navigationEngine.buildWorkspaceStatus(
      { aiCore: true, workflowEngine: true, communicationBus: true, moduleManager: true, memoryFoundation: true, knowledgeFoundation: true, activeProject: "Demo", runtimeMetrics: { memoryMb: 512, cpuUserMs: 10, gpu: "Local", activeJobs: 0 } },
      "in-production",
      false,
    );
    expect(status.ai).toBe("Ready");
    expect(status.offline).toBe(true);
    expect(status.production).toBe("Active");
  });
});

describe("AI Me Navigation Awareness", () => {
  it("includes current page, project, and navigation history", () => {
    const nav = navigationStore.visit(defaultNavigationState, "storyboard");
    const context = buildAiMeWorkspaceContext(
      { ...defaultShellLayout, workspace: "storyboard" },
      { aiCore: true, workflowEngine: true, communicationBus: true, moduleManager: true, memoryFoundation: true, knowledgeFoundation: true, activeProject: "Nike Shoes" },
      "saved",
      "in-production",
      nav,
    );
    expect(context.navigation.currentPage).toBe("Creative Planner");
    expect(context.navigation.breadcrumb).toContain("Nike Shoes");
    expect(context.project.name).toBe("Nike Shoes");
    expect(context.explanation).toContain("Current page");
  });

  it("can guide the user to a workspace", () => {
    const guide = guideUserToWorkspace("knowledge-packs");
    expect(guide).toContain("Knowledge Packs");
    expect(guide).toContain("Ctrl+K");
  });
});
