import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";

import { VideoIntelligenceHealthMonitorLogger } from "./health-logger.js";

import {

  VideoIntelligenceAutoRepairResult,

  VideoIntelligenceHealthScoreLevel,

  VideoIntelligenceHealthWarning,

  VideoIntelligenceWarningType,

} from "./types.js";



export class VideoIntelligenceAutoRepairHandler {

  constructor(

    private readonly foundation: AiVideoIntelligenceFoundation,

    private readonly logger: VideoIntelligenceHealthMonitorLogger

  ) {}



  async attemptRepairs(warnings: VideoIntelligenceHealthWarning[]): Promise<VideoIntelligenceAutoRepairResult> {

    const repairs: string[] = [];

    let success = true;



    const critical = warnings.some(

      (w) =>

        w.severity === VideoIntelligenceHealthScoreLevel.Critical ||

        w.severity === VideoIntelligenceHealthScoreLevel.Failed

    );



    const hasCriticalWarning = warnings.some(

      (w) =>

        w.type === VideoIntelligenceWarningType.DatabaseProblems ||

        w.type === VideoIntelligenceWarningType.RegistryProblems ||

        w.type === VideoIntelligenceWarningType.BrokenDependencies ||

        w.type === VideoIntelligenceWarningType.VideoAnalysisFailure

    );



    if (critical || hasCriticalWarning || warnings.length > 3) {

      this.logger.log("warn", "repair", "Critical video intelligence issue — notifying AI Core and Recovery", {

        warningCount: warnings.length,

      });

      this.foundation.integration.reportCriticalIssue(

        `Critical video intelligence health: ${warnings.map((w) => w.message).join("; ")}`

      );

      repairs.push("AI Core and Recovery Engine notified");

    }



    try {

      await this.foundation.recover();

      repairs.push("Video intelligence foundation recovery executed");

    } catch {

      success = false;

    }



    const registry = this.foundation.getRegistry();

    registry.persist();

    repairs.push("Video intelligence registry re-persisted");



    const productionRepair = await this.foundation

      .getProductionVideoPlanningEngine()

      .repairProductionPlan("health-monitor-repair")

      .catch(() => null);

    if (productionRepair?.success) {

      repairs.push("Production video planning repair attempted");

    }



    const qualityRepair = await this.foundation

      .getVideoQualityPredictionEngine()

      .repairQualityPrediction("health-monitor-repair")

      .catch(() => null);

    if (qualityRepair?.success) {

      repairs.push("Video quality prediction repair attempted");

    }



    try {

      const optimization = this.foundation.getVideoIntelligenceOptimizationEngine();

      const cache = optimization.getCache();

      if (cache.hitRate < 10) {

        repairs.push("Video intelligence cache flagged for optimization");

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



    this.logger.log("info", "repair", "Automatic video intelligence repair complete", {

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


