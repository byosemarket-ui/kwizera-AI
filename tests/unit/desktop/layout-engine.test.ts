import { describe, expect, it, beforeEach, vi } from "vitest";
import { panelEngine, createDefaultPanels, FLOATABLE_PANELS } from "../../../desktop/shell/layout/panel-engine.ts";
import { workspaceLayoutManager, createBuiltinLayouts } from "../../../desktop/shell/layout/layout-manager.ts";
import { buildAiMeLayoutContext, explainPanelForAiMe } from "../../../desktop/shell/layout/aime-layout-awareness.ts";
import { defaultShellLayout } from "../../../desktop/shell/layout-store.ts";

describe("Dockable Panel Engine", () => {
  it("creates floatable panels for all required windows", () => {
    const ids = FLOATABLE_PANELS.map((p) => p.id);
    expect(ids).toEqual([
      "ai-assist", "live-preview", "product-analysis", "asset-browser",
      "timeline", "logs", "hardware-monitor",
    ]);
  });

  it("docks panel to left/right/top/bottom/center without overlap in same zone", () => {
    let layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    layout = panelEngine.dockPanel(layout, "ai-assist", "left");
    expect(panelEngine.getPanel(layout, "ai-assist")?.zone).toBe("left");
    layout = panelEngine.dockPanel(layout, "logs", "right");
    const rightPanels = panelEngine.getPanelsInZone(layout, "right");
    expect(rightPanels).toHaveLength(1);
    expect(rightPanels[0].id).toBe("logs");
  });

  it("floats, resizes, and prevents overlap", () => {
    let layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    layout = panelEngine.floatPanel(layout, "timeline", { x: 100, y: 100 });
    layout = panelEngine.floatPanel(layout, "logs", { x: 100, y: 100 });
    const timeline = panelEngine.getPanel(layout, "timeline");
    const logs = panelEngine.getPanel(layout, "logs");
    expect(timeline?.mode).toBe("floating");
    expect(logs?.mode).toBe("floating");
    expect(logs?.floatX).not.toBe(timeline?.floatX);
  });

  it("supports maximize, minimize, collapse, expand, restore", () => {
    let layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    layout = panelEngine.floatPanel(layout, "live-preview");
    layout = panelEngine.maximizePanel(layout, "live-preview");
    expect(panelEngine.getPanel(layout, "live-preview")?.maximized).toBe(true);
    layout = panelEngine.collapsePanel(layout, "live-preview");
    expect(panelEngine.getPanel(layout, "live-preview")?.collapsed).toBe(true);
    layout = panelEngine.expandPanel(layout, "live-preview");
    expect(panelEngine.getPanel(layout, "live-preview")?.collapsed).toBe(false);
    layout = panelEngine.restoreDefaultSize(layout, "live-preview");
    expect(panelEngine.getPanel(layout, "live-preview")?.maximized).toBe(false);
  });

  it("auto-docks when floating near viewport edge", () => {
    let layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    layout = panelEngine.floatPanel(layout, "hardware-monitor", { x: 5, y: 200 });
    layout = panelEngine.autoDock(layout, "hardware-monitor", { width: 1280, height: 800 });
    expect(panelEngine.getPanel(layout, "hardware-monitor")?.zone).toBe("left");
    expect(panelEngine.getPanel(layout, "hardware-monitor")?.mode).toBe("docked");
  });

  it("respects locked panels", () => {
    const layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    const lockedId = layout.panels.find((p) => p.locked)?.id ?? "slot-product-input";
    const before = panelEngine.getPanel(layout, lockedId)?.zone;
    const result = panelEngine.dockPanel(layout, lockedId, "right");
    expect(panelEngine.getPanel(result, lockedId)?.zone).toBe(before);
  });

  it("recommends layout improvements", () => {
    let layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    layout = panelEngine.floatPanel(layout, "timeline");
    layout = panelEngine.floatPanel(layout, "logs");
    layout = panelEngine.floatPanel(layout, "live-preview");
    layout = panelEngine.floatPanel(layout, "product-analysis");
    const rec = panelEngine.recommendLayout(layout);
    expect(rec).toContain("floating");
  });
});

describe("Workspace Layout Manager", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
    });
  });

  it("provides builtin workspace layouts", () => {
    const builtins = createBuiltinLayouts();
    expect(builtins.map((l) => l.name)).toEqual(expect.arrayContaining([
      "Default Workspace",
      "Product Input Workspace",
      "Creative Workspace",
      "Production Workspace",
      "Rendering Workspace",
      "Review Workspace",
    ]));
  });

  it("saves, loads, duplicates, deletes custom layouts", () => {
    let state = workspaceLayoutManager.load();
    state = workspaceLayoutManager.saveLayout(state, { ...defaultShellLayout, panels: createDefaultPanels() }, { name: "My Layout" });
    expect(state.layouts.some((l) => l.name === "My Layout")).toBe(true);
    const customId = state.layouts.find((l) => l.name === "My Layout")!.id;
    state = workspaceLayoutManager.loadLayout(state, customId);
    expect(state.activeLayoutId).toBe(customId);
    state = workspaceLayoutManager.duplicateLayout(state, customId);
    expect(state.layouts.filter((l) => l.name.includes("Copy")).length).toBe(1);
    state = workspaceLayoutManager.deleteLayout(state, customId);
    expect(state.layouts.some((l) => l.id === customId)).toBe(false);
  });

  it("resets to default and keeps history", () => {
    let state = workspaceLayoutManager.load();
    state = workspaceLayoutManager.loadLayout(state, "creative");
    state = workspaceLayoutManager.resetToDefault(state);
    expect(state.activeLayoutId).toBe("default");
    expect(state.history.length).toBeGreaterThan(0);
  });

  it("applies preset to shell without losing workspace route", () => {
    const state = workspaceLayoutManager.load();
    const preset = workspaceLayoutManager.getActive(workspaceLayoutManager.loadLayout(state, "production"));
    const applied = workspaceLayoutManager.applyToShell({ ...defaultShellLayout, workspace: "home" }, preset);
    expect(applied.workspace).toBe("home");
    expect(applied.bottomExpanded).toBe(true);
  });
});

describe("AI Me Layout Awareness", () => {
  it("explains panel and layout context", () => {
    const layout = { ...defaultShellLayout, panels: createDefaultPanels() };
    const ctx = buildAiMeLayoutContext(layout, workspaceLayoutManager.load());
    expect(ctx.activeLayoutName).toBeTruthy();
    expect(ctx.explanation).toContain("layout");
    expect(explainPanelForAiMe("ai-assist", layout)).toContain("AI Me");
  });
});
