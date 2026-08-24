import { smartCacheManager } from "./smart-cache";
import type { PerformanceAlert, PerformanceMetricsSample } from "./types";

export function optimizeMemory(metrics: PerformanceMetricsSample, ttlMs: number): {
  releasedEntries: number;
  alerts: PerformanceAlert[];
  actions: string[];
} {
  const actions: string[] = [];
  const alerts: PerformanceAlert[] = [];
  let releasedEntries = 0;

  if (metrics.ramUsage >= 85 || (metrics.jsHeapMb != null && metrics.jsHeapMb > 400)) {
    releasedEntries += smartCacheManager.cleanup(ttlMs / 2);
    actions.push(`Released ${releasedEntries} unused cache entries under memory pressure`);
  } else if (metrics.ramUsage >= 70) {
    releasedEntries += smartCacheManager.cleanup(ttlMs);
    if (releasedEntries) actions.push(`Trimmed ${releasedEntries} stale cache entries`);
  }

  if (metrics.diskUsage >= 92) {
    const cleared = smartCacheManager.clearCategory("previews");
    releasedEntries += cleared;
    actions.push(`Cleared ${cleared} preview cache entries to free storage`);
    alerts.push({
      id: `disk-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      severity: "warning",
      code: "disk-near-full",
      message: `Storage is ${metrics.diskUsage}% full`,
      recommendation: "Clear unused previews or free disk space. Production continues uninterrupted.",
    });
  }

  return { releasedEntries, alerts, actions };
}

export function detectPerformanceAlerts(metrics: PerformanceMetricsSample): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  const at = new Date().toISOString();

  if (metrics.ramUsage >= 92) {
    alerts.push({
      id: `ram-${at}`,
      at,
      severity: "critical",
      code: "ram-critical",
      message: `RAM is almost full (${metrics.ramUsage}%)`,
      recommendation: "Switch to Power Saving or Performance mode. Background tasks will throttle automatically.",
    });
  } else if (metrics.ramUsage >= 85) {
    alerts.push({
      id: `ram-w-${at}`,
      at,
      severity: "warning",
      code: "ram-high",
      message: `RAM usage is elevated (${metrics.ramUsage}%)`,
      recommendation: "Consider closing inactive panels. Cache cleanup will run in the background.",
    });
  }

  if (metrics.vramUsage >= 90 || metrics.gpuUsage >= 92) {
    alerts.push({
      id: `gpu-${at}`,
      at,
      severity: "warning",
      code: "gpu-low",
      message: `GPU / VRAM pressure is high (GPU ${metrics.gpuUsage}%, VRAM ${metrics.vramUsage}%)`,
      recommendation: "Prioritize active render jobs. Non-critical AI analysis is deferred.",
    });
  }

  if (metrics.fps > 0 && metrics.fps < 28) {
    alerts.push({
      id: `fps-${at}`,
      at,
      severity: "warning",
      code: "fps-low",
      message: `Workspace FPS dropped to ${metrics.fps}`,
      recommendation: "Enable Performance mode or reduce motion in preferences for smoother navigation.",
    });
  }

  if (metrics.diskUsage >= 90) {
    alerts.push({
      id: `disk-${at}`,
      at,
      severity: metrics.diskUsage >= 95 ? "critical" : "warning",
      code: "disk-low",
      message: `Storage is nearly full (${metrics.diskUsage}%)`,
      recommendation: "Export or delete unused media. Production will not be interrupted.",
    });
  }

  return alerts;
}

export function scoreResponsiveness(metrics: PerformanceMetricsSample): "excellent" | "good" | "fair" | "poor" {
  if (metrics.fps >= 55 && metrics.uiLagMs < 8 && metrics.ramUsage < 70) return "excellent";
  if (metrics.fps >= 45 && metrics.uiLagMs < 16 && metrics.ramUsage < 85) return "good";
  if (metrics.fps >= 30 && metrics.ramUsage < 92) return "fair";
  return "poor";
}

export function predictBottleneck(metrics: PerformanceMetricsSample): string | null {
  if (metrics.ramUsage >= metrics.gpuUsage && metrics.ramUsage >= 80) return "RAM pressure";
  if (metrics.gpuUsage >= 85) return "GPU / VRAM saturation";
  if (metrics.diskUsage >= 90) return "Disk capacity";
  if (metrics.fps < 30) return "UI frame budget";
  if (metrics.cpuUsage >= 85) return "CPU load";
  return null;
}
