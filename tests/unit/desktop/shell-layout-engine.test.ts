import { describe, expect, it, beforeEach, vi } from "vitest";
import { shellLayoutManager, defaultShellLayout } from "../../../desktop/shell/layout-store.ts";
import { panelEngine, createDefaultPanels } from "../../../desktop/shell/panel-engine.ts";
import { buildAiMeWorkspaceContext, explainWorkspaceForAiMe } from "../../../desktop/shell/aime-awareness.ts";
import { mapLegacyWorkspace, workspaceNav, workspaceTiers } from "../../../desktop/shell/workspace-registry.ts";

describe("Shell Layout Store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
    });
  });

  it("loads default layout when storage is empty", () => {
    const layout = shellLayoutManager.load();
    expect(layout.workspace).toBe("home");
    expect(layout.leftCollapsed).toBe(false);
    expect(layout.rightOpen).toBe(true);
    expect(layout.panels.length).toBeGreaterThan(0);
  });

  it("persists layout changes", () => {
    const patched = shellLayoutManager.patch(defaultShellLayout, { leftCollapsed: true, bottomExpanded: true });
    shellLayoutManager.save(patched);
    const loaded = shellLayoutManager.load();
    expect(loaded.leftCollapsed).toBe(true);
    expect(loaded.bottomExpanded).toBe(true);
  });

  it("migrates legacy v1 workspace IDs", () => {
    localStorage.setItem("kwizera.desktop-workspace.v1", JSON.stringify({ workspace: "dashboard", leftCollapsed: true }));
    const layout = shellLayoutManager.load();
    expect(layout.workspace).toBe("home");
    expect(layout.leftCollapsed).toBe(true);
  });
});

describe("Panel Engine", () => {
  it("creates default panels with future module slots", () => {
    const panels = createDefaultPanels();
    expect(panels.some((p) => p.id === "production-main")).toBe(true);
    expect(panels.some((p) => p.moduleSlot === "storyboard")).toBe(true);
    expect(panels.filter((p) => p.mode === "hidden").length).toBeGreaterThan(0);
  });

  it("supports dock, float, resize, lock, and fullscreen modes", () => {
    let layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    layout = panelEngine.floatPanel(layout, "production-main");
    expect(panelEngine.getPanel(layout, "production-main")?.mode).toBe("floating");

    layout = panelEngine.dockPanel(layout, "production-main", "center");
    expect(panelEngine.getPanel(layout, "production-main")?.zone).toBe("center");

    layout = panelEngine.resizePanel(layout, "ai-assist", { width: 320 });
    expect(panelEngine.getPanel(layout, "ai-assist")?.width).toBe(320);

    layout = panelEngine.toggleLock(layout, "slot-product-input");
    expect(panelEngine.getPanel(layout, "slot-product-input")?.locked).toBe(false);

    layout = panelEngine.toggleFullscreen(layout, "production-main");
    expect(panelEngine.getPanel(layout, "production-main")?.mode).toBe("fullscreen");
  });

  it("prevents changes to locked panels", () => {
    const layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    const locked = panelEngine.getPanel(layout, "slot-storyboard");
    expect(locked?.locked).toBe(true);
    const result = panelEngine.setMode(layout, "slot-storyboard", "docked");
    expect(panelEngine.getPanel(result, "slot-storyboard")?.mode).toBe("hidden");
  });
});

describe("Workspace Registry", () => {
  it("defines professional navigation items from the product workspace", () => {
    expect(workspaceNav.length).toBeGreaterThanOrEqual(20);
    expect(workspaceNav.map((n) => n.label)).toContain("Home");
    expect(workspaceNav.map((n) => n.label)).toContain("AI Me");
    expect(workspaceNav.map((n) => n.label)).toContain("Production");
  });

  it("maps legacy workspace IDs", () => {
    expect(mapLegacyWorkspace("dashboard")).toBe("home");
    expect(mapLegacyWorkspace("ai")).toBe("ai-me");
    expect(mapLegacyWorkspace("projects")).toBe("open-project");
    expect(mapLegacyWorkspace("unknown")).toBe("home");
  });

  it("assigns tier to every workspace", () => {
    for (const item of workspaceNav) {
      expect(workspaceTiers[item.id]).toBeDefined();
    }
  });
});

describe("AI Me Workspace Awareness", () => {
  it("builds complete workspace context", () => {
    const context = buildAiMeWorkspaceContext(defaultShellLayout, {
      aiCore: true,
      workflowEngine: true,
      communicationBus: true,
      moduleManager: true,
      memoryFoundation: true,
      knowledgeFoundation: true,
      activeProject: "Test Project",
    });

    expect(context.structure.activeWorkspace).toBe("home");
    expect(context.structure.regions).toHaveLength(5);
    expect(context.futureModules).toContain("storyboard");
    expect(context.explanation).toContain("KWIZERA AI STUDIO");
    expect(context.project.name).toBe("Test Project");
  });

  it("explains each workspace for AI Me", () => {
    const explanation = explainWorkspaceForAiMe("ai-me");
    expect(explanation).toContain("AI Me");
  });
});

describe("Layout Integrity Checks", () => {
  it("maintains panel count after patch operations", () => {
    let layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    const initialCount = layout.panels.length;
    layout = panelEngine.toggleFullscreen(layout, "production-main");
    layout = shellLayoutManager.patch(layout, { zen: true, bottomExpanded: true });
    expect(layout.panels.length).toBe(initialCount);
  });

  it("toggle bottom panel state", () => {
    const expanded = shellLayoutManager.toggleBottom(defaultShellLayout);
    expect(expanded.bottomExpanded).toBe(true);
    const collapsed = shellLayoutManager.toggleBottom(expanded);
    expect(collapsed.bottomExpanded).toBe(false);
  });
});
