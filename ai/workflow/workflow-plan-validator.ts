import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { ExecutionPlan } from "../planning/types.js";
import { WorkflowValidationResult } from "./types.js";

export class WorkflowPlanValidator {
  validate(plan: ExecutionPlan, core: AiCoreManager | null): WorkflowValidationResult {
    const checks: WorkflowValidationResult["checks"] = [];

    checks.push({
      name: "plan-tasks",
      passed: plan.taskList.length > 0 && plan.executionOrder.length > 0,
      message: "Execution plan contains tasks and order",
    });

    checks.push({
      name: "plan-dependencies",
      passed: plan.dependencies.every((d) => d.satisfied),
      message: "Plan dependencies marked satisfied",
    });

    checks.push({
      name: "recovery-strategy",
      passed: plan.recoveryStrategy.checkpoints.length > 0,
      message: "Recovery strategy present",
    });

    checks.push({
      name: "expected-output",
      passed: Boolean(plan.expectedOutput && plan.projectGoal),
      message: "Expected output and goal defined",
    });

    checks.push({
      name: "system-health",
      passed: core?.controller.getHealthReport().healthy ?? false,
      message: "System health acceptable",
    });

    const passed = checks.every((c) => c.passed);

    return {
      passed,
      checks,
      nextAction: passed ? undefined : checks.find((c) => !c.passed)?.message,
    };
  }
}
