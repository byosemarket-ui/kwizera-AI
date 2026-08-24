/** Workspace Performance Optimization types — Phase 1 Step 7 */

export type WorkspacePerformanceMode =
  | "balanced"
  | "performance"
  | "quality"
  | "power-saving"
  | "auto";

export type BackgroundTaskKind =
  | "auto-save"
  | "ai-analysis"
  | "thumbnail"
  | "metadata"
  | "project-index"
  | "cache-cleanup"
  | "memory-release";

export type BackgroundTaskPriority = "critical" | "high" | "normal" | "low";

export type CacheCategory =
  | "images"
  | "product-analysis"
  | "storyboards"
  | "ai-results"
  | "previews"
  | "layout-data";

export interface PerformanceMetricsSample {
  at: string;
  fps: number;
  uiLagMs: number;
  cpuUsage: number;
  gpuUsage: number;
  ramUsage: number;
  ramUsedMb: number;
  ramTotalMb: number;
  vramUsage: number;
  diskUsage: number;
  diskUsedGb: number;
  diskTotalGb: number;
  jsHeapMb: number | null;
  activeAiModels: number;
  activeProductionTasks: number;
  source: "live" | "api" | "heuristic";
}

export interface CacheEntryMeta {
  key: string;
  category: CacheCategory;
  sizeBytes: number;
  createdAt: string;
  lastAccessAt: string;
  hits: number;
}

export interface CacheStats {
  entries: number;
  totalBytes: number;
  byCategory: Record<CacheCategory, { entries: number; bytes: number }>;
  lastCleanupAt: string | null;
}

export interface BackgroundTask {
  id: string;
  kind: BackgroundTaskKind;
  priority: BackgroundTaskPriority;
  label: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: "queued" | "running" | "completed" | "deferred" | "cancelled";
  productionSafe: boolean;
}

export interface PerformanceAlert {
  id: string;
  at: string;
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  recommendation: string;
}

export interface PerformanceModePolicy {
  mode: WorkspacePerformanceMode;
  metricsIntervalMs: number;
  backgroundThrottle: number;
  maxParallelBackground: number;
  cacheTtlMs: number;
  reduceMotion: boolean;
  prioritizeProduction: boolean;
}

export interface PerformanceSnapshot {
  version: 1;
  mode: WorkspacePerformanceMode;
  effectiveMode: Exclude<WorkspacePerformanceMode, "auto">;
  metrics: PerformanceMetricsSample;
  cache: CacheStats;
  tasks: BackgroundTask[];
  alerts: PerformanceAlert[];
  productionActive: boolean;
  responsiveness: "excellent" | "good" | "fair" | "poor";
  recommendation: string;
}

export interface AiMePerformanceContext {
  mode: WorkspacePerformanceMode;
  effectiveMode: string;
  fps: number;
  ramUsage: number;
  gpuUsage: number;
  productionActive: boolean;
  alertCount: number;
  recommendation: string;
  bottleneck: string | null;
  explanation: string;
}
