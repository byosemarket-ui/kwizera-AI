import {
  ProductAnalysisProfile,
  ProductClassification,
  ProductCompletenessScores,
  ProductMarketingPreparation,
  ProductVisualPreparation,
} from "./types.js";

export class ProductAnalysisScorer {
  computeScores(
    profile: ProductAnalysisProfile,
    visual: ProductVisualPreparation,
    classification: ProductClassification,
    marketing: ProductMarketingPreparation,
    missingFields: string[]
  ): ProductCompletenessScores {
    const totalFields = 20;
    const filledFields = totalFields - missingFields.length;
    const completenessScore = Math.round(Math.max(0, Math.min(100, (filledFields / totalFields) * 100)));

    let dataQualityScore = 70;
    if (profile.description.length >= 50) dataQualityScore += 10;
    if (profile.features.length >= 3) dataQualityScore += 8;
    if (profile.specifications && Object.keys(profile.specifications).length >= 2) dataQualityScore += 7;
    if (profile.sku) dataQualityScore += 5;
    dataQualityScore = Math.min(100, dataQualityScore);

    const marketingReadyCount = [
      marketing.marketingStrategyReady,
      marketing.creativeDirectionReady,
      marketing.storyboardReady,
      marketing.scriptPlanningReady,
      marketing.visualPlanningReady,
      marketing.audioPlanningReady,
      marketing.videoGenerationReady,
    ].filter(Boolean).length;
    const marketingReadinessScore = Math.round((marketingReadyCount / 7) * 100);

    let analysisConfidenceScore = 60;
    if (classification.industry && classification.useCase) analysisConfidenceScore += 15;
    if (classification.targetCustomer) analysisConfidenceScore += 10;
    if (visual.productVisibility >= 70) analysisConfidenceScore += 8;
    if (profile.price > 0) analysisConfidenceScore += 7;
    analysisConfidenceScore = Math.min(100, analysisConfidenceScore);

    return {
      completenessScore,
      dataQualityScore,
      marketingReadinessScore,
      analysisConfidenceScore,
    };
  }

  isAnalysisValid(
    scores: ProductCompletenessScores,
    missingFields: string[],
    criticallyIncomplete: boolean
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (criticallyIncomplete) {
      diagnostics.push("Critical product fields missing — analysis rejected");
    }
    if (scores.completenessScore < 40) {
      diagnostics.push(`Completeness score ${scores.completenessScore} below minimum threshold (40)`);
    }
    if (scores.dataQualityScore < 50) {
      diagnostics.push(`Data quality score ${scores.dataQualityScore} below minimum threshold (50)`);
    }
    if (scores.analysisConfidenceScore < 55) {
      diagnostics.push(`Analysis confidence ${scores.analysisConfidenceScore} below minimum threshold (55)`);
    }
    if (missingFields.includes("productName") || missingFields.includes("brand")) {
      diagnostics.push("Product name and brand are required for validated analysis");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
