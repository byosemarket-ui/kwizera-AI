import {
  BrandStrategyKnowledge,
  CampaignKnowledge,
  ContentKnowledge,
  CustomerPsychologyKnowledge,
  MarketingQualityScores,
  MarketingStructureKnowledge,
  StorytellingKnowledge,
} from "./types.js";

const MIN_STORE_CONFIDENCE = 55;

export class MarketingScorer {
  computeScores(
    brand: BrandStrategyKnowledge,
    structure: MarketingStructureKnowledge,
    campaign: CampaignKnowledge,
    customer: CustomerPsychologyKnowledge,
    content: ContentKnowledge,
    storytelling: StorytellingKnowledge
  ): MarketingQualityScores {
    const hasCta = Boolean(structure.callToAction && structure.callToAction.length > 3);
    const hasBenefits = structure.benefits.length >= 2;
    const hasSocialProof = Boolean(structure.socialProof);

    const marketingQualityScore = Math.round(
      brand.brandConsistency * 0.2 +
        campaign.brandingConsistency * 0.15 +
        (hasBenefits ? 20 : 8) +
        (hasSocialProof ? 15 : 5) +
        (hasCta ? 20 : 5) +
        (content.headlines.length >= 2 ? 10 : 3)
    );

    const brandConsistencyScore = Math.round(
      brand.brandConsistency * 0.5 +
        campaign.brandingConsistency * 0.3 +
        (brand.brandColors.length >= 2 ? 10 : 0) +
        (brand.brandMessaging ? 10 : 0)
    );

    const customerRelevanceScore = Math.round(
      customer.customerNeeds.length * 8 +
        customer.buyingTriggers.length * 7 +
        customer.trustFactors.length * 6 +
        (customer.customerIntent ? 15 : 0)
    );

    const campaignStructureScore = Math.round(
      (structure.hook ? 15 : 0) +
        (structure.problem ? 12 : 0) +
        (structure.solution ? 12 : 0) +
        (structure.offer ? 12 : 0) +
        (hasCta ? 15 : 0) +
        (campaign.campaignFlow ? 14 : 0) +
        campaign.performanceIndicators.length * 4
    );

    const storytellingScore = Math.round(
      (storytelling.hookTiming <= 5 ? 25 : 12) +
        (storytelling.narrativeArc ? 20 : 5) +
        (storytelling.emotionalFlow ? 20 : 5) +
        (storytelling.storyPacing ? 15 : 5) +
        (storytelling.characterOrBrandRole ? 10 : 0)
    );

    const conversionReadinessScore = Math.round(
      (hasCta ? 30 : 5) +
        (structure.offer ? 20 : 5) +
        (hasSocialProof ? 15 : 0) +
        (customer.buyingTriggers.length >= 2 ? 15 : 5) +
        (storytelling.hookTiming <= 5 ? 10 : 3) +
        campaign.performanceIndicators.length * 2
    );

    const aiConfidenceScore = Math.round(
      (marketingQualityScore +
        brandConsistencyScore +
        customerRelevanceScore +
        campaignStructureScore +
        storytellingScore +
        conversionReadinessScore) /
        6
    );

    return {
      marketingQualityScore: Math.min(100, marketingQualityScore),
      brandConsistencyScore: Math.min(100, brandConsistencyScore),
      customerRelevanceScore: Math.min(100, customerRelevanceScore),
      campaignStructureScore: Math.min(100, campaignStructureScore),
      storytellingScore: Math.min(100, storytellingScore),
      conversionReadinessScore: Math.min(100, conversionReadinessScore),
      aiConfidenceScore: Math.min(100, aiConfidenceScore),
    };
  }

  isAnalysisValid(scores: MarketingQualityScores): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];
    if (scores.aiConfidenceScore < MIN_STORE_CONFIDENCE) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below minimum ${MIN_STORE_CONFIDENCE}`);
    }
    if (scores.campaignStructureScore < 35) {
      diagnostics.push("Campaign structure score too low for validated storage");
    }
    const minDimension = 50;
    if (scores.marketingQualityScore < minDimension) {
      diagnostics.push(`Marketing quality ${scores.marketingQualityScore} below minimum ${minDimension}`);
    }
    if (scores.customerRelevanceScore < minDimension) {
      diagnostics.push(`Customer relevance ${scores.customerRelevanceScore} below minimum ${minDimension}`);
    }
    if (scores.conversionReadinessScore < minDimension) {
      diagnostics.push(`Conversion readiness ${scores.conversionReadinessScore} below minimum ${minDimension}`);
    }
    return { valid: diagnostics.length === 0, diagnostics };
  }
}
