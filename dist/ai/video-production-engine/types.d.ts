/**
 * KWIZERA AI STUDIO — Video Production Engine types (Step 8J)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare enum ProductionPlanType {
    Standard = "standard",
    PlatformOptimized = "platform-optimized",
    Campaign = "campaign",
    Combined = "combined"
}
export declare enum ExportFormat {
    Mp4 = "mp4",
    Mov = "mov",
    Mkv = "mkv",
    Webm = "webm",
    Gif = "gif"
}
export interface ProductionProfile {
    productionId: string;
    projectId: string;
    storyboardId: string;
    videoId: string;
    productId: string;
    brandId: string;
    campaignId: string;
    platform: StoryboardGenerationPlatform;
    productionVersion: number;
    marketingVideoId: string;
}
export interface WorkflowValidationPlan {
    storyboardValidated: boolean;
    sceneGenerationValidated: boolean;
    cameraPlansValidated: boolean;
    motionPlansValidated: boolean;
    animationPlansValidated: boolean;
    visualEffectsPlansValidated: boolean;
    audioSyncPlansValidated: boolean;
    marketingPlansValidated: boolean;
    productionWorkflowValidated: boolean;
    issues: string[];
}
export interface AssetValidationPlan {
    images: string;
    videos: string;
    logos: string;
    fonts: string;
    icons: string;
    backgrounds: string;
    music: string;
    voice: string;
    soundEffects: string;
    subtitles: string;
    captions: string;
    templates: string;
    luts: string;
    motionGraphics: string;
    brandAssets: string;
    allAssetsReady: boolean;
}
export interface DependencyValidationPlan {
    memoryEngine: boolean;
    knowledgeEngine: boolean;
    productIntelligenceEngine: boolean;
    imageIntelligenceEngine: boolean;
    videoIntelligenceEngine: boolean;
    videoGenerationFoundation: boolean;
    storyboardGeneration: boolean;
    sceneGeneration: boolean;
    cameraDirector: boolean;
    motionGeneration: boolean;
    animation: boolean;
    visualEffects: boolean;
    audioSynchronization: boolean;
    marketingVideo: boolean;
    allDependenciesReady: boolean;
    missingDependencies: string[];
}
export interface ProductionTimelinePlan {
    sceneTimeline: string[];
    cameraTimeline: string[];
    motionTimeline: string[];
    animationTimeline: string[];
    audioTimeline: string[];
    effectsTimeline: string[];
    subtitleTimeline: string[];
    renderingTimeline: string[];
}
export interface RenderPreparationPlan {
    resolution: string;
    fps: string;
    aspectRatio: string;
    codec: string;
    bitrate: string;
    audioFormat: string;
    hdr: string;
    colorSpace: string;
    compressionStrategy: string;
    renderPriority: string;
}
export interface ExportFormatPlan {
    format: ExportFormat;
    profile: string;
    notes: string[];
}
export interface ExportPreparationPlan {
    primaryFormat: ExportFormat;
    formats: ExportFormatPlan[];
    deliveryNotes: string;
}
export interface DeliveryInstructionsPlan {
    platformDelivery: string;
    fileNaming: string;
    metadataEmbedding: string;
    captionDelivery: string;
}
export interface RecoveryPlan {
    checkpointStrategy: string;
    rollbackPoints: string[];
    failureRecovery: string;
    assetRecovery: string;
}
export interface ProductionWorkflowPlan {
    workflowStages: string[];
    executionOrder: string[];
    validationGates: string[];
}
export interface PlatformProductionOptimization {
    platform: StoryboardGenerationPlatform;
    resolution: string;
    aspectRatio: string;
    maxDuration: string;
    notes: string[];
}
export interface VideoProductionScores {
    productionReadinessScore: number;
    assetReadinessScore: number;
    workflowScore: number;
    timelineScore: number;
    dependencyScore: number;
    performanceScore: number;
    aiConfidenceScore: number;
}
export interface VideoProductionRelationships {
    storyboards: string[];
    productionPlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    motionPlans: string[];
    cameraPlans: string[];
    animationPlans: string[];
    visualEffectPlans: string[];
    audioPlans: string[];
    marketingPlans: string[];
    knowledgeRecords: string[];
}
export interface VideoProductionInput {
    storyboardId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    marketingVideoId?: string;
    knowledgeRecordIds?: string[];
    platform?: StoryboardGenerationPlatform;
}
export interface VideoProductionRecord {
    productionId: string;
    profile: ProductionProfile;
    planType: ProductionPlanType;
    workflowValidation: WorkflowValidationPlan;
    assetValidation: AssetValidationPlan;
    dependencyValidation: DependencyValidationPlan;
    productionTimeline: ProductionTimelinePlan;
    renderPreparation: RenderPreparationPlan;
    exportPreparation: ExportPreparationPlan;
    deliveryInstructions: DeliveryInstructionsPlan;
    recoveryPlan: RecoveryPlan;
    productionWorkflow: ProductionWorkflowPlan;
    platformOptimizations: PlatformProductionOptimization[];
    scores: VideoProductionScores;
    relationships: VideoProductionRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface VideoProductionResult {
    success: boolean;
    plans?: VideoProductionRecord[];
    record?: VideoProductionRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface VideoProductionSearchQuery {
    productionId?: string;
    storyboardId?: string;
    videoId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: StoryboardGenerationPlatform;
    workflow?: string;
    asset?: string;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface VideoProductionEngineStatusReport {
    engineStatus: string;
    workflowStatus: string;
    assetStatus: string;
    timelineStatus: string;
    productionPlansGenerated: number;
    averageProductionReadinessScore: number;
    averageAssetReadinessScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
        averageValidationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoProductionEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const PRODUCTION_PLATFORM_TARGETS: StoryboardGenerationPlatform[];
export declare const PLATFORM_PRODUCTION_CONFIG: Record<StoryboardGenerationPlatform, {
    resolution: string;
    aspectRatio: string;
    maxDuration: string;
}>;
export declare const SUPPORTED_EXPORT_FORMATS: ExportFormat[];
//# sourceMappingURL=types.d.ts.map