import type { AiCoreManager } from "../core/ai-core-manager.js";
import {
  DecisionRequest,
  DecisionValidationResult,
  ScoredSolution,
} from "./types.js";

export class DecisionValidator {
  validate(
    request: DecisionRequest,
    selected: ScoredSolution,
    core: AiCoreManager
  ): DecisionValidationResult {
    const checks: DecisionValidationResult["checks"] = [];

    checks.push({
      name: "required-inputs",
      passed: request.userRequest.trim().length > 0,
      message: "User request present",
    });

    checks.push({
      name: "dependencies",
      passed: selected.requiredModules.every((m) =>
        core.registry.getEntry(m) !== undefined || m === "decision-engine"
      ),
      message: "Required module slots exist in registry",
    });

    const health = core.controller.getHealthReport();
    checks.push({
      name: "system-health",
      passed: health.healthy || core.getLifecycleState() === "ready",
      message: health.healthy ? "System healthy" : `Health: ${health.lifecycleState}`,
    });

    checks.push({
      name: "available-resources",
      passed: core.runtime.isWorkflowReady(),
      message: core.runtime.isWorkflowReady()
        ? "Runtime workflow-ready"
        : "Runtime not ready",
    });

    checks.push({
      name: "runtime-status",
      passed: core.isStarted() && core.lifecycle.isOperational(),
      message: `Lifecycle: ${core.getLifecycleState()}`,
    });

    const passed = checks.every((c) => c.passed);

    return {
      passed,
      checks,
      nextAction: passed
        ? undefined
        : checks.find((c) => !c.passed)?.message ?? "Resolve validation failures",
    };
  }
}
