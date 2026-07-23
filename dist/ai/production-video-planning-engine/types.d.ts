/**
 * KWIZERA AI STUDIO — Production Video Planning Engine types (Step 7K)
 */
export declare enum ProductionVideoPlatform {
    TikTok = "tiktok",
    Instagram = "instagram",
    Facebook = "facebook",
    YouTube = "youtube",
    WhatsApp = "whatsapp",
    Website = "website",
    Television = "television",
    DigitalSignage = "digital-signage"
}
export declare enum ProductionVideoWorkflowStep {
    AnalysisValidation = "analysis-validation",
    UnderstandingValidation = "understanding-validation",
    SceneValidation = "scene-validation",
    TimelineValidation = "timeline-validation",
    CameraValidation = "camera-validation",
    MotionValidation = "motion-validation",
    StyleValidation = "style-validation",
    EnhancementValidation = "enhancement-validation",
    CreativeValidation = "creative-validation",
    RenderingPreparation = "rendering-preparation",
    ExportPreparation = "export-preparation",
    DeliveryPreparation = "delivery-preparation"
}
export declare enum ProductionVideoExportFormat {
    MP4 = "mp4",
    MOV = "mov",
    MKV = "mkv",
    WEBM = "webm",
    GIF = "gif"
}
export interface ProductionVideoProfile {
    productionPlanId: string;
    projectId: string;
    videoId: string;
    product: string;
    brand: string;
    campaign: string;
    platform: ProductionVideoPlatform;
    productionVersion: number;
}
export interface ProductionVideoWorkflowPlanning {
    analysisValidation: string;
    understandingValidation: string;
    sceneValidation: string;
    timelineValidation: string;
    cameraValidation: string;
    motionValidation: string;
    styleValidation: string;
    enhancementValidation: string;
    creativeValidation: string;
    renderingPreparation: string;
    exportPreparation: string;
    deliveryPreparation: string;
}
export interface ProductionVideoAssetItem {
    assetType: string;
    assetId: string;
    source: string;
    status: "ready" | "planned" | "missing";
    validationNote: string;
}
export interface ProductionVideoAssetInventory {
    sourceVideos: ProductionVideoAssetItem[];
    images: ProductionVideoAssetItem[];
    audio: ProductionVideoAssetItem[];
    voice: ProductionVideoAssetItem[];
    music: ProductionVideoAssetItem[];
    soundEffects: ProductionVideoAssetItem[];
    logos: ProductionVideoAssetItem[];
    fonts: ProductionVideoAssetItem[];
    templates: ProductionVideoAssetItem[];
    motionGraphics: ProductionVideoAssetItem[];
    effects: ProductionVideoAssetItem[];
    luts: ProductionVideoAssetItem[];
    captions: ProductionVideoAssetItem[];
    subtitles: ProductionVideoAssetItem[];
    brandAssets: ProductionVideoAssetItem[];
}
export interface ProductionVideoDependencyCheck {
    moduleId: string;
    moduleName: string;
    required: boolean;
    present: boolean;
    validated: boolean;
    status: "passed" | "missing" | "invalid";
    detail: string;
}
export interface ProductionVideoDependencyValidation {
    checks: ProductionVideoDependencyCheck[];
    allRequiredPassed: boolean;
    passedCount: number;
    totalRequired: number;
}
export interface ProductionVideoRenderPreparation {
    resolution: string;
    frameRate: number;
    aspectRatio: string;
    codec: string;
    bitrate: string;
    audioFormat: string;
    colorProfile: string;
    compressionStrategy: string;
    renderPriority: string;
}
export interface ProductionVideoExportPreparation {
    mp4: string;
    mov: string;
    mkv: string;
    webm: string;
    gif: string;
    additionalFormatsSupported: boolean;
}
export interface ProductionVideoDeliveryInstructions {
    primaryPlatform: ProductionVideoPlatform;
    deliveryNotes: string[];
    packagingStrategy: string;
}
export interface ProductionVideoPlatformRules {
    tiktok: string;
    instagram: string;
    facebook: string;
    youtube: string;
    whatsapp: string;
    website: string;
    television: string;
    digitalSignage: string;
}
export interface ProductionVideoRecoveryPlan {
    dependencyRecovery: string;
    assetRecovery: string;
    workflowRecovery: string;
    renderRecovery: string;
    exportRecovery: string;
    rollbackStrategy: string;
}
export interface ProductionVideoPlanningScores {
    productionReadinessScore: number;
    assetReadinessScore: number;
    workflowScore: number;
    dependencyScore: number;
    performanceScore: number;
    aiConfidenceScore: number;
}
export interface ProductionVideoPlanningRelationships {
    relatedStoryboards: string[];
    relatedProductionPlans: string[];
    relatedEnhancementPlans: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedScripts: string[];
    relatedKnowledge: string[];
    relatedProductionHistory: string[];
    relatedProjects: string[];
}
export interface ProductionVideoPlanningRecommendation {
    category: "workflow" | "asset" | "dependency" | "render" | "export" | "delivery" | "recovery" | "platform";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface ProductionVideoPlanningInput {
    videoId: string;
    projectId?: string;
    campaign?: string;
    platform?: ProductionVideoPlatform;
    workflowSteps?: ProductionVideoWorkflowStep[];
    exportFormats?: ProductionVideoExportFormat[];
    relatedProjects?: string[];
    relatedKnowledge?: string[];
    relatedScripts?: string[];
    keywords?: string[];
}
export interface ProductionVideoPlanningRecord {
    videoId: string;
    intelligenceId: string;
    analysisId: string;
    understandingId: string;
    detectionId: string;
    timelineId: string;
    cameraId: string;
    motionId: string;
    styleId: string;
    enhancementPlanId: string;
    creativePlanId: string;
    profile: ProductionVideoProfile;
    workflow: ProductionVideoWorkflowPlanning;
    assets: ProductionVideoAssetInventory;
    dependencies: ProductionVideoDependencyValidation;
    renderPreparation: ProductionVideoRenderPreparation;
    exportPreparation: ProductionVideoExportPreparation;
    deliveryInstructions: ProductionVideoDeliveryInstructions;
    platformRules: ProductionVideoPlatformRules;
    recoveryPlan: ProductionVideoRecoveryPlan;
    scores: ProductionVideoPlanningScores;
    relationships: ProductionVideoPlanningRelationships;
    recommendations: ProductionVideoPlanningRecommendation[];
    keywords: string[];
    productionReady: boolean;
    validated: boolean;
    plannedAt: string;
    lastUpdated: string;
    version: number;
}
export interface ProductionVideoPlanningResult {
    success: boolean;
    record?: ProductionVideoPlanningRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ProductionVideoPlanningSearchQuery {
    productionPlanId?: string;
    videoId?: string;
    brand?: string;
    product?: string;
    campaign?: string;
    platform?: ProductionVideoPlatform;
    workflow?: ProductionVideoWorkflowStep;
    asset?: string;
    minReadinessScore?: number;
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface ProductionVideoPlanningEngineStatusReport {
    engineStatus: string;
    workflowPlanningStatus: string;
    assetValidationStatus: string;
    dependencyValidationStatus: string;
    renderPreparationStatus: string;
    exportPreparationStatus: string;
    deliveryPreparationStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imageIntelligenceBridgeStatus: string;
    plansCreated: number;
    averageProductionReadinessScore: number;
    averageAssetReadinessScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ProductionVideoPlanningEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map