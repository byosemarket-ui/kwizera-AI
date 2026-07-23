import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import { AbTestPreparationPlan, CallToActionPlan, ConversionOptimizationPlan, EngagementOptimizationPlan, HookOptimizationPlan, MarketingStrategyPlan, MarketingVideoPlanType, MarketingVideoProfile, PlatformMarketingOptimization, ProductPresentationPlan } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare class MarketingVideoAnalyzer {
    buildMarketingVideoPlan(storyboard: StoryboardGenerationRecord, scenes: SceneGenerationRecord[], audioPlans: AudioSynchronizationRecord[], version: number): MarketingVideoRecordDraft;
    buildProfile(storyboard: StoryboardGenerationRecord, version: number): MarketingVideoProfile;
    buildMarketingStrategy(storyboard: StoryboardGenerationRecord): MarketingStrategyPlan;
    buildHookOptimization(storyboard: StoryboardGenerationRecord, hookScene: SceneGenerationRecord, hookAudio?: AudioSynchronizationRecord): HookOptimizationPlan;
    buildProductPresentation(storyboard: StoryboardGenerationRecord, productScene: SceneGenerationRecord): ProductPresentationPlan;
    buildCallToAction(storyboard: StoryboardGenerationRecord, ctaScene?: SceneGenerationRecord): CallToActionPlan;
    buildEngagementOptimization(storyboard: StoryboardGenerationRecord): EngagementOptimizationPlan;
    buildConversionOptimization(storyboard: StoryboardGenerationRecord): ConversionOptimizationPlan;
    buildAbTestPreparation(storyboard: StoryboardGenerationRecord, hookScene?: SceneGenerationRecord): AbTestPreparationPlan;
    buildPlatformOptimizations(platform: StoryboardGenerationPlatform): PlatformMarketingOptimization[];
    buildRecommendations(draft: MarketingVideoRecordDraft): string[];
}
export interface MarketingVideoRecordDraft {
    marketingVideoId: string;
    profile: MarketingVideoProfile;
    planType: MarketingVideoPlanType;
    marketingStrategy: MarketingStrategyPlan;
    hookOptimization: HookOptimizationPlan;
    productPresentation: ProductPresentationPlan;
    callToAction: CallToActionPlan;
    engagementOptimization: EngagementOptimizationPlan;
    conversionOptimization: ConversionOptimizationPlan;
    abTestPreparation: AbTestPreparationPlan;
    platformOptimizations: PlatformMarketingOptimization[];
}
//# sourceMappingURL=marketing-video-analyzer.d.ts.map