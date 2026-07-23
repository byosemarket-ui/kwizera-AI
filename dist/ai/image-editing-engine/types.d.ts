/**
 * KWIZERA AI STUDIO — Image Editing, Inpainting & Outpainting Engine types (Step 9F)
 */
export declare enum ImageEditGenPlatform {
    Website = "website",
    Mobile = "mobile",
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    LinkedIn = "linkedin",
    Print = "print",
    Billboard = "billboard"
}
export declare enum ImageEditGenInputType {
    SourceImage = "source-image",
    EditingPrompt = "editing-prompt",
    ProductInformation = "product-information",
    BrandGuidelines = "brand-guidelines",
    Campaign = "campaign",
    StyleReferences = "style-references",
    Mask = "mask",
    KnowledgeRecord = "knowledge-record"
}
export declare enum ImageEditOperationType {
    ObjectRemoval = "object-removal",
    ObjectAddition = "object-addition",
    ObjectReplacement = "object-replacement",
    ColorEditing = "color-editing",
    LightingEditing = "lighting-editing",
    ShadowEditing = "shadow-editing",
    ReflectionEditing = "reflection-editing",
    BackgroundEditing = "background-editing",
    SkinRetouchPlanning = "skin-retouch-planning",
    ProductCleanup = "product-cleanup"
}
export declare enum ImageEditInpaintingType {
    HoleFilling = "hole-filling",
    MissingAreaReconstruction = "missing-area-reconstruction",
    ObjectReconstruction = "object-reconstruction",
    TextureReconstruction = "texture-reconstruction",
    PatternReconstruction = "pattern-reconstruction",
    DetailRecovery = "detail-recovery"
}
export declare enum ImageEditOutpaintingType {
    CanvasExpansion = "canvas-expansion",
    SceneExtension = "scene-extension",
    BackgroundExtension = "background-extension",
    EnvironmentExtension = "environment-extension",
    AspectRatioExpansion = "aspect-ratio-expansion",
    PrintExpansion = "print-expansion"
}
export declare enum ImageEditMaskType {
    EditableMask = "editable-mask",
    ObjectMask = "object-mask",
    SubjectMask = "subject-mask",
    BackgroundMask = "background-mask",
    LayerMask = "layer-mask",
    ProtectedRegion = "protected-region"
}
export declare enum ImageEditIdentityTarget {
    HumanIdentity = "human-identity",
    ProductIdentity = "product-identity",
    LogoIntegrity = "logo-integrity",
    PackagingIntegrity = "packaging-integrity",
    BrandColors = "brand-colors",
    BrandElements = "brand-elements"
}
export interface ImageEditingPlanProfile {
    imageEditingPlanId: string;
    sourceImageId: string;
    editedImageId: string;
    promptId: string;
    projectId: string;
    productId: string;
    brandId: string;
    campaignId: string;
    platform: ImageEditGenPlatform;
    primaryOperation: ImageEditOperationType;
    inpaintingType?: ImageEditInpaintingType;
    outpaintingType?: ImageEditOutpaintingType;
    version: number;
    language: string;
}
export interface ImageAnalysisPlan {
    subject: string;
    objects: string[];
    background: string;
    composition: string;
    perspective: string;
    lighting: string;
    shadows: string;
    reflections: string;
    imageQuality: string;
    resolution: string;
}
export interface ImageEditOperationPlan {
    operations: ImageEditOperationType[];
    operationPrompts: Record<string, string>;
    executionOrder: string[];
    nonDestructiveNotes: string[];
}
export interface InpaintingPlan {
    inpaintingType: ImageEditInpaintingType;
    targetRegions: string[];
    reconstructionStrategy: string;
    textureNotes: string[];
    detailRecoveryNotes: string[];
}
export interface OutpaintingPlan {
    outpaintingType: ImageEditOutpaintingType;
    expansionDirection: string;
    expansionRatio: string;
    sceneExtensionNotes: string[];
    environmentNotes: string[];
}
export interface MaskManagementPlan {
    masks: Array<{
        maskId: string;
        maskType: ImageEditMaskType;
        label: string;
        editable: boolean;
        protected: boolean;
    }>;
    protectedRegions: string[];
    layerNotes: string[];
}
export interface IdentityPreservationPlan {
    targets: ImageEditIdentityTarget[];
    identityLock: boolean;
    productLock: boolean;
    logoLock: boolean;
    brandColorLock: boolean;
    notes: string[];
}
export interface NonDestructiveEditingPlan {
    originalPreserved: boolean;
    layerEditingEnabled: boolean;
    undoStackDepth: number;
    redoStackDepth: number;
    rollbackSupported: boolean;
    versionHistory: Array<{
        version: number;
        timestamp: string;
        summary: string;
    }>;
}
export interface ImageEditQualityImprovementPlan {
    edgeQuality: string;
    textureQuality: string;
    fineDetails: string;
    noiseReduction: string;
    artifactPrevention: string;
    sharpnessPlanning: string;
}
export interface ImageEditPlatformOptimization {
    platform: ImageEditGenPlatform;
    aspectRatio: string;
    resolution: string;
    optimizationNotes: string[];
}
export interface ProductionImageEditingInstructions {
    renderNotes: string[];
    maskGuidance: string[];
    layerGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface ImageEditingScores {
    editingQualityScore: number;
    identityPreservationScore: number;
    reconstructionScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface ImageEditingRelationships {
    sourceImages: string[];
    editedImages: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    prompts: string[];
    masks: string[];
    knowledgeRecords: string[];
    backgroundPlans: string[];
    productImagePlans: string[];
}
export interface ImageEditingInput {
    sourceImageId?: string;
    editingPrompt?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: ImageEditGenPlatform;
    language?: string;
    primaryOperation?: ImageEditOperationType;
    operations?: ImageEditOperationType[];
    inpaintingType?: ImageEditInpaintingType;
    outpaintingType?: ImageEditOutpaintingType;
    maskIds?: string[];
    styleReferenceIds?: string[];
    knowledgeRecordIds?: string[];
    productImagePlanId?: string;
    backgroundPlanId?: string;
    generateInpaintingPlan?: boolean;
    generateOutpaintingPlan?: boolean;
    generatePlatformOptimizations?: boolean;
    inputTypes?: ImageEditGenInputType[];
}
export interface ImageEditingRecord {
    imageEditingPlanId: string;
    profile: ImageEditingPlanProfile;
    imageAnalysis: ImageAnalysisPlan;
    editingOperations: ImageEditOperationPlan;
    inpaintingPlan: InpaintingPlan;
    outpaintingPlan: OutpaintingPlan;
    maskManagement: MaskManagementPlan;
    identityPreservation: IdentityPreservationPlan;
    nonDestructiveEditing: NonDestructiveEditingPlan;
    qualityImprovement: ImageEditQualityImprovementPlan;
    platformOptimizations: ImageEditPlatformOptimization[];
    productionInstructions: ProductionImageEditingInstructions;
    blueprintId?: string;
    scores: ImageEditingScores;
    relationships: ImageEditingRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageEditingResult {
    success: boolean;
    record?: ImageEditingRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageEditingSearchQuery {
    imageEditingPlanId?: string;
    sourceImageId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: ImageEditGenPlatform;
    primaryOperation?: ImageEditOperationType;
    inpaintingType?: ImageEditInpaintingType;
    outpaintingType?: ImageEditOutpaintingType;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface ImageEditingEngineStatusReport {
    engineStatus: string;
    imageAnalysisStatus: string;
    editingOperationsStatus: string;
    inpaintingStatus: string;
    outpaintingStatus: string;
    maskManagementStatus: string;
    imageEditingPlansGenerated: number;
    averageEditingQualityScore: number;
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
export declare class ImageEditingEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_IMAGE_EDIT_OPERATIONS: ImageEditOperationType[];
export declare const ALL_IMAGE_EDIT_INPAINTING_TYPES: ImageEditInpaintingType[];
export declare const ALL_IMAGE_EDIT_OUTPAINTING_TYPES: ImageEditOutpaintingType[];
export declare const ALL_IMAGE_EDIT_MASK_TYPES: ImageEditMaskType[];
export declare const ALL_IMAGE_EDIT_IDENTITY_TARGETS: ImageEditIdentityTarget[];
export declare const ALL_IMAGE_EDIT_GEN_PLATFORMS: ImageEditGenPlatform[];
export declare const IMAGE_EDIT_PLATFORM_CONFIG: Record<ImageEditGenPlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
}>;
//# sourceMappingURL=types.d.ts.map