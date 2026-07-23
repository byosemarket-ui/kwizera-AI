import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { CreativeImageIntelligenceScores } from "./types.js";

export class CreativeImageScorer {
  computeScores(
    composition: CompositionIntelligenceRecord,
    brandVisual: BrandVisualIntelligenceRecord,
    understanding: ImageUnderstandingRecord,
    hasEnhancementPlan: boolean
  ): CreativeImageIntelligenceScores {
    const creativeLayoutScore = Math.round(
      (composition.compositionAnalysis.balance +
        composition.visualHierarchy.productPriority +
        composition.visualHierarchy.brandVisibility +
        composition.suitability.socialMedia) /
        4
    );

    const marketingScore = Math.round(
      (composition.suitability.advertisement +
        composition.suitability.poster +
        composition.visualHierarchy.ctaVisibility +
        understanding.scores.aiConfidenceScore) /
        4
    );

    const brandConsistencyScore = brandVisual.scores.brandConsistencyScore;

    const readabilityScore = Math.round(
      (composition.visualHierarchy.mainSubjectVisibility +
        composition.compositionAnalysis.negativeSpace +
        brandVisual.logoAnalysis.logoContrast) /
        3
    );

    const visualImpactScore = Math.round(
      (composition.visualHierarchy.mainSubjectVisibility +
        composition.suitability.thumbnail +
        brandVisual.scores.marketingReadinessScore) /
        3
    );

    const enhancementBonus = hasEnhancementPlan ? 5 : 0;

    const aiConfidenceScore = Math.round(
      (creativeLayoutScore +
        marketingScore +
        brandConsistencyScore +
        readabilityScore +
        visualImpactScore +
        enhancementBonus) /
        5
    );

    return {
      creativeLayoutScore: Math.min(100, creativeLayoutScore),
      marketingScore: Math.min(100, marketingScore),
      brandConsistencyScore,
      readabilityScore: Math.min(100, readabilityScore),
      visualImpactScore: Math.min(100, visualImpactScore),
      aiConfidenceScore: Math.min(100, aiConfidenceScore),
    };
  }

  isPlanValid(
    scores: CreativeImageIntelligenceScores,
    brandVisual: BrandVisualIntelligenceRecord,
    composition: CompositionIntelligenceRecord
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (!composition.validated) {
      diagnostics.push("Composition intelligence required for creative layout planning");
    }
    if (!brandVisual.validated) {
      diagnostics.push("Brand visual intelligence required for brand-aligned creative planning");
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency ${scores.brandConsistencyScore}% below threshold (50)`);
    }
    if (scores.creativeLayoutScore < 45) {
      diagnostics.push(`Creative layout score ${scores.creativeLayoutScore} below threshold (45)`);
    }
    if (scores.marketingScore < 45) {
      diagnostics.push(`Marketing alignment score ${scores.marketingScore} below threshold (45)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
