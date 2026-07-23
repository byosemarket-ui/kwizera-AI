/**
 * KWIZERA AI STUDIO — AI Video Generation Foundation types (Step 8A)
 */
export declare enum VideoGenerationLifecycleState {
    Initializing = "initializing",
    Loading = "loading",
    Ready = "ready",
    Preparing = "preparing",
    Generating = "generating",
    Validating = "validating",
    Optimizing = "optimizing",
    RenderPreparation = "render-preparation",
    ExportPreparation = "export-preparation",
    Archiving = "archiving",
    Recovering = "recovering",
    Closing = "closing",
    Closed = "closed"
}
export declare enum VideoGenerationCategory {
    StoryGeneration = "story-generation",
    SceneGeneration = "scene-generation",
    ShotGeneration = "shot-generation",
    CameraPlanning = "camera-planning-generation",
    MotionPlanning = "motion-planning-generation",
    AnimationPlanning = "animation-planning-generation",
    VisualEffectsPlanning = "visual-effects-planning-generation",
    AudioSynchronization = "audio-sync-generation",
    MarketingVideoPlanning = "marketing-video-generation",
    VideoProductionPlanning = "video-production-generation",
    RenderingPlanning = "rendering-planning-generation",
    VideoQualityValidation = "video-quality-validation",
    VideoGenerationOptimization = "video-generation-optimization",
    ExportPlanning = "export-planning-generation",
    BatchGeneration = "batch-generation",
    DistributedGeneration = "distributed-generation",
    CloudGeneration = "cloud-generation-preparation",
    GenerationHealthMonitoring = "generation-health-monitor"
}
export declare enum VideoGenerationModuleStatus {
    Prepared = "prepared",
    Registered = "registered",
    Active = "active",
    Disabled = "disabled",
    Validating = "validating",
    Recovering = "recovering",
    Failed = "failed"
}
export declare enum VideoGenerationHealthLevel {
    Excellent = "excellent",
    Good = "good",
    Warning = "warning",
    Critical = "critical",
    Failed = "failed"
}
export declare enum VideoGenerationSource {
    MemoryEngine = "memory-engine",
    KnowledgeEngine = "knowledge-engine",
    ProductIntelligenceEngine = "product-intelligence-engine",
    ImageIntelligenceEngine = "image-intelligence-engine",
    VideoIntelligenceEngine = "video-intelligence-engine",
    ProductionPlan = "production-plan",
    Storyboard = "storyboard",
    Script = "script",
    UserInput = "user-input",
    System = "system",
    Manual = "manual"
}
export declare enum VideoGenerationVerificationStatus {
    Unverified = "unverified",
    Pending = "pending",
    Verified = "verified",
    Rejected = "rejected",
    Archived = "archived"
}
export declare enum VideoGenerationAccessPermission {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Validate = "validate",
    Admin = "admin"
}
export declare enum VideoGenerationAccessOperation {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Validate = "validate",
    Query = "query"
}
export declare enum GenerationAssetType {
    Storyboard = "storyboard",
    Script = "script",
    Scene = "scene",
    Timeline = "timeline",
    CameraPlan = "camera-plan",
    MotionPlan = "motion-plan",
    Character = "character",
    Background = "background",
    Image = "image",
    Audio = "audio",
    Voice = "voice",
    Music = "music",
    Effect = "effect",
    Transition = "transition",
    Template = "template",
    ExportProfile = "export-profile"
}
export declare enum GenerationBlueprintStage {
    StoryGeneration = "story-generation",
    SceneGeneration = "scene-generation",
    ShotGeneration = "shot-generation",
    CameraPlanning = "camera-planning",
    MotionPlanning = "motion-planning",
    AnimationPlanning = "animation-planning",
    VisualEffectsPlanning = "visual-effects-planning",
    AudioSynchronization = "audio-synchronization",
    MarketingVideoPlanning = "marketing-video-planning",
    VideoProductionPlanning = "video-production-planning",
    RenderingPlanning = "rendering-planning",
    VideoQualityValidation = "video-quality-validation",
    VideoGenerationOptimization = "video-generation-optimization",
    ExportPlanning = "export-planning"
}
export declare enum GenerationWorkflowActionType {
    Generate = "generate",
    Edit = "edit",
    Replace = "replace",
    Sync = "sync",
    Plan = "plan",
    Validate = "validate",
    Optimize = "optimize",
    Restore = "restore",
    Rollback = "rollback"
}
export declare enum GenerationPlatformTarget {
    YouTube = "youtube",
    Instagram = "instagram",
    TikTok = "tiktok",
    Facebook = "facebook",
    Website = "website",
    Broadcast = "broadcast",
    Custom = "custom"
}
export interface VideoGenerationVersionEntry {
    version: number;
    timestamp: string;
    changeSummary: string;
    source: VideoGenerationSource;
}
export interface VideoGenerationQualityMetadata {
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: VideoGenerationVerificationStatus;
    source: VideoGenerationSource;
    sourceRef?: string;
    versionHistory: VideoGenerationVersionEntry[];
    relationshipLinks: string[];
    healthStatus: VideoGenerationHealthLevel;
    lastValidated?: string;
}
export interface VideoGenerationModuleRegistration {
    moduleId: string;
    moduleName: string;
    version: string;
    status: VideoGenerationModuleStatus;
    dependencies: string[];
    qualityScore: number;
    confidenceScore: number;
    healthStatus: VideoGenerationHealthLevel;
    createdAt: string;
    lastUpdated: string;
    accessPermissions: VideoGenerationAccessPermission[];
    category: VideoGenerationCategory;
    storageLocation: string;
    implemented: boolean;
}
export interface VideoGenerationRegistrySnapshot {
    foundationVersion: string;
    storageRoot: string;
    lastUpdated: string;
    modules: VideoGenerationModuleRegistration[];
}
export interface VideoGenerationIntegrityResult {
    verified: boolean;
    checkedPaths: number;
    issues: string[];
    checksumVerified: boolean;
    blueprintIntegrity: boolean;
    timestamp: string;
}
export interface VideoGenerationAccessRequest {
    requesterId: string;
    category: VideoGenerationCategory;
    operation: VideoGenerationAccessOperation;
    resourceId?: string;
}
export interface VideoGenerationAccessResult {
    granted: boolean;
    message: string;
    durationMs: number;
}
export interface VideoGenerationValidationResult {
    valid: boolean;
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: VideoGenerationVerificationStatus;
    issues: string[];
    recommendations: string[];
    durationMs: number;
}
export interface VideoGenerationIntegrationStatus {
    aiCore: boolean;
    memoryEngine: boolean;
    knowledgeEngine: boolean;
    productIntelligenceEngine: boolean;
    imageIntelligenceEngine: boolean;
    videoIntelligenceEngine: boolean;
    decisionEngine: boolean;
    reasoningEngine: boolean;
    planningEngine: boolean;
    workflowEngine: boolean;
    stateManager: boolean;
    recoveryEngine: boolean;
    healthMonitor: boolean;
    readyCount: number;
    totalCount: number;
}
export interface VideoGenerationHealthReport {
    level: VideoGenerationHealthLevel;
    score: number;
    availability: boolean;
    storageIntegrity: boolean;
    registryHealth: boolean;
    assetRegistryHealth: boolean;
    blueprintHealth: boolean;
    workflowHealth: boolean;
    qualityValidation: boolean;
    integrationReady: boolean;
    readPerformanceMs: number;
    writePerformanceMs: number;
    issues: string[];
    timestamp: string;
}
export interface GenerationAssetRegistration {
    assetId: string;
    assetType: GenerationAssetType;
    assetName: string;
    projectId: string;
    videoId?: string;
    sceneId?: string;
    timelineId?: string;
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: VideoGenerationVerificationStatus;
    source: VideoGenerationSource;
    sourceRef?: string;
    relationshipLinks: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedKnowledge: string[];
    relatedProductionPlans: string[];
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface GenerationBlueprintStageEntry {
    stage: GenerationBlueprintStage;
    enabled: boolean;
    order: number;
    dependencies: GenerationBlueprintStage[];
    qualityScore: number;
    readinessScore: number;
    lastUpdated: string;
}
export interface GenerationBlueprint {
    blueprintId: string;
    projectId: string;
    name: string;
    stages: GenerationBlueprintStageEntry[];
    multiProject: boolean;
    multiVideo: boolean;
    multiScene: boolean;
    multiTimeline: boolean;
    multiLanguage: boolean;
    multiPlatform: boolean;
    batchGeneration: boolean;
    distributedGeneration: boolean;
    cloudGenerationPrepared: boolean;
    integrityVerified: boolean;
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface GenerationProjectRegistration {
    projectId: string;
    projectName: string;
    description: string;
    brand?: string;
    product?: string;
    campaign?: string;
    languages: string[];
    platforms: GenerationPlatformTarget[];
    videoIds: string[];
    sceneIds: string[];
    timelineIds: string[];
    blueprintId?: string;
    productionPlanId?: string;
    qualityScore: number;
    confidenceScore: number;
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface GenerationWorkflowEditEntry {
    editId: string;
    projectId: string;
    videoId?: string;
    actionType: GenerationWorkflowActionType;
    summary: string;
    beforeStateRef: string;
    afterStateRef: string;
    reversible: boolean;
    timestamp: string;
    version: number;
}
export interface GenerationWorkflowState {
    projectId: string;
    videoId?: string;
    originalPreserved: boolean;
    currentVersion: number;
    undoStack: string[];
    redoStack: string[];
    editHistory: GenerationWorkflowEditEntry[];
    lastUpdated: string;
}
export interface VideoGenerationFoundationStatusReport {
    foundationStatus: string;
    lifecycleState: VideoGenerationLifecycleState;
    registryStatus: string;
    storageStatus: string;
    persistenceStatus: string;
    integrityStatus: string;
    healthLevel: VideoGenerationHealthLevel;
    integrationStatus: VideoGenerationIntegrationStatus;
    registeredModules: number;
    preparedModules: number;
    assetCount: number;
    projectCount: number;
    blueprintCount: number;
    performance: {
        startupMs: number;
        averageReadMs: number;
        averageWriteMs: number;
        averageValidationMs: number;
        totalAccessRequests: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoGenerationFoundationError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map