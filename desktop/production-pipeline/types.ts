/** Phase 5 Step 2 — AI Production Pipeline Engine (execute job; defer final render to Step 4). */

import type {
  JobPriority,
  ProductionExecutionPackage,
  ProductionJob,
  ProductionTask,
  TaskType,
  FailureClass,
} from "../production-queue/types";
import type { ProductionSnapshot } from "../production-plan/types";

export type RunStatus =
  | "IDLE"
  | "RUNNING"
  | "PAUSED"
  | "BLOCKED"
  | "FAILED"
  | "CANCELLED"
  | "STEP2_COMPLETE"
  | "READY_FOR_STEP3";

export type ExecTaskStatus =
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
  | "CANCELLED"
  | "DEFERRED_STEP4";

export type PipelineStageId =
  | "ASSET_PREPARATION"
  | "VISUAL_GENERATION"
  | "AUDIO_GENERATION"
  | "SCENE_PRODUCTION"
  | "TIMELINE_ASSEMBLY"
  | "FINAL_RENDER"
  | "QUALITY_CONTROL"
  | "EXPORT";

export type ArtifactKind =
  | "Image"
  | "Audio"
  | "Scene"
  | "Subtitle"
  | "Timeline"
  | "Video"
  | "Thumbnail"
  | "Report"
  | "AssetIndex"
  | "Other";

export interface EngineRoute {
  taskType: TaskType;
  engineName: string;
  location: "LOCAL" | "EXTERNAL" | "UNKNOWN";
  offlineCapable: boolean;
  internetRequired: boolean;
  note: string;
}

export interface PipelineArtifact {
  artifactId: string;
  productionId: string;
  runId: string;
  taskId: string;
  sceneId: string | null;
  kind: ArtifactKind;
  version: string;
  versionNumber: number;
  source: string;
  engine: string;
  model: string;
  createdAt: string;
  outputPath: string;
  inputRefs: string[];
  validationState: "VALID" | "WARNING" | "INVALID" | "PENDING";
  validationNotes: string[];
  cacheKey: string;
  productConsistency: "OK" | "WARNING" | "FAILED" | "N/A";
}

export interface TaskAttempt {
  attemptId: string;
  taskId: string;
  attemptNumber: number;
  startedAt: string;
  endedAt: string | null;
  status: ExecTaskStatus;
  errorId: string | null;
  workerId: string | null;
}

export interface PipelineError {
  errorId: string;
  taskId: string;
  errorType: FailureClass;
  message: string;
  detail: string;
  timestamp: string;
  retryCount: number;
  recoveryRecommendation: string;
}

export interface PipelineCheckpoint {
  checkpointId: string;
  runId: string;
  label: string;
  completedTaskIds: string[];
  artifactIds: string[];
  timestamp: string;
  state: string;
}

export interface ExecTask extends Omit<ProductionTask, "status"> {
  status: ExecTaskStatus;
  stage: PipelineStageId;
  weight: number;
  attempt: number;
  lastAttemptId: string | null;
  artifactIds: string[];
  cacheHit: boolean;
  deferredToStep4: boolean;
  progress: number;
}

export interface ProductionRun {
  runId: string;
  productionId: string;
  projectId: string;
  productId: string;
  snapshotId: string;
  jobName: string;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  machineId: string;
  applicationVersion: string;
  snapshotVersion: string;
  status: RunStatus;
  currentTaskId: string | null;
  currentStage: PipelineStageId | null;
  priority: JobPriority;
  progress: number;
  stageProgress: Record<PipelineStageId, number>;
  pauseRequested: boolean;
  cancelRequested: boolean;
  gpuWorkers: number;
  cpuWorkers: number;
  activeWorkerIds: string[];
  warnings: string[];
  errors: PipelineError[];
}

export interface PipelineState {
  version: 1;
  run: ProductionRun;
  package: ProductionExecutionPackage;
  snapshot: ProductionSnapshot;
  job: ProductionJob;
  tasks: ExecTask[];
  artifacts: PipelineArtifact[];
  attempts: TaskAttempt[];
  checkpoints: PipelineCheckpoint[];
  routes: EngineRoute[];
  cacheIndex: Record<string, string>;
  readyForStep3: boolean;
  step2Complete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Step3CommandCenterHandoffPayload {
  version: 1;
  step: "phase-5-step-3-live-command-center";
  productionId: string;
  runId: string;
  projectId: string;
  projectName: string;
  pipelineState: PipelineState;
  completedTaskIds: string[];
  remainingTaskIds: string[];
  intermediateOutputs: PipelineArtifact[];
  sceneOutputs: PipelineArtifact[];
  audioOutputs: PipelineArtifact[];
  visualOutputs: PipelineArtifact[];
  timelineInputs: PipelineArtifact[];
  errors: PipelineError[];
  warnings: string[];
  checkpoints: PipelineCheckpoint[];
  resourceSummary: string;
  currentStage: PipelineStageId | null;
  nextTasks: string[];
  status: "READY FOR LIVE COMMAND CENTER / NEXT PIPELINE STAGE";
  preparedAt: string;
  note: string;
}

export interface PipelineUiSnapshot {
  version: 1;
  state: PipelineState | null;
  recommendation: string;
  handoffReady: boolean;
  ticking: boolean;
  updatedAt: string;
}

export const PIPELINE_STORE_KEY = "kwizera.production-pipeline.v1";
export const PIPELINE_HANDOFF_KEY = "kwizera.production-pipeline.handoff.v1";
export const PIPELINE_MEMORY_KEY = "kwizera.production-pipeline.memory.v1";
export const PIPELINE_ARTIFACT_KEY = "kwizera.production-pipeline.artifacts.v1";

/** Final encode + export remain Step 4. */
export const STEP4_DEFERRED_TYPES: TaskType[] = [
  "VIDEO_RENDER",
  "THUMBNAIL_GENERATION",
  "QUALITY_CHECK",
  "EXPORT",
];

export const STAGE_WEIGHTS: Record<PipelineStageId, number> = {
  ASSET_PREPARATION: 10,
  VISUAL_GENERATION: 30,
  AUDIO_GENERATION: 15,
  SCENE_PRODUCTION: 20,
  TIMELINE_ASSEMBLY: 10,
  FINAL_RENDER: 10,
  QUALITY_CONTROL: 3,
  EXPORT: 2,
};

export const STAGE_LABELS: Record<PipelineStageId, string> = {
  ASSET_PREPARATION: "Asset Preparation",
  VISUAL_GENERATION: "Visual Generation",
  AUDIO_GENERATION: "Audio Generation",
  SCENE_PRODUCTION: "Scene Production",
  TIMELINE_ASSEMBLY: "Timeline Assembly",
  FINAL_RENDER: "Final Render (Step 4)",
  QUALITY_CONTROL: "Quality Control (Step 4)",
  EXPORT: "Export (Step 4)",
};
