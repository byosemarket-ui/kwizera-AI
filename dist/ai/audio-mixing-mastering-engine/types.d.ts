/**
 * KWIZERA AI STUDIO — Audio Mixing & Mastering Engine types (Step 10I)
 */
export declare enum AudioMixingPlatform {
    Website = "website",
    Mobile = "mobile",
    Podcast = "podcast",
    Audiobook = "audiobook",
    YouTube = "youtube",
    TikTok = "tiktok",
    Instagram = "instagram",
    Television = "television",
    Radio = "radio",
    Film = "film"
}
export declare enum AudioTrackType {
    Voice = "voice",
    Music = "music",
    Foley = "foley",
    Ambient = "ambient",
    Effects = "effects",
    Dialogue = "dialogue",
    Narration = "narration",
    MasterBus = "master-bus"
}
export declare enum MixingInputType {
    VoiceTrack = "voice-track",
    MusicTrack = "music-track",
    AmbientTrack = "ambient-track",
    SoundEffects = "sound-effects",
    MultiTrackSession = "multi-track-session",
    VideoTimeline = "video-timeline",
    BrandGuidelines = "brand-guidelines",
    KnowledgeRecord = "knowledge-record"
}
export interface AudioMixMasterProfile {
    mixingPlanId: string;
    masteringPlanId: string;
    projectId: string;
    sessionId: string;
    brandId: string;
    campaignId?: string;
    platform: AudioMixingPlatform;
    version: number;
}
export interface MultiTrackAnalysis {
    trackCount: number;
    trackTypes: AudioTrackType[];
    frequencyDistribution: Record<string, string>;
    loudnessLufs: number;
    dynamicRangeDb: number;
    stereoWidth: string;
    phaseStatus: string;
    timingAlignment: string;
    noiseLevel: string;
    clippingDetected: boolean;
    silenceGaps: number;
    trackDetails: Record<string, string>;
    keywords: string[];
}
export interface MixingPlan {
    trackBalancing: Record<string, string>;
    volumeAutomation: string[];
    panPlanning: Record<string, string>;
    eqPlanning: Record<string, string>;
    compressionPlanning: Record<string, string>;
    reverbPlanning: Record<string, string>;
    delayPlanning: Record<string, string>;
    busRouting: string[];
    groupRouting: string[];
    processingChain: string[];
}
export interface MasteringPlan {
    loudnessNormalization: string;
    limiting: string;
    finalEq: string;
    stereoEnhancement: string;
    dynamicOptimization: string;
    harmonicEnhancement: string;
    peakProtection: string;
    outputLevelOptimization: string;
    targetLufs: number;
    techniques: string[];
}
export interface FrequencyManagementPlan {
    lowFrequencies: string;
    midFrequencies: string;
    highFrequencies: string;
    harmonicBalance: string;
    frequencyMasking: string[];
    tonalBalance: string;
}
export interface LoudnessManagementPlan {
    broadcastLoudness: string;
    streamingLoudness: string;
    podcastLoudness: string;
    cinemaLoudness: string;
    televisionLoudness: string;
    radioLoudness: string;
    platformTarget: string;
}
export interface SpatialMixPlan {
    stereoMixing: string;
    monoCompatibility: string;
    surroundPreparation: string;
    binauralPreparation: string;
    dolbyAtmosPreparation: string;
}
export interface OutputMasterPlan {
    platform: AudioMixingPlatform;
    formatNotes: string[];
    deliveryNotes: string[];
    loudnessTarget: string;
}
export interface ProductionMixMasterInstructions {
    renderNotes: string[];
    mixingGuidance: string[];
    masteringGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface AudioMixMasterScores {
    mixingQualityScore: number;
    masteringQualityScore: number;
    loudnessScore: number;
    frequencyBalanceScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface AudioMixMasterRelationships {
    mixingPlans: string[];
    masteringPlans: string[];
    voicePlans: string[];
    musicPlans: string[];
    ambientPlans: string[];
    soundPlans: string[];
    enhancementPlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    videos: string[];
    knowledgeRecords: string[];
}
export interface AudioMixMasterGenerationInput {
    mixPrompt?: string;
    sessionId?: string;
    sessionRef?: string;
    voiceTrackRefs?: string[];
    musicTrackRefs?: string[];
    ambientTrackRefs?: string[];
    soundEffectRefs?: string[];
    videoId?: string;
    timelineRef?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: AudioMixingPlatform;
    trackCount?: number;
    trackTypes?: AudioTrackType[];
    durationSec?: number;
    voicePlanIds?: string[];
    musicPlanIds?: string[];
    ambientPlanIds?: string[];
    soundPlanIds?: string[];
    enhancementPlanIds?: string[];
    knowledgeRecordIds?: string[];
    inputTypes?: MixingInputType[];
}
export interface AudioMixMasterGenerationRecord {
    mixingPlanId: string;
    masteringPlanId: string;
    profile: AudioMixMasterProfile;
    multiTrackAnalysis: MultiTrackAnalysis;
    mixingPlan: MixingPlan;
    masteringPlan: MasteringPlan;
    frequencyManagement: FrequencyManagementPlan;
    loudnessManagement: LoudnessManagementPlan;
    spatialMixPlan: SpatialMixPlan;
    outputPreparation: OutputMasterPlan;
    productionInstructions: ProductionMixMasterInstructions;
    blueprintId?: string;
    scores: AudioMixMasterScores;
    relationships: AudioMixMasterRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface AudioMixMasterGenerationResult {
    success: boolean;
    record?: AudioMixMasterGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface AudioMixMasterSearchQuery {
    mixingPlanId?: string;
    masteringPlanId?: string;
    sessionId?: string;
    productId?: string;
    brandId?: string;
    platform?: AudioMixingPlatform;
    mixing?: string;
    mastering?: string;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface AudioMixMasterGenerationEngineStatusReport {
    engineStatus: string;
    multiTrackAnalysisStatus: string;
    mixingPlanningStatus: string;
    masteringPlanningStatus: string;
    loudnessPlanningStatus: string;
    frequencyManagementStatus: string;
    spatialAudioStatus: string;
    mixMasterPlansGenerated: number;
    averageMixingQualityScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averageBlueprintMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class AudioMixingMasteringEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_AUDIO_MIXING_PLATFORMS: AudioMixingPlatform[];
export declare const AUDIO_TRACK_TYPES: AudioTrackType[];
export declare const PLATFORM_MIX_MASTER_CONFIG: Record<AudioMixingPlatform, {
    targetLufs: number;
    formatNotes: string;
    loudnessStandard: string;
}>;
//# sourceMappingURL=types.d.ts.map