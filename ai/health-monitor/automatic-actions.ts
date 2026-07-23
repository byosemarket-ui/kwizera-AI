import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import { FailureType, RecoveryResultStatus } from "../recovery-engine/types.js";
import { HealthMonitorLogger } from "./health-logger.js";
import { HealthRecommendation, ModuleHealthScore, SystemHealthLevel } from "./types.js";

export interface AutomaticActionResult {
  action: string;
  success: boolean;
  recoveryResult?: string;
  diagnostics?: string;
}

export class AutomaticActions {
  constructor(private readonly logger: HealthMonitorLogger) {}

  async handleWarning(
    moduleScores: ModuleHealthScore[]
  ): Promise<{ diagnostics: string[]; recommendations: HealthRecommendation[] }> {
    const diagnostics: string[] = [];
    const recommendations: HealthRecommendation[] = [];

    for (const mod of moduleScores.filter((m) => m.level === SystemHealthLevel.Warning)) {
      diagnostics.push(`${mod.moduleId}: score ${mod.score}`);
      recommendations.push({
        component: mod.moduleId,
        message: `Review ${mod.moduleName} — ${mod.warnings.join(", ") || "performance degraded"}`,
        priority: "medium",
      });
    }

    if (diagnostics.length) {
      this.logger.log("warn", "warning", "Diagnostics collected for warnings", { diagnostics });
    }

    return { diagnostics, recommendations };
  }

  async handleCritical(
    moduleScores: ModuleHealthScore[],
    recoveryEngine: AiRecoveryEngine | null
  ): Promise<AutomaticActionResult[]> {
    const results: AutomaticActionResult[] = [];
    const critical = moduleScores.filter(
      (m) => m.level === SystemHealthLevel.Critical || m.level === SystemHealthLevel.Failed
    );

    for (const mod of critical) {
      if (!recoveryEngine) {
        results.push({
          action: "notify-recovery-engine",
          success: false,
          diagnostics: "Recovery Engine unavailable",
        });
        continue;
      }

      try {
        const recovery = await recoveryEngine.recoverFromFailure({
          failureId: `health-${Date.now()}`,
          failureType: FailureType.Module,
          affectedComponent: mod.moduleId,
          rootCause: mod.errors[0] ?? `${mod.moduleName} health critical`,
          timestamp: new Date().toISOString(),
          severity: "critical",
          diagnostics: { moduleId: mod.moduleId, score: mod.score },
        });

        results.push({
          action: "automatic-recovery",
          success: recovery.status === RecoveryResultStatus.Success,
          recoveryResult: recovery.message,
        });

        this.logger.log(
          recovery.status === RecoveryResultStatus.Success ? "info" : "error",
          "recovery",
          `Recovery for ${mod.moduleId}: ${recovery.status}`,
          { recoveryId: recovery.recoveryId }
        );
      } catch (error) {
        results.push({
          action: "automatic-recovery",
          success: false,
          diagnostics: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}
