import {
  ProductBrandKnowledge,
  ProductCustomerKnowledge,
  ProductKnowledgeQualityScores,
  ProductMarketingKnowledge,
  ProductProfileKnowledge,
  ProductVisualKnowledge,
} from "./types.js";

const MIN_STORE_CONFIDENCE = 55;

export class ProductScorer {
  computeScores(
    profile: ProductProfileKnowledge,
    visual: ProductVisualKnowledge,
    brand: ProductBrandKnowledge,
    marketing: ProductMarketingKnowledge,
    customer: ProductCustomerKnowledge
  ): ProductKnowledgeQualityScores {
    const hasFeatures = profile.features.length >= 2;
    const hasSpecs = Object.keys(profile.specifications).length >= 1;
    const hasDescription = profile.description.length >= 20;
    const hasCta = marketing.callToAction.length >= 5;
    const hasUsp = marketing.uniqueSellingPoints.length >= 2;

    const productQualityScore = Math.round(
      (hasDescription ? 20 : 5) +
        (hasFeatures ? 25 : 8) +
        (hasSpecs ? 15 : 5) +
        (profile.materials.length >= 1 ? 10 : 0) +
        (profile.colors.length >= 1 ? 10 : 0) +
        visual.productQuality * 0.2
    );

    const presentationScore = Math.round(
      visual.productVisibility * 0.35 +
        visual.productQuality * 0.35 +
        (visual.productPlacement ? 15 : 0) +
        (visual.productBackground ? 15 : 0)
    );

    const marketingReadinessScore = Math.round(
      (hasCta ? 25 : 5) +
        (hasUsp ? 20 : 5) +
        marketing.productBenefits.length * 5 +
        (marketing.productPositioning ? 15 : 0) +
        (marketing.salesStrategy ? 10 : 0) +
        (marketing.emotionalAppeal ? 10 : 0)
    );

    const brandConsistencyScore = Math.round(
      brand.brandConsistency * 0.5 +
        (brand.brandColors.length >= 2 ? 15 : 5) +
        (brand.logoUsage ? 15 : 0) +
        (brand.brandIdentity ? 10 : 0)
    );

    const customerRelevanceScore = Math.round(
      customer.customerNeeds.length * 10 +
        customer.customerInterests.length * 6 +
        (customer.buyingMotivation ? 15 : 0) +
        customer.preferredPlatforms.length * 5
    );

    const aiConfidenceScore = Math.round(
      (productQualityScore +
        presentationScore +
        marketingReadinessScore +
        brandConsistencyScore +
        customerRelevanceScore) /
        5
    );

    return {
      productQualityScore: Math.min(100, productQualityScore),
      presentationScore: Math.min(100, presentationScore),
      marketingReadinessScore: Math.min(100, marketingReadinessScore),
      brandConsistencyScore: Math.min(100, brandConsistencyScore),
      customerRelevanceScore: Math.min(100, customerRelevanceScore),
      aiConfidenceScore: Math.min(100, aiConfidenceScore),
    };
  }

  isAnalysisValid(
    profile: ProductProfileKnowledge,
    scores: ProductKnowledgeQualityScores
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (!profile.productName || profile.productName === "Unnamed Product") {
      diagnostics.push("Product name is required for validated storage");
    }
    if (!profile.brand || profile.brand === "Unknown Brand") {
      diagnostics.push("Brand is required for validated storage");
    }
    if (profile.features.length < 1) {
      diagnostics.push("At least one product feature is required");
    }
    if (scores.aiConfidenceScore < MIN_STORE_CONFIDENCE) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below minimum ${MIN_STORE_CONFIDENCE}`);
    }
    if (scores.productQualityScore < 40) {
      diagnostics.push("Product quality score too low for validated storage");
    }

    const minDimension = 50;
    if (scores.presentationScore < minDimension) {
      diagnostics.push(`Presentation score ${scores.presentationScore} below minimum ${minDimension}`);
    }
    if (scores.marketingReadinessScore < minDimension) {
      diagnostics.push(`Marketing readiness ${scores.marketingReadinessScore} below minimum ${minDimension}`);
    }
    if (scores.customerRelevanceScore < minDimension) {
      diagnostics.push(`Customer relevance ${scores.customerRelevanceScore} below minimum ${minDimension}`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
