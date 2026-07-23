import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BackgroundGenerationRecord } from "../background-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { IdentityPreservationPlan, ImageAnalysisPlan, ImageEditGenPlatform, ImageEditPlatformOptimization, ImageEditQualityImprovementPlan, ImageEditingInput, ImageEditingPlanProfile, ImageEditOperationPlan, InpaintingPlan, MaskManagementPlan, NonDestructiveEditingPlan, OutpaintingPlan, ProductionImageEditingInstructions } from "./types.js";
export interface ImageEditingContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    editingPrompt?: string;
    sourceImageId?: string;
    productImagePlan?: ProductImageGenerationRecord | null;
    backgroundPlan?: BackgroundGenerationRecord | null;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class ImageEditingAnalyzer {
    analyzeImage(context: ImageEditingContext, input: ImageEditingInput): ImageAnalysisPlan;
    buildProfile(input: ImageEditingInput, platform: ImageEditGenPlatform, version: number, context: ImageEditingContext, sourceImageId: string): ImageEditingPlanProfile;
    buildEditingOperations(input: ImageEditingInput, profile: ImageEditingPlanProfile, context: ImageEditingContext): ImageEditOperationPlan;
    buildInpaintingPlan(input: ImageEditingInput, profile: ImageEditingPlanProfile): InpaintingPlan;
    buildOutpaintingPlan(input: ImageEditingInput, profile: ImageEditingPlanProfile): OutpaintingPlan;
    buildMaskManagement(input: ImageEditingInput, context: ImageEditingContext): MaskManagementPlan;
    buildIdentityPreservation(context: ImageEditingContext): IdentityPreservationPlan;
    buildNonDestructiveEditing(profile: ImageEditingPlanProfile, existing?: {
        version: number;
    } | null): NonDestructiveEditingPlan;
    buildQualityImprovement(context: ImageEditingContext): ImageEditQualityImprovementPlan;
    buildPlatformOptimizations(profile: ImageEditingPlanProfile, input: ImageEditingInput): ImageEditPlatformOptimization[];
    buildProductionInstructions(profile: ImageEditingPlanProfile, operations: ImageEditOperationPlan, maskManagement: MaskManagementPlan): ProductionImageEditingInstructions;
    buildRecommendations(context: ImageEditingContext, analysis: ImageAnalysisPlan): string[];
    resolvePlatform(input: ImageEditingInput): ImageEditGenPlatform;
    resolveSourceImageId(input: ImageEditingInput, context: ImageEditingContext): string | null;
    extractContextFromProduct(analysis: ProductAnalysisIntelligenceRecord | null, understanding: ProductUnderstandingRecord | null, creative: CreativeDirectionRecord | null, strategy: MarketingStrategyRecord | null, input: ImageEditingInput, productImagePlan?: ProductImageGenerationRecord | null, backgroundPlan?: BackgroundGenerationRecord | null): ImageEditingContext | null;
    private maskLabel;
    private identityNote;
}
//# sourceMappingURL=image-editing-analyzer.d.ts.map