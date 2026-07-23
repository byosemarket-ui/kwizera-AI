import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import type { BrandingDesignRecord } from "../branding-design-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import { AssetValidationEntry, DeliveryInstructions, DependencyValidationEntry, ExportPreparationPlan, ImageProductionInput, ImageProductionPlatform, ImageProductionProfile, PlatformProductionRules, ProductionStructure, RecoveryPlan, RenderPreparationPlan, WorkflowValidationEntry } from "./types.js";
export interface ImageProductionContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    imagePlanId?: string;
    productImagePlan?: ProductImageGenerationRecord | null;
    brandingPlan?: BrandingDesignRecord | null;
    stylePlan?: MultiStyleImageRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
    understanding?: ProductUnderstandingRecord | null;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
}
export declare class ImageProductionAnalyzer {
    buildProfile(input: ImageProductionInput, platform: ImageProductionPlatform, version: number, context: ImageProductionContext): ImageProductionProfile;
    buildWorkflowValidation(foundation: AiImageGenerationFoundation): WorkflowValidationEntry[];
    buildAssetValidation(context: ImageProductionContext, input: ImageProductionInput): AssetValidationEntry[];
    buildDependencyValidation(foundation: AiImageGenerationFoundation): DependencyValidationEntry[];
    buildProductionStructure(profile: ImageProductionProfile, context: ImageProductionContext): ProductionStructure;
    buildRenderPreparation(profile: ImageProductionProfile): RenderPreparationPlan;
    buildExportPreparation(input: ImageProductionInput): ExportPreparationPlan;
    buildDeliveryInstructions(profile: ImageProductionProfile): DeliveryInstructions;
    buildRecoveryPlan(profile: ImageProductionProfile, context: ImageProductionContext): RecoveryPlan;
    buildPlatformRules(input: ImageProductionInput): PlatformProductionRules[];
    buildRecommendations(context: ImageProductionContext, profile: ImageProductionProfile): string[];
    resolvePlatform(input: ImageProductionInput, context: ImageProductionContext): ImageProductionPlatform;
    resolveImagePlanId(input: ImageProductionInput, context: ImageProductionContext): string | null;
    extractContextFromProduct(analysis: ProductAnalysisIntelligenceRecord | null | undefined, understanding: ProductUnderstandingRecord | null | undefined, creative: CreativeDirectionRecord | null | undefined, strategy: MarketingStrategyRecord | null | undefined, input: ImageProductionInput, productImagePlan?: ProductImageGenerationRecord | null, brandingPlan?: BrandingDesignRecord | null, stylePlan?: MultiStyleImageRecord | null): ImageProductionContext;
    private buildPlatformRule;
    private resolveAssetId;
    private resolveAssetSource;
}
//# sourceMappingURL=image-production-analyzer.d.ts.map