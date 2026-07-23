import {
  CustomerUnderstanding,
  ProductPurpose,
  UnderstandingMarketingPreparation,
  UnderstandingScores,
  UniqueValue,
  ValueAnalysis,
} from "./types.js";

export class ProductUnderstandingScorer {
  computeScores(
    purpose: ProductPurpose,
    customer: CustomerUnderstanding,
    value: ValueAnalysis,
    unique: UniqueValue,
    marketing: UnderstandingMarketingPreparation
  ): UnderstandingScores {
    let understandingScore = 60;
    if (purpose.primaryPurpose.length >= 20) understandingScore += 10;
    if (purpose.secondaryFunctions.length >= 1) understandingScore += 5;
    if (customer.customerNeeds.length >= 3) understandingScore += 10;
    if (customer.customerPainPoints.length >= 2) understandingScore += 5;
    if (unique.uniqueSellingPoints.length >= 2) understandingScore += 10;
    understandingScore = Math.min(100, understandingScore);

    const businessValueScore = Math.round(
      (value.commercialValue + value.marketValue + value.brandValue) / 3
    );

    const customerValueScore = Math.round(
      (value.functionalValue + value.emotionalValue + value.practicalValue) / 3
    );

    const readyCount = [
      marketing.audienceIntelligenceReady,
      marketing.marketingStrategyReady,
      marketing.creativeDirectionReady,
      marketing.storyboardReady,
      marketing.scriptPlanningReady,
      marketing.visualPlanningReady,
      marketing.productionPlanningReady,
    ].filter(Boolean).length;
    const marketingReadinessScore = Math.round((readyCount / 7) * 100);

    const aiConfidenceScore = Math.round(
      (understandingScore + businessValueScore + customerValueScore) / 3
    );

    return {
      understandingScore,
      businessValueScore,
      customerValueScore,
      marketingReadinessScore,
      aiConfidenceScore,
    };
  }

  isUnderstandingValid(scores: UnderstandingScores, purpose: ProductPurpose): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (!purpose.primaryPurpose || purpose.primaryPurpose.length < 10) {
      diagnostics.push("Product purpose is insufficient for validated understanding");
    }
    if (scores.understandingScore < 55) {
      diagnostics.push(`Understanding score ${scores.understandingScore} below threshold (55)`);
    }
    if (scores.customerValueScore < 50) {
      diagnostics.push(`Customer value score ${scores.customerValueScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
