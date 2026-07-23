import {
  ImageQualityCategoryScores,
  ImageQualityChecks,
  ImageQualityPredictions,
  ImageQualityRiskItem,
  ImageQualityRiskSeverity,
} from "./types.js";
import type { UpstreamQualityContext } from "./image-quality-prediction-analyzer.js";

export class ImageQualityPredictionScorer {
  computeScores(ctx: UpstreamQualityContext, checks: ImageQualityChecks): ImageQualityCategoryScores {
    const { analysis, composition, lightingColor, brandVisual, enhancementPlan, creativePlan, productionPlan } =
      ctx;

    const technicalQualityScore = Math.round(
      (analysis.scores.technicalQualityScore +
        analysis.scores.visualQualityScore +
        analysis.visual.sharpness +
        (100 - analysis.visual.noiseLevel)) /
        4
    );

    const compositionScore = Math.round(
      (composition.compositionAnalysis.balance +
        composition.visualHierarchy.productPriority +
        composition.suitability.socialMedia) /
        3
    );

    const lightingScore = lightingColor.scores.lightingQualityScore;
    const colorScore = lightingColor.scores.colorQualityScore;
    const brandConsistencyScore = brandVisual.scores.brandConsistencyScore;

    const marketingEffectivenessScore = Math.round(
      (ctx.understanding.scores.marketingReadinessScore +
        creativePlan.scores.marketingScore +
        brandVisual.scores.marketingReadinessScore) /
        3
    );

    const platformReadinessScore = productionPlan.scores.productionReadinessScore;
    const productionReadinessScore = productionPlan.scores.productionReadinessScore;

    const overallImageQualityScore = Math.round(
      (technicalQualityScore +
        compositionScore +
        lightingScore +
        colorScore +
        brandConsistencyScore +
        enhancementPlan.scores.imageQualityScore) /
        6
    );

    const aiConfidenceScore = Math.round(
      (overallImageQualityScore +
        marketingEffectivenessScore +
        platformReadinessScore +
        productionReadinessScore +
        creativePlan.scores.aiConfidenceScore) /
        5
    );

    return {
      overallImageQualityScore,
      technicalQualityScore,
      compositionScore,
      lightingScore,
      colorScore,
      brandConsistencyScore,
      marketingEffectivenessScore,
      platformReadinessScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isPredictionValid(
    scores: ImageQualityCategoryScores,
    risks: ImageQualityRiskItem[],
    checks: ImageQualityChecks
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    const unresolvedCritical = risks.filter((r) => !r.resolved && r.severity === "critical");
    if (unresolvedCritical.length > 0) {
      diagnostics.push(
        `Unresolved critical risk(s): ${unresolvedCritical.map((r) => r.category).join(", ")}`
      );
    }

    if (!checks.dependencyValidation) {
      diagnostics.push("Dependency validation must pass before quality prediction approval");
    }

    if (scores.overallImageQualityScore < 45) {
      diagnostics.push(`Overall quality score ${scores.overallImageQualityScore} below threshold (45)`);
    }

    if (scores.productionReadinessScore < 50) {
      diagnostics.push(`Production readiness ${scores.productionReadinessScore} below threshold (50)`);
    }

    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  severityRank(severity: ImageQualityRiskSeverity): number {
    const ranks: Record<ImageQualityRiskSeverity, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return ranks[severity];
  }
}
