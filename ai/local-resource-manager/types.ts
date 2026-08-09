/** Platform Step 4 — Local Resource Manager & Intelligent Production Scheduler types. */

export const LOCAL_RESOURCE_MANAGER_VERSION = "1.0";

export type ProductionMode =
  | "maximum-quality"
  | "balanced"
  | "maximum-performance"
  | "power-saving";

export type WorkloadClass =
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "rendering"
  | "knowledge-processing"
  | "learning"
  | "background";

export type AlertSeverity = "info" | "warning" | "critical";

export interface ResourceMetrics {
  at: string;
  cpuUsage: number;
  cpuTemperatureC: number | null;
  cpuFrequencyMhz: number | null;
  gpuUsage: number;
  gpuTemperatureC: number | null;
  gpuMemoryUsedMb: number | null;
  gpuMemoryTotalMb: number | null;
  vramUsage: number;
  systemRamUsedMb: number;
  systemRamTotalMb: number;
  ramUsage: number;
  storageUsedGb: number;
  storageTotalGb: number;
  diskUsage: number;
  storageSpeedMBps: number | null;
  diskReadMBps: number | null;
  diskWriteMBps: number | null;
  batteryPercent: number | null;
  batteryCharging: boolean | null;
  source: "live" | "override" | "heuristic";
}

export interface SystemHealthReport {
  at: string;
  overallHealth: "excellent" | "good" | "fair" | "poor" | "critical";
  performanceLevel: "high" | "medium" | "low" | "throttled";
  resourceAvailability: "abundant" | "adequate" | "limited" | "exhausted";
  thermalStatus: "cool" | "warm" | "hot" | "unknown";
  memoryPressure: "none" | "moderate" | "high" | "critical";
  storageCapacity: "ok" | "low" | "critical";
  score: number;
  alerts: ResourceAlert[];
}

export interface ResourceAlert {
  id: string;
  at: string;
  severity: AlertSeverity;
  code: string;
  message: string;
}

export interface AllocationPlan {
  workload: WorkloadClass;
  cpuShare: number;
  gpuShare: number;
  ramMb: number;
  vramMb: number;
  diskMb: number;
  maxConcurrent: number;
  backgroundThrottle: number;
}

export interface ScheduleDecision {
  jobId: string;
  allowStart: boolean;
  delayReason: string | null;
  recommendedPriorityBoost: boolean;
  estimatedStartDelayMs: number;
}

export interface ResourceForecast {
  at: string;
  remainingRenderTimeMs: number;
  expectedMemoryMb: number;
  expectedGpuUsage: number;
  expectedStorageMb: number;
  exhaustionWarnings: string[];
  predictedCompletionMs: number;
}

export interface ProtectionAction {
  at: string;
  action: "pause-non-critical" | "block-start" | "throttle-background" | "warn-storage" | "protect-integrity";
  jobIds: string[];
  detail: string;
}

export interface LocalResourceManagerResult {
  runId: string;
  version: typeof LOCAL_RESOURCE_MANAGER_VERSION;
  processedAt: string;
  mode: ProductionMode;
  metrics: ResourceMetrics;
  health: SystemHealthReport;
  forecast: ResourceForecast;
  protections: ProtectionAction[];
  scheduleDecisions: ScheduleDecision[];
  issuesFound: string[];
  issuesRepaired: string[];
  systemOverloadedIntentionally: false;
  criticalJobsInterruptedWithoutSave: false;
  singleUserOnly: true;
  localMachineOnly: true;
  automationEngineDeferred: false;
  summary: string;
}

export interface AiMeLocalResourceManagerAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  singleUserOnly: true;
  canExplainResourceUsage: boolean;
  canRecommendProductionMode: boolean;
  canPredictCompletionTime: boolean;
  canExplainJobDelay: boolean;
  canRecommendHardwareUpgrades: boolean;
  automationEngineDeferred: false;
  summary: string;
}

export interface LocalResourceManagerExplainResult {
  usageExplanation: string;
  recommendedMode: ProductionMode;
  predictedCompletionMs: number;
  delayExplanations: string[];
  hardwareUpgradeRecommendation: string | null;
}

export interface LocalResourceManagerHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface LocalResourceManagerReportData {
  generatedAt: string;
  existingResourceManagerCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  resourceMonitoringStatus: string;
  schedulingCapability: string;
  productionModesStatus: string;
  forecastingCapability: string;
  systemProtectionStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep5: string[];
}

export interface LocalResourceManagerStore {
  mode: ProductionMode;
  metricsHistory: ResourceMetrics[];
  alerts: ResourceAlert[];
  protections: ProtectionAction[];
  runs: LocalResourceManagerResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
  metricsOverride: Partial<ResourceMetrics> | null;
  pausedBackgroundJobIds: string[];
}

/** Compatible snapshot consumed by Local Production Queue. */
export interface LrmQueueResourceSnapshot {
  at: string;
  cpuUsage: number;
  gpuUsage: number;
  ramUsage: number;
  vramUsage: number;
  diskUsage: number;
  maxParallel: number;
  canAcceptJob: boolean;
  reason: string;
}
