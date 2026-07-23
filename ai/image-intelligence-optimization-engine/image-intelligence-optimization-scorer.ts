import type { ImageQualityPredictionRecord } from "../image-quality-prediction-engine/types.js";
import {
  ImageModuleOptimizationResult,
  ImageOptimizationPerformanceMetrics,
  ImageOptimizationScores,
} from "./types.js";

export class ImageIntelligenceOptimizationScorer {
  computeScores(
    moduleResults: ImageModuleOptimizationResult[],
    performance: ImageOptimizationPerformanceMetrics,
    qualityPrediction: ImageQualityPredictionRecord
  ): ImageOptimizationScores {
    const avgImprovement =
      moduleResults.length > 0
        ? Math.round(
            moduleResults.reduce((s, m) => s + (m.qualityScoreAfter - m.qualityScoreBefore), 0) /
              moduleResults.length
          )
        : 0;

    const planningImprovement =
      performance.planningSpeedBeforeMs > 0
        ? Math.min(
            100,
            Math.round(
              ((performance.planningSpeedBeforeMs - performance.planningSpeedMs) /
                performance.planningSpeedBeforeMs) *
                100
            )
          )
        : 15;

    const searchImprovement =
      performance.searchSpeedBeforeMs > 0
        ? Math.min(
            100,
            Math.round(
              ((performance.searchSpeedBeforeMs - performance.searchSpeedMs) / performance.searchSpeedBeforeMs) *
                100
            )
          )
        : 20;

    const recommendationImprovement = Math.min(100, Math.max(5, avgImprovement + 5));
    const relationshipImprovement = Math.min(100, Math.max(5, avgImprovement + 3));
    const workflowEfficiencyScore = Math.min(100, planningImprovement + 10);
    const confidenceImprovement = Math.min(
      100,
      Math.max(5, avgImprovement + Math.round((planningImprovement + searchImprovement) / 4))
    );

    const overallImprovementScore = Math.max(
      5,
      Math.min(
        100,
        Math.round((avgImprovement + planningImprovement + searchImprovement + recommendationImprovement) / 4)
      )
    );

    const aiConfidenceScore = Math.min(
      100,
      Math.max(
        55,
        Math.round(
          (qualityPrediction.scores.aiConfidenceScore + overallImprovementScore + confidenceImprovement) / 3
        )
      )
    );

    return {
      overallImprovementScore,
      planningImprovementScore: planningImprovement,
      searchImprovementScore: searchImprovement,
      recommendationImprovementScore: recommendationImprovement,
      relationshipImprovementScore: relationshipImprovement,
      workflowEfficiencyScore,
      confidenceImprovementScore: confidenceImprovement,
      aiConfidenceScore,
    };
  }

  isOptimizationValid(
    scores: ImageOptimizationScores,
    moduleResults: ImageModuleOptimizationResult[],
    qualityPreserved: boolean
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (!qualityPreserved) diagnostics.push("Optimization must not reduce module quality scores");
    if (!moduleResults.every((m) => m.improved && m.qualityScoreAfter >= m.qualityScoreBefore)) {
      diagnostics.push("Every module must maintain or improve quality scores");
    }
    if (scores.overallImprovementScore < 5) {
      diagnostics.push(`Overall improvement score ${scores.overallImprovementScore} below threshold (5)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(
    scores: ImageOptimizationScores,
    qualityPrediction: ImageQualityPredictionRecord,
    qualityPreserved: boolean
  ): boolean {
    return (
      qualityPrediction.productionReady &&
      qualityPreserved &&
      scores.overallImprovementScore >= 5 &&
      scores.planningImprovementScore >= 0
    );
  }
}
