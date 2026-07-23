import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { ImageEnhancementRecord } from "../image-enhancement-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { BrandConsistencyPlan, BrandDesignGenPlatform, BrandDesignProfile, BrandingDesignInput, BrandingDesignRecord, ColorManagementPlan, DesignPlanningPlan, LogoPlanningPlan, MarketingMaterialsPlan, PrintDesignPlan, SocialMediaDesignPlan } from "./types.js";
export interface BrandingDesignContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    marketingObjective?: string;
    designPrompt?: string;
    colorPalette?: string[];
    productImagePlan?: ProductImageGenerationRecord | null;
    enhancementPlan?: ImageEnhancementRecord | null;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class BrandingDesignAnalyzer {
    buildProfile(input: BrandingDesignInput, platform: BrandDesignGenPlatform, version: number, context: BrandingDesignContext): BrandDesignProfile;
    buildDesignPlanning(input: BrandingDesignInput, profile: BrandDesignProfile, context: BrandingDesignContext): DesignPlanningPlan;
    buildLogoPlanning(input: BrandingDesignInput, profile: BrandDesignProfile, context: BrandingDesignContext): LogoPlanningPlan;
    buildMarketingMaterials(input: BrandingDesignInput, profile: BrandDesignProfile, context: BrandingDesignContext): MarketingMaterialsPlan;
    buildSocialMediaDesign(input: BrandingDesignInput, profile: BrandDesignProfile): SocialMediaDesignPlan;
    buildPrintDesign(input: BrandingDesignInput, profile: BrandDesignProfile): PrintDesignPlan;
    buildBrandConsistency(input: BrandingDesignInput, context: BrandingDesignContext): BrandConsistencyPlan;
    buildColorManagement(input: BrandingDesignInput, context: BrandingDesignContext): ColorManagementPlan;
    buildPlatformOptimizations(profile: BrandDesignProfile, input: BrandingDesignInput): Array<{
        platform: BrandDesignGenPlatform;
        aspectRatio: string;
        resolution: string;
        notes: string[];
    }>;
    buildProductionInstructions(profile: BrandDesignProfile, designPlanning: DesignPlanningPlan, colorManagement: ColorManagementPlan): BrandingDesignRecord["productionInstructions"];
    buildRecommendations(context: BrandingDesignContext, profile: BrandDesignProfile): string[];
    resolvePlatform(input: BrandingDesignInput): BrandDesignGenPlatform;
    extractContextFromProduct(analysis: ProductAnalysisIntelligenceRecord | null, understanding: ProductUnderstandingRecord | null, creative: CreativeDirectionRecord | null, strategy: MarketingStrategyRecord | null, input: BrandingDesignInput, productImagePlan?: ProductImageGenerationRecord | null, enhancementPlan?: ImageEnhancementRecord | null): BrandingDesignContext | null;
}
//# sourceMappingURL=branding-design-analyzer.d.ts.map