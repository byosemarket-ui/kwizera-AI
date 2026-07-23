import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryHealthMonitorLogger } from "./health-logger.js";
import { AutoRepairResult, HealthWarning, MemoryHealthScoreLevel } from "./types.js";

export class AutoRepairHandler {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: MemoryHealthMonitorLogger
  ) {}

  async attemptRepairs(warnings: HealthWarning[]): Promise<AutoRepairResult> {
    const repairs: string[] = [];
    let success = true;

    const critical = warnings.some(
      (w) => w.severity === MemoryHealthScoreLevel.Critical || w.severity === MemoryHealthScoreLevel.Failed
    );

    if (critical) {
      this.logger.log("warn", "repair", "Critical problem — notifying recovery engine", {
        warningCount: warnings.length,
      });
      try {
        await this.foundation.getMemoryBackupEngine().createAutomaticBackup();
        repairs.push("Emergency backup created to protect user work");
      } catch {
        success = false;
      }
    }

    const relationship = this.foundation.getRelationshipMemoryEngine().validateIntegrity();
    if (relationship.issuesRepaired > 0) {
      repairs.push(`Repaired ${relationship.issuesRepaired} relationship issue(s)`);
    }

    this.foundation.getIndexEngine().optimizeIndexes();
    repairs.push("Indexes optimized");

    const corruption = this.foundation.getMemoryRecoveryEngine().detectCorruption();
    if (corruption.detected) {
      this.logger.log("warn", "repair", "Corruption detected — recovery engine notified", {
        issues: corruption.issues,
      });
      repairs.push("Corruption flagged for recovery engine");
    }

    const validated = (await this.foundation.getMemoryRecoveryEngine().verifyIntegrity()).valid;

    this.logger.log("info", "repair", "Automatic repair complete", { repairs, validated });

    return {
      attempted: repairs.length > 0,
      success,
      repairs,
      validated,
    };
  }
}
