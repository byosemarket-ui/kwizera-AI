import { CreativeQualityScores, StoryboardPlan } from "./types.js";

export class CreativeVideoScorer {
  computeScores(
    storyboard: StoryboardPlan,
    recommendationCount: number,
    templateMatchScore: number,
    storytellingBase: number,
    marketingBase: number,
    brandConsistency: number,
    productionBase: number
  ): CreativeQualityScores {
    let creativeScore = 55;
    if (storyboard.sceneOrder.length >= 3) creativeScore += 15;
    if (storyboard.sceneTiming.length >= 3) creativeScore += 10;
    if (recommendationCount >= 4) creativeScore += 10;
    creativeScore = Math.min(100, creativeScore);

    const storytellingScore = Math.round((storytellingBase + (storyboard.sceneOrder.length >= 3 ? 15 : 0)) / 1.15);
    const marketingScore = Math.round((marketingBase + templateMatchScore * 0.2) / 1.2);
    const visualImpactScore = Math.round((creativeScore + brandConsistency) / 2);
    const brandConsistencyScore = brandConsistency;

    const productionReadinessScore = Math.round(
      (productionBase + creativeScore + marketingScore) / 3
    );

    const aiConfidenceScore = Math.round(
      (creativeScore +
        storytellingScore +
        marketingScore +
        visualImpactScore +
        brandConsistencyScore +
        productionReadinessScore) /
        6
    );

    return {
      creativeScore: Math.min(100, creativeScore),
      storytellingScore: Math.min(100, storytellingScore),
      marketingScore: Math.min(100, marketingScore),
      visualImpactScore: Math.min(100, visualImpactScore),
      brandConsistencyScore: Math.min(100, brandConsistencyScore),
      productionReadinessScore: Math.min(100, productionReadinessScore),
      aiConfidenceScore: Math.min(100, aiConfidenceScore),
    };
  }

  isPlanValid(
    scores: CreativeQualityScores,
    sceneCount: number,
    recommendationCount: number,
    templateCount: number
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];
    if (sceneCount < 2) diagnostics.push("At least 2 storyboard scenes required");
    if (recommendationCount < 3) diagnostics.push("At least 3 creative recommendations required");
    if (templateCount < 1) diagnostics.push("At least 1 creative template match required");
    if (scores.creativeScore < 55) {
      diagnostics.push(`Creative score ${scores.creativeScore} below threshold (55)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }
    return { valid: diagnostics.length === 0, diagnostics };
  }
}
