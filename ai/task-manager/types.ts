/**
 * KWIZERA AI STUDIO — AI Task Manager types (Step 2F)
 */

import type { PlanTask } from "../planning/types.js";
import type { TaskExecutionRecord } from "../workflow/types.js";

export enum ManagedTaskType {
  ProductAnalysis = "product-analysis",
  ImageAnalysis = "image-analysis",
  ImageEnhancement = "image-enhancement",
  VideoPlanning = "video-planning",
  VideoGeneration = "video-generation",
  PosterGeneration = "poster-generation",
  BannerGeneration = "banner-generation",
  MarketingContent = "marketing-content",
  Translation = "translation",
  Learning = "learning",
  MemoryUpdate = "memory-update",
  KnowledgeUpdate = "knowledge-update",
  DatabaseSave = "database-save",
  Export = "export",
  Backup = "backup",
  Recovery = "recovery",
  General = "general",
}

export enum TaskPriority {
  Critical = "critical",
  High = "high",
  Normal = "normal",
  Low = "low",
  Background = "background",
}

export enum TaskQueueCategory {
  Interactive = "interactive",
  Background = "background",
  Learning = "learning",
  Maintenance = "maintenance",
  Recovery = "recovery",
}

export enum ManagedTaskState {
  Created = "created",
  Queued = "queued",
  Waiting = "waiting",
  Preparing = "preparing",
  Running = "running",
  Paused = "paused",
  Resuming = "resuming",
  Retrying = "retrying",
  Completed = "completed",
  Cancelled = "cancelled",
  Failed = "failed",
  Recovered = "recovered",
  Archived = "archived",
}

export interface CreateTaskRequest {
  name: string;
  taskType: ManagedTaskType;
  priority: TaskPriority;
  queueCategory: TaskQueueCategory;
  moduleId: string;
  workflowRunId?: string;
  workflowId?: string;
  planTaskId?: string;
  dependsOn?: string[];
  estimatedMs?: number;
  parameters?: Record<string, unknown>;
}

export interface TaskProgress {
  status: ManagedTaskState;
  progressPercent: number;
  estimatedRemainingMs: number;
  elapsedMs: number;
  currentStage: string;
  warnings: string[];
  errors: string[];
  recoveryAttempts: number;
}

export interface ResourceSnapshot {
  cpuIntensity: "low" | "medium" | "high";
  memoryMbEstimate: number;
  diskUsageEstimate: number;
  databaseActive: boolean;
  aiRuntimeReady: boolean;
}

export interface TaskDependencyResult {
  satisfied: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
  pauseReason?: string;
}

export interface ManagedTask {
  id: string;
  name: string;
  taskType: ManagedTaskType;
  priority: TaskPriority;
  queueCategory: TaskQueueCategory;
  moduleId: string;
  workflowRunId?: string;
  workflowId?: string;
  planTaskId?: string;
  dependsOn: string[];
  state: ManagedTaskState;
  progress: TaskProgress;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  parameters: Record<string, unknown>;
}

export interface RunWorkflowTaskInput {
  planTask: PlanTask;
  workflowRunId: string;
  workflowId: string;
  taskType: ManagedTaskType;
  priority: TaskPriority;
  queueCategory: TaskQueueCategory;
  completedTaskIds: string[];
  simulateFailure?: boolean;
}

export interface TaskRunResult {
  success: boolean;
  managedTaskId: string;
  record: TaskExecutionRecord;
  task: ManagedTask;
}

export interface TaskHistoryRecord {
  taskId: string;
  workflowId?: string;
  taskType: ManagedTaskType;
  priority: TaskPriority;
  startTime?: string;
  endTime?: string;
  executionDurationMs: number;
  status: ManagedTaskState;
  errors: string[];
  recoveryActions: string[];
  performanceMetrics: Record<string, number>;
  futureLearningValue: number;
  timestamp: string;
}

export interface QueueStatusReport {
  interactive: number;
  background: number;
  learning: number;
  maintenance: number;
  recovery: number;
  totalQueued: number;
  activeCritical: boolean;
}

export class TaskManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "TaskManagerError";
  }
}

export interface TaskManagerStatusReport {
  taskManagerStatus: string;
  queueStatus: string;
  schedulingQuality: string;
  recoveryStatus: string;
  performance: {
    averageTaskMs: number;
    totalTasks: number;
    throughput: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}
