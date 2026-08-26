/** Phase 5 Step 1 — Production Queue & Job Orchestration (prepare only; do not execute). */

import type { ProductionSnapshot } from "../production-plan/types";
import type { RequiredAsset } from "../production-plan/types";

export type JobStatus =
  | "DRAFT"
  | "VALIDATING"
  | "QUEUED"
  | "PREPARING"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "BLOCKED"
  | "FAILED"
  | "CANCELLED"
  | "COMPLETED";

export type JobPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type TaskStatus =
  | "PENDING"
  | "READY"
  | "WAITING"
  | "BLOCKED"
  | "STARTING"
  | "RUNNING"
  | "VALIDATING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "SKIPPED"
  | "CANCELLED";

export type TaskType =
  | "ASSET_IMPORT"
  | "ASSET_VALIDATION"
  | "IMAGE_PROCESSING"
  | "IMAGE_GENERATION"
  | "BACKGROUND_GENERATION"
  | "VISUAL_GENERATION"
  | "VOICE_GENERATION"
  | "AUDIO_PROCESSING"
  | "MUSIC_GENERATION"
  | "SFX_GENERATION"
  | "SCENE_BUILD"
  | "TEXT_RENDER"
  | "SUBTITLE_GENERATION"
  | "TIMELINE_ASSEMBLY"
  | "VIDEO_COMPOSITION"
  | "VIDEO_RENDER"
  | "THUMBNAIL_GENERATION"
  | "QUALITY_CHECK"
  | "EXPORT";

export type FailureClass =
  | "TRANSIENT"
  | "CONFIGURATION"
  | "RESOURCE"
  | "INPUT"
  | "DEPENDENCY"
  | "ENGINE"
  | "OUTPUT"
  | "SYSTEM";

export type EngineStatus = "AVAILABLE" | "UNAVAILABLE" | "NOT CONFIGURED" | "ERROR";
export type AssetCheckStatus = "AVAILABLE" | "MISSING" | "INVALID" | "OPTIONAL";
export type ResourceItemStatus = "AVAILABLE" | "WARNING" | "INSUFFICIENT" | "NOT DETECTED";

export type PrepStage =
  | "loaded"
  | "snapshot"
  | "job"
  | "tasks"
  | "dependencies"
  | "assets"
  | "engines"
  | "resources"
  | "storage"
  | "queue"
  | "readiness"
  | "package"
  | "saved";

export interface SnapshotValidationItem {
  id: string;
  label: string;
  ok: boolean;
  critical: boolean;
  detail: string;
}

export interface SnapshotValidation {
  items: SnapshotValidationItem[];
  valid: boolean;
  blocking: string[];
}

export interface QueueAssetCheck {
  id: string;
  category: string;
  fileName: string | null;
  assetId: string | null;
  sceneNumber: number | null;
  required: "CRITICAL" | "REQUIRED" | "OPTIONAL";
  status: AssetCheckStatus;
  integrity: "OK" | "UNVERIFIED" | "INVALID" | "N/A";
  reason: string;
  resolution: string;
}

export interface AiEngineRequirement {
  id: string;
  name: string;
  purpose: string;
  status: EngineStatus;
  localPreferred: boolean;
  model: string;
  modelVersion: string;
  modelType: string;
  location: "LOCAL" | "EXTERNAL" | "UNKNOWN";
  vram: string;
  ram: string;
  cpu: string;
  note: string;
}

export interface ResourceCheckItem {
  id: string;
  name: string;
  value: string;
  status: ResourceItemStatus;
  note: string;
}

export interface StorageEstimate {
  estimatedRequiredLabel: string;
  availableLabel: string;
  status: "SUFFICIENT" | "WARNING" | "INSUFFICIENT" | "ESTIMATE UNAVAILABLE";
  note: string;
}

export interface ProductionTask {
  taskId: string;
  productionId: string;
  taskType: TaskType;
  taskName: string;
  description: string;
  status: TaskStatus;
  priority: JobPriority;
  order: number;
  dependencies: string[];
  inputs: string[];
  expectedOutputs: string[];
  requiredAssets: string[];
  requiredAiEngine: string | null;
  requiredResources: string[];
  parallelSafe: boolean;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  failureClass: FailureClass | null;
  progress: number;
  blockedReason: string | null;
  resolution: string | null;
}

export interface JobReadinessScores {
  snapshot: number;
  assets: number;
  aiEngines: number;
  resources: number;
  dependencies: number;
  configuration: number;
  overall: number;
  explanation: string;
}

export interface PrepCheck {
  id: string;
  label: string;
  ok: boolean;
  critical: boolean;
  detail: string;
}

export interface ProductionJob {
  version: 1;
  productionId: string;
  projectId: string;
  productId: string;
  snapshotId: string;
  jobName: string;
  projectName: string;
  productName: string;
  status: JobStatus;
  priority: JobPriority;
  currentTaskId: string | null;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  readyTasks: number;
  waitingTasks: number;
  progress: number;
  estimatedDurationLabel: string;
  tasks: ProductionTask[];
  executionOrder: string[];
  parallelGroups: string[][];
  assetChecks: QueueAssetCheck[];
  engines: AiEngineRequirement[];
  resources: ResourceCheckItem[];
  storage: StorageEstimate;
  validation: SnapshotValidation;
  readiness: JobReadinessScores;
  prepChecks: PrepCheck[];
  versionLabel: string;
  versionNumber: number;
  errorState: string | null;
  recoveryState: "none" | "restored" | "rechecking";
  userConfirmedReady: boolean;
  readyForStep2: boolean;
  duplicateOf: string | null;
  warnings: string[];
  planAssetRefs: RequiredAsset[];
  createdAt: string;
  updatedAt: string;
  history: Array<{ versionLabel: string; productionId: string; createdAt: string; status: JobStatus }>;
}

export interface ProductionExecutionPackage {
  version: 1;
  step: "phase-5-step-2-pipeline-engine";
  productionId: string;
  projectId: string;
  projectName: string;
  snapshotId: string;
  job: ProductionJob;
  snapshot: ProductionSnapshot;
  taskGraph: ProductionTask[];
  executionQueue: string[];
  dependencies: Record<string, string[]>;
  requiredAssets: QueueAssetCheck[];
  requiredAiEngines: AiEngineRequirement[];
  resourceRequirements: ResourceCheckItem[];
  priority: JobPriority;
  retryPolicy: { defaultMaxRetries: number; note: string };
  recoveryState: string;
  readiness: JobReadinessScores;
  packageVersion: string;
  preparedAt: string;
  note: string;
}

export interface QueueProgress {
  total: number;
  completed: number;
  percent: number;
  currentLabel: string;
  currentStage: PrepStage | null;
  running: boolean;
}

export interface ProductionQueueSnapshot {
  version: 1;
  job: ProductionJob | null;
  executionPackage: ProductionExecutionPackage | null;
  progress: QueueProgress;
  recommendation: string;
  handoffReady: boolean;
  updatedAt: string;
}

export const QUEUE_STORE_KEY = "kwizera.production-queue.v1";
export const QUEUE_HANDOFF_KEY = "kwizera.production-queue.handoff.v1";
export const QUEUE_MEMORY_KEY = "kwizera.production-queue.memory.v1";
export const QUEUE_COUNTER_KEY = "kwizera.production-queue.counter.v1";

export const PREP_STAGES: PrepStage[] = [
  "loaded", "snapshot", "job", "tasks", "dependencies", "assets",
  "engines", "resources", "storage", "queue", "readiness", "package", "saved",
];

export const PREP_STAGE_LABELS: Record<PrepStage, string> = {
  loaded: "Production Snapshot loaded",
  snapshot: "Snapshot validated",
  job: "Production Job created",
  tasks: "Task graph built",
  dependencies: "Dependencies checked",
  assets: "Assets checked",
  engines: "AI engines checked",
  resources: "Machine resources checked",
  storage: "Storage estimated",
  queue: "Execution queue ordered",
  readiness: "Job readiness scored",
  package: "Execution package prepared",
  saved: "Ready state saved",
};
