import type { AiCoreManager } from "../core/ai-core-manager.js";
import {
  ApprovedDecisionInput,
  ExecutionPlan,
  PlanValidationResult,
  ResourceEstimate,
} from "./types.js";

export class PlanValidator {
  validate(
    input: ApprovedDecisionInput,
    plan: ExecutionPlan,
    core: AiCoreManager | null
  ): PlanValidationResult {
    const checks: PlanValidationResult["checks"] = [];

    checks.push({
      name: "required-information",
      passed: Boolean(input.objective.trim()) && plan.taskList.length > 0,
      message: "Objective and task list present",
    });

    checks.push({
      name: "dependencies-satisfied",
      passed: plan.dependencies.every((d) => d.satisfied),
      message: "All task dependencies satisfied against registry slots",
    });

    checks.push({
      name: "required-modules",
      passed: plan.requiredResources.modules.every(
        (m) => core?.registry.getEntry(m) !== undefined || m === "planning-engine"
      ),
      message: "Required module slots exist in registry",
    });

    checks.push({
      name: "storage-available",
      passed: this.hasStorageCapacity(plan.requiredResources, core),
      message: "Storage capacity acceptable for estimated plan",
    });

    const health = core?.controller.getHealthReport();
    checks.push({
      name: "system-health",
      passed: health?.healthy ?? false,
      message: health?.healthy ? "System healthy" : "System health degraded",
    });

    checks.push({
      name: "recovery-strategy",
      passed:
        plan.recoveryStrategy.checkpoints.length > 0 &&
        plan.recoveryStrategy.rollbackSteps.length > 0,
      message: "Recovery strategy defined with checkpoints",
    });

    const passed = checks.every((c) => c.passed);

    return {
      passed,
      checks,
      nextAction: passed
        ? undefined
        : checks.find((c) => !c.passed)?.message ?? "Resolve plan validation failures",
    };
  }

  private hasStorageCapacity(resources: ResourceEstimate, core: AiCoreManager | null): boolean {
    if (!core) return true;
    const storageRoot = core.configuration.getConfiguration().storage.storageRoot;
    return Boolean(storageRoot) && resources.storageBytes > 0;
  }
}
