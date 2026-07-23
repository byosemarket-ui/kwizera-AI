/**
 * KWIZERA AI STUDIO — AI Image Generation Foundation types (Step 9A)
 */
export declare enum ImageGenerationLifecycleState {
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
export declare enum ImageGenerationCategory {
    TextToImage = "text-to-image-generation",
    ImageToImage = "image-to-image-generation",
    ProductImageGeneration = "product-image-generation",
    BackgroundGeneration = "background-generation",
    ImageEditing = "image-editing-generation",
    Inpainting = "inpainting-generation",
    Outpainting = "outpainting-generation",
    ImageEnhancement = "image-enhancement-generation",
    BrandingDesign = "branding-design-generation",
    MultiStyleImageGeneration = "multi-style-image-generation",
    ImageProduction = "image-production",
    RenderingPlanning = "image-rendering-planning",
    ImageQualityValidation = "image-quality-validation",
    ImageGenerationOptimization = "image-generation-optimization",
    ExportPlanning = "image-export-planning",
    BatchGeneration = "batch-image-generation",
    DistributedGeneration = "distributed-image-generation",
    CloudGeneration = "cloud-image-generation-preparation",
    GenerationHealthMonitoring = "image-generation-health-monitor"
}
export declare enum ImageGenerationModuleStatus {
    Prepared = "prepared",
    Registered = "registered",
    Active = "active",
    Disabled = "disabled",
    Validating = "validating",
    Recovering = "recovering",
    Failed = "failed"
}
export declare enum ImageGenerationHealthLevel {
    Excellent = "excellent",
    Good = "good",
    Warning = "warning",
    Critical = "critical",
    Failed = "failed"
}
export declare enum ImageGenerationSource {
    MemoryEngine = "memory-engine",
    KnowledgeEngine = "knowledge-engine",
    ProductIntelligenceEngine = "product-intelligence-engine",
    ImageIntelligenceEngine = "image-intelligence-engine",
    VideoIntelligenceEngine = "video-intelligence-engine",
    VideoGenerationEngine = "video-generation-engine",
    ProductionPlan = "production-plan",
    Prompt = "prompt",
    Template = "template",
    UserInput = "user-input",
    System = "system",
    Manual = "manual"
}
export declare enum ImageGenerationVerificationStatus {
    Unverified = "unverified",
    Pending = "pending",
    Verified = "verified",
    Rejected = "rejected",
    Archived = "archived"
}
export declare enum ImageGenerationAccessPermission {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Validate = "validate",
    Admin = "admin"
}
export declare enum ImageGenerationAccessOperation {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Validate = "validate",
    Query = "query"
}
export declare enum ImageGenerationAssetType {
    Prompt = "prompt",
    Image = "image",
    ProductImage = "product-image",
    Character = "character",
    Background = "background",
    Logo = "logo",
    BrandAsset = "brand-asset",
    Style = "style",
    Template = "template",
    Mask = "mask",
    Layer = "layer",
    Variation = "variation",
    RenderProfile = "render-profile"
}
export declare enum ImageGenerationBlueprintStage {
    TextToImage = "text-to-image",
    ImageToImage = "image-to-image",
    ProductImageGeneration = "product-image-generation",
    BackgroundGeneration = "background-generation",
    ImageEditing = "image-editing",
    Inpainting = "inpainting",
    Outpainting = "outpainting",
    ImageEnhancement = "image-enhancement",
    BrandingDesign = "branding-design",
    MultiStyleImageGeneration = "multi-style-image-generation",
    ImageProduction = "image-production",
    RenderingPlanning = "rendering-planning",
    ImageQualityValidation = "image-quality-validation",
    ImageGenerationOptimization = "image-generation-optimization",
    ExportPlanning = "export-planning"
}
export declare enum ImageGenerationWorkflowActionType {
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
export declare enum ImageGenerationPlatformTarget {
    Instagram = "instagram",
    Pinterest = "pinterest",
    Facebook = "facebook",
    Website = "website",
    Ecommerce = "ecommerce",
    Print = "print",
    Custom = "custom"
}
export declare enum ImageGenerationResolutionTarget {
    Thumbnail = "thumbnail",
    Standard = "standard",
    High = "high",
    Ultra = "ultra",
    Print = "print",
    Custom = "custom"
}
export interface ImageGenerationVersionEntry {
    version: number;
    timestamp: string;
    changeSummary: string;
    source: ImageGenerationSource;
}
export interface ImageGenerationQualityMetadata {
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: ImageGenerationVerificationStatus;
    source: ImageGenerationSource;
    sourceRef?: string;
    versionHistory: ImageGenerationVersionEntry[];
    relationshipLinks: string[];
    healthStatus: ImageGenerationHealthLevel;
    lastValidated?: string;
}
export interface ImageGenerationModuleRegistration {
    moduleId: string;
    moduleName: string;
    version: string;
    status: ImageGenerationModuleStatus;
    dependencies: string[];
    qualityScore: number;
    confidenceScore: number;
    healthStatus: ImageGenerationHealthLevel;
    createdAt: string;
    lastUpdated: string;
    accessPermissions: ImageGenerationAccessPermission[];
    category: ImageGenerationCategory;
    storageLocation: string;
    implemented: boolean;
}
export interface ImageGenerationRegistrySnapshot {
    foundationVersion: string;
    storageRoot: string;
    lastUpdated: string;
    modules: ImageGenerationModuleRegistration[];
}
export interface ImageGenerationIntegrityResult {
    verified: boolean;
    checkedPaths: number;
    issues: string[];
    checksumVerified: boolean;
    blueprintIntegrity: boolean;
    timestamp: string;
}
export interface ImageGenerationAccessRequest {
    requesterId: string;
    category: ImageGenerationCategory;
    operation: ImageGenerationAccessOperation;
    resourceId?: string;
}
export interface ImageGenerationAccessResult {
    granted: boolean;
    message: string;
    durationMs: number;
}
export interface ImageGenerationValidationResult {
    valid: boolean;
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: ImageGenerationVerificationStatus;
    issues: string[];
    recommendations: string[];
    durationMs: number;
}
export interface ImageGenerationIntegrationStatus {
    aiCore: boolean;
    memoryEngine: boolean;
    knowledgeEngine: boolean;
    productIntelligenceEngine: boolean;
    imageIntelligenceEngine: boolean;
    videoIntelligenceEngine: boolean;
    imageGenerationEngine: boolean;
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
export interface ImageGenerationHealthReport {
    level: ImageGenerationHealthLevel;
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
export interface ImageGenerationAssetRegistration {
    assetId: string;
    assetType: ImageGenerationAssetType;
    assetName: string;
    projectId: string;
    imageId?: string;
    promptId?: string;
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: ImageGenerationVerificationStatus;
    source: ImageGenerationSource;
    sourceRef?: string;
    relationshipLinks: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedKnowledge: string[];
    relatedProductionPlans: string[];
    relatedVideos: string[];
    relatedPrompts: string[];
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageGenerationBlueprintStageEntry {
    stage: ImageGenerationBlueprintStage;
    enabled: boolean;
    order: number;
    dependencies: ImageGenerationBlueprintStage[];
    qualityScore: number;
    readinessScore: number;
    lastUpdated: string;
}
export interface ImageGenerationBlueprint {
    blueprintId: string;
    projectId: string;
    name: string;
    stages: ImageGenerationBlueprintStageEntry[];
    multiProject: boolean;
    multiImage: boolean;
    multiLanguage: boolean;
    multiPlatform: boolean;
    multiResolution: boolean;
    batchGeneration: boolean;
    distributedGeneration: boolean;
    cloudGenerationPrepared: boolean;
    integrityVerified: boolean;
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageGenerationProjectRegistration {
    projectId: string;
    projectName: string;
    description: string;
    brand?: string;
    product?: string;
    campaign?: string;
    languages: string[];
    platforms: ImageGenerationPlatformTarget[];
    resolutions: ImageGenerationResolutionTarget[];
    imageIds: string[];
    promptIds: string[];
    blueprintId?: string;
    productionPlanId?: string;
    qualityScore: number;
    confidenceScore: number;
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageGenerationWorkflowEditEntry {
    editId: string;
    projectId: string;
    imageId?: string;
    actionType: ImageGenerationWorkflowActionType;
    summary: string;
    beforeStateRef: string;
    afterStateRef: string;
    reversible: boolean;
    timestamp: string;
    version: number;
}
export interface ImageGenerationWorkflowState {
    projectId: string;
    imageId?: string;
    originalPreserved: boolean;
    currentVersion: number;
    undoStack: string[];
    redoStack: string[];
    editHistory: ImageGenerationWorkflowEditEntry[];
    lastUpdated: string;
}
export interface ImageGenerationFoundationStatusReport {
    foundationStatus: string;
    lifecycleState: ImageGenerationLifecycleState;
    registryStatus: string;
    storageStatus: string;
    persistenceStatus: string;
    integrityStatus: string;
    healthLevel: ImageGenerationHealthLevel;
    integrationStatus: ImageGenerationIntegrationStatus;
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
export declare class ImageGenerationFoundationError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map