import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { ProductBackgroundPlan, ProductConsistencyPlan, ProductImageGenPlatform, ProductImageGenerationInput, ProductImagePlanProfile, ProductImagePlatformOptimization, ProductLightingPlan, ProductMarketingVariationPlan, ProductPhotographyPlan, ProductPresentationPlan, ProductionProductImageInstructions } from "./types.js";
export interface ProductGenerationContext {
    productId: string;
    productName: string;
    brandName: string;
    brandId: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    productCategory: string;
    industry?: string;
    keyFeature?: string;
    keyBenefit?: string;
    targetAudience?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class ProductImageGenerationAnalyzer {
    buildProfile(input: ProductImageGenerationInput, platform: ProductImageGenPlatform, version: number, context: ProductGenerationContext): ProductImagePlanProfile;
    buildPresentationPlan(context: ProductGenerationContext): ProductPresentationPlan;
    buildPhotographyPlan(input: ProductImageGenerationInput, context: ProductGenerationContext): ProductPhotographyPlan;
    buildBackgroundPlan(input: ProductImageGenerationInput, context: ProductGenerationContext): ProductBackgroundPlan;
    buildLightingPlan(context: ProductGenerationContext): ProductLightingPlan;
    buildConsistencyPlan(context: ProductGenerationContext): ProductConsistencyPlan;
    buildMarketingVariations(profile: ProductImagePlanProfile, input: ProductImageGenerationInput): ProductMarketingVariationPlan[];
    buildPlatformOptimizations(profile: ProductImagePlanProfile, input: ProductImageGenerationInput): ProductImagePlatformOptimization[];
    buildProductionInstructions(profile: ProductImagePlanProfile, presentationPlan: ProductPresentationPlan, photographyPlan: ProductPhotographyPlan, lightingPlan: ProductLightingPlan): ProductionProductImageInstructions;
    buildRecommendations(context: ProductGenerationContext, consistencyPlan: ProductConsistencyPlan): string[];
    resolvePlatform(input: ProductImageGenerationInput, context: ProductGenerationContext): ProductImageGenPlatform;
    extractContextFromProduct(analysis: ProductAnalysisIntelligenceRecord | null, understanding: ProductUnderstandingRecord | null, creative: CreativeDirectionRecord | null, strategy: MarketingStrategyRecord | null, input: ProductImageGenerationInput): ProductGenerationContext | null;
    private buildViewDefinition;
    private getMarketplaceNotes;
}
//# sourceMappingURL=product-image-generation-analyzer.d.ts.map