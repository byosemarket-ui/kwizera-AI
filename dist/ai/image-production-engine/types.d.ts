/**
 * KWIZERA AI STUDIO — Image Production Engine types (Step 9J)
 */
export declare enum ImageProductionPlatform {
    Website = "website",
    Mobile = "mobile",
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    LinkedIn = "linkedin",
    Print = "print",
    Packaging = "packaging",
    Billboard = "billboard"
}
export declare enum ImageProductionWorkflowStage {
    TextToImage = "text-to-image",
    ImageToImage = "image-to-image",
    ProductImageGeneration = "product-image-generation",
    BackgroundGeneration = "background-generation",
    ImageEditing = "image-editing",
    ImageEnhancement = "image-enhancement",
    Branding = "branding",
    MultiStyleGeneration = "multi-style-generation",
    ProductionWorkflow = "production-workflow"
}
export declare enum ImageProductionAssetType {
    SourceImage = "source-image",
    GeneratedImage = "generated-image",
    Logo = "logo",
    Font = "font",
    Icon = "icon",
    Template = "template",
    Layer = "layer",
    Mask = "mask",
    Texture = "texture",
    BrandAsset = "brand-asset",
    ColorProfile = "color-profile",
    Metadata = "metadata"
}
export declare enum ImageProductionDependency {
    MemoryEngine = "memory-engine",
    KnowledgeEngine = "knowledge-engine",
    ProductIntelligenceEngine = "product-intelligence-engine",
    ImageIntelligenceEngine = "image-intelligence-engine",
    VideoIntelligenceEngine = "video-intelligence-engine",
    ImageGenerationFoundation = "image-generation-foundation",
    TextToImageEngine = "text-to-image-generation-engine",
    ImageToImageEngine = "image-to-image-generation-engine",
    ProductImageEngine = "product-image-generation-engine",
    BackgroundEngine = "background-generation-engine",
    ImageEditingEngine = "image-editing-generation-engine",
    EnhancementEngine = "image-enhancement-generation-engine",
    BrandingEngine = "branding-design-generation-engine",
    MultiStyleEngine = "multi-style-image-generation-engine"
}
export declare enum ImageProductionExportFormat {
    Png = "png",
    Jpg = "jpg",
    Webp = "webp",
    Tiff = "tiff",
    Svg = "svg",
    Pdf = "pdf"
}
export declare enum ImageProductionColorSpace {
    Rgb = "rgb",
    Cmyk = "cmyk"
}
export interface ImageProductionProfile {
    imageProductionId: string;
    projectId: string;
    imagePlanId: string;
    productId: string;
    brandId: string;
    campaignId: string;
    platform: ImageProductionPlatform;
    productionVersion: number;
    language: string;
}
export interface WorkflowValidationEntry {
    stage: ImageProductionWorkflowStage;
    validated: boolean;
    moduleId: string;
    status: string;
    notes: string[];
}
export interface AssetValidationEntry {
    assetType: ImageProductionAssetType;
    assetId: string;
    validated: boolean;
    source: string;
    notes: string[];
}
export interface DependencyValidationEntry {
    dependency: ImageProductionDependency;
    available: boolean;
    moduleId?: string;
    notes: string[];
}
export interface ProductionLayerEntry {
    layerId: string;
    name: string;
    order: number;
    type: string;
    visible: boolean;
    locked: boolean;
}
export interface ProductionMaskEntry {
    maskId: string;
    layerId: string;
    type: string;
    validated: boolean;
}
export interface ProductionStructure {
    layerStructure: ProductionLayerEntry[];
    maskStructure: ProductionMaskEntry[];
    objectHierarchy: string[];
    assetHierarchy: string[];
    colorManagement: {
        primaryColorSpace: ImageProductionColorSpace;
        iccProfile: string;
        brandColors: string[];
    };
    metadataStructure: Record<string, string>;
    versionStructure: {
        currentVersion: number;
        historyRef: string;
    };
}
export interface RenderPreparationPlan {
    resolution: string;
    dpi: number;
    aspectRatio: string;
    colorSpace: ImageProductionColorSpace;
    rgbProfile: string;
    cmykProfile: string;
    iccProfiles: string[];
    compressionStrategy: string;
    outputQuality: number;
    instructions: string[];
}
export interface ExportPreparationEntry {
    format: ImageProductionExportFormat;
    enabled: boolean;
    quality: number;
    colorSpace: ImageProductionColorSpace;
    notes: string[];
}
export interface ExportPreparationPlan {
    exports: ExportPreparationEntry[];
    extensibleFormats: string[];
}
export interface DeliveryInstructions {
    platform: ImageProductionPlatform;
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
    platform: ImageProductionPlatform;
    resolution: string;
    aspectRatio: string;
    exportFormats: ImageProductionExportFormat[];
    rules: string[];
}
export interface ImageProductionScores {
    productionReadinessScore: number;
    assetReadinessScore: number;
    workflowScore: number;
    layerIntegrityScore: number;
    dependencyScore: number;
    performanceScore: number;
    aiConfidenceScore: number;
}
export interface ImageProductionRelationships {
    imagePlans: string[];
    productionPlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    templates: string[];
    knowledgeRecords: string[];
    stylePlans: string[];
    brandingPlans: string[];
    productImagePlans: string[];
    generatedImages: string[];
    sourceImages: string[];
}
export interface ImageProductionInput {
    productId?: string;
    projectId?: string;
    imagePlanId?: string;
    stylePlanId?: string;
    brandingPlanId?: string;
    productImagePlanId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: ImageProductionPlatform;
    language?: string;
    templateIds?: string[];
    knowledgeRecordIds?: string[];
    validateAllWorkflows?: boolean;
    validateAllAssets?: boolean;
    prepareExports?: boolean;
    preparePlatformRules?: boolean;
}
export interface ImageProductionRecord {
    imageProductionId: string;
    profile: ImageProductionProfile;
    workflowValidation: WorkflowValidationEntry[];
    assetValidation: AssetValidationEntry[];
    dependencyValidation: DependencyValidationEntry[];
    productionStructure: ProductionStructure;
    renderPreparation: RenderPreparationPlan;
    exportPreparation: ExportPreparationPlan;
    deliveryInstructions: DeliveryInstructions;
    recoveryPlan: RecoveryPlan;
    platformRules: PlatformProductionRules[];
    blueprintId?: string;
    scores: ImageProductionScores;
    relationships: ImageProductionRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageProductionResult {
    success: boolean;
    record?: ImageProductionRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageProductionSearchQuery {
    imageProductionId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: ImageProductionPlatform;
    assetId?: string;
    templateId?: string;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface ImageProductionEngineStatusReport {
    engineStatus: string;
    workflowValidationStatus: string;
    assetValidationStatus: string;
    dependencyValidationStatus: string;
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
export declare class ImageProductionEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_IMAGE_PRODUCTION_PLATFORMS: ImageProductionPlatform[];
export declare const ALL_IMAGE_PRODUCTION_WORKFLOW_STAGES: ImageProductionWorkflowStage[];
export declare const ALL_IMAGE_PRODUCTION_ASSET_TYPES: ImageProductionAssetType[];
export declare const ALL_IMAGE_PRODUCTION_DEPENDENCIES: ImageProductionDependency[];
export declare const ALL_IMAGE_PRODUCTION_EXPORT_FORMATS: ImageProductionExportFormat[];
export declare const IMAGE_PRODUCTION_PLATFORM_CONFIG: Record<ImageProductionPlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
    dpi: number;
}>;
export declare const WORKFLOW_MODULE_MAP: Record<ImageProductionWorkflowStage, string>;
export declare const DEPENDENCY_MODULE_MAP: Partial<Record<ImageProductionDependency, string>>;
//# sourceMappingURL=types.d.ts.map