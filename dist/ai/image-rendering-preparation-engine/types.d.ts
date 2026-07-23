/**
 * KWIZERA AI STUDIO — Image Rendering Preparation Engine types (Step 9K)
 */
export declare enum ImageRenderPlatform {
    Website = "website",
    Mobile = "mobile",
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    LinkedIn = "linkedin",
    Print = "print",
    Packaging = "packaging",
    Catalogue = "catalogue",
    Billboard = "billboard"
}
export declare enum ImageRenderValidationStage {
    TextToImage = "text-to-image",
    ImageToImage = "image-to-image",
    ProductImageGeneration = "product-image-generation",
    BackgroundGeneration = "background-generation",
    ImageEditing = "image-editing",
    ImageEnhancement = "image-enhancement",
    Branding = "branding",
    MultiStyleGeneration = "multi-style-generation",
    ProductionPlans = "production-plans"
}
export declare enum ImageRenderLayerCheck {
    LayerHierarchy = "layer-hierarchy",
    LayerOrder = "layer-order",
    LayerVisibility = "layer-visibility",
    LayerGroups = "layer-groups",
    BlendModes = "blend-modes",
    Opacity = "opacity",
    ClippingMasks = "clipping-masks"
}
export declare enum ImageRenderMaskType {
    SubjectMask = "subject-mask",
    ObjectMask = "object-mask",
    BackgroundMask = "background-mask",
    LayerMask = "layer-mask",
    AlphaMask = "alpha-mask",
    EditableRegion = "editable-region"
}
export declare enum ImageRenderAssetType {
    SourceImage = "source-image",
    GeneratedImage = "generated-image",
    Logo = "logo",
    Font = "font",
    Icon = "icon",
    Template = "template",
    Texture = "texture",
    BrandAsset = "brand-asset",
    IccProfile = "icc-profile",
    Metadata = "metadata"
}
export declare enum ImageRenderColorSpace {
    Rgb = "rgb",
    Cmyk = "cmyk"
}
export interface ImageRenderPlanProfile {
    imageRenderPlanId: string;
    projectId: string;
    productionId: string;
    imageId: string;
    platform: ImageRenderPlatform;
    renderVersion: number;
    language: string;
}
export interface RenderValidationEntry {
    stage: ImageRenderValidationStage;
    validated: boolean;
    moduleId: string;
    status: string;
    notes: string[];
}
export interface LayerValidationEntry {
    check: ImageRenderLayerCheck;
    validated: boolean;
    layerCount: number;
    notes: string[];
}
export interface MaskValidationEntry {
    maskType: ImageRenderMaskType;
    maskId: string;
    validated: boolean;
    notes: string[];
}
export interface RenderAssetValidationEntry {
    assetType: ImageRenderAssetType;
    assetId: string;
    validated: boolean;
    source: string;
    notes: string[];
}
export interface RenderLayerEntry {
    layerId: string;
    name: string;
    order: number;
    group: string;
    blendMode: string;
    opacity: number;
    visible: boolean;
    clippingMask: boolean;
}
export interface RenderSettingsPlan {
    resolution: string;
    dpi: number;
    aspectRatio: string;
    rgbProfile: string;
    cmykProfile: string;
    iccProfile: string;
    bitDepth: number;
    colorSpace: ImageRenderColorSpace;
    compressionStrategy: string;
    outputQuality: number;
    alphaChannel: boolean;
    instructions: string[];
}
export interface OutputProfileEntry {
    platform: ImageRenderPlatform;
    resolution: string;
    aspectRatio: string;
    colorSpace: ImageRenderColorSpace;
    dpi: number;
    rules: string[];
}
export interface ResourcePlanningPlan {
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
export interface RenderJobPlan {
    jobId: string;
    renderPlanId: string;
    priority: number;
    status: string;
    platform: ImageRenderPlatform;
    estimatedResources: string;
}
export interface RenderRecoveryPlan {
    recoveryId: string;
    checkpoints: string[];
    resumeSteps: string[];
    rollbackSteps: string[];
    automaticRecovery: boolean;
    failureDetection: string[];
}
export interface ImageRenderScores {
    renderReadinessScore: number;
    assetQualityScore: number;
    layerIntegrityScore: number;
    maskIntegrityScore: number;
    performanceScore: number;
    platformCompatibilityScore: number;
    aiConfidenceScore: number;
}
export interface ImageRenderRelationships {
    imagePlans: string[];
    productionPlans: string[];
    renderPlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    templates: string[];
    knowledgeRecords: string[];
    stylePlans: string[];
}
export interface ImageRenderInput {
    productId?: string;
    projectId?: string;
    productionId?: string;
    imageId?: string;
    stylePlanId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: ImageRenderPlatform;
    language?: string;
    templateIds?: string[];
    knowledgeRecordIds?: string[];
    validateLayers?: boolean;
    validateMasks?: boolean;
    validateAssets?: boolean;
    planResources?: boolean;
    prepareOutputProfiles?: boolean;
    generateRenderJobs?: boolean;
}
export interface ImageRenderRecord {
    imageRenderPlanId: string;
    profile: ImageRenderPlanProfile;
    renderValidation: RenderValidationEntry[];
    layerValidation: LayerValidationEntry[];
    maskValidation: MaskValidationEntry[];
    assetValidation: RenderAssetValidationEntry[];
    layerStructure: RenderLayerEntry[];
    renderSettings: RenderSettingsPlan;
    outputProfiles: OutputProfileEntry[];
    resourcePlanning: ResourcePlanningPlan;
    renderJobs: RenderJobPlan[];
    recoveryPlan: RenderRecoveryPlan;
    blueprintId?: string;
    scores: ImageRenderScores;
    relationships: ImageRenderRelationships;
    recommendations: string[];
    validated: boolean;
    renderReady: boolean;
    productionReady: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageRenderResult {
    success: boolean;
    record?: ImageRenderRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageRenderSearchQuery {
    imageRenderPlanId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: ImageRenderPlatform;
    resolution?: string;
    colorSpace?: ImageRenderColorSpace;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface ImageRenderEngineStatusReport {
    engineStatus: string;
    renderValidationStatus: string;
    layerValidationStatus: string;
    maskValidationStatus: string;
    resourcePlanningStatus: string;
    renderPlansGenerated: number;
    averageRenderReadinessScore: number;
    averageLayerIntegrityScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averagePlanningMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageRenderEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_IMAGE_RENDER_PLATFORMS: ImageRenderPlatform[];
export declare const ALL_IMAGE_RENDER_VALIDATION_STAGES: ImageRenderValidationStage[];
export declare const ALL_IMAGE_RENDER_LAYER_CHECKS: ImageRenderLayerCheck[];
export declare const ALL_IMAGE_RENDER_MASK_TYPES: ImageRenderMaskType[];
export declare const ALL_IMAGE_RENDER_ASSET_TYPES: ImageRenderAssetType[];
export declare const IMAGE_RENDER_PLATFORM_CONFIG: Record<ImageRenderPlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
    dpi: number;
}>;
export declare const RENDER_VALIDATION_MODULE_MAP: Record<ImageRenderValidationStage, string>;
//# sourceMappingURL=types.d.ts.map