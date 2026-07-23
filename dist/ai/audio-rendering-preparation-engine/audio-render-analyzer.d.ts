import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import type { AudioProductionRecord } from "../audio-production-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { AudioRenderInput, AudioRenderJobPlan, AudioRenderOutputProfileEntry, AudioRenderPlanProfile, AudioRenderPlatform, AudioRenderRecoveryPlan, AudioRenderResourcePlanningPlan, AudioRenderSettingsPlan, AudioRenderTimelineEntry, AudioRenderTrackEntry, AudioRenderAssetValidationEntry, AudioRenderTimelineValidationEntry, AudioRenderTrackValidationEntry, AudioRenderValidationEntry } from "./types.js";
export interface AudioRenderContext {
    productId?: string;
    productName?: string;
    brandId?: string;
    brandName?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    productionId?: string;
    audioId?: string;
    audioPlanId?: string;
    sessionId?: string;
    renderPrompt?: string;
    productionPlan?: AudioProductionRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class AudioRenderAnalyzer {
    buildProfile(input: AudioRenderInput, platform: AudioRenderPlatform, version: number, context: AudioRenderContext): AudioRenderPlanProfile;
    buildRenderValidation(foundation: AiAudioGenerationFoundation): AudioRenderValidationEntry[];
    buildTrackValidation(context: AudioRenderContext, tracks: AudioRenderTrackEntry[]): AudioRenderTrackValidationEntry[];
    buildTimelineValidation(context: AudioRenderContext, timeline: AudioRenderTimelineEntry[]): AudioRenderTimelineValidationEntry[];
    buildAssetValidation(context: AudioRenderContext, input: AudioRenderInput): AudioRenderAssetValidationEntry[];
    buildTrackStructure(context: AudioRenderContext): AudioRenderTrackEntry[];
    buildTimelineStructure(context: AudioRenderContext, tracks: AudioRenderTrackEntry[]): AudioRenderTimelineEntry[];
    buildRenderSettings(profile: AudioRenderPlanProfile): AudioRenderSettingsPlan;
    buildOutputProfiles(input: AudioRenderInput): AudioRenderOutputProfileEntry[];
    buildResourcePlanning(profile: AudioRenderPlanProfile, input: AudioRenderInput): AudioRenderResourcePlanningPlan;
    buildRenderJobs(profile: AudioRenderPlanProfile, input: AudioRenderInput): AudioRenderJobPlan[];
    buildRecoveryPlan(profile: AudioRenderPlanProfile, context: AudioRenderContext): AudioRenderRecoveryPlan;
    buildRecommendations(context: AudioRenderContext, profile: AudioRenderPlanProfile): string[];
    resolvePlatform(input: AudioRenderInput, context: AudioRenderContext): AudioRenderPlatform;
    extractContext(input: AudioRenderInput, productionPlan?: AudioProductionRecord | null, analysis?: ProductAnalysisIntelligenceRecord | null): AudioRenderContext;
    private buildOutputProfile;
    private validateTrackCheck;
    private validateTimelineCheck;
    private resolveAssetId;
    private resolveAssetSource;
}
//# sourceMappingURL=audio-render-analyzer.d.ts.map