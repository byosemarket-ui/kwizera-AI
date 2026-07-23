import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BackgroundGenerationRecord } from "../background-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import type { ImageEditingRecord } from "../image-editing-engine/types.js";
import { EnhancementImageAnalysis, EnhancementOperationsPlan, EnhancementPlanProfile, EnhancementPlatformOptimization, EnhancementQualityImprovementPlan, ImageEnhanceGenPlatform, ImageEnhancementInput, ImagePreservationPlan, PrintPreparationPlan, ProductionEnhancementInstructions, RestorationOperationsPlan, SuperResolutionPlan } from "./types.js";
export interface ImageEnhancementContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    restorationPrompt?: string;
    sourceImageId?: string;
    editedImageId?: string;
    productImagePlan?: ProductImageGenerationRecord | null;
    backgroundPlan?: BackgroundGenerationRecord | null;
    editingPlan?: ImageEditingRecord | null;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class ImageEnhancementAnalyzer {
    analyzeImage(context: ImageEnhancementContext, input: ImageEnhancementInput): EnhancementImageAnalysis;
    buildProfile(input: ImageEnhancementInput, platform: ImageEnhanceGenPlatform, version: number, context: ImageEnhancementContext, sourceImageId: string): EnhancementPlanProfile;
    buildEnhancementOperations(input: ImageEnhancementInput, profile: EnhancementPlanProfile, context: ImageEnhancementContext): EnhancementOperationsPlan;
    buildRestorationOperations(input: ImageEnhancementInput, profile: EnhancementPlanProfile, context: ImageEnhancementContext): RestorationOperationsPlan;
    buildPreservation(context: ImageEnhancementContext): ImagePreservationPlan;
    buildQualityImprovement(context: ImageEnhancementContext): EnhancementQualityImprovementPlan;
    buildPrintPreparation(profile: EnhancementPlanProfile, input: ImageEnhancementInput): PrintPreparationPlan;
    buildSuperResolutionPlan(profile: EnhancementPlanProfile): SuperResolutionPlan;
    buildPlatformOptimizations(profile: EnhancementPlanProfile, input: ImageEnhancementInput): EnhancementPlatformOptimization[];
    buildProductionInstructions(profile: EnhancementPlanProfile, operations: EnhancementOperationsPlan, restoration: RestorationOperationsPlan): ProductionEnhancementInstructions;
    buildRecommendations(context: ImageEnhancementContext, analysis: EnhancementImageAnalysis): string[];
    resolvePlatform(input: ImageEnhancementInput): ImageEnhanceGenPlatform;
    resolveSourceImageId(input: ImageEnhancementInput, context: ImageEnhancementContext): string | null;
    extractContextFromProduct(analysis: ProductAnalysisIntelligenceRecord | null, understanding: ProductUnderstandingRecord | null, creative: CreativeDirectionRecord | null, strategy: MarketingStrategyRecord | null, input: ImageEnhancementInput, productImagePlan?: ProductImageGenerationRecord | null, backgroundPlan?: BackgroundGenerationRecord | null, editingPlan?: ImageEditingRecord | null): ImageEnhancementContext | null;
    private preservationNote;
}
//# sourceMappingURL=image-enhancement-analyzer.d.ts.map