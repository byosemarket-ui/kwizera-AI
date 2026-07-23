import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AudioMixMasterGenerationInput, AudioMixMasterProfile, AudioMixingPlatform, FrequencyManagementPlan, LoudnessManagementPlan, MasteringPlan, MixingPlan, MultiTrackAnalysis, OutputMasterPlan, ProductionMixMasterInstructions, SpatialMixPlan } from "./types.js";
export interface MixMasterContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    mixPrompt?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class AudioMixingMasteringAnalyzer {
    analyzeMultiTrack(input: AudioMixMasterGenerationInput, context: MixMasterContext): MultiTrackAnalysis;
    buildProfile(input: AudioMixMasterGenerationInput, platform: AudioMixingPlatform, version: number, context: MixMasterContext): AudioMixMasterProfile;
    buildMixingPlan(analysis: MultiTrackAnalysis): MixingPlan;
    buildMasteringPlan(platform: AudioMixingPlatform, analysis: MultiTrackAnalysis): MasteringPlan;
    buildFrequencyManagement(analysis: MultiTrackAnalysis): FrequencyManagementPlan;
    buildLoudnessManagement(platform: AudioMixingPlatform): LoudnessManagementPlan;
    buildSpatialMixPlan(analysis: MultiTrackAnalysis, platform: AudioMixingPlatform): SpatialMixPlan;
    buildOutputPreparation(platform: AudioMixingPlatform): OutputMasterPlan;
    buildProductionInstructions(profile: AudioMixMasterProfile, analysis: MultiTrackAnalysis, mixing: MixingPlan, mastering: MasteringPlan): ProductionMixMasterInstructions;
    buildRecommendations(analysis: MultiTrackAnalysis, context: MixMasterContext, platform: AudioMixingPlatform): string[];
    resolvePlatform(input: AudioMixMasterGenerationInput, context: MixMasterContext): AudioMixingPlatform;
    extractContextFromInput(input: AudioMixMasterGenerationInput): MixMasterContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: AudioMixMasterGenerationInput): MixMasterContext;
    private detectTrackTypes;
    private countTracksFromInput;
    private buildTrackDetails;
    private extractKeywords;
}
//# sourceMappingURL=audio-mixing-mastering-analyzer.d.ts.map