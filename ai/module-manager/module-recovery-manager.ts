import type { AiModulePlugin } from "../core/types.js";
import { ModuleHistoryStore } from "./module-history-store.js";
import { ModuleManagerLogger } from "./module-logger.js";
import { ModuleCommunicationRouter } from "./communication-router.js";
import {
  ManagedModuleState,
  ModuleHealthStatus,
  ModuleRegistryRecord,
} from "./types.js";

export interface RecoveryDiagnostics {
  moduleId: string;
  failureReason: string;
  timestamp: string;
  steps: string[];
}

export class ModuleRecoveryManager {
  private readonly diagnostics: RecoveryDiagnostics[] = [];
  private readonly restartCounts = new Map<string, number>();

  constructor(
    private readonly history: ModuleHistoryStore,
    private readonly logger: ModuleManagerLogger,
    private readonly router: ModuleCommunicationRouter
  ) {}

  getDiagnostics(): ReadonlyArray<RecoveryDiagnostics> {
    return this.diagnostics;
  }

  getRestartCount(moduleId: string): number {
    return this.restartCounts.get(moduleId) ?? 0;
  }

  async recover(
    record: ModuleRegistryRecord,
    plugin: AiModulePlugin,
    reinitialize: () => Promise<void>
  ): Promise<boolean> {
    const steps: string[] = [];
    record.status = ManagedModuleState.Recovering;
    steps.push("Failure detected");
    steps.push("Diagnostics generated");

    const diag: RecoveryDiagnostics = {
      moduleId: record.moduleId,
      failureReason: record.lastError ?? "Unknown failure",
      timestamp: new Date().toISOString(),
      steps,
    };

    this.logger.log("warn", "recovery", `Recovering module ${record.moduleId}`, {
      failureReason: record.lastError,
    });

    try {
      record.status = ManagedModuleState.Restarting;
      steps.push("Restarting affected module only");
      this.router.isolate(record.moduleId);

      await plugin.shutdown();
      steps.push("Module shutdown complete");
      record.status = ManagedModuleState.Stopped;

      await reinitialize();
      steps.push("Dependencies reconnected");
      steps.push("Normal operation resumed");

      record.status = ManagedModuleState.Running;
      record.healthStatus = ModuleHealthStatus.Healthy;
      record.lastError = undefined;
      this.router.clearIsolation(record.moduleId);

      const count = (this.restartCounts.get(record.moduleId) ?? 0) + 1;
      this.restartCounts.set(record.moduleId, count);

      this.history.appendEvent({
        moduleId: record.moduleId,
        eventType: "recovery",
        detail: steps.join(" → "),
        timestamp: new Date().toISOString(),
      });

      diag.steps = steps;
      this.diagnostics.push(diag);
      this.logger.log("info", "recovery", `Module ${record.moduleId} recovered`, { count });
      return true;
    } catch (error) {
      record.status = ManagedModuleState.Failed;
      record.healthStatus = ModuleHealthStatus.Unhealthy;
      record.lastError = error instanceof Error ? error.message : String(error);
      steps.push(`Recovery failed: ${record.lastError}`);
      diag.steps = steps;
      this.diagnostics.push(diag);
      this.logger.log("error", "recovery", `Recovery failed for ${record.moduleId}`, {
        error: record.lastError,
      });
      return false;
    }
  }
}
