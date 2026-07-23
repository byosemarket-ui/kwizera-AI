import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AmbientAudioGenerationInput, AmbientPlatform, AmbientProfile, AmbientSoundPlan, AmbientTimelinePlan, EnvironmentAnalysis, EnvironmentCategory, IndoorAmbiencePlan, ProductionAmbientInstructions, SpatialAudioPlan, UrbanAmbiencePlan, WeatherAmbiencePlan, AmbientSyncPlan } from "./types.js";
export interface AmbientContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    targetAudience?: string;
    industry?: string;
    environmentPrompt?: string;
    geographicContext?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class AmbientAudioGenerationAnalyzer {
    analyzeEnvironment(input: AmbientAudioGenerationInput, context: AmbientContext): EnvironmentAnalysis;
    buildProfile(input: AmbientAudioGenerationInput, platform: AmbientPlatform, version: number, context: AmbientContext, analysis: EnvironmentAnalysis): AmbientProfile;
    buildAmbientSoundPlan(analysis: EnvironmentAnalysis, category: EnvironmentCategory): AmbientSoundPlan;
    buildUrbanAmbiencePlan(analysis: EnvironmentAnalysis, category: EnvironmentCategory): UrbanAmbiencePlan;
    buildIndoorAmbiencePlan(analysis: EnvironmentAnalysis, category: EnvironmentCategory): IndoorAmbiencePlan;
    buildWeatherAmbiencePlan(analysis: EnvironmentAnalysis): WeatherAmbiencePlan;
    buildSpatialAudioPlan(analysis: EnvironmentAnalysis): SpatialAudioPlan;
    buildTimelinePlan(analysis: EnvironmentAnalysis, ambientPlan: AmbientSoundPlan, platform: AmbientPlatform): AmbientTimelinePlan;
    buildSyncPreparation(input: AmbientAudioGenerationInput, analysis: EnvironmentAnalysis, platform: AmbientPlatform): AmbientSyncPlan;
    buildProductionInstructions(profile: AmbientProfile, analysis: EnvironmentAnalysis, spatial: SpatialAudioPlan): ProductionAmbientInstructions;
    buildRecommendations(analysis: EnvironmentAnalysis, context: AmbientContext, category: EnvironmentCategory): string[];
    resolvePlatform(input: AmbientAudioGenerationInput, context: AmbientContext): AmbientPlatform;
    extractContextFromInput(input: AmbientAudioGenerationInput): AmbientContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: AmbientAudioGenerationInput): AmbientContext;
    private detectCategory;
    private detectIndoorOutdoor;
    private detectTimeOfDay;
    private detectWeather;
    private detectSeason;
    private detectMood;
    private resolveDuration;
    private detectSyncTarget;
    private extractKeywords;
}
//# sourceMappingURL=ambient-audio-generation-analyzer.d.ts.map