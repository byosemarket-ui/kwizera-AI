import { describe, expect, it, beforeEach, vi } from "vitest";
import { dashboardWidgetStore, defaultDashboardLayout, DEFAULT_WIDGETS } from "../../../desktop/dashboard/widget-store.ts";
import { dashboardLiveEngine } from "../../../desktop/dashboard/live-engine.ts";
import { buildAiMeDashboardContext, guideDashboardWidget } from "../../../desktop/dashboard/aime-dashboard-awareness.ts";
import { PRODUCTION_MODULES, RESERVED_PANELS } from "../../../desktop/dashboard/widgets/module-slots.tsx";

describe("Dashboard Widget Store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
    });
  });

  it("loads default widget layout with 12 widgets", () => {
    const layout = dashboardWidgetStore.load();
    expect(layout.version).toBe(3);
    expect(layout.widgets.length).toBe(DEFAULT_WIDGETS.length);
    expect(layout.columns).toBe(12);
  });

  it("persists widget positions and visibility", () => {
    let layout = dashboardWidgetStore.moveWidget(defaultDashboardLayout, "active-project", 2, 4);
    layout = dashboardWidgetStore.toggleHidden(layout, "notifications");
    dashboardWidgetStore.save(layout);
    const loaded = dashboardWidgetStore.load();
    const active = loaded.widgets.find((w) => w.id === "active-project");
    expect(active?.x).toBe(2);
    expect(active?.y).toBe(4);
    expect(loaded.widgets.find((w) => w.id === "notifications")?.hidden).toBe(true);
  });

  it("supports pin, lock, resize, and compact", () => {
    let layout = dashboardWidgetStore.togglePin(defaultDashboardLayout, "statistics");
    layout = dashboardWidgetStore.resizeWidget(layout, "last-activity", 8, 4);
    layout = dashboardWidgetStore.toggleLock(layout, "last-activity");
    layout = dashboardWidgetStore.toggleCompact(layout, "statistics");
    const stats = layout.widgets.find((w) => w.id === "statistics");
    const activity = layout.widgets.find((w) => w.id === "last-activity");
    expect(stats?.pinned).toBe(true);
    expect(stats?.compact).toBe(true);
    expect(activity?.locked).toBe(true);
    expect(activity?.w).toBe(8);
  });

  it("prevents move/resize on locked widgets", () => {
    const locked = defaultDashboardLayout;
    const moved = dashboardWidgetStore.moveWidget(locked, "production-modules", 5, 5);
    expect(moved.widgets.find((w) => w.id === "production-modules")?.x).toBe(1);
  });

  it("migrates legacy business-dashboard layout", () => {
    localStorage.setItem("kwizera.business-dashboard.layout.v1", JSON.stringify({ hidden: ["kpis"], compact: ["actions"] }));
    const layout = dashboardWidgetStore.load();
    expect(layout.widgets.find((w) => w.id === "statistics")?.hidden).toBe(true);
    expect(layout.widgets.find((w) => w.id === "quick-actions")?.compact).toBe(true);
  });
});

describe("Dashboard Live Engine", () => {
  it("builds live status cards", () => {
    const snapshot = dashboardLiveEngine.buildSnapshot(
      {
        aiCore: true, workflowEngine: true, communicationBus: true, moduleManager: true,
        memoryFoundation: true, knowledgeFoundation: true, activeProject: "Demo",
        runtimeMetrics: { memoryMb: 512, cpuUserMs: 10, gpu: "Local", activeJobs: 2 },
      },
      { activeProject: { id: "1", name: "Demo", modifiedAt: new Date().toISOString(), productImages: [{ sizeBytes: 1024 }] }, projects: [] },
      "Home",
      { jobs: [{ id: "j1", status: "running", stage: "rendering", progress: 40, updatedAt: new Date().toISOString() }], history: [] },
    );
    expect(snapshot.statuses).toHaveLength(6);
    expect(snapshot.statuses.map((s) => s.key)).toEqual([
      "active-project", "production", "ai", "rendering", "knowledge", "storage",
    ]);
    expect(snapshot.progress.percent).toBeGreaterThan(0);
    expect(snapshot.aiRecommendation).toContain("Production");
  });

  it("updates progress tasks with running and waiting counts", () => {
    const progress = dashboardLiveEngine.buildProgress(2, {
      jobs: [
        { id: "a", status: "running", stage: "rendering", progress: 40 },
        { id: "b", status: "queued", stage: "export", progress: 0 },
      ],
      history: [{ id: "c", status: "completed", stage: "analysis", progress: 100 }],
    });
    expect(progress.running).toBe(1);
    expect(progress.waiting).toBe(1);
    expect(progress.tasks.length).toBe(4);
  });

  it("does not invent running jobs when the pipeline is idle", () => {
    const progress = dashboardLiveEngine.buildProgress(0, { jobs: [], history: [] });
    expect(progress.running).toBe(0);
    expect(progress.waiting).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.tasks.every((task) => task.status === "waiting")).toBe(true);
  });
});

describe("Production & Reserved Placeholders", () => {
  it("defines all production module placeholders", () => {
    expect(PRODUCTION_MODULES.map((m) => m.id)).toEqual([
      "product-upload", "product-analysis", "marketing", "storyboard",
      "image-generation", "audio-generation", "video-generation", "rendering", "export",
    ]);
  });

  it("defines reserved panel placeholders", () => {
    expect(RESERVED_PANELS.map((p) => p.id)).toEqual([
      "product-input", "ai-analysis", "live-preview", "timeline", "output", "ai-me",
    ]);
  });
});

describe("AI Me Dashboard Awareness", () => {
  it("builds dashboard context for AI Me", () => {
    const layout = dashboardWidgetStore.load();
    const ctx = buildAiMeDashboardContext(layout, {
      updatedAt: new Date().toISOString(),
      statuses: [],
      progress: dashboardLiveEngine.buildProgress(1, { jobs: [{ id: "j", status: "running", stage: "rendering", progress: 20 }], history: [] }),
      activeProject: "Nike Shoes",
      workspaceLabel: "Home",
      aiRecommendation: "Start with storyboard.",
      lastActivity: "Updated 5m ago",
      recentProduction: "Nike Shoes",
    });
    expect(ctx.layout.visibleWidgets.length).toBeGreaterThan(0);
    expect(ctx.explanation).toContain("dashboard");
    expect(ctx.live.activeProject).toBe("Nike Shoes");
  });

  it("guides user to dashboard widgets", () => {
    expect(guideDashboardWidget("live-status")).toContain("live-status");
  });
});
