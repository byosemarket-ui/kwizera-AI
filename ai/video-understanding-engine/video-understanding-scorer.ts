import {
  AudienceUnderstanding,
  BrandUnderstanding,
  MarketingUnderstanding,
  ProductUnderstanding,
  StoryUnderstanding,
  VideoPurpose,
  VideoUnderstandingScores,
} from "./types.js";

export class VideoUnderstandingScorer {
  computeScores(
    purpose: VideoPurpose,
    story: StoryUnderstanding,
    product: ProductUnderstanding,
    brand: BrandUnderstanding,
    audience: AudienceUnderstanding,
    marketing: MarketingUnderstanding,
    productionReadinessScore: number
  ): VideoUnderstandingScores {
    let videoUnderstandingScore = 58;
    if (purpose.primaryPurpose.length >= 20) videoUnderstandingScore += 12;
    if (story.narrativeStructure.length >= 10) videoUnderstandingScore += 10;
    if (story.storyFlow.length >= 15) videoUnderstandingScore += 8;
    videoUnderstandingScore = Math.min(100, videoUnderstandingScore);

    let storytellingScore = 52;
    if (story.emotionalJourney.length >= 10) storytellingScore += 15;
    if (story.viewerAttentionFlow.length >= 15) storytellingScore += 15;
    if (story.marketingJourney.length >= 15) storytellingScore += 10;
    storytellingScore = Math.min(100, storytellingScore);

    let marketingScore = marketing.marketingStrength;
    if (marketing.ctaOpportunity.length >= 15) marketingScore = Math.min(100, marketingScore + 5);
    if (marketing.productBenefits.length >= 15) marketingScore = Math.min(100, marketingScore + 5);

    let audienceAlignmentScore = 50;
    if (audience.targetAudience.length >= 10) audienceAlignmentScore += 15;
    if (audience.engagementOpportunity.length >= 15) audienceAlignmentScore += 15;
    if (audience.conversionOpportunity.length >= 10) audienceAlignmentScore += 10;
    audienceAlignmentScore = Math.min(100, audienceAlignmentScore);

    const brandConsistencyScore = Math.min(100, brand.brandConsistency);

    let productBoost = 0;
    if (product.mainProduct !== "none" && product.productVisibility >= 65) productBoost = 5;

    const aiConfidenceScore = Math.round(
      (videoUnderstandingScore +
        storytellingScore +
        marketingScore +
        audienceAlignmentScore +
        brandConsistencyScore +
        productionReadinessScore) /
        6 +
        productBoost
    );

    return {
      videoUnderstandingScore,
      storytellingScore,
      marketingScore,
      audienceAlignmentScore,
      brandConsistencyScore,
      productionReadinessScore: Math.min(100, productionReadinessScore),
      aiConfidenceScore: Math.min(100, aiConfidenceScore),
    };
  }

  isUnderstandingValid(scores: VideoUnderstandingScores, purpose: VideoPurpose): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (!purpose.primaryPurpose || purpose.primaryPurpose.length < 10) {
      diagnostics.push("Video purpose is insufficient for validated understanding");
    }
    if (scores.videoUnderstandingScore < 55) {
      diagnostics.push(
        `Video understanding score ${scores.videoUnderstandingScore} below threshold (55)`
      );
    }
    if (scores.storytellingScore < 50) {
      diagnostics.push(`Storytelling score ${scores.storytellingScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
