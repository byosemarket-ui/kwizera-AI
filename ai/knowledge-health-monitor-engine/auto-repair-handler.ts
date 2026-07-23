import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeHealthMonitorLogger } from "./health-logger.js";
import {
  KnowledgeAutoRepairResult,
  KnowledgeHealthScoreLevel,
  KnowledgeHealthWarning,
} from "./types.js";

export class KnowledgeAutoRepairHandler {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly logger: KnowledgeHealthMonitorLogger
  ) {}

  async attemptRepairs(warnings: KnowledgeHealthWarning[]): Promise<KnowledgeAutoRepairResult> {
    const repairs: string[] = [];
    let success = true;

    const critical = warnings.some(
      (w) =>
        w.severity === KnowledgeHealthScoreLevel.Critical ||
        w.severity === KnowledgeHealthScoreLevel.Failed
    );

    if (critical) {
      this.logger.log("warn", "repair", "Critical knowledge issue — notifying AI Core and Recovery", {
        warningCount: warnings.length,
      });
      this.foundation.integration.reportCriticalKnowledgeIssue(
        `Critical knowledge health: ${warnings.map((w) => w.message).join("; ")}`
      );
      repairs.push("AI Core and Recovery Engine notified");
    }

    const quarantined = await this.foundation
      .getKnowledgeValidationEngine()
      .quarantineCorruptRecords();
    if (quarantined > 0) {
      repairs.push(`Quarantined ${quarantined} corrupt record(s)`);
    }

    const graphIntegrity = this.foundation.getGraphEngine().validateIntegrity();
    if (graphIntegrity.issuesRepaired > 0) {
      repairs.push(`Repaired ${graphIntegrity.issuesRepaired} graph issue(s)`);
    }

    const relationshipRepair = await this.foundation
      .getKnowledgeValidationEngine()
      .repairSafeIssues();
    if (relationshipRepair.repaired > 0) {
      repairs.push(`Repaired ${relationshipRepair.repaired} consistency issue(s)`);
    }

    try {
      await this.foundation.getKnowledgeOptimizationEngine().optimizeCache();
      repairs.push("Knowledge cache optimized");
    } catch {
      success = false;
    }

    let validated = false;
    try {
      this.foundation.getStorageEngine().runIntegrityCheck();
      const integrity = await this.foundation.getKnowledgeValidationEngine().validateIntegrity();
      validated = integrity.valid;
      if (!validated) {
        repairs.push("Post-repair validation flagged remaining issues");
      }
    } catch {
      success = false;
    }

    this.logger.log("info", "repair", "Automatic knowledge repair complete", { repairs, validated });

    return {
      attempted: repairs.length > 0,
      success,
      repairs,
      validated,
    };
  }
}
