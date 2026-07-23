import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import {
  BrandDirection,
  CreativeDirectionProfile,
  CreativeScores,
  MarketingDirection,
  PlatformCreativeDirection,
  VisualDirection,
} from "./types.js";

export class CreativeDirectionScorer {
  computeScores(
    profile: CreativeDirectionProfile,
    visual: VisualDirection,
    brand: BrandDirection,
    marketing: MarketingDirection,
    platformDirections: PlatformCreativeDirection[],
    strategy: MarketingStrategyRecord,
    audience: AudienceIntelligenceRecord
  ): CreativeScores {
    const creativeQualityScore = this.computeCreativeQuality(profile, visual, marketing, platformDirections);
    const brandConsistencyScore = this.computeBrandConsistency(brand, profile);
    const marketingAlignmentScore = Math.min(100, strategy.scores.strategyQualityScore);
    const visualDirectionScore = this.computeVisualDirectionScore(visual);
    const audienceAlignmentScore = Math.min(100, audience.scores.audienceRelevanceScore);
    const aiConfidenceScore = Math.round(
      (creativeQualityScore +
        brandConsistencyScore +
        marketingAlignmentScore +
        visualDirectionScore +
        audienceAlignmentScore) /
        5
    );

    return {
      creativeQualityScore,
      brandConsistencyScore,
      marketingAlignmentScore,
      visualDirectionScore,
      audienceAlignmentScore,
      aiConfidenceScore,
    };
  }

  isCreativeDirectionValid(
    scores: CreativeScores,
    profile: CreativeDirectionProfile,
    brand: BrandDirection,
    marketing: MarketingDirection,
    platformDirections: PlatformCreativeDirection[]
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (!profile.creativeTheme) diagnostics.push("Creative theme is required");
    if (!profile.creativeStyle) diagnostics.push("Creative style must be selected");
    if (brand.brandColors.length < 2) diagnostics.push("Brand colors insufficient for validated direction");
    if (!marketing.hookDirection) diagnostics.push("Hook direction is required");
    if (platformDirections.length < 1) diagnostics.push("At least one platform direction required");
    if (scores.creativeQualityScore < 55) {
      diagnostics.push(`Creative quality score ${scores.creativeQualityScore} below threshold (55)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.marketingAlignmentScore < 50) {
      diagnostics.push(`Marketing alignment score ${scores.marketingAlignmentScore} below threshold (50)`);
    }
    if (scores.audienceAlignmentScore < 50) {
      diagnostics.push(`Audience alignment score ${scores.audienceAlignmentScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  private computeCreativeQuality(
    profile: CreativeDirectionProfile,
    visual: VisualDirection,
    marketing: MarketingDirection,
    platforms: PlatformCreativeDirection[]
  ): number {
    let score = 50;
    if (profile.creativeTheme.length >= 20) score += 10;
    if (visual.colorPalette.length >= 3) score += 10;
    if (marketing.storytellingDirection.length >= 30) score += 10;
    if (platforms.length >= 2) score += 10;
    if (profile.emotionalDirection.length >= 20) score += 10;
    return Math.min(100, score);
  }

  private computeBrandConsistency(brand: BrandDirection, profile: CreativeDirectionProfile): number {
    let score = 45;
    if (brand.brandIdentity) score += 15;
    if (brand.brandVoice) score += 15;
    if (brand.brandColors.length >= 2) score += 10;
    if (brand.brandConsistency.length >= 30) score += 10;
    if (profile.brand) score += 5;
    return Math.min(100, score);
  }

  private computeVisualDirectionScore(visual: VisualDirection): number {
    const fields = [
      visual.colorPalette,
      visual.typographyStyle,
      visual.designStyle,
      visual.compositionStyle,
      visual.lightingStyle,
      visual.visualHierarchy,
    ];
    const filled = fields.filter((f) => (Array.isArray(f) ? f.length > 0 : Boolean(f))).length;
    return Math.min(100, 40 + filled * 10);
  }
}
