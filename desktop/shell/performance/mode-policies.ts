import type { PerformanceModePolicy, WorkspacePerformanceMode } from "./types";

export const PERFORMANCE_MODE_POLICIES: Record<Exclude<WorkspacePerformanceMode, "auto">, PerformanceModePolicy> = {
  balanced: {
    mode: "balanced",
    metricsIntervalMs: 2000,
    backgroundThrottle: 0.5,
    maxParallelBackground: 2,
    cacheTtlMs: 15 * 60_000,
    reduceMotion: false,
    prioritizeProduction: true,
  },
  performance: {
    mode: "performance",
    metricsIntervalMs: 1500,
    backgroundThrottle: 0.75,
    maxParallelBackground: 1,
    cacheTtlMs: 8 * 60_000,
    reduceMotion: true,
    prioritizeProduction: true,
  },
  quality: {
    mode: "quality",
    metricsIntervalMs: 2500,
    backgroundThrottle: 0.35,
    maxParallelBackground: 2,
    cacheTtlMs: 30 * 60_000,
    reduceMotion: false,
    prioritizeProduction: true,
  },
  "power-saving": {
    mode: "power-saving",
    metricsIntervalMs: 4000,
    backgroundThrottle: 0.9,
    maxParallelBackground: 1,
    cacheTtlMs: 5 * 60_000,
    reduceMotion: true,
    prioritizeProduction: true,
  },
};

export function resolveEffectiveMode(
  mode: WorkspacePerformanceMode,
  productionActive: boolean,
  ramUsage: number,
  cpuUsage: number,
): Exclude<WorkspacePerformanceMode, "auto"> {
  if (mode !== "auto") return mode;
  if (ramUsage >= 90 || cpuUsage >= 92) return "power-saving";
  if (productionActive && (ramUsage >= 75 || cpuUsage >= 80)) return "performance";
  if (productionActive) return "balanced";
  if (ramUsage < 50 && cpuUsage < 40) return "quality";
  return "balanced";
}

export function getModePolicy(
  mode: WorkspacePerformanceMode,
  productionActive: boolean,
  ramUsage: number,
  cpuUsage: number,
): PerformanceModePolicy {
  const effective = resolveEffectiveMode(mode, productionActive, ramUsage, cpuUsage);
  return PERFORMANCE_MODE_POLICIES[effective];
}
