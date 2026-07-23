import type { AudioProductionRecord } from "../audio-production-engine/types.js";
import type { AudioRenderRecord } from "../audio-rendering-preparation-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { AudioBrandValidationEntry, AudioPlatformValidationEntry, AudioQualityIssue, AudioQualityTimelineValidationEntry, AudioQualityTrackValidationEntry, AudioQualityValidationEntry, AudioQualityValidationInput, AudioQualityValidationPlatform, AudioQualityValidationProfile, AudioSyncValidationEntry, AudioTechnicalValidationEntry } from "./types.js";
export interface AudioQualityValidationContext {
    productId?: string;
    productName?: string;
    brandId?: string;
    brandName?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    validationPrompt?: string;
    productionPlan?: AudioProductionRecord | null;
    renderPlan?: AudioRenderRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class AudioQualityValidationAnalyzer {
    buildProfile(input: AudioQualityValidationInput, platform: AudioQualityValidationPlatform, version: number, context: AudioQualityValidationContext): AudioQualityValidationProfile;
    buildAudioQualityValidation(context: AudioQualityValidationContext, platform: AudioQualityValidationPlatform): AudioQualityValidationEntry[];
    buildTrackValidation(context: AudioQualityValidationContext): AudioQualityTrackValidationEntry[];
    buildTimelineValidation(context: AudioQualityValidationContext): AudioQualityTimelineValidationEntry[];
    buildSyncValidation(context: AudioQualityValidationContext): AudioSyncValidationEntry[];
    buildBrandValidation(context: AudioQualityValidationContext): AudioBrandValidationEntry[];
    buildPlatformValidation(input: AudioQualityValidationInput, context: AudioQualityValidationContext): AudioPlatformValidationEntry[];
    buildTechnicalValidation(context: AudioQualityValidationContext): AudioTechnicalValidationEntry[];
    detectIssues(audioQuality: AudioQualityValidationEntry[], trackValidation: AudioQualityTrackValidationEntry[], timelineValidation: AudioQualityTimelineValidationEntry[], syncValidation: AudioSyncValidationEntry[], brandValidation: AudioBrandValidationEntry[], context: AudioQualityValidationContext): AudioQualityIssue[];
    buildRecommendations(context: AudioQualityValidationContext, profile: AudioQualityValidationProfile, issues: AudioQualityIssue[]): string[];
    resolvePlatform(input: AudioQualityValidationInput, context: AudioQualityValidationContext): AudioQualityValidationPlatform;
    extractContext(input: AudioQualityValidationInput, productionPlan?: AudioProductionRecord | null, renderPlan?: AudioRenderRecord | null, analysis?: ProductAnalysisIntelligenceRecord | null): AudioQualityValidationContext;
    private buildPlatformEntry;
    private scoreAudioQualityCheck;
    private validateTrackCheck;
    private validateTimelineCheck;
    private validateSyncCheck;
    private createIssue;
}
//# sourceMappingURL=audio-quality-validation-analyzer.d.ts.map