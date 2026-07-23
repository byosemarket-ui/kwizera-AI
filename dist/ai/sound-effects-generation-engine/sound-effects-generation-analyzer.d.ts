import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { CinematicSoundPlan, EnvironmentalSoundPlan, FoleyPlan, ProductionSfxInstructions, SfxPlatform, SoundAnalysis, SoundCategory, SoundEffectPlan, SoundEffectsGenerationInput, SoundProfile, SyncPreparationPlan, TimelinePlan } from "./types.js";
export interface SfxContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    targetAudience?: string;
    industry?: string;
    soundPrompt?: string;
    sceneHint?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class SoundEffectsGenerationAnalyzer {
    analyzeSound(input: SoundEffectsGenerationInput, context: SfxContext): SoundAnalysis;
    buildProfile(input: SoundEffectsGenerationInput, platform: SfxPlatform, version: number, context: SfxContext, analysis: SoundAnalysis): SoundProfile;
    buildSoundEffectPlan(analysis: SoundAnalysis, category: SoundCategory): SoundEffectPlan;
    buildFoleyPlan(analysis: SoundAnalysis, category: SoundCategory): FoleyPlan;
    buildEnvironmentalPlan(context: SfxContext, analysis: SoundAnalysis): EnvironmentalSoundPlan;
    buildCinematicPlan(analysis: SoundAnalysis, category: SoundCategory): CinematicSoundPlan;
    buildTimelinePlan(analysis: SoundAnalysis, soundPlan: SoundEffectPlan): TimelinePlan;
    buildSyncPreparation(input: SoundEffectsGenerationInput, analysis: SoundAnalysis, platform: SfxPlatform): SyncPreparationPlan;
    buildProductionInstructions(profile: SoundProfile, analysis: SoundAnalysis, timeline: TimelinePlan): ProductionSfxInstructions;
    buildRecommendations(analysis: SoundAnalysis, context: SfxContext, category: SoundCategory): string[];
    resolvePlatform(input: SoundEffectsGenerationInput, context: SfxContext): SfxPlatform;
    extractContextFromInput(input: SoundEffectsGenerationInput): SfxContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: SoundEffectsGenerationInput): SfxContext;
    private detectCategory;
    private detectScene;
    private detectEnvironment;
    private detectAction;
    private detectObjects;
    private detectEmotion;
    private resolveDuration;
    private detectSyncTarget;
    private baseSoundsForCategory;
    private extractKeywords;
}
//# sourceMappingURL=sound-effects-generation-analyzer.d.ts.map