/**
 * KWIZERA AI STUDIO — Image Enhancement & Restoration Engine types (Step 9G)
 */
export declare enum ImageEnhanceGenPlatform {
    Website = "website",
    Mobile = "mobile",
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    LinkedIn = "linkedin",
    Print = "print",
    Catalogue = "catalogue",
    Billboard = "billboard"
}
export declare enum ImageEnhanceGenInputType {
    SourceImage = "source-image",
    EditedImage = "edited-image",
    ProductImage = "product-image",
    BrandGuidelines = "brand-guidelines",
    RestorationPrompt = "restoration-prompt",
    KnowledgeRecord = "knowledge-record"
}
export declare enum ImageEnhanceOperationType {
    SuperResolutionPlanning = "super-resolution-planning",
    ImageUpscaling = "image-upscaling",
    NoiseReduction = "noise-reduction",
    Deblurring = "deblurring",
    DetailEnhancement = "detail-enhancement",
    TextureEnhancement = "texture-enhancement",
    ColorCorrection = "color-correction",
    WhiteBalanceCorrection = "white-balance-correction",
    ExposureCorrection = "exposure-correction",
    ContrastEnhancement = "contrast-enhancement",
    HdrPreparation = "hdr-preparation"
}
export declare enum ImageEnhanceRestorationType {
    ScratchRemoval = "scratch-removal",
    DustRemoval = "dust-removal",
    CrackRepair = "crack-repair",
    MissingAreaRecovery = "missing-area-recovery",
    FaceRestoration = "face-restoration",
    ObjectRestoration = "object-restoration",
    DocumentRestoration = "document-restoration",
    HistoricalPhotoRestoration = "historical-photo-restoration"
}
export declare enum ImageEnhancePreservationTarget {
    HumanIdentity = "human-identity",
    ProductIdentity = "product-identity",
    LogoIntegrity = "logo-integrity",
    PackagingIntegrity = "packaging-integrity",
    BrandColors = "brand-colors",
    OriginalComposition = "original-composition"
}
export declare enum ImageEnhanceCategory {
    Product = "product",
    Fashion = "fashion",
    Historical = "historical",
    Document = "document",
    Portrait = "portrait",
    Landscape = "landscape"
}
export interface EnhancementPlanProfile {
    enhancementPlanId: string;
    sourceImageId: string;
    enhancedImageId: string;
    restoredImageId: string;
    promptId: string;
    projectId: string;
    productId: string;
    brandId: string;
    campaignId: string;
    platform: ImageEnhanceGenPlatform;
    imageCategory: ImageEnhanceCategory;
    primaryEnhancement: ImageEnhanceOperationType;
    primaryRestoration?: ImageEnhanceRestorationType;
    version: number;
    language: string;
}
export interface EnhancementImageAnalysis {
    resolution: string;
    sharpness: string;
    blur: string;
    noise: string;
    compressionArtifacts: string;
    dynamicRange: string;
    exposure: string;
    whiteBalance: string;
    colorAccuracy: string;
    textureQuality: string;
}
export interface EnhancementOperationsPlan {
    operations: ImageEnhanceOperationType[];
    operationPrompts: Record<string, string>;
    executionOrder: string[];
    superResolutionTarget: string;
    upscalingFactor: string;
}
export interface RestorationOperationsPlan {
    restorationType: ImageEnhanceRestorationType;
    targetDamage: string[];
    restorationStrategy: string;
    authenticityNotes: string[];
    historicalNotes: string[];
}
export interface ImagePreservationPlan {
    targets: ImageEnhancePreservationTarget[];
    identityLock: boolean;
    productLock: boolean;
    logoLock: boolean;
    compositionLock: boolean;
    notes: string[];
}
export interface EnhancementQualityImprovementPlan {
    fineDetails: string;
    hairDetails: string;
    fabricDetails: string;
    reflectionQuality: string;
    shadowQuality: string;
    edgeQuality: string;
    skinQuality: string;
}
export interface PrintPreparationPlan {
    printResolution: string;
    colorProfile: string;
    dpiPlanning: string;
    cmykPreparation: string;
    largeFormatPreparation: string;
}
export interface SuperResolutionPlan {
    targetResolution: string;
    upscalingMethod: string;
    detailRecoveryStrategy: string;
    edgePreservationNotes: string[];
    authenticityConstraints: string[];
}
export interface EnhancementPlatformOptimization {
    platform: ImageEnhanceGenPlatform;
    aspectRatio: string;
    resolution: string;
    optimizationNotes: string[];
}
export interface ProductionEnhancementInstructions {
    renderNotes: string[];
    enhancementGuidance: string[];
    restorationGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface ImageEnhancementScores {
    enhancementScore: number;
    restorationScore: number;
    sharpnessScore: number;
    colorAccuracyScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface ImageEnhancementRelationships {
    sourceImages: string[];
    enhancedImages: string[];
    restoredImages: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    knowledgeRecords: string[];
    imageEditingPlans: string[];
    productImagePlans: string[];
    backgroundPlans: string[];
}
export interface ImageEnhancementInput {
    sourceImageId?: string;
    editedImageId?: string;
    restorationPrompt?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: ImageEnhanceGenPlatform;
    language?: string;
    imageCategory?: ImageEnhanceCategory;
    primaryEnhancement?: ImageEnhanceOperationType;
    enhancements?: ImageEnhanceOperationType[];
    restorationType?: ImageEnhanceRestorationType;
    productImagePlanId?: string;
    backgroundPlanId?: string;
    imageEditingPlanId?: string;
    knowledgeRecordIds?: string[];
    generateRestorationPlan?: boolean;
    generatePrintPreparation?: boolean;
    generatePlatformOptimizations?: boolean;
    inputTypes?: ImageEnhanceGenInputType[];
}
export interface ImageEnhancementRecord {
    enhancementPlanId: string;
    profile: EnhancementPlanProfile;
    imageAnalysis: EnhancementImageAnalysis;
    enhancementOperations: EnhancementOperationsPlan;
    restorationOperations: RestorationOperationsPlan;
    preservation: ImagePreservationPlan;
    qualityImprovement: EnhancementQualityImprovementPlan;
    printPreparation: PrintPreparationPlan;
    superResolutionPlan: SuperResolutionPlan;
    platformOptimizations: EnhancementPlatformOptimization[];
    productionInstructions: ProductionEnhancementInstructions;
    blueprintId?: string;
    scores: ImageEnhancementScores;
    relationships: ImageEnhancementRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageEnhancementResult {
    success: boolean;
    record?: ImageEnhancementRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageEnhancementSearchQuery {
    enhancementPlanId?: string;
    sourceImageId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: ImageEnhanceGenPlatform;
    primaryEnhancement?: ImageEnhanceOperationType;
    restorationType?: ImageEnhanceRestorationType;
    imageCategory?: ImageEnhanceCategory;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface ImageEnhancementEngineStatusReport {
    engineStatus: string;
    imageAnalysisStatus: string;
    enhancementOperationsStatus: string;
    restorationOperationsStatus: string;
    printPreparationStatus: string;
    superResolutionStatus: string;
    enhancementPlansGenerated: number;
    averageEnhancementScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averageAnalysisMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageEnhancementEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_IMAGE_ENHANCE_OPERATIONS: ImageEnhanceOperationType[];
export declare const ALL_IMAGE_ENHANCE_RESTORATION_TYPES: ImageEnhanceRestorationType[];
export declare const ALL_IMAGE_ENHANCE_PRESERVATION_TARGETS: ImageEnhancePreservationTarget[];
export declare const ALL_IMAGE_ENHANCE_GEN_PLATFORMS: ImageEnhanceGenPlatform[];
export declare const IMAGE_ENHANCE_PLATFORM_CONFIG: Record<ImageEnhanceGenPlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
}>;
//# sourceMappingURL=types.d.ts.map