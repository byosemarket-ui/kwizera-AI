import {
  ProductBackgroundPlan,
  ProductConsistencyPlan,
  ProductImageGenerationRecord,
  ProductImageGenerationScores,
  ProductLightingPlan,
  ProductMarketingVariationPlan,
  ProductImagePlatformOptimization,
  ProductPhotographyPlan,
  ProductPresentationPlan,
} from "./types.js";
import type { ProductGenerationContext } from "./product-image-generation-analyzer.js";

export class ProductImageGenerationScorer {
  computeScores(
    presentationPlan: ProductPresentationPlan,
    photographyPlan: ProductPhotographyPlan,
    backgroundPlan: ProductBackgroundPlan,
    lightingPlan: ProductLightingPlan,
    consistencyPlan: ProductConsistencyPlan,
    marketingVariations: ProductMarketingVariationPlan[],
    platformOptimizations: ProductImagePlatformOptimization[],
    context: ProductGenerationContext
  ): ProductImageGenerationScores {
    const productPresentationScore = this.computePresentationScore(presentationPlan);
    const photographyScore = this.computePhotographyScore(photographyPlan, lightingPlan);
    const brandConsistencyScore = this.computeBrandConsistency(context, consistencyPlan, backgroundPlan);
    const marketplaceReadinessScore = this.computeMarketplaceReadiness(
      platformOptimizations,
      marketingVariations,
      consistencyPlan
    );
    const productionReadinessScore = this.computeProductionReadiness(
      presentationPlan,
      photographyPlan,
      lightingPlan,
      consistencyPlan
    );
    const aiConfidenceScore = Math.round(
      (productPresentationScore +
        photographyScore +
        brandConsistencyScore +
        marketplaceReadinessScore +
        productionReadinessScore) /
        5
    );

    return {
      productPresentationScore,
      photographyScore,
      brandConsistencyScore,
      marketplaceReadinessScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isProductImagePlanValid(
    scores: ProductImageGenerationScores,
    record: Pick<
      ProductImageGenerationRecord,
      "presentationPlan" | "photographyPlan" | "lightingPlan" | "backgroundPlan" | "consistencyPlan"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.productPresentationScore < 55) {
      diagnostics.push(`Product presentation score ${scores.productPresentationScore} below threshold (55)`);
    }
    if (scores.photographyScore < 55) {
      diagnostics.push(`Photography score ${scores.photographyScore} below threshold (55)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.marketplaceReadinessScore < 55) {
      diagnostics.push(`Marketplace readiness score ${scores.marketplaceReadinessScore} below threshold (55)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    if (record.presentationPlan.views.length < 8) {
      diagnostics.push("Insufficient presentation views (minimum 8)");
    }
    if (record.photographyPlan.modes.length < 3) {
      diagnostics.push("Insufficient photography modes (minimum 3)");
    }
    if (!record.lightingPlan.studioLighting || record.lightingPlan.studioLighting.length < 5) {
      diagnostics.push("Studio lighting plan incomplete");
    }
    if (!record.backgroundPlan.backgroundDescription || record.backgroundPlan.backgroundDescription.length < 10) {
      diagnostics.push("Background plan incomplete");
    }
    if (record.consistencyPlan.rules.length < 4) {
      diagnostics.push("Insufficient consistency rules (minimum 4)");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: ProductImageGenerationScores, record: ProductImageGenerationRecord): boolean {
    return (
      scores.productionReadinessScore >= 55 &&
      scores.productPresentationScore >= 55 &&
      record.presentationPlan.views.length >= 8 &&
      record.productionInstructions.renderNotes.length >= 1
    );
  }

  isMarketplaceReady(scores: ProductImageGenerationScores, record: ProductImageGenerationRecord): boolean {
    return (
      scores.marketplaceReadinessScore >= 55 &&
      record.platformOptimizations.length >= 1 &&
      record.marketingVariations.length >= 4
    );
  }

  isBrandConsistent(context: ProductGenerationContext, consistencyPlan: ProductConsistencyPlan): boolean {
    if (!context.brandName) return consistencyPlan.rules.length >= 4;
    return (
      consistencyPlan.logoPlacement.toLowerCase().includes(context.brandName.toLowerCase()) ||
      consistencyPlan.colorLock
    );
  }

  private computePresentationScore(plan: ProductPresentationPlan): number {
    let score = 45;
    if (plan.views.length >= 10) score += 25;
    else if (plan.views.length >= 8) score += 20;
    if (plan.showcaseLayout.length >= 15) score += 10;
    if (plan.heroPlacement.length >= 10) score += 10;
    if (plan.catalogueStructure.length >= 3) score += 10;
    return Math.min(100, score);
  }

  private computePhotographyScore(plan: ProductPhotographyPlan, lighting: ProductLightingPlan): number {
    let score = 45;
    if (plan.modes.length >= 5) score += 20;
    if (plan.studioSetup.length >= 15) score += 10;
    if (plan.commercialStyle.length >= 10) score += 10;
    if (lighting.productHighlight && lighting.reflectionControl) score += 15;
    return Math.min(100, score);
  }

  private computeBrandConsistency(
    context: ProductGenerationContext,
    consistency: ProductConsistencyPlan,
    background: ProductBackgroundPlan
  ): number {
    let score = 45;
    if (consistency.rules.length >= 6) score += 20;
    if (consistency.colorLock && consistency.shapeLock) score += 15;
    if (context.brandGuidelines) score += 10;
    if (context.brandName && consistency.logoPlacement.length >= 10) score += 10;
    if (background.colorHarmony.length >= 10) score += 10;
    return Math.min(100, score);
  }

  private computeMarketplaceReadiness(
    platforms: ProductImagePlatformOptimization[],
    variations: ProductMarketingVariationPlan[],
    consistency: ProductConsistencyPlan
  ): number {
    let score = 45;
    if (platforms.length >= 4) score += 20;
    if (variations.length >= 6) score += 15;
    if (consistency.packagingNotes.length >= 5) score += 10;
    if (platforms.some((p) => p.platform === "ecommerce")) score += 10;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    presentation: ProductPresentationPlan,
    photography: ProductPhotographyPlan,
    lighting: ProductLightingPlan,
    consistency: ProductConsistencyPlan
  ): number {
    let score = 45;
    if (presentation.views.every((v) => v.description.length >= 10)) score += 15;
    if (photography.notes.length >= 2) score += 10;
    if (lighting.shadowPlanning && lighting.reflectionControl) score += 15;
    if (consistency.shapeLock && consistency.colorLock) score += 15;
    return Math.min(100, score);
  }
}
