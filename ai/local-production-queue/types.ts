/** Platform Step 3 — Local Production Queue & Job Management types (single-user, local-only). */

export const LOCAL_PRODUCTION_QUEUE_VERSION = "1.0";

export type ProductionJobType =
  | "product-analysis"
  | "background-removal"
  | "image-enhancement"
  | "storyboard-generation"
  | "prompt-generation"
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "rendering"
  | "export"
  | "knowledge-update"
  | "ai-learning";

export type ProductionJobStatus =
  | "waiting"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ProductionJobPriority = "critical" | "high" | "normal" | "low";

export interface ProductionJobCheckpoint {
  at: string;
  label: string;
  progress: number;
  data?: Record<string, unknown>;
}

export interface ProductionJobRecord {
  jobId: string;
  projectId: string | null;
  jobType: ProductionJobType;
  title: string;
  status: ProductionJobStatus;
  priority: ProductionJobPriority;
  dependsOn: string[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  progress: number;
  retryCount: number;
  maxRetries: number;
  errors: string[];
  suggestedCause: string | null;
  outputFiles: string[];
  checkpoints: ProductionJobCheckpoint[];
  lastCheckpointLabel: string | null;
  estimatedDurationMs: number;
  resourceProfile: {
    cpuWeight: number;
    gpuWeight: number;
    ramMb: number;
    vramMb: number;
    diskMb: number;
  };
  parallelSafe: boolean;
  notes: string[];
}

export interface ResourceSnapshot {
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

export interface EnqueueJobInput {
  jobType: ProductionJobType;
  title?: string;
  projectId?: string;
  priority?: ProductionJobPriority;
  dependsOn?: string[];
  estimatedDurationMs?: number;
  parallelSafe?: boolean;
  maxRetries?: number;
  outputFiles?: string[];
}

export interface LocalProductionQueueResult {
  runId: string;
  version: typeof LOCAL_PRODUCTION_QUEUE_VERSION;
  processedAt: string;
  waiting: string[];
  running: string[];
  paused: string[];
  completed: string[];
  failed: string[];
  cancelled: string[];
  issuesFound: string[];
  issuesRepaired: string[];
  progressLost: false;
  invalidOrderExecuted: false;
  singleUserOnly: true;
  localExecutionOnly: true;
  localResourceManagerDeferred: false;
  summary: string;
}

export interface AiMeLocalProductionQueueAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  singleUserOnly: true;
  canExplainQueue: boolean;
  canPredictCompletionTime: boolean;
  canExplainWhyWaiting: boolean;
  canRecommendOptimization: boolean;
  localResourceManagerDeferred: false;
  summary: string;
}

export interface LocalProductionQueueExplainResult {
  queueSummary: string;
  predictedCompletionMs: number;
  waitingExplanations: string[];
  optimizationRecommendation: string;
}

export interface LocalProductionQueueHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface LocalProductionQueueReportData {
  generatedAt: string;
  existingQueueCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  queueManagementStatus: string;
  dependencyManagementStatus: string;
  parallelExecutionStatus: string;
  failureRecoveryStatus: string;
  jobHistoryStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep4: string[];
}

export interface LocalProductionQueueStore {
  jobs: ProductionJobRecord[];
  history: ProductionJobRecord[];
  runs: LocalProductionQueueResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
  resourceOverride: Partial<ResourceSnapshot> | null;
}
