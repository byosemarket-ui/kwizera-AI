import type { AiModuleRegistry } from "../core/module-registry.js";
import type { PlanTask } from "../planning/types.js";
import type { TaskCoordinator } from "./task-coordinator.js";
import { RecoveryEvent, TaskExecutionRecord, TaskExecutionStatus, WorkflowState, WorkflowTracking } from "./types.js";

export class ProgressTracker {
  createTracking(scheduled: PlanTask[], estimatedTotalMs: number): WorkflowTracking {
    return {
      currentTaskId: null,
      completedTasks: [],
      remainingTasks: scheduled.map((t) => t.id),
      executionTimeMs: 0,
      estimatedRemainingMs: estimatedTotalMs,
      errors: [],
      warnings: [],
      recoveryAttempts: 0,
    };
  }

  updateAfterTask(
    tracking: WorkflowTracking,
    taskId: string,
    durationMs: number,
    estimatedPerTaskMs: number
  ): void {
    tracking.currentTaskId = taskId;
    if (!tracking.completedTasks.includes(taskId)) {
      tracking.completedTasks.push(taskId);
    }
    tracking.remainingTasks = tracking.remainingTasks.filter((id) => id !== taskId);
    tracking.executionTimeMs += durationMs;
    tracking.estimatedRemainingMs = Math.max(
      0,
      tracking.estimatedRemainingMs - estimatedPerTaskMs
    );
  }

  addError(tracking: WorkflowTracking, error: string): void {
    tracking.errors.push(error);
  }

  addWarning(tracking: WorkflowTracking, warning: string): void {
    tracking.warnings.push(warning);
  }
}

export class RecoveryManager {
  async attemptRecovery(
    task: PlanTask,
    coordinator: TaskCoordinator,
    registry: AiModuleRegistry,
    tracking: WorkflowTracking
  ): Promise<{ recovered: boolean; record?: TaskExecutionRecord; event: RecoveryEvent }> {
    tracking.recoveryAttempts += 1;

    const event: RecoveryEvent = {
      timestamp: new Date().toISOString(),
      taskId: task.id,
      action: "safe-retry-from-checkpoint",
      success: false,
      message: "Attempting recovery from last successful step",
    };

    const result = coordinator.coordinate(task, registry, false);

    if (result.success) {
      result.record.status = TaskExecutionStatus.Recovered;
      event.success = true;
      event.message = `Recovered task ${task.id} via safe retry`;
      return { recovered: true, record: result.record, event };
    }

    event.message = `Recovery failed for task ${task.id}`;
    return { recovered: false, event };
  }
}

export function resolveWorkflowState(
  success: boolean,
  hadRecovery: boolean,
  paused: boolean
): WorkflowState {
  if (paused && !success) return WorkflowState.Paused;
  if (success && hadRecovery) return WorkflowState.Recovered;
  if (success) return WorkflowState.Completed;
  return WorkflowState.Failed;
}
