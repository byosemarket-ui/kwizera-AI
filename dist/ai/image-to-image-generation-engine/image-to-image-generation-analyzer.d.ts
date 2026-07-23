import { BackgroundPlan, ImageToImageGenerationInput, ImageToImagePlatform, MaskPlan, PreservationPlan, SourceImageAnalysis, SourceImageMetadata, TransformationPlan, TransformationPlanProfile, TransformationVariation, PlatformTransformationOptimization, ProductionTransformationInstructions } from "./types.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { TextToImageGenerationRecord } from "../text-to-image-generation-engine/types.js";
export interface TransformationContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    transformationPrompt?: string;
    sourceMetadata?: SourceImageMetadata;
    textToImagePlan?: TextToImageGenerationRecord | null;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class ImageToImageGenerationAnalyzer {
    analyzeSourceImage(source: SourceImageMetadata, context: TransformationContext, textToImagePlan?: TextToImageGenerationRecord | null): SourceImageAnalysis;
    buildProfile(input: ImageToImageGenerationInput, source: SourceImageMetadata, platform: ImageToImagePlatform, version: number, context: TransformationContext): TransformationPlanProfile;
    buildTransformationPlan(input: ImageToImageGenerationInput, analysis: SourceImageAnalysis, profile: TransformationPlanProfile, context: TransformationContext): TransformationPlan;
    buildPreservationPlan(input: ImageToImageGenerationInput, analysis: SourceImageAnalysis): PreservationPlan;
    buildMaskPlan(profile: TransformationPlanProfile, analysis: SourceImageAnalysis): MaskPlan;
    buildBackgroundPlan(profile: TransformationPlanProfile, analysis: SourceImageAnalysis): BackgroundPlan;
    buildPlatformOptimizations(profile: TransformationPlanProfile, input: ImageToImageGenerationInput): PlatformTransformationOptimization[];
    buildVariations(profile: TransformationPlanProfile): TransformationVariation[];
    buildProductionInstructions(profile: TransformationPlanProfile, maskPlan: MaskPlan, transformationPlan: TransformationPlan): ProductionTransformationInstructions;
    buildRecommendations(analysis: SourceImageAnalysis, preservationPlan: PreservationPlan, context: TransformationContext): string[];
    resolvePlatform(input: ImageToImageGenerationInput): ImageToImagePlatform;
    resolveSourceMetadata(input: ImageToImageGenerationInput, context: TransformationContext): SourceImageMetadata | null;
    extractContextFromInput(input: ImageToImageGenerationInput): TransformationContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: ImageToImageGenerationInput, textToImagePlan?: TextToImageGenerationRecord | null): TransformationContext;
    private inferTransformationTypes;
    private describeTransformation;
    private getPreserveElementsForType;
    private preservationNote;
    private inferCategory;
    private getSafeZones;
}
//# sourceMappingURL=image-to-image-generation-analyzer.d.ts.map