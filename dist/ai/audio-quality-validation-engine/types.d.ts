/**
 * KWIZERA AI STUDIO — Audio Quality Validation Engine types (Step 10L)
 */
export declare enum AudioQualityValidationPlatform {
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
export declare enum AudioQualityCheck {
    SampleRate = "sample-rate",
    BitDepth = "bit-depth",
    Loudness = "loudness",
    PeakLevel = "peak-level",
    DynamicRange = "dynamic-range",
    SignalToNoiseRatio = "signal-to-noise-ratio",
    Noise = "noise",
    Distortion = "distortion",
    Clipping = "clipping",
    FrequencyBalance = "frequency-balance"
}
export declare enum AudioQualityTrackCheck {
    TrackStructure = "track-structure",
    TrackOrder = "track-order",
    TrackGroups = "track-groups",
    BusRouting = "bus-routing",
    SendRouting = "send-routing",
    Automation = "automation",
    MuteSoloStatus = "mute-solo-status"
}
export declare enum AudioQualityTimelineCheck {
    TimelineAlignment = "timeline-alignment",
    CuePoints = "cue-points",
    FadeIn = "fade-in",
    FadeOut = "fade-out",
    Crossfade = "crossfade",
    LoopIntegrity = "loop-integrity"
}
export declare enum AudioSyncCheck {
    VideoSync = "video-sync",
    LipSyncMetadata = "lip-sync-metadata",
    DialogueTiming = "dialogue-timing",
    MusicTiming = "music-timing",
    SoundEffectsTiming = "sound-effects-timing",
    AmbientTiming = "ambient-timing"
}
export declare enum AudioBrandValidationCheck {
    BrandAudioIdentity = "brand-audio-identity",
    VoiceIdentity = "voice-identity",
    AudioStyle = "audio-style",
    CampaignConsistency = "campaign-consistency"
}
export declare enum AudioTechnicalValidationCheck {
    Codec = "codec",
    ChannelLayout = "channel-layout",
    Metadata = "metadata",
    FileFormat = "file-format",
    Compression = "compression",
    LoudnessTarget = "loudness-target",
    ExportSettings = "export-settings"
}
export declare enum AudioQualityIssueSeverity {
    Low = "low",
    Medium = "medium",
    High = "high",
    Critical = "critical"
}
export declare enum AudioQualityIssueCategory {
    MissingAsset = "missing-asset",
    BrokenTrack = "broken-track",
    TimelineProblem = "timeline-problem",
    SyncProblem = "sync-problem",
    LoudnessProblem = "loudness-problem",
    Clipping = "clipping",
    Distortion = "distortion",
    MetadataProblem = "metadata-problem",
    Branding = "branding",
    RenderingRisk = "rendering-risk"
}
export interface AudioQualityValidationProfile {
    audioQualityValidationId: string;
    projectId: string;
    productionId: string;
    renderPlanId: string;
    audioPlanId: string;
    productId: string;
    brandId: string;
    platform: AudioQualityValidationPlatform;
    validationVersion: number;
}
export interface AudioQualityValidationEntry {
    check: AudioQualityCheck;
    validated: boolean;
    score: number;
    notes: string[];
}
export interface AudioQualityTrackValidationEntry {
    check: AudioQualityTrackCheck;
    validated: boolean;
    notes: string[];
}
export interface AudioQualityTimelineValidationEntry {
    check: AudioQualityTimelineCheck;
    validated: boolean;
    notes: string[];
}
export interface AudioSyncValidationEntry {
    check: AudioSyncCheck;
    validated: boolean;
    notes: string[];
}
export interface AudioBrandValidationEntry {
    check: AudioBrandValidationCheck;
    validated: boolean;
    notes: string[];
}
export interface AudioPlatformValidationEntry {
    platform: AudioQualityValidationPlatform;
    validated: boolean;
    ready: boolean;
    notes: string[];
}
export interface AudioTechnicalValidationEntry {
    check: AudioTechnicalValidationCheck;
    validated: boolean;
    notes: string[];
}
export interface AudioQualityIssue {
    issueId: string;
    category: AudioQualityIssueCategory;
    severity: AudioQualityIssueSeverity;
    message: string;
    repaired: boolean;
    repairNotes?: string[];
}
export interface AudioQualityValidationScores {
    overallAudioQualityScore: number;
    loudnessScore: number;
    frequencyBalanceScore: number;
    synchronizationScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    platformCompatibilityScore: number;
    aiConfidenceScore: number;
}
export interface AudioQualityValidationRelationships {
    audioPlans: string[];
    productionPlans: string[];
    renderPlans: string[];
    voicePlans: string[];
    musicPlans: string[];
    soundPlans: string[];
    ambientPlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    knowledgeRecords: string[];
}
export interface AudioQualityValidationInput {
    productId?: string;
    projectId?: string;
    productionId?: string;
    renderPlanId?: string;
    audioPlanId?: string;
    brandId?: string;
    brandName?: string;
    campaignId?: string;
    platform?: AudioQualityValidationPlatform;
    validationPrompt?: string;
    voicePlanIds?: string[];
    musicPlanIds?: string[];
    soundPlanIds?: string[];
    ambientPlanIds?: string[];
    knowledgeRecordIds?: string[];
    validatePlatform?: boolean;
    autoRepair?: boolean;
}
export interface AudioQualityValidationRecord {
    audioQualityValidationId: string;
    profile: AudioQualityValidationProfile;
    audioQuality: AudioQualityValidationEntry[];
    trackValidation: AudioQualityTrackValidationEntry[];
    timelineValidation: AudioQualityTimelineValidationEntry[];
    syncValidation: AudioSyncValidationEntry[];
    brandValidation: AudioBrandValidationEntry[];
    platformValidation: AudioPlatformValidationEntry[];
    technicalValidation: AudioTechnicalValidationEntry[];
    issues: AudioQualityIssue[];
    repairsApplied: string[];
    blueprintId?: string;
    scores: AudioQualityValidationScores;
    relationships: AudioQualityValidationRelationships;
    recommendations: string[];
    validated: boolean;
    approved: boolean;
    productionReady: boolean;
    renderReady: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface AudioQualityValidationResult {
    success: boolean;
    record?: AudioQualityValidationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface AudioQualityValidationSearchQuery {
    audioQualityValidationId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: AudioQualityValidationPlatform;
    audioPlanId?: string;
    minQualityScore?: number;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface AudioQualityValidationEngineStatusReport {
    engineStatus: string;
    audioQualityStatus: string;
    trackValidationStatus: string;
    syncValidationStatus: string;
    brandValidationStatus: string;
    validationsPerformed: number;
    averageOverallQualityScore: number;
    averageApprovalRate: number;
    performance: {
        averageValidationMs: number;
        averageSearchMs: number;
        averageRepairMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class AudioQualityValidationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_AUDIO_QUALITY_VALIDATION_PLATFORMS: AudioQualityValidationPlatform[];
export declare const ALL_AUDIO_QUALITY_CHECKS: AudioQualityCheck[];
export declare const ALL_AUDIO_QUALITY_TRACK_CHECKS: AudioQualityTrackCheck[];
export declare const ALL_AUDIO_QUALITY_TIMELINE_CHECKS: AudioQualityTimelineCheck[];
export declare const ALL_AUDIO_SYNC_CHECKS: AudioSyncCheck[];
export declare const ALL_AUDIO_BRAND_VALIDATION_CHECKS: AudioBrandValidationCheck[];
export declare const ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS: AudioTechnicalValidationCheck[];
export declare const AUDIO_QUALITY_PLATFORM_CONFIG: Record<AudioQualityValidationPlatform, {
    sampleRate: number;
    bitDepth: number;
    loudnessTarget: number;
    channelLayout: string;
    codec: string;
}>;
//# sourceMappingURL=types.d.ts.map