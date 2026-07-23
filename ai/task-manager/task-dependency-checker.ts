import type { AiCoreManager } from "../core/ai-core-manager.js";
import { TaskDependencyResult } from "./types.js";

export class TaskDependencyChecker {
  verify(
    moduleId: string,
    dependsOn: string[],
    completedTaskIds: string[],
    core: AiCoreManager | null
  ): TaskDependencyResult {
    const checks: TaskDependencyResult["checks"] = [];

    checks.push({
      name: "required-module",
      passed: core?.registry.getEntry(moduleId) !== undefined,
      message: `Module slot ${moduleId}`,
    });

    checks.push({
      name: "required-memory",
      passed: true,
      message: "Memory Engine slot reserved (stub until Step 2G+)",
    });

    checks.push({
      name: "required-knowledge",
      passed: true,
      message: "Knowledge Engine slot reserved (stub until built)",
    });

    const storageRoot = core?.configuration.getConfiguration().storage.storageRoot;
    checks.push({
      name: "required-storage",
      passed: Boolean(storageRoot),
      message: storageRoot ? "Storage root configured" : "Storage not configured",
    });

    checks.push({
      name: "required-configuration",
      passed: core?.configuration.isLoaded() ?? false,
      message: "Application configuration",
    });

    const prevSatisfied = dependsOn.every((id) => completedTaskIds.includes(id));
    checks.push({
      name: "required-previous-tasks",
      passed: prevSatisfied,
      message: prevSatisfied
        ? "Previous task dependencies satisfied"
        : `Waiting for: ${dependsOn.join(", ")}`,
    });

    checks.push({
      name: "system-health",
      passed: core?.controller.getHealthReport().healthy ?? false,
      message: "System health",
    });

    const failed = checks.find((c) => !c.passed);
    return {
      satisfied: !failed,
      checks,
      pauseReason: failed?.message,
    };
  }
}
