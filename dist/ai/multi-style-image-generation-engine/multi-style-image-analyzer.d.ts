import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BrandingDesignRecord } from "../branding-design-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { MultiStyleGenPlatform, MultiStyleIdentityPreservationPlan, MultiStyleImageInput, MultiStylePlatformOptimization, MultiStylePlanProfile, MultiStyleVariationPlan, ProductionMultiStyleInstructions, StyleTransformationPlan } from "./types.js";
export interface MultiStyleImageContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    prompt?: string;
    sourceImageId?: string;
    productImagePlan?: ProductImageGenerationRecord | null;
    brandingPlan?: BrandingDesignRecord | null;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class MultiStyleImageAnalyzer {
    buildProfile(input: MultiStyleImageInput, platform: MultiStyleGenPlatform, version: number, context: MultiStyleImageContext, sourceImageId: string): MultiStylePlanProfile;
    buildStyleTransformation(input: MultiStyleImageInput, profile: MultiStylePlanProfile, context: MultiStyleImageContext): StyleTransformationPlan;
    buildStyleVariations(profile: MultiStylePlanProfile, input: MultiStyleImageInput): MultiStyleVariationPlan;
    buildIdentityPreservation(context: MultiStyleImageContext): MultiStyleIdentityPreservationPlan;
    buildPlatformOptimizations(profile: MultiStylePlanProfile, input: MultiStyleImageInput): MultiStylePlatformOptimization[];
    buildProductionInstructions(profile: MultiStylePlanProfile, transformation: StyleTransformationPlan, preservation: MultiStyleIdentityPreservationPlan): ProductionMultiStyleInstructions;
    buildRecommendations(context: MultiStyleImageContext, profile: MultiStylePlanProfile): string[];
    resolvePlatform(input: MultiStyleImageInput): MultiStyleGenPlatform;
    resolveSourceImageId(input: MultiStyleImageInput, context: MultiStyleImageContext): string | null;
    extractContextFromProduct(analysis: ProductAnalysisIntelligenceRecord | null, understanding: ProductUnderstandingRecord | null, creative: CreativeDirectionRecord | null, strategy: MarketingStrategyRecord | null, input: MultiStyleImageInput, productImagePlan?: ProductImageGenerationRecord | null, brandingPlan?: BrandingDesignRecord | null): MultiStyleImageContext | null;
    private preservationNote;
}
//# sourceMappingURL=multi-style-image-analyzer.d.ts.map