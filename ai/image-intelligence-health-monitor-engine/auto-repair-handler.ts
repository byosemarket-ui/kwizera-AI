import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceHealthMonitorLogger } from "./health-logger.js";
import {
  ImageIntelligenceAutoRepairResult,
  ImageIntelligenceHealthScoreLevel,
  ImageIntelligenceHealthWarning,
  ImageIntelligenceWarningType,
} from "./types.js";

export class ImageIntelligenceAutoRepairHandler {
  constructor(
    private readonly foundation: AiImageIntelligenceFoundation,
    private readonly logger: ImageIntelligenceHealthMonitorLogger
  ) {}

  async attemptRepairs(warnings: ImageIntelligenceHealthWarning[]): Promise<ImageIntelligenceAutoRepairResult> {
    const repairs: string[] = [];
    let success = true;

    const critical = warnings.some(
      (w) =>
        w.severity === ImageIntelligenceHealthScoreLevel.Critical ||
        w.severity === ImageIntelligenceHealthScoreLevel.Failed
    );

    const hasCriticalWarning = warnings.some(
      (w) =>
        w.type === ImageIntelligenceWarningType.DatabaseProblems ||
        w.type === ImageIntelligenceWarningType.RegistryProblems ||
        w.type === ImageIntelligenceWarningType.BrokenDependencies ||
        w.type === ImageIntelligenceWarningType.ImageAnalysisFailure
    );

    if (critical || hasCriticalWarning || warnings.length > 3) {
      this.logger.log("warn", "repair", "Critical image intelligence issue — notifying AI Core and Recovery", {
        warningCount: warnings.length,
      });
      this.foundation.integration.reportCriticalIssue(
        `Critical image intelligence health: ${warnings.map((w) => w.message).join("; ")}`
      );
      repairs.push("AI Core and Recovery Engine notified");
    }

    try {
      await this.foundation.recover();
      repairs.push("Image intelligence foundation recovery executed");
    } catch {
      success = false;
    }

    const registry = this.foundation.getRegistry();
    registry.persist();
    repairs.push("Image intelligence registry re-persisted");

    const productionRepair = await this.foundation
      .getProductionImagePlanningEngine()
      .repairProductionPlan("health-monitor-repair")
      .catch(() => null);
    if (productionRepair?.success) {
      repairs.push("Production image planning repair attempted");
    }

    const qualityRepair = await this.foundation
      .getImageQualityPredictionEngine()
      .repairQualityPrediction("health-monitor-repair")
      .catch(() => null);
    if (qualityRepair?.success) {
      repairs.push("Image quality prediction repair attempted");
    }

    try {
      const optimization = this.foundation.getImageIntelligenceOptimizationEngine();
      const cache = optimization.getCache();
      if (cache.hitRate < 10) {
        repairs.push("Image intelligence cache flagged for optimization");
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

    this.logger.log("info", "repair", "Automatic image intelligence repair complete", {
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
