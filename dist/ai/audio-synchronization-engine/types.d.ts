/**
 * KWIZERA AI STUDIO — Audio Synchronization Engine types (Step 8H)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare enum AudioSyncPlanType {
    Voice = "voice",
    Music = "music",
    SoundEffect = "sound-effect",
    Subtitle = "subtitle",
    Mixed = "mixed",
    Combined = "combined"
}
export interface AudioSynchronizationProfile {
    audioSynchronizationId: string;
    projectId: string;
    sceneId: string;
    storyboardId: string;
    productId: string;
    brandId: string;
    platform: StoryboardGenerationPlatform;
    audioVersion: number;
    visualEffectPlanId: string;
    animationPlanId: string;
    motionPlanId: string;
    cameraPlanId: string;
}
export interface VoiceSynchronizationPlan {
    voiceTiming: string;
    speechAlignment: string;
    pronunciationTiming: string;
    emotionTiming: string;
    dialogueTiming: string;
    lipSyncBlueprint: string;
}
export interface MusicSynchronizationPlan {
    musicPlacement: string;
    musicTiming: string;
    beatDetection: string;
    rhythmAlignment: string;
    musicFadeIn: string;
    musicFadeOut: string;
}
export interface SoundEffectSynchronizationPlan {
    effectTiming: string;
    environmentalSounds: string;
    productSounds: string;
    transitionSounds: string;
    ambientSounds: string;
}
export interface SubtitleSynchronizationPlan {
    subtitleTiming: string;
    captionTiming: string;
    multiLanguageSupport: string;
    readingSpeedValidation: string;
    subtitlePosition: string;
    captionStyling: string;
}
export interface AudioMixingPlan {
    voiceLevel: string;
    musicLevel: string;
    effectLevel: string;
    noiseReduction: string;
    loudnessNormalization: string;
    dynamicRange: string;
    stereoPlanning: string;
    surroundSoundPreparation: string;
}
export interface SceneSynchronizationPlan {
    voiceSync: string[];
    musicSync: string[];
    motionSync: string[];
    cameraSync: string[];
    animationSync: string[];
    visualEffectsSync: string[];
    sceneChangeSync: string[];
}
export interface AudioContinuityPlan {
    crossSceneContinuity: boolean;
    voiceContinuity: boolean;
    musicContinuity: boolean;
    effectContinuity: boolean;
    issues: string[];
}
export interface PlatformAudioSyncOptimization {
    platform: StoryboardGenerationPlatform;
    loudnessTarget: string;
    musicMixRatio: string;
    notes: string[];
}
export interface AudioSynchronizationScores {
    audioSynchronizationScore: number;
    lipSyncScore: number;
    musicAlignmentScore: number;
    subtitleQualityScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface AudioSynchronizationRelationships {
    storyboards: string[];
    scenes: string[];
    cameraPlans: string[];
    motionPlans: string[];
    animationPlans: string[];
    visualEffectPlans: string[];
    stylePlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    knowledgeRecords: string[];
    voiceFiles: string[];
    musicTracks: string[];
    soundEffects: string[];
    scripts: string[];
}
export interface AudioSynchronizationInput {
    sceneId?: string;
    storyboardId?: string;
    visualEffectPlanId?: string;
    animationPlanId?: string;
    motionPlanId?: string;
    cameraPlanId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    stylePlanId?: string;
    scriptId?: string;
    voiceFileIds?: string[];
    musicIds?: string[];
    soundEffectIds?: string[];
    knowledgeRecordIds?: string[];
    platform?: StoryboardGenerationPlatform;
}
export interface AudioSynchronizationRecord {
    audioSynchronizationId: string;
    profile: AudioSynchronizationProfile;
    planType: AudioSyncPlanType;
    voiceSynchronization: VoiceSynchronizationPlan;
    musicSynchronization: MusicSynchronizationPlan;
    soundEffectSynchronization: SoundEffectSynchronizationPlan;
    subtitleSynchronization: SubtitleSynchronizationPlan;
    audioMixing: AudioMixingPlan;
    sceneSynchronization: SceneSynchronizationPlan;
    continuity: AudioContinuityPlan;
    platformOptimizations: PlatformAudioSyncOptimization[];
    scores: AudioSynchronizationScores;
    relationships: AudioSynchronizationRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    audioContinuityMaintained: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface AudioSynchronizationResult {
    success: boolean;
    plans?: AudioSynchronizationRecord[];
    record?: AudioSynchronizationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface AudioSynchronizationSearchQuery {
    audioSynchronizationId?: string;
    sceneId?: string;
    storyboardId?: string;
    planType?: AudioSyncPlanType;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: StoryboardGenerationPlatform;
    voice?: string;
    music?: string;
    soundEffect?: string;
    subtitle?: string;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface AudioSynchronizationEngineStatusReport {
    engineStatus: string;
    voiceSyncStatus: string;
    musicSyncStatus: string;
    subtitleSyncStatus: string;
    audioPlansGenerated: number;
    averageAudioSynchronizationScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averageSyncMs: number;
        averageSearchMs: number;
        averageLipSyncPlanningMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class AudioSynchronizationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const AUDIO_SYNC_PLATFORM_TARGETS: StoryboardGenerationPlatform[];
export declare const PLATFORM_AUDIO_SYNC_CONFIG: Record<StoryboardGenerationPlatform, {
    loudnessTarget: string;
    musicMixRatio: string;
}>;
//# sourceMappingURL=types.d.ts.map