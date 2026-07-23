import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { CreativeDirectionStyle } from "../creative-direction-engine/types.js";
import { ColorPlan, CompositionPlan, ImageArtisticStyle, ImagePlanProfile, ImageVariation, LightingPlan, PlatformImageOptimization, ProductionImageInstructions, PromptAnalysis, StylePlan, TextToImageGenerationInput, TextToImagePlatform } from "./types.js";
export interface GenerationContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    targetAudience?: string;
    keyBenefit?: string;
    keyFeature?: string;
    industry?: string;
    textPrompt?: string;
    creativeStyle?: CreativeDirectionStyle;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class TextToImageGenerationAnalyzer {
    analyzePrompt(input: TextToImageGenerationInput, context: GenerationContext): PromptAnalysis;
    buildProfile(input: TextToImageGenerationInput, platform: TextToImagePlatform, version: number, context: GenerationContext, promptAnalysis: PromptAnalysis): ImagePlanProfile;
    buildCompositionPlan(promptAnalysis: PromptAnalysis, context: GenerationContext, input: TextToImageGenerationInput): CompositionPlan;
    buildLightingPlan(promptAnalysis: PromptAnalysis, style: ImageArtisticStyle): LightingPlan;
    buildStylePlan(promptAnalysis: PromptAnalysis, context: GenerationContext, input: TextToImageGenerationInput): StylePlan;
    buildColorPlan(promptAnalysis: PromptAnalysis, context: GenerationContext): ColorPlan;
    buildPlatformOptimizations(profile: ImagePlanProfile, input: TextToImageGenerationInput): PlatformImageOptimization[];
    buildVariations(profile: ImagePlanProfile, compositionPlan: CompositionPlan): ImageVariation[];
    buildProductionInstructions(profile: ImagePlanProfile, compositionPlan: CompositionPlan, lightingPlan: LightingPlan): ProductionImageInstructions;
    buildRecommendations(promptAnalysis: PromptAnalysis, compositionPlan: CompositionPlan, context: GenerationContext): string[];
    resolvePlatform(input: TextToImageGenerationInput, context: GenerationContext): TextToImagePlatform;
    resolveStyle(context: GenerationContext, industry: string): ImageArtisticStyle;
    extractContextFromInput(input: TextToImageGenerationInput): GenerationContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: TextToImageGenerationInput): GenerationContext;
    private extractSubject;
    private extractEnvironment;
    private extractObjects;
    private extractMood;
    private extractEmotion;
    private extractCameraPerspective;
    private extractCompositionHint;
    private extractLightingHint;
    private extractColorPalette;
    private getSafeZones;
    private getFormatNotes;
}
//# sourceMappingURL=text-to-image-generation-analyzer.d.ts.map