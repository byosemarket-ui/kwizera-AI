import type { PlanTask } from "../planning/types.js";
import {
  ManagedTaskType,
  TaskPriority,
  TaskQueueCategory,
} from "./types.js";

const MODULE_TYPE_MAP: Record<string, ManagedTaskType> = {
  "product-engine": ManagedTaskType.ProductAnalysis,
  "image-engine": ManagedTaskType.ImageAnalysis,
  "video-engine": ManagedTaskType.VideoGeneration,
  "marketing-engine": ManagedTaskType.MarketingContent,
  "translation-engine": ManagedTaskType.Translation,
  "learning-engine": ManagedTaskType.Learning,
  "memory-engine": ManagedTaskType.MemoryUpdate,
  "knowledge-engine": ManagedTaskType.KnowledgeUpdate,
  "decision-engine": ManagedTaskType.General,
  "planning-engine": ManagedTaskType.General,
  "workflow-engine": ManagedTaskType.General,
  "task-manager": ManagedTaskType.General,
};

const PRIORITY_MAP: Record<string, TaskPriority> = {
  critical: TaskPriority.Critical,
  high: TaskPriority.High,
  normal: TaskPriority.Normal,
  low: TaskPriority.Low,
};

export function inferTaskType(planTask: PlanTask): ManagedTaskType {
  return MODULE_TYPE_MAP[planTask.moduleId] ?? ManagedTaskType.General;
}

export function inferPriority(planTask: PlanTask): TaskPriority {
  return PRIORITY_MAP[planTask.priority] ?? TaskPriority.Normal;
}

export function inferQueueCategory(taskType: ManagedTaskType): TaskQueueCategory {
  if (taskType === ManagedTaskType.Learning) return TaskQueueCategory.Learning;
  if (taskType === ManagedTaskType.Recovery) return TaskQueueCategory.Recovery;
  if (taskType === ManagedTaskType.Backup || taskType === ManagedTaskType.DatabaseSave) {
    return TaskQueueCategory.Maintenance;
  }
  if (taskType === ManagedTaskType.General) return TaskQueueCategory.Background;
  return TaskQueueCategory.Interactive;
}

export function mapPlanPriorityToTaskPriority(priority: string): TaskPriority {
  return PRIORITY_MAP[priority] ?? TaskPriority.Normal;
}
