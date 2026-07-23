import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceHealthMonitorLogger } from "./health-logger.js";
import {
  ProductIntelligenceAutoRepairResult,
  ProductIntelligenceHealthScoreLevel,
  ProductIntelligenceHealthWarning,
  ProductIntelligenceWarningType,
} from "./types.js";

export class ProductIntelligenceAutoRepairHandler {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly logger: ProductIntelligenceHealthMonitorLogger
  ) {}

  async attemptRepairs(
    warnings: ProductIntelligenceHealthWarning[]
  ): Promise<ProductIntelligenceAutoRepairResult> {
    const repairs: string[] = [];
    let success = true;

    const critical = warnings.some(
      (w) =>
        w.severity === ProductIntelligenceHealthScoreLevel.Critical ||
        w.severity === ProductIntelligenceHealthScoreLevel.Failed
    );

    const hasCriticalWarning = warnings.some(
      (w) =>
        w.type === ProductIntelligenceWarningType.DatabaseProblems ||
        w.type === ProductIntelligenceWarningType.RegistryProblems ||
        w.type === ProductIntelligenceWarningType.BrokenDependencies ||
        w.type === ProductIntelligenceWarningType.PlanningFailure
    );

    if (critical || hasCriticalWarning || warnings.length > 3) {
      this.logger.log("warn", "repair", "Critical product intelligence issue — notifying AI Core and Recovery", {
        warningCount: warnings.length,
      });
      this.foundation.integration.reportCriticalIssue(
        `Critical product intelligence health: ${warnings.map((w) => w.message).join("; ")}`
      );
      repairs.push("AI Core and Recovery Engine notified");
    }

    try {
      await this.foundation.recover();
      repairs.push("Product intelligence foundation recovery executed");
    } catch {
      success = false;
    }

    const registry = this.foundation.getRegistry();
    registry.persist();
    repairs.push("Product intelligence registry re-persisted");

    const productionRepair = await this.foundation
      .getProductionPlanningEngine()
      .repairProductionPlan("health-monitor-repair")
      .catch(() => null);
    if (productionRepair?.success) {
      repairs.push("Production planning repair attempted");
    }

    const qualityRepair = await this.foundation
      .getQualityPredictionEngine()
      .repairQualityPrediction("health-monitor-repair")
      .catch(() => null);
    if (qualityRepair?.success) {
      repairs.push("Quality prediction repair attempted");
    }

    try {
      const optimization = this.foundation.getProductIntelligenceOptimizationEngine();
      const cache = optimization.getCache();
      if (cache.hitRate < 10) {
        repairs.push("Product intelligence cache flagged for optimization");
      }
    } catch {
      success = false;
    }

    let validated = false;
    try {
      const integrity = this.foundation.getLastIntegrityResult();
      const health = await this.foundation.runHealthCheck();
      validated = (integrity?.verified ?? true) && health.score >= 60;
      if (!validated) {
        repairs.push("Post-repair validation flagged remaining issues");
      }
    } catch {
      success = false;
    }

    this.logger.log("info", "repair", "Automatic product intelligence repair complete", {
      repairs,
      validated,
    });

    return {
      attempted: repairs.length > 0,
      success,
      repairs,
      validated,
    };
  }
}
