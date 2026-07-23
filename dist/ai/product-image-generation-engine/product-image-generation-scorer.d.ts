import { ProductBackgroundPlan, ProductConsistencyPlan, ProductImageGenerationRecord, ProductImageGenerationScores, ProductLightingPlan, ProductMarketingVariationPlan, ProductImagePlatformOptimization, ProductPhotographyPlan, ProductPresentationPlan } from "./types.js";
import type { ProductGenerationContext } from "./product-image-generation-analyzer.js";
export declare class ProductImageGenerationScorer {
    computeScores(presentationPlan: ProductPresentationPlan, photographyPlan: ProductPhotographyPlan, backgroundPlan: ProductBackgroundPlan, lightingPlan: ProductLightingPlan, consistencyPlan: ProductConsistencyPlan, marketingVariations: ProductMarketingVariationPlan[], platformOptimizations: ProductImagePlatformOptimization[], context: ProductGenerationContext): ProductImageGenerationScores;
    isProductImagePlanValid(scores: ProductImageGenerationScores, record: Pick<ProductImageGenerationRecord, "presentationPlan" | "photographyPlan" | "lightingPlan" | "backgroundPlan" | "consistencyPlan">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: ProductImageGenerationScores, record: ProductImageGenerationRecord): boolean;
    isMarketplaceReady(scores: ProductImageGenerationScores, record: ProductImageGenerationRecord): boolean;
    isBrandConsistent(context: ProductGenerationContext, consistencyPlan: ProductConsistencyPlan): boolean;
    private computePresentationScore;
    private computePhotographyScore;
    private computeBrandConsistency;
    private computeMarketplaceReadiness;
    private computeProductionReadiness;
}
//# sourceMappingURL=product-image-generation-scorer.d.ts.map