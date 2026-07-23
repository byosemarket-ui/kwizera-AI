import {
  BrandVisualConsistencyCheck,
  BrandVisualIntelligenceScores,
  LogoAnalysis,
} from "./types.js";

export class BrandVisualScorer {
  computeScores(consistency: BrandVisualConsistencyCheck, logo: LogoAnalysis): BrandVisualIntelligenceScores {
    const brandConsistencyScore = Math.round(
      (consistency.logoConsistency +
        consistency.colorConsistency +
        consistency.typographyConsistency +
        consistency.layoutConsistency +
        consistency.visualIdentity) /
        5
    );

    const logoQualityScore = Math.round((logo.logoVisibility + logo.logoContrast + logo.logoConsistency) / 3);
    const colorConsistencyScore = consistency.colorConsistency;
    const typographyScore = consistency.typographyConsistency;
    const marketingReadinessScore = consistency.marketingConsistency;

    const aiConfidenceScore = Math.round(
      (brandConsistencyScore +
        logoQualityScore +
        colorConsistencyScore +
        typographyScore +
        marketingReadinessScore) /
        5
    );

    return {
      brandConsistencyScore,
      logoQualityScore,
      colorConsistencyScore,
      typographyScore,
      marketingReadinessScore,
      aiConfidenceScore,
    };
  }

  isAnalysisValid(
    scores: BrandVisualIntelligenceScores,
    brandName: string,
    consistency: BrandVisualConsistencyCheck
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (!brandName || brandName === "unknown-brand") {
      diagnostics.push("Brand name missing — brand visual profile incomplete");
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (consistency.visualIdentity < 45) {
      diagnostics.push(`Visual identity ${consistency.visualIdentity} below minimum threshold`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
