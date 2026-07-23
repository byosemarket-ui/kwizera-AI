/**
 * KWIZERA AI STUDIO — Audio Production Engine types (Step 10J)
 */
export declare enum AudioProductionPlatform {
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
export declare enum AudioProductionWorkflowStage {
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
    ProductionWorkflow = "production-workflow"
}
export declare enum AudioProductionAssetType {
    VoiceTrack = "voice-track",
    MusicTrack = "music-track",
    SoundEffect = "sound-effect",
    AmbientTrack = "ambient-track",
    MultiTrackSession = "multi-track-session",
    VoiceProfile = "voice-profile",
    Template = "template",
    Metadata = "metadata",
    BrandAsset = "brand-asset",
    AudioPreset = "audio-preset"
}
export declare enum AudioProductionDependency {
    MemoryEngine = "memory-engine",
    KnowledgeEngine = "knowledge-engine",
    ProductIntelligenceEngine = "product-intelligence-engine",
    ImageIntelligenceEngine = "image-intelligence-engine",
    VideoIntelligenceEngine = "video-intelligence-engine",
    VideoGenerationEngine = "video-generation-engine",
    ImageGenerationEngine = "image-generation-engine",
    AudioGenerationFoundation = "audio-generation-foundation",
    TextToSpeechEngine = "text-to-speech-generation-engine",
    SpeechToSpeechEngine = "speech-to-speech-generation-engine",
    VoiceCloningEngine = "voice-cloning-generation-engine",
    MusicGenerationEngine = "music-generation-engine",
    SoundEffectsEngine = "sound-effects-generation-engine",
    AmbientAudioEngine = "ambient-audio-generation-engine",
    AudioEnhancementEngine = "audio-enhancement-generation-engine",
    AudioMixingMasteringEngine = "audio-mixing-generation-engine"
}
export declare enum AudioProductionExportFormat {
    Wav = "wav",
    Mp3 = "mp3",
    Flac = "flac",
    Aac = "aac",
    Ogg = "ogg",
    Aiff = "aiff"
}
export interface AudioProductionProfile {
    audioProductionId: string;
    projectId: string;
    audioPlanId: string;
    brandId: string;
    campaignId: string;
    platform: AudioProductionPlatform;
    productionVersion: number;
}
export interface WorkflowValidationEntry {
    stage: AudioProductionWorkflowStage;
    validated: boolean;
    moduleId: string;
    status: string;
    notes: string[];
}
export interface AssetValidationEntry {
    assetType: AudioProductionAssetType;
    assetId: string;
    validated: boolean;
    source: string;
    notes: string[];
}
export interface TrackValidationEntry {
    trackId: string;
    trackType: string;
    validated: boolean;
    notes: string[];
}
export interface DependencyValidationEntry {
    dependency: AudioProductionDependency;
    available: boolean;
    moduleId?: string;
    notes: string[];
}
export interface ProductionTrackEntry {
    trackId: string;
    name: string;
    order: number;
    type: string;
    bus: string;
    validated: boolean;
}
export interface ProductionBusEntry {
    busId: string;
    name: string;
    order: number;
    type: string;
}
export interface ProductionStructure {
    trackStructure: ProductionTrackEntry[];
    busStructure: ProductionBusEntry[];
    timelineStructure: {
        cueId: string;
        timeSec: number;
        label: string;
    }[];
    assetHierarchy: string[];
    metadataStructure: Record<string, string>;
    versionStructure: {
        currentVersion: number;
        historyRef: string;
    };
}
export interface RenderPreparationPlan {
    sampleRate: number;
    bitDepth: number;
    channelLayout: string;
    loudnessTarget: string;
    dynamicRange: string;
    codecPreparation: string;
    outputQuality: string;
    instructions: string[];
}
export interface ExportPreparationEntry {
    format: AudioProductionExportFormat;
    enabled: boolean;
    bitrate: string;
    notes: string[];
}
export interface ExportPreparationPlan {
    exports: ExportPreparationEntry[];
    extensibleFormats: string[];
}
export interface DeliveryInstructions {
    platform: AudioProductionPlatform;
    deliveryTargets: string[];
    packagingNotes: string[];
    distributionNotes: string[];
}
export interface RecoveryPlan {
    recoveryId: string;
    checkpoints: string[];
    rollbackSteps: string[];
    assetRecoveryRefs: string[];
}
export interface PlatformProductionRules {
    platform: AudioProductionPlatform;
    loudnessTarget: string;
    exportFormats: AudioProductionExportFormat[];
    rules: string[];
}
export interface AudioProductionScores {
    productionReadinessScore: number;
    assetReadinessScore: number;
    workflowScore: number;
    trackIntegrityScore: number;
    dependencyScore: number;
    performanceScore: number;
    aiConfidenceScore: number;
}
export interface AudioProductionRelationships {
    audioPlans: string[];
    productionPlans: string[];
    voicePlans: string[];
    musicPlans: string[];
    ambientPlans: string[];
    soundPlans: string[];
    enhancementPlans: string[];
    mixingPlans: string[];
    masteringPlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    videos: string[];
    knowledgeRecords: string[];
}
export interface AudioProductionInput {
    productionPrompt?: string;
    audioPlanId?: string;
    mixingPlanId?: string;
    masteringPlanId?: string;
    sessionId?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: AudioProductionPlatform;
    videoId?: string;
    voicePlanIds?: string[];
    musicPlanIds?: string[];
    ambientPlanIds?: string[];
    soundPlanIds?: string[];
    enhancementPlanIds?: string[];
    voiceTrackRefs?: string[];
    musicTrackRefs?: string[];
    knowledgeRecordIds?: string[];
    validateAllWorkflows?: boolean;
    validateAllAssets?: boolean;
    prepareExports?: boolean;
    preparePlatformRules?: boolean;
}
export interface AudioProductionRecord {
    audioProductionId: string;
    profile: AudioProductionProfile;
    workflowValidation: WorkflowValidationEntry[];
    assetValidation: AssetValidationEntry[];
    trackValidation: TrackValidationEntry[];
    dependencyValidation: DependencyValidationEntry[];
    productionStructure: ProductionStructure;
    renderPreparation: RenderPreparationPlan;
    exportPreparation: ExportPreparationPlan;
    deliveryInstructions: DeliveryInstructions;
    recoveryPlan: RecoveryPlan;
    platformRules: PlatformProductionRules;
    blueprintId?: string;
    scores: AudioProductionScores;
    relationships: AudioProductionRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface AudioProductionResult {
    success: boolean;
    record?: AudioProductionRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface AudioProductionSearchQuery {
    audioProductionId?: string;
    audioPlanId?: string;
    productId?: string;
    brandId?: string;
    platform?: AudioProductionPlatform;
    sessionId?: string;
    track?: string;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface AudioProductionEngineStatusReport {
    engineStatus: string;
    workflowValidationStatus: string;
    assetValidationStatus: string;
    trackValidationStatus: string;
    dependencyValidationStatus: string;
    renderPreparationStatus: string;
    exportPreparationStatus: string;
    productionPlansGenerated: number;
    averageProductionReadinessScore: number;
    averageWorkflowScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averagePlanningMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class AudioProductionEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_AUDIO_PRODUCTION_WORKFLOW_STAGES: AudioProductionWorkflowStage[];
export declare const ALL_AUDIO_PRODUCTION_ASSET_TYPES: AudioProductionAssetType[];
export declare const ALL_AUDIO_PRODUCTION_DEPENDENCIES: AudioProductionDependency[];
export declare const ALL_AUDIO_PRODUCTION_EXPORT_FORMATS: AudioProductionExportFormat[];
export declare const ALL_AUDIO_PRODUCTION_PLATFORMS: AudioProductionPlatform[];
export declare const WORKFLOW_MODULE_MAP: Record<AudioProductionWorkflowStage, string>;
export declare const DEPENDENCY_MODULE_MAP: Partial<Record<AudioProductionDependency, string>>;
export declare const AUDIO_PRODUCTION_PLATFORM_CONFIG: Record<AudioProductionPlatform, {
    targetLufs: number;
    sampleRate: number;
    channelLayout: string;
}>;
//# sourceMappingURL=types.d.ts.map