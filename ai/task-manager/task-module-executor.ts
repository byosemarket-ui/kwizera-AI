import type { AiModuleRegistry } from "../core/module-registry.js";
import type { PlanTask } from "../planning/types.js";
import { TaskExecutionRecord, TaskExecutionStatus } from "../workflow/types.js";

/**
 * Executes task coordination to module slots — no AI work performed.
 */
export class TaskModuleExecutor {
  execute(
    planTask: PlanTask,
    registry: AiModuleRegistry,
    simulateFailure = false
  ): { success: boolean; record: TaskExecutionRecord; diagnostics?: string } {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const entry = registry.getEntry(planTask.moduleId);

    if (!entry) {
      const durationMs = Math.round(performance.now() - start);
      return {
        success: false,
        diagnostics: `Module ${planTask.moduleId} not registered`,
        record: this.buildRecord(planTask, startedAt, durationMs, TaskExecutionStatus.Failed, false, "MODULE_NOT_FOUND"),
      };
    }

    if (simulateFailure) {
      const durationMs = Math.round(performance.now() - start);
      return {
        success: false,
        diagnostics: "Simulated task failure",
        record: this.buildRecord(
          planTask,
          startedAt,
          durationMs,
          TaskExecutionStatus.Failed,
          true,
          "SIMULATED_FAILURE"
        ),
      };
    }

    const durationMs = Math.round(performance.now() - start);
    return {
      success: true,
      record: this.buildRecord(
        planTask,
        startedAt,
        durationMs,
        TaskExecutionStatus.Completed,
        true,
        undefined,
        `Task coordinated to ${planTask.moduleId} (${entry.status})`
      ),
    };
  }

  private buildRecord(
    planTask: PlanTask,
    startedAt: string,
    durationMs: number,
    status: TaskExecutionStatus,
    coordinated: boolean,
    error?: string,
    message?: string
  ): TaskExecutionRecord {
    return {
      taskId: planTask.id,
      taskName: planTask.name,
      moduleId: planTask.moduleId,
      status,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      coordinated,
      message:
        message ??
        (error ? `Task failed: ${error}` : `Task completed via ${planTask.moduleId}`),
      error,
    };
  }
}
