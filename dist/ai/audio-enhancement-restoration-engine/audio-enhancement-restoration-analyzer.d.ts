import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AudioEnhancementGenerationInput, AudioEnhancementProfile, AudioQualityAnalysis, AudioSyncPlan, EnhancementPlan, AudioEnhancementPlatform, AudioEnhancementType, MusicImprovementPlan, OutputPreparationPlan, ProductionEnhancementInstructions, RestorationPlan, VoiceImprovementPlan } from "./types.js";
export interface EnhancementContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    targetAudience?: string;
    industry?: string;
    audioPrompt?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class AudioEnhancementRestorationAnalyzer {
    analyzeAudioQuality(input: AudioEnhancementGenerationInput, context: EnhancementContext): AudioQualityAnalysis;
    buildProfile(input: AudioEnhancementGenerationInput, platform: AudioEnhancementPlatform, version: number, context: EnhancementContext, analysis: AudioQualityAnalysis): AudioEnhancementProfile;
    buildEnhancementPlan(analysis: AudioQualityAnalysis, platform: AudioEnhancementPlatform): EnhancementPlan;
    buildRestorationPlan(analysis: AudioQualityAnalysis): RestorationPlan;
    buildVoiceImprovementPlan(analysis: AudioQualityAnalysis): VoiceImprovementPlan;
    buildMusicImprovementPlan(analysis: AudioQualityAnalysis): MusicImprovementPlan;
    buildSyncPlan(input: AudioEnhancementGenerationInput, analysis: AudioQualityAnalysis): AudioSyncPlan;
    buildOutputPreparation(platform: AudioEnhancementPlatform, analysis: AudioQualityAnalysis): OutputPreparationPlan;
    buildProductionInstructions(profile: AudioEnhancementProfile, analysis: AudioQualityAnalysis, enhancement: EnhancementPlan, restoration: RestorationPlan): ProductionEnhancementInstructions;
    buildRecommendations(analysis: AudioQualityAnalysis, context: EnhancementContext, enhancementType: AudioEnhancementType): string[];
    resolvePlatform(input: AudioEnhancementGenerationInput, context: EnhancementContext): AudioEnhancementPlatform;
    extractContextFromInput(input: AudioEnhancementGenerationInput): EnhancementContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: AudioEnhancementGenerationInput): EnhancementContext;
    private detectAudioCategory;
    private detectAudioEnhancementType;
    private extractKeywords;
}
//# sourceMappingURL=audio-enhancement-restoration-analyzer.d.ts.map