import type { CoreStatus } from "../types";
import type { WorkspacePerformanceMode } from "./types";
import type {
  PerformanceAlert, PerformanceMetricsSample, PerformanceSnapshot,
} from "./types";
import { backgroundTaskManager } from "./background-tasks";
import { collectClientResourceHints, fpsMonitor, mergeMetricsSample } from "./fps-monitor";
import { getModePolicy, resolveEffectiveMode } from "./mode-policies";
import {
  detectPerformanceAlerts, optimizeMemory, predictBottleneck, scoreResponsiveness,
} from "./memory-optimizer";
import { smartCacheManager } from "./smart-cache";
import { buildAiMePerformanceContext } from "./aime-performance-awareness";

type Listener = (snapshot: PerformanceSnapshot) => void;

export class WorkspacePerformanceEngine {
  private mode: WorkspacePerformanceMode = "balanced";
  private alertsEnabled = true;
  private productionActive = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private lastSnapshot: PerformanceSnapshot | null = null;
  private lastAlertKeys = new Set<string>();
  private core: CoreStatus | null = null;
  private onAlert: ((alert: PerformanceAlert) => void) | null = null;

  constructor() {
    backgroundTaskManager.register("cache-cleanup", () => {
      const policy = this.currentPolicy();
      smartCacheManager.cleanup(policy.cacheTtlMs);
    });
    backgroundTaskManager.register("memory-release", () => {
      if (!this.lastSnapshot) return;
      optimizeMemory(this.lastSnapshot.metrics, this.currentPolicy().cacheTtlMs);
    });
    backgroundTaskManager.register("auto-save", () => {
      /* AppShell autosave remains authoritative — this slot is for coordination only */
    });
    backgroundTaskManager.register("thumbnail", () => {});
    backgroundTaskManager.register("metadata", () => {});
    backgroundTaskManager.register("project-index", () => {});
    backgroundTaskManager.register("ai-analysis", () => {});
  }

  configure(options: {
    mode: WorkspacePerformanceMode;
    alertsEnabled?: boolean;
    cacheMaxMb?: number;
  }): void {
    this.mode = options.mode;
    this.alertsEnabled = options.alertsEnabled !== false;
    if (options.cacheMaxMb) smartCacheManager.setMaxBytes(options.cacheMaxMb * 1024 * 1024);
  }

  setCore(core: CoreStatus | null): void {
    this.core = core;
    const jobs = core?.runtimeMetrics?.activeJobs ?? 0;
    this.productionActive = jobs > 0 || Boolean(core?.activeProject && core.activeProject !== "No active project" && jobs >= 0 && (core as CoreStatus & { projectBusy?: boolean }).projectBusy);
    // Prefer explicit active jobs for production priority
    this.productionActive = (core?.runtimeMetrics?.activeJobs ?? 0) > 0;
  }

  setProductionActive(active: boolean): void {
    this.productionActive = active;
  }

  onPerformanceAlert(handler: (alert: PerformanceAlert) => void): void {
    this.onAlert = handler;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.lastSnapshot) listener(this.lastSnapshot);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    fpsMonitor.start();
    backgroundTaskManager.start(800);
    this.schedule();
    void this.tick();
  }

  stop(): void {
    fpsMonitor.stop();
    backgroundTaskManager.stop();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getSnapshot(): PerformanceSnapshot | null {
    return this.lastSnapshot;
  }

  getCache() {
    return smartCacheManager;
  }

  getTasks() {
    return backgroundTaskManager.list();
  }

  buildAiMeContext() {
    return buildAiMePerformanceContext(this.lastSnapshot);
  }

  /** Manual maintenance — never interrupts production-critical work. */
  runMaintenance(force = false): { cleaned: number; deferred: boolean } {
    if (this.productionActive && !force) {
      backgroundTaskManager.enqueue("cache-cleanup", "Deferred cache cleanup", "low", true);
      return { cleaned: 0, deferred: true };
    }
    const policy = this.currentPolicy();
    const cleaned = smartCacheManager.cleanup(policy.cacheTtlMs);
    backgroundTaskManager.enqueue("memory-release", "Memory release pass", "normal", true);
    return { cleaned, deferred: false };
  }

  cacheLayoutData(key: string, value: unknown): void {
    smartCacheManager.set(key, "layout-data", value);
  }

  cachePreview(key: string, value: unknown): void {
    smartCacheManager.set(key, "previews", value);
  }

  private currentPolicy() {
    const metrics = this.lastSnapshot?.metrics;
    return getModePolicy(
      this.mode,
      this.productionActive,
      metrics?.ramUsage ?? 0,
      metrics?.cpuUsage ?? 0,
    );
  }

  private lastInterval = 0;

  private schedule(): void {
    const interval = this.currentPolicy().metricsIntervalMs;
    if (this.timer && interval === this.lastInterval) return;
    if (this.timer) clearInterval(this.timer);
    this.lastInterval = interval;
    this.timer = setInterval(() => void this.tick(), interval);
  }

  private async tick(): Promise<void> {
    const fps = fpsMonitor.sample();
    const client = await collectClientResourceHints();
    const api = this.core?.runtimeMetrics;
    const metrics = mergeMetricsSample(fps, api, client);
    const effective = resolveEffectiveMode(this.mode, this.productionActive, metrics.ramUsage, metrics.cpuUsage);
    const policy = getModePolicy(this.mode, this.productionActive, metrics.ramUsage, metrics.cpuUsage);

    backgroundTaskManager.configure({
      maxParallel: this.productionActive ? 1 : policy.maxParallelBackground,
      throttle: this.productionActive ? Math.max(policy.backgroundThrottle, 0.6) : policy.backgroundThrottle,
      productionActive: this.productionActive,
    });

    document.documentElement.dataset.perfMode = effective;
    document.documentElement.dataset.perfProduction = this.productionActive ? "1" : "0";
    if (policy.reduceMotion) {
      document.documentElement.classList.add("perf-reduce-motion");
    } else {
      document.documentElement.classList.remove("perf-reduce-motion");
    }

    const mem = optimizeMemory(metrics, policy.cacheTtlMs);
    let alerts = this.alertsEnabled ? [...detectPerformanceAlerts(metrics), ...mem.alerts] : [];
    alerts = dedupeAlerts(alerts).slice(0, 6);

    for (const alert of alerts) {
      const key = alert.code;
      if (!this.lastAlertKeys.has(key)) {
        this.lastAlertKeys.add(key);
        this.onAlert?.(alert);
      }
    }
    // Clear stale codes when recovered
    for (const key of [...this.lastAlertKeys]) {
      if (!alerts.some((a) => a.code === key)) this.lastAlertKeys.delete(key);
    }

    // Periodic gentle maintenance when idle
    if (!this.productionActive && metrics.ramUsage > 60) {
      backgroundTaskManager.enqueue("cache-cleanup", "Idle cache cleanup", "low", true);
    }

    const bottleneck = predictBottleneck(metrics);
    const recommendation = buildRecommendation(this.mode, effective, metrics, bottleneck, this.productionActive);

    const snapshot: PerformanceSnapshot = {
      version: 1,
      mode: this.mode,
      effectiveMode: effective,
      metrics,
      cache: smartCacheManager.stats(),
      tasks: backgroundTaskManager.list(),
      alerts,
      productionActive: this.productionActive,
      responsiveness: scoreResponsiveness(metrics),
      recommendation,
    };

    this.lastSnapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));

    // Reschedule if interval changed with mode
    this.schedule();
  }
}

function dedupeAlerts(alerts: PerformanceAlert[]): PerformanceAlert[] {
  const seen = new Set<string>();
  return alerts.filter((a) => {
    if (seen.has(a.code)) return false;
    seen.add(a.code);
    return true;
  });
}

function buildRecommendation(
  mode: WorkspacePerformanceMode,
  effective: string,
  metrics: PerformanceMetricsSample,
  bottleneck: string | null,
  productionActive: boolean,
): string {
  if (productionActive) {
    return bottleneck
      ? `Production prioritized. Watch ${bottleneck.toLowerCase()}; background tasks remain deferred.`
      : "Production prioritized — generation and render jobs keep CPU/GPU share first.";
  }
  if (mode === "auto") {
    return `Auto selected ${effective}. ${bottleneck ? `Next risk: ${bottleneck}.` : "Resources look stable."}`;
  }
  if (metrics.fps < 40) return "Switch to Performance mode for smoother panel switching and scrolling.";
  if (metrics.ramUsage > 80) return "Enable Power Saving or run maintenance to release unused cache.";
  return `Stay on ${effective} unless quality-critical preview work needs Quality mode.`;
}

export const workspacePerformanceEngine = new WorkspacePerformanceEngine();
