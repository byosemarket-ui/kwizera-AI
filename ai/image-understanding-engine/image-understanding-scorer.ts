import {
  BrandUnderstanding,
  ImagePurpose,
  ImageUnderstandingScores,
  MarketingUnderstanding,
  ProductInImageUnderstanding,
  SceneUnderstanding,
  VisualUnderstanding,
} from "./types.js";

export class ImageUnderstandingScorer {
  computeScores(
    purpose: ImagePurpose,
    scene: SceneUnderstanding,
    visual: VisualUnderstanding,
    product: ProductInImageUnderstanding,
    brand: BrandUnderstanding,
    marketing: MarketingUnderstanding
  ): ImageUnderstandingScores {
    let imageUnderstandingScore = 58;
    if (purpose.primaryPurpose.length >= 20) imageUnderstandingScore += 12;
    if (scene.preparedScenes.length >= 2) imageUnderstandingScore += 8;
    if (visual.mainSubject) imageUnderstandingScore += 10;
    if (visual.visualHierarchy) imageUnderstandingScore += 5;
    imageUnderstandingScore = Math.min(100, imageUnderstandingScore);

    let productUnderstandingScore = 40;
    if (product.productReadiness) productUnderstandingScore += 30;
    productUnderstandingScore += Math.round(product.productVisibility * 0.3);
    productUnderstandingScore = Math.min(100, productUnderstandingScore);

    let marketingReadinessScore = 50;
    if (marketing.promotionalPurpose.length >= 15) marketingReadinessScore += 15;
    if (marketing.storytellingOpportunity.length >= 15) marketingReadinessScore += 15;
    if (marketing.ctaOpportunity.length >= 10) marketingReadinessScore += 10;
    marketingReadinessScore = Math.min(100, marketingReadinessScore);

    const brandConsistencyScore = Math.min(100, brand.brandConsistency);

    let creativeReadinessScore = 55;
    if (visual.composition.length >= 10) creativeReadinessScore += 15;
    if (scene.sceneDescription.length >= 20) creativeReadinessScore += 15;
    if (purpose.creativeIntent.length >= 15) creativeReadinessScore += 10;
    creativeReadinessScore = Math.min(100, creativeReadinessScore);

    const aiConfidenceScore = Math.round(
      (imageUnderstandingScore +
        productUnderstandingScore +
        marketingReadinessScore +
        brandConsistencyScore +
        creativeReadinessScore) /
        5
    );

    return {
      imageUnderstandingScore,
      productUnderstandingScore,
      marketingReadinessScore,
      brandConsistencyScore,
      creativeReadinessScore,
      aiConfidenceScore,
    };
  }

  isUnderstandingValid(scores: ImageUnderstandingScores, purpose: ImagePurpose): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (!purpose.primaryPurpose || purpose.primaryPurpose.length < 10) {
      diagnostics.push("Image purpose is insufficient for validated understanding");
    }
    if (scores.imageUnderstandingScore < 55) {
      diagnostics.push(`Image understanding score ${scores.imageUnderstandingScore} below threshold (55)`);
    }
    if (scores.productUnderstandingScore < 40 && scores.imageUnderstandingScore < 70) {
      diagnostics.push(`Product understanding score ${scores.productUnderstandingScore} below threshold`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
