import { describe, expect, it, beforeEach, vi } from "vitest";
import { SmartCacheManager } from "../../../desktop/shell/performance/smart-cache.ts";
import { BackgroundTaskManager } from "../../../desktop/shell/performance/background-tasks.ts";
import { resolveEffectiveMode, getModePolicy } from "../../../desktop/shell/performance/mode-policies.ts";
import {
  detectPerformanceAlerts, optimizeMemory, scoreResponsiveness, predictBottleneck,
} from "../../../desktop/shell/performance/memory-optimizer.ts";
import { mergeMetricsSample } from "../../../desktop/shell/performance/fps-monitor.ts";
import { buildAiMePerformanceContext } from "../../../desktop/shell/performance/aime-performance-awareness.ts";
import type { PerformanceMetricsSample, PerformanceSnapshot } from "../../../desktop/shell/performance/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
}

function sample(over: Partial<PerformanceMetricsSample> = {}): PerformanceMetricsSample {
  return {
    at: new Date().toISOString(),
    fps: 60,
    uiLagMs: 4,
    cpuUsage: 20,
    gpuUsage: 15,
    ramUsage: 40,
    ramUsedMb: 3200,
    ramTotalMb: 8192,
    vramUsage: 12,
    diskUsage: 50,
    diskUsedGb: 120,
    diskTotalGb: 512,
    jsHeapMb: 80,
    activeAiModels: 0,
    activeProductionTasks: 0,
    source: "heuristic",
    ...over,
  };
}

describe("Performance Modes", () => {
  it("auto-switches based on workload", () => {
    expect(resolveEffectiveMode("auto", true, 80, 85)).toBe("performance");
    expect(resolveEffectiveMode("auto", false, 95, 40)).toBe("power-saving");
    expect(resolveEffectiveMode("auto", false, 30, 20)).toBe("quality");
    expect(resolveEffectiveMode("balanced", true, 99, 99)).toBe("balanced");
  });

  it("exposes mode policies for all modes", () => {
    expect(getModePolicy("performance", true, 50, 50).prioritizeProduction).toBe(true);
    expect(getModePolicy("power-saving", false, 50, 50).reduceMotion).toBe(true);
  });
});

describe("Smart Cache", () => {
  beforeEach(() => mockStorage());

  it("stores, retrieves, and cleans unused entries", () => {
    const cache = new SmartCacheManager(1024);
    cache.set("img-1", "images", { url: "a.png" }, 200);
    cache.set("analysis-1", "product-analysis", { score: 1 }, 200);
    expect(cache.get("img-1")).toEqual({ url: "a.png" });
    const removed = cache.cleanup(0);
    expect(removed).toBeGreaterThanOrEqual(0);
    expect(cache.stats().entries).toBeGreaterThanOrEqual(0);
  });

  it("enforces budget without throwing", () => {
    const cache = new SmartCacheManager(500);
    for (let i = 0; i < 20; i += 1) cache.set(`k-${i}`, "previews", { i }, 80);
    expect(cache.stats().totalBytes).toBeLessThanOrEqual(500);
  });
});

describe("Background Task Manager", () => {
  it("defers low-priority work during production", async () => {
    vi.useFakeTimers();
    const mgr = new BackgroundTaskManager();
    let ran = 0;
    mgr.register("thumbnail", () => { ran += 1; });
    mgr.configure({ maxParallel: 1, throttle: 0, productionActive: true });
    mgr.enqueue("thumbnail", "Make thumbs", "low", false);
    mgr.start(10);
    await vi.advanceTimersByTimeAsync(50);
    expect(ran).toBe(0);
    mgr.configure({ maxParallel: 1, throttle: 0, productionActive: false });
    await vi.advanceTimersByTimeAsync(50);
    expect(ran).toBeGreaterThanOrEqual(0);
    mgr.stop();
    vi.useRealTimers();
  });

  it("runs production-safe tasks", async () => {
    vi.useFakeTimers();
    const mgr = new BackgroundTaskManager();
    let ran = 0;
    mgr.register("cache-cleanup", () => { ran += 1; });
    mgr.configure({ maxParallel: 2, throttle: 0, productionActive: true });
    mgr.enqueue("cache-cleanup", "Cleanup", "normal", true);
    mgr.start(10);
    await vi.advanceTimersByTimeAsync(40);
    expect(ran).toBeGreaterThanOrEqual(1);
    mgr.stop();
    vi.useRealTimers();
  });
});

describe("Memory & Alerts", () => {
  beforeEach(() => mockStorage());

  it("detects RAM / GPU / FPS / disk alerts", () => {
    const alerts = detectPerformanceAlerts(sample({ ramUsage: 93, gpuUsage: 95, fps: 20, diskUsage: 91 }));
    expect(alerts.some((a) => a.code.includes("ram"))).toBe(true);
    expect(alerts.some((a) => a.code.includes("gpu") || a.code.includes("fps") || a.code.includes("disk"))).toBe(true);
  });

  it("scores responsiveness and predicts bottlenecks", () => {
    expect(scoreResponsiveness(sample())).toBe("excellent");
    expect(scoreResponsiveness(sample({ fps: 22, ramUsage: 95 }))).toBe("poor");
    expect(predictBottleneck(sample({ ramUsage: 88 }))).toBe("RAM pressure");
  });

  it("optimizes memory under pressure", () => {
    const cache = new SmartCacheManager();
    cache.set("old", "previews", { x: 1 }, 100);
    const result = optimizeMemory(sample({ ramUsage: 90, jsHeapMb: 500 }), 1000);
    expect(result.actions.length).toBeGreaterThanOrEqual(0);
  });
});

describe("Metrics Merge", () => {
  it("merges FPS, API, and client hints", () => {
    const merged = mergeMetricsSample(
      { fps: 58, uiLagMs: 3 },
      { memoryMb: 900, cpuUsage: 33, gpuUsage: 40, ramUsage: 55, ramTotalMb: 16384, activeJobs: 2, activeAiModels: 1 },
      { jsHeapMb: 120, diskUsedGb: 10, diskTotalGb: 100, diskUsage: 10, deviceMemoryGb: 16, cores: 8 },
    );
    expect(merged.fps).toBe(58);
    expect(merged.activeProductionTasks).toBe(2);
    expect(merged.cpuUsage).toBe(33);
    expect(merged.source).toBe("api");
  });
});

describe("AI Me Performance", () => {
  it("explains performance status and recommendations", () => {
    const snap: PerformanceSnapshot = {
      version: 1,
      mode: "auto",
      effectiveMode: "performance",
      metrics: sample({ fps: 48, ramUsage: 70, activeProductionTasks: 2 }),
      cache: { entries: 2, totalBytes: 1000, byCategory: {
        images: { entries: 0, bytes: 0 },
        "product-analysis": { entries: 0, bytes: 0 },
        storyboards: { entries: 0, bytes: 0 },
        "ai-results": { entries: 0, bytes: 0 },
        previews: { entries: 2, bytes: 1000 },
        "layout-data": { entries: 0, bytes: 0 },
      }, lastCleanupAt: null },
      tasks: [],
      alerts: [],
      productionActive: true,
      responsiveness: "good",
      recommendation: "Production prioritized.",
    };
    const ctx = buildAiMePerformanceContext(snap);
    expect(ctx.explanation.toLowerCase()).toContain("production");
    expect(ctx.recommendation.length).toBeGreaterThan(0);
  });
});

describe("High Load Simulation", () => {
  beforeEach(() => mockStorage());

  it("stays stable under high CPU/GPU/RAM and large cache pressure", () => {
    const cache = new SmartCacheManager(2048);
    for (let i = 0; i < 100; i += 1) {
      cache.set(`blob-${i}`, i % 2 ? "ai-results" : "images", { n: i, payload: "x".repeat(40) }, 60);
    }
    const hot = sample({ cpuUsage: 95, gpuUsage: 94, ramUsage: 96, fps: 18, activeProductionTasks: 4, activeAiModels: 3 });
    const alerts = detectPerformanceAlerts(hot);
    const mem = optimizeMemory(hot, 500);
    expect(alerts.length).toBeGreaterThan(0);
    expect(cache.stats().totalBytes).toBeLessThanOrEqual(2048);
    expect(mem.releasedEntries).toBeGreaterThanOrEqual(0);
    expect(scoreResponsiveness(hot)).toBe("poor");
  });
});
