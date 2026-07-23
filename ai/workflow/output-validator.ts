import type { ExecutionPlan } from "../planning/types.js";
import { TaskExecutionRecord, WorkflowValidationResult } from "./types.js";

export class OutputValidator {
  validate(
    plan: ExecutionPlan,
    taskHistory: TaskExecutionRecord[],
    planValidation: WorkflowValidationResult
  ): WorkflowValidationResult {
    const checks: WorkflowValidationResult["checks"] = [...planValidation.checks];

    const allTasksCompleted = plan.executionOrder.every((id) =>
      taskHistory.some(
        (t) =>
          t.taskId === id &&
          (t.status === "completed" || t.status === "recovered")
      )
    );

    checks.push({
      name: "all-tasks-completed",
      passed: allTasksCompleted,
      message: allTasksCompleted
        ? "All planned tasks coordinated successfully"
        : "Not all tasks completed",
    });

    checks.push({
      name: "validation-rules",
      passed: plan.validationRules.filter((r) => r.required).length > 0,
      message: "Required validation rules referenced in plan",
    });

    const passed = checks.every((c) => c.passed);

    return {
      passed,
      checks,
      nextAction: passed ? undefined : checks.find((c) => !c.passed)?.message,
    };
  }
}
