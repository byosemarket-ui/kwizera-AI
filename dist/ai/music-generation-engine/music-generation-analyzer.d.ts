import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { ArrangementPlan, CompositionPlan, LoopPlan, MoodPlan, MusicAnalysis, MusicGenerationInput, MusicPlatform, MusicProfile, ProductionMusicInstructions, SyncPreparationPlan } from "./types.js";
export interface MusicContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    targetAudience?: string;
    industry?: string;
    musicPrompt?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class MusicGenerationAnalyzer {
    analyzeMusic(input: MusicGenerationInput, context: MusicContext): MusicAnalysis;
    buildProfile(input: MusicGenerationInput, platform: MusicPlatform, version: number, context: MusicContext, analysis: MusicAnalysis): MusicProfile;
    buildCompositionPlan(analysis: MusicAnalysis, context: MusicContext): CompositionPlan;
    buildArrangementPlan(analysis: MusicAnalysis): ArrangementPlan;
    buildMoodPlan(input: MusicGenerationInput, analysis: MusicAnalysis, context: MusicContext): MoodPlan;
    buildSyncPreparation(input: MusicGenerationInput, analysis: MusicAnalysis, platform: MusicPlatform): SyncPreparationPlan;
    buildLoopPlan(input: MusicGenerationInput, analysis: MusicAnalysis): LoopPlan;
    buildProductionInstructions(profile: MusicProfile, analysis: MusicAnalysis, arrangement: ArrangementPlan): ProductionMusicInstructions;
    buildRecommendations(analysis: MusicAnalysis, moodPlan: MoodPlan, context: MusicContext): string[];
    resolvePlatform(input: MusicGenerationInput, context: MusicContext): MusicPlatform;
    extractContextFromInput(input: MusicGenerationInput): MusicContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: MusicGenerationInput): MusicContext;
    private detectGenre;
    private detectMood;
    private detectKey;
    private detectEnergy;
    private resolveDuration;
    private buildChordProgression;
    private secondaryMood;
    private detectSyncTarget;
    private extractKeywords;
}
//# sourceMappingURL=music-generation-analyzer.d.ts.map