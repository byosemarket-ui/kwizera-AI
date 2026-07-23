import type { AiModuleRegistry } from "../core/module-registry.js";
import type { PlanTask } from "../planning/types.js";
import { TaskExecutionRecord, TaskExecutionStatus } from "./types.js";

export interface TaskCoordinationResult {
  record: TaskExecutionRecord;
  success: boolean;
}

/**
 * Coordinates module tasks without performing AI work.
 * Step 2E: delegates to module slots only.
 */
export class TaskCoordinator {
  coordinate(
    task: PlanTask,
    registry: AiModuleRegistry,
    simulateFailure = false
  ): TaskCoordinationResult {
    const startedAt = new Date().toISOString();
    const start = performance.now();

    const entry = registry.getEntry(task.moduleId);
    if (!entry) {
      const durationMs = Math.round(performance.now() - start);
      return {
        success: false,
        record: {
          taskId: task.id,
          taskName: task.name,
          moduleId: task.moduleId,
          status: TaskExecutionStatus.Failed,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs,
          coordinated: false,
          message: `Module ${task.moduleId} not found in registry`,
          error: "MODULE_NOT_FOUND",
        },
      };
    }

    if (simulateFailure) {
      const durationMs = Math.round(performance.now() - start);
      return {
        success: false,
        record: {
          taskId: task.id,
          taskName: task.name,
          moduleId: task.moduleId,
          status: TaskExecutionStatus.Failed,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs,
          coordinated: true,
          message: `Simulated failure coordinating ${task.moduleId}`,
          error: "SIMULATED_FAILURE",
        },
      };
    }

    const durationMs = Math.round(performance.now() - start);
    return {
      success: true,
      record: {
        taskId: task.id,
        taskName: task.name,
        moduleId: task.moduleId,
        status: TaskExecutionStatus.Completed,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        coordinated: true,
        message: `Task coordinated to ${task.moduleId} (${entry.status}) — no AI work performed by Workflow Engine`,
      },
    };
  }
}
