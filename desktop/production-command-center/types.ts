/** Phase 5 Step 3 — Live Production Command Center & Resource Monitor (monitor/control layer only). */

import type { PerformanceAlert, PerformanceMetricsSample, PerformanceSnapshot } from "../shell/performance/types";
import type { PipelineArtifact, PipelineCheckpoint, PipelineError, PipelineStageId, PipelineState } from "../production-pipeline/types";

export type LogLevel = "info" | "success" | "warning" | "error";
export type LogCategory = "all" | "info" | "success" | "warning" | "error" | "task" | "ai" | "resource" | "render";

export type ControlPending = "none" | "pausing" | "resuming" | "cancelling";

export type ConnectionState = "connected" | "reconnecting" | "lost";

export type PipelineNodeStatus =
  | "COMPLETED"
  | "RUNNING"
  | "READY"
  | "WAITING"
  | "BLOCKED"
  | "FAILED"
  | "DEFERRED";

export type AiEngineCategory =
  | "VISION"
  | "IMAGE_GENERATION"
  | "VOICE"
  | "AUDIO"
  | "VIDEO"
  | "TEXT";

export type AiEngineUiStatus =
  | "READY"
  | "RUNNING"
  | "BUSY"
  | "UNAVAILABLE"
  | "ERROR"
  | "NOT_CONFIGURED";

export type ResourceHealthLevel = "GOOD" | "WARNING" | "CRITICAL" | "UNAVAILABLE";

export type EtaStatus = "calculating" | "available" | "unavailable";

export interface ProductionLogEntry {
  id: string;
  at: string;
  level: LogLevel;
  category: Exclude<LogCategory, "all">;
  message: string;
  taskId?: string;
  action?: string;
}

export interface PipelineNodeView {
  id: PipelineStageId;
  label: string;
  shortLabel: string;
  status: PipelineNodeStatus;
  progress: number;
}

export interface WorkerStatusView {
  workerId: string;
  type: "GPU" | "CPU";
  label: string;
  status: "IDLE" | "RUNNING" | "BUSY";
  taskId: string | null;
  taskName: string | null;
  progress: number;
}

export interface AiEngineStatusView {
  category: AiEngineCategory;
  engineName: string;
  status: AiEngineUiStatus;
  taskName: string | null;
}

export interface ResourceHealthView {
  cpu: ResourceHealthLevel;
  ram: ResourceHealthLevel;
  gpu: ResourceHealthLevel;
  vram: ResourceHealthLevel;
  storage: ResourceHealthLevel;
  temperature: ResourceHealthLevel;
}

export interface ResourceMonitorView {
  cpuUsage: number | null;
  cpuTempC: number | null;
  cpuFreqMhz: number | null;
  ramUsedGb: number | null;
  ramTotalGb: number | null;
  ramUsage: number | null;
  gpuUsage: number | null;
  gpuName: string | null;
  gpuTempC: number | null;
  vramUsedGb: number | null;
  vramTotalGb: number | null;
  vramUsage: number | null;
  diskFreeGb: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  diskUsage: number | null;
  productionStorageGb: number | null;
  renderSpeedFps: number | null;
  renderSpeedLabel: string;
  alerts: PerformanceAlert[];
  health: ResourceHealthView;
}

export interface EtaView {
  status: EtaStatus;
  label: string;
  remainingMs: number | null;
  stageRemainingMs: number | null;
  currentTaskRemainingMs: number | null;
}

export interface TaskQueueItemView {
  taskId: string;
  taskName: string;
  taskType: string;
  status: string;
  progress: number;
  durationMs: number | null;
  error: string | null;
  isCurrent: boolean;
  marker: "done" | "current" | "next" | "pending" | "failed" | "blocked";
}

export interface TaskDetailView {
  taskId: string;
  taskType: string;
  taskName: string;
  status: string;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  elapsedMs: number | null;
  etaMs: number | null;
  dependencies: string[];
  workerId: string | null;
  engine: string;
  model: string;
  inputs: string[];
  outputs: string[];
  retryCount: number;
  maxRetries: number;
  errors: PipelineError[];
  warnings: string[];
  blockedReason: string | null;
  artifactIds: string[];
}

export interface RecoveryView {
  active: boolean;
  lastCheckpoint: string | null;
  recoveredTasks: number;
  remainingTasks: number;
  status: string;
  note: string;
}

export interface LiveProductionStats {
  tasksCompleted: number;
  tasksFailed: number;
  retries: number;
  currentStage: PipelineStageId | null;
  totalElapsedMs: number;
  estimatedRemainingMs: number | null;
  resourcePeaks: {
    cpu: number;
    ram: number;
    gpu: number;
    vram: number;
  };
  artifactCount: number;
  checkpointCount: number;
}

export interface CommandCenterUiPrefs {
  selectedTaskId: string | null;
  logFilter: LogCategory;
  logSearch: string;
  autoScrollLogs: boolean;
  pauseLogScroll: boolean;
  expandedPanels: Record<string, boolean>;
}

export interface CommandCenterDashboard {
  projectName: string;
  productionId: string;
  runId: string;
  status: string;
  controlPending: ControlPending;
  connectionState: ConnectionState;
  syncWarning: boolean;
  overallProgress: number;
  completedTasks: number;
  totalTasks: number;
  currentStage: PipelineStageId | null;
  currentStageLabel: string;
  stageProgress: number;
  stageIndex: number;
  stageCount: number;
  currentTaskId: string | null;
  currentTaskName: string;
  currentTaskProgress: number;
  startedAt: string | null;
  elapsedLabel: string;
  eta: EtaView;
  pipelineNodes: PipelineNodeView[];
  queueItems: TaskQueueItemView[];
  workers: WorkerStatusView[];
  aiEngines: AiEngineStatusView[];
  resources: ResourceMonitorView;
  recovery: RecoveryView;
  stats: LiveProductionStats;
  errors: PipelineError[];
  warnings: string[];
  checkpoints: PipelineCheckpoint[];
  artifacts: PipelineArtifact[];
}

export interface CommandCenterSnapshot {
  version: 1;
  connected: boolean;
  connectionState: ConnectionState;
  syncWarning: boolean;
  controlPending: ControlPending;
  dashboard: CommandCenterDashboard | null;
  logs: ProductionLogEntry[];
  prefs: CommandCenterUiPrefs;
  recommendation: string;
  step4HandoffReady: boolean;
  updatedAt: string;
}

export interface LiveProductionState {
  version: 1;
  step: "phase-5-step-4-final-assembly";
  productionId: string;
  runId: string;
  projectId: string;
  projectName: string;
  overallProgress: number;
  currentStage: PipelineStageId | null;
  currentTaskId: string | null;
  currentTaskName: string | null;
  queueState: TaskQueueItemView[];
  taskStates: PipelineState["tasks"] | [];
  logs: ProductionLogEntry[];
  eta: EtaView;
  resourceState: ResourceMonitorView;
  aiState: AiEngineStatusView[];
  workerState: WorkerStatusView[];
  errors: PipelineError[];
  warnings: string[];
  checkpoints: PipelineCheckpoint[];
  generatedArtifacts: PipelineArtifact[];
  productionStatus: string;
  stats: LiveProductionStats;
  pipelineState: PipelineState | null;
  preparedAt: string;
  note: string;
}

export interface Step4FinalAssemblyHandoffPayload extends LiveProductionState {
  status: "READY FOR FINAL ASSEMBLY / STEP 4";
}

export const COMMAND_CENTER_STORE_KEY = "kwizera.production-command-center.v1";
export const COMMAND_CENTER_HANDOFF_KEY = "kwizera.production-command-center.handoff.v1";
export const COMMAND_CENTER_LOG_KEY = "kwizera.production-command-center.logs.v1";

export const PIPELINE_STAGE_SHORT: Record<PipelineStageId, string> = {
  ASSET_PREPARATION: "ASSETS",
  VISUAL_GENERATION: "VISUALS",
  AUDIO_GENERATION: "AUDIO",
  SCENE_PRODUCTION: "SCENES",
  TIMELINE_ASSEMBLY: "TIMELINE",
  FINAL_RENDER: "RENDER",
  QUALITY_CONTROL: "QUALITY CHECK",
  EXPORT: "EXPORT",
};

export const DEFAULT_UI_PREFS: CommandCenterUiPrefs = {
  selectedTaskId: null,
  logFilter: "all",
  logSearch: "",
  autoScrollLogs: true,
  pauseLogScroll: false,
  expandedPanels: {
    queue: true,
    task: true,
    resources: true,
    recovery: true,
  },
};

export type MetricsInput = PerformanceMetricsSample | PerformanceSnapshot["metrics"];
