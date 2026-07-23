/**
 * KWIZERA AI STUDIO — Video Enhancement Planning Engine types (Step 7I)
 */
export declare enum VideoEnhancementPlatform {
    TikTok = "tiktok",
    Instagram = "instagram",
    Facebook = "facebook",
    YouTube = "youtube",
    WhatsApp = "whatsapp",
    Website = "website",
    Television = "television",
    PrintPreview = "print-preview"
}
export declare enum EnhancementType {
    Visual = "visual",
    Audio = "audio",
    Motion = "motion",
    Restoration = "restoration",
    Cinematic = "cinematic",
    Platform = "platform",
    Stabilization = "stabilization",
    Color = "color"
}
export interface EnhancementProfile {
    enhancementPlanId: string;
    projectId: string;
    videoId: string;
    product: string;
    brand: string;
    campaign: string;
    platform: VideoEnhancementPlatform;
    enhancementVersion: number;
}
export interface VideoQualityAnalysis {
    resolution: number;
    frameQuality: number;
    motionQuality: number;
    stabilization: number;
    noise: number;
    compressionArtifacts: number;
    lighting: number;
    colorAccuracy: number;
    visualClarity: number;
    audioQuality: number;
}
export interface VisualEnhancementPlan {
    resolutionEnhancement: string;
    frameEnhancement: string;
    noiseReduction: string;
    stabilizationPlanning: string;
    colorCorrectionPlanning: string;
    colorGradingPlanning: string;
    lightingEnhancement: string;
    contrastEnhancement: string;
    sharpnessEnhancement: string;
    backgroundEnhancement: string;
}
export interface AudioEnhancementPlan {
    noiseReduction: string;
    voiceEnhancement: string;
    musicOptimization: string;
    audioSynchronization: string;
    loudnessNormalization: string;
    echoReduction: string;
    audioClarity: string;
}
export interface MotionEnhancementPlan {
    motionSmoothing: string;
    motionConsistency: string;
    cameraStabilization: string;
    motionContinuity: string;
    frameInterpolationPrep: string;
}
export interface CinematicEnhancementPlan {
    styleAlignment: string;
    pacingOptimization: string;
    transitionRefinement: string;
    colorGradingCinematic: string;
}
export interface PlatformOptimizationRule {
    platform: VideoEnhancementPlatform;
    resolutionTarget: string;
    aspectRatio: string;
    bitrateGuidance: string;
    loudnessTarget: string;
    enhancementNotes: string[];
    priority: "low" | "medium" | "high";
}
export interface NonDestructivePolicy {
    preserveOriginal: boolean;
    supportsUndo: boolean;
    supportsRedo: boolean;
    supportsRecovery: boolean;
    versionHistoryEnabled: boolean;
    originalAssetRef: string;
}
export interface EnhancementVersionEntry {
    version: number;
    timestamp: string;
    changeSummary: string;
    reversible: boolean;
}
export interface EnhancementQualityScores {
    enhancementReadinessScore: number;
    visualQualityScore: number;
    audioQualityScore: number;
    motionQualityScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface EnhancementRecommendation {
    category: EnhancementType;
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
    nonDestructive: boolean;
}
export interface EnhancementRelationships {
    relatedVideos: string[];
    relatedScenes: string[];
    relatedTimelines: string[];
    relatedMotionPlans: string[];
    relatedCameraPlans: string[];
    relatedStylePlans: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedKnowledge: string[];
    relatedMemory: string[];
    relatedProjects: string[];
}
export interface VideoEnhancementPlanningInput {
    videoId: string;
    projectId?: string;
    platform?: VideoEnhancementPlatform;
    relatedKnowledge?: string[];
    relatedProjects?: string[];
}
export interface VideoEnhancementPlanRecord {
    videoId: string;
    intelligenceId: string;
    analysisId: string;
    detectionId: string;
    styleIntelligenceId?: string;
    motionIntelligenceId?: string;
    cameraIntelligenceId?: string;
    timelineId?: string;
    profile: EnhancementProfile;
    qualityAnalysis: VideoQualityAnalysis;
    visualPlan: VisualEnhancementPlan;
    audioPlan: AudioEnhancementPlan;
    motionPlan: MotionEnhancementPlan;
    cinematicPlan: CinematicEnhancementPlan;
    platformOptimizations: PlatformOptimizationRule[];
    nonDestructive: NonDestructivePolicy;
    versionHistory: EnhancementVersionEntry[];
    scores: EnhancementQualityScores;
    relationships: EnhancementRelationships;
    recommendations: EnhancementRecommendation[];
    keywords: string[];
    validated: boolean;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface VideoEnhancementPlanningResult {
    success: boolean;
    record?: VideoEnhancementPlanRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface VideoEnhancementSearchQuery {
    videoId?: string;
    enhancementType?: EnhancementType;
    platform?: VideoEnhancementPlatform;
    brand?: string;
    product?: string;
    campaign?: string;
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface VideoEnhancementEngineStatusReport {
    engineStatus: string;
    qualityAnalysisStatus: string;
    visualPlanningStatus: string;
    audioPlanningStatus: string;
    motionPlanningStatus: string;
    platformOptimizationStatus: string;
    nonDestructiveStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imageIntelligenceBridgeStatus: string;
    videosProcessed: number;
    plansGenerated: number;
    averageEnhancementReadinessScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoEnhancementPlanningEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map