import {
  CompositionAnalysis,
  CompositionIntelligenceScores,
  CompositionSuitability,
  ProductPlacement,
  VisualHierarchy,
} from "./types.js";

export class CompositionScorer {
  computeScores(
    composition: CompositionAnalysis,
    hierarchy: VisualHierarchy,
    placement: ProductPlacement,
    suitability: CompositionSuitability
  ): CompositionIntelligenceScores {
    const compositionQualityScore = Math.round(
      (composition.balance + composition.symmetry + placement.productVisibility) / 3
    );

    const visualBalanceScore = Math.min(100, composition.balance);

    const visualHierarchyScore = Math.round(
      (hierarchy.mainSubjectVisibility +
        hierarchy.productPriority +
        hierarchy.brandVisibility +
        hierarchy.secondarySubjectVisibility) /
        4
    );

    const suitabilityValues = Object.values(suitability);
    const marketingReadinessScore = Math.round(
      suitabilityValues.reduce((a, b) => a + b, 0) / suitabilityValues.length
    );

    let creativeReadinessScore = 55;
    if (composition.ruleOfThirds || composition.centerComposition) creativeReadinessScore += 12;
    if (hierarchy.mainSubjectVisibility >= 70) creativeReadinessScore += 10;
    if (composition.negativeSpace >= 40) creativeReadinessScore += 8;
    if (placement.productEmphasis) creativeReadinessScore += 10;
    creativeReadinessScore = Math.min(100, creativeReadinessScore);

    const aiConfidenceScore = Math.round(
      (compositionQualityScore +
        visualBalanceScore +
        visualHierarchyScore +
        marketingReadinessScore +
        creativeReadinessScore) /
        5
    );

    return {
      compositionQualityScore,
      visualBalanceScore,
      visualHierarchyScore,
      marketingReadinessScore,
      creativeReadinessScore,
      aiConfidenceScore,
    };
  }

  isAnalysisValid(scores: CompositionIntelligenceScores, composition: CompositionAnalysis): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (composition.balance <= 0) {
      diagnostics.push("Composition balance not computed — analysis incomplete");
    }
    if (scores.compositionQualityScore < 50) {
      diagnostics.push(`Composition quality score ${scores.compositionQualityScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
