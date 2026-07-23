/**
 * KWIZERA AI STUDIO — Audio Rendering Preparation Engine types (Step 10K)
 */
export declare enum AudioRenderPlatform {
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
export declare enum AudioRenderValidationStage {
    TextToSpeech = "text-to-speech",
    SpeechToSpeech = "speech-to-speech",
    VoiceCloning = "voice-cloning",
    MusicGeneration = "music-generation",
    SoundEffectsGeneration = "sound-effects-generation",
    AmbientAudioGeneration = "ambient-audio-generation",
    AudioEnhancement = "audio-enhancement",
    AudioRestoration = "audio-restoration",
    AudioMixing = "audio-mixing",
    AudioMastering = "audio-mastering",
    ProductionPlans = "production-plans"
}
export declare enum AudioRenderTrackCheck {
    TrackHierarchy = "track-hierarchy",
    TrackOrder = "track-order",
    TrackGroups = "track-groups",
    BusRouting = "bus-routing",
    SendRouting = "send-routing",
    Automation = "automation",
    MuteSoloStatus = "mute-solo-status"
}
export declare enum AudioRenderTimelineCheck {
    TimelineAlignment = "timeline-alignment",
    CuePoints = "cue-points",
    TrackPosition = "track-position",
    FadeIn = "fade-in",
    FadeOut = "fade-out",
    Crossfade = "crossfade",
    LoopIntegrity = "loop-integrity"
}
export declare enum AudioRenderAssetType {
    VoiceTrack = "voice-track",
    MusicTrack = "music-track",
    AmbientTrack = "ambient-track",
    SoundEffect = "sound-effect",
    AudioPreset = "audio-preset",
    Metadata = "metadata",
    BrandAsset = "brand-asset",
    SessionTemplate = "session-template"
}
export declare enum AudioRenderChannelLayout {
    Mono = "mono",
    Stereo = "stereo",
    Surround = "surround"
}
export declare enum AudioRenderCodec {
    Wav = "wav",
    Mp3 = "mp3",
    Flac = "flac",
    Aac = "aac",
    Ogg = "ogg",
    Aiff = "aiff"
}
export interface AudioRenderPlanProfile {
    audioRenderPlanId: string;
    projectId: string;
    productionId: string;
    audioId: string;
    platform: AudioRenderPlatform;
    renderVersion: number;
}
export interface AudioRenderValidationEntry {
    stage: AudioRenderValidationStage;
    validated: boolean;
    moduleId: string;
    status: string;
    notes: string[];
}
export interface AudioRenderTrackValidationEntry {
    check: AudioRenderTrackCheck;
    validated: boolean;
    trackCount: number;
    notes: string[];
}
export interface AudioRenderTimelineValidationEntry {
    check: AudioRenderTimelineCheck;
    validated: boolean;
    cueCount: number;
    notes: string[];
}
export interface AudioRenderAssetValidationEntry {
    assetType: AudioRenderAssetType;
    assetId: string;
    validated: boolean;
    source: string;
    notes: string[];
}
export interface AudioRenderTrackEntry {
    trackId: string;
    name: string;
    order: number;
    group: string;
    bus: string;
    send: string;
    automation: boolean;
    muted: boolean;
    solo: boolean;
}
export interface AudioRenderTimelineEntry {
    cueId: string;
    trackId: string;
    positionMs: number;
    fadeInMs: number;
    fadeOutMs: number;
    crossfadeMs: number;
    loop: boolean;
}
export interface AudioRenderSettingsPlan {
    sampleRate: number;
    bitDepth: number;
    channelLayout: AudioRenderChannelLayout;
    mono: boolean;
    stereo: boolean;
    surround: boolean;
    loudnessTarget: number;
    dynamicRange: string;
    codec: AudioRenderCodec;
    compressionStrategy: string;
    outputQuality: number;
    instructions: string[];
}
export interface AudioRenderOutputProfileEntry {
    platform: AudioRenderPlatform;
    sampleRate: number;
    bitDepth: number;
    channelLayout: AudioRenderChannelLayout;
    codec: AudioRenderCodec;
    loudnessTarget: number;
    rules: string[];
}
export interface AudioRenderResourcePlanningPlan {
    cpuAllocation: string;
    gpuAllocation: string;
    ramAllocation: string;
    storageAllocation: string;
    cacheAllocation: string;
    temporaryFiles: string[];
    renderQueue: string[];
    parallelRenderingPreparation: boolean;
    notes: string[];
}
export interface AudioRenderJobPlan {
    jobId: string;
    renderPlanId: string;
    priority: number;
    status: string;
    platform: AudioRenderPlatform;
    estimatedResources: string;
}
export interface AudioRenderRecoveryPlan {
    recoveryId: string;
    checkpoints: string[];
    resumeSteps: string[];
    rollbackSteps: string[];
    automaticRecovery: boolean;
    failureDetection: string[];
}
export interface AudioRenderScores {
    renderReadinessScore: number;
    assetQualityScore: number;
    trackIntegrityScore: number;
    timelineIntegrityScore: number;
    performanceScore: number;
    platformCompatibilityScore: number;
    aiConfidenceScore: number;
}
export interface AudioRenderRelationships {
    audioPlans: string[];
    productionPlans: string[];
    renderPlans: string[];
    voicePlans: string[];
    musicPlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    knowledgeRecords: string[];
}
export interface AudioRenderInput {
    productId?: string;
    projectId?: string;
    productionId?: string;
    audioId?: string;
    audioPlanId?: string;
    brandId?: string;
    brandName?: string;
    campaignId?: string;
    platform?: AudioRenderPlatform;
    renderPrompt?: string;
    sessionId?: string;
    voicePlanIds?: string[];
    musicPlanIds?: string[];
    knowledgeRecordIds?: string[];
    validateTracks?: boolean;
    validateTimeline?: boolean;
    validateAssets?: boolean;
    planResources?: boolean;
    prepareOutputProfiles?: boolean;
    generateRenderJobs?: boolean;
}
export interface AudioRenderRecord {
    audioRenderPlanId: string;
    profile: AudioRenderPlanProfile;
    renderValidation: AudioRenderValidationEntry[];
    trackValidation: AudioRenderTrackValidationEntry[];
    timelineValidation: AudioRenderTimelineValidationEntry[];
    assetValidation: AudioRenderAssetValidationEntry[];
    trackStructure: AudioRenderTrackEntry[];
    timelineStructure: AudioRenderTimelineEntry[];
    renderSettings: AudioRenderSettingsPlan;
    outputProfiles: AudioRenderOutputProfileEntry[];
    resourcePlanning: AudioRenderResourcePlanningPlan;
    renderJobs: AudioRenderJobPlan[];
    recoveryPlan: AudioRenderRecoveryPlan;
    blueprintId?: string;
    scores: AudioRenderScores;
    relationships: AudioRenderRelationships;
    recommendations: string[];
    validated: boolean;
    renderReady: boolean;
    productionReady: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface AudioRenderResult {
    success: boolean;
    record?: AudioRenderRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface AudioRenderSearchQuery {
    audioRenderPlanId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: AudioRenderPlatform;
    codec?: AudioRenderCodec;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface AudioRenderEngineStatusReport {
    engineStatus: string;
    renderValidationStatus: string;
    trackValidationStatus: string;
    timelineValidationStatus: string;
    resourcePlanningStatus: string;
    renderPlansGenerated: number;
    averageRenderReadinessScore: number;
    averageTrackIntegrityScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averagePlanningMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class AudioRenderEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_AUDIO_RENDER_PLATFORMS: AudioRenderPlatform[];
export declare const ALL_AUDIO_RENDER_VALIDATION_STAGES: AudioRenderValidationStage[];
export declare const ALL_AUDIO_RENDER_TRACK_CHECKS: AudioRenderTrackCheck[];
export declare const ALL_AUDIO_RENDER_TIMELINE_CHECKS: AudioRenderTimelineCheck[];
export declare const ALL_AUDIO_RENDER_ASSET_TYPES: AudioRenderAssetType[];
export declare const AUDIO_RENDER_VALIDATION_MODULE_MAP: Record<AudioRenderValidationStage, string>;
export declare const AUDIO_RENDER_PLATFORM_CONFIG: Record<AudioRenderPlatform, {
    sampleRate: number;
    bitDepth: number;
    channelLayout: AudioRenderChannelLayout;
    loudnessTarget: number;
    dynamicRange: string;
    codec: AudioRenderCodec;
    compressionStrategy: string;
    outputQuality: number;
}>;
//# sourceMappingURL=types.d.ts.map