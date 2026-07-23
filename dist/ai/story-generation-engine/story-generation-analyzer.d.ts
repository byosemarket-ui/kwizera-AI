import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import { GeneratedScene, GeneratedShot, PlatformStoryboardVariation, StoryboardGenerationInput, StoryboardGenerationPlatform, StoryboardGenerationProfile, StoryStructure, VisualPlanning, AudioPlanning, MarketingPlanning, ViewerJourney, CinematicPlanning, StoryboardGenerationRecord } from "./types.js";
import { CreativeDirectionStyle } from "../creative-direction-engine/types.js";
export declare class StoryGenerationAnalyzer {
    buildProfile(input: StoryboardGenerationInput, platform: StoryboardGenerationPlatform, version: number, context: GenerationContext): StoryboardGenerationProfile;
    buildStoryStructure(context: GenerationContext, input: StoryboardGenerationInput): StoryStructure;
    buildScenes(profile: StoryboardGenerationProfile, storyStructure: StoryStructure, context: GenerationContext, includeSocialProof: boolean): GeneratedScene[];
    buildShots(sceneId: string, shotCount: number, purpose: string, mood: string, sceneSeconds: number): GeneratedShot[];
    buildVisualPlanning(context: GenerationContext): VisualPlanning;
    buildAudioPlanning(context: GenerationContext, profile: StoryboardGenerationProfile): AudioPlanning;
    buildMarketingPlanning(context: GenerationContext, storyStructure: StoryStructure): MarketingPlanning;
    buildViewerJourney(storyStructure: StoryStructure): ViewerJourney;
    buildCinematicPlanning(context: GenerationContext, profile: StoryboardGenerationProfile): CinematicPlanning;
    buildProductionStructure(storyStructure: StoryStructure): StoryboardGenerationRecord["productionStructure"];
    buildPlatformVariations(profile: StoryboardGenerationProfile, scenes: GeneratedScene[]): PlatformStoryboardVariation[];
    buildRecommendations(scenes: GeneratedScene[], context: GenerationContext): string[];
    extractContextFromIntelligence(intelligence: StoryboardIntelligenceRecord, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): GenerationContext;
    extractContextFromInput(input: StoryboardGenerationInput): GenerationContext;
    resolvePlatform(input: StoryboardGenerationInput, context: GenerationContext): StoryboardGenerationPlatform;
    private selectScenesForPlatform;
    private buildSceneAssets;
    private angleForPurpose;
    private movementForPurpose;
    private framingForShotType;
}
export interface GenerationContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    projectId?: string;
    campaignId?: string;
    targetAudience?: string;
    keyBenefit?: string;
    keyFeature?: string;
    customerPain?: string;
    creativeStyle?: CreativeDirectionStyle;
    environmentStyle?: string;
    ctaText?: string;
    creative?: CreativeDirectionRecord;
    strategy?: MarketingStrategyRecord;
    intelligence?: StoryboardIntelligenceRecord;
    understanding?: ProductUnderstandingRecord;
}
//# sourceMappingURL=story-generation-analyzer.d.ts.map