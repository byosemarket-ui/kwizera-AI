/**
 * KWIZERA AI STUDIO — Image-to-Image Generation Engine types (Step 9C)
 */
export declare enum ImageToImagePlatform {
    Website = "website",
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    LinkedIn = "linkedin",
    Print = "print",
    Billboard = "billboard",
    Packaging = "packaging"
}
export declare enum ImageToImageInputType {
    SourceImage = "source-image",
    TransformationPrompt = "transformation-prompt",
    ProductInformation = "product-information",
    BrandGuidelines = "brand-guidelines",
    StyleReferences = "style-references",
    KnowledgeRecord = "knowledge-record"
}
export declare enum TransformationType {
    StyleTransfer = "style-transfer",
    BackgroundReplacement = "background-replacement",
    ColorModification = "color-modification",
    LightingAdjustment = "lighting-adjustment",
    CompositionAdjustment = "composition-adjustment",
    ObjectReplacement = "object-replacement",
    ObjectRemoval = "object-removal",
    SubjectEnhancement = "subject-enhancement",
    ResolutionPlanning = "resolution-planning"
}
export declare enum PreservationRule {
    PreserveIdentity = "preserve-identity",
    PreserveProductShape = "preserve-product-shape",
    PreserveLogo = "preserve-logo",
    PreserveBrandColors = "preserve-brand-colors",
    PreserveComposition = "preserve-composition",
    PreserveUserSelectedAreas = "preserve-user-selected-areas"
}
export declare enum MaskType {
    EditableMask = "editable-mask",
    ProtectedMask = "protected-mask",
    RegionSelection = "region-selection",
    ForegroundMask = "foreground-mask",
    BackgroundMask = "background-mask",
    ObjectMask = "object-mask"
}
export declare enum ImageTransformationStyle {
    Photorealistic = "photorealistic",
    Commercial = "commercial",
    Luxury = "luxury",
    Corporate = "corporate",
    Cartoon = "cartoon",
    Illustration = "illustration",
    Watercolor = "watercolor",
    OilPainting = "oil-painting",
    PencilSketch = "pencil-sketch",
    ThreeDStyle = "3d-style",
    ProductPhotography = "product-photography"
}
export declare enum ImageTransformationBackgroundType {
    White = "white-background",
    Transparent = "transparent-background",
    Studio = "studio-background",
    Lifestyle = "lifestyle-background",
    Outdoor = "outdoor-background",
    Custom = "custom-background"
}
export declare enum ImageTransformationVariationType {
    VariationA = "variation-a",
    VariationB = "variation-b",
    VariationC = "variation-c",
    StyleVariation = "style-variation",
    BackgroundVariation = "background-variation",
    ColorVariation = "color-variation"
}
export declare enum SourceImageCategory {
    Product = "product",
    Portrait = "portrait",
    Lifestyle = "lifestyle",
    Packaging = "packaging",
    Brand = "brand"
}
export interface SourceImageMetadata {
    imageId: string;
    category: SourceImageCategory;
    subject: string;
    resolution: string;
    width: number;
    height: number;
    format: string;
    qualityScore: number;
    objects?: string[];
    background?: string;
}
export interface TransformationPlanProfile {
    transformationPlanId: string;
    sourceImageId: string;
    generatedImageId: string;
    promptId: string;
    projectId: string;
    productId: string;
    brandId: string;
    platform: ImageToImagePlatform;
    targetStyle: ImageTransformationStyle;
    targetBackground: ImageTransformationBackgroundType;
    version: number;
    language: string;
}
export interface SourceImageAnalysis {
    subject: string;
    objects: string[];
    background: string;
    composition: string;
    lighting: string;
    colors: string[];
    cameraPerspective: string;
    imageQuality: string;
    resolution: string;
    metadata: Record<string, string | number>;
}
export interface TransformationStep {
    type: TransformationType;
    description: string;
    priority: number;
    preserveElements: string[];
}
export interface TransformationPlan {
    steps: TransformationStep[];
    targetStyle: ImageTransformationStyle;
    targetBackground: ImageTransformationBackgroundType;
    transformationPrompt: string;
    visualConsistencyNotes: string[];
}
export interface PreservationPlan {
    rules: PreservationRule[];
    protectedRegions: string[];
    identityLock: boolean;
    brandColorLock: boolean;
    compositionLock: boolean;
    notes: string[];
}
export interface MaskDefinition {
    maskId: string;
    maskType: MaskType;
    label: string;
    region: string;
    editable: boolean;
    protected: boolean;
}
export interface MaskPlan {
    masks: MaskDefinition[];
    foregroundMaskId: string;
    backgroundMaskId: string;
    objectMaskIds: string[];
    editableRegions: string[];
    protectedRegions: string[];
}
export interface BackgroundPlan {
    backgroundType: ImageTransformationBackgroundType;
    description: string;
    replacementStrategy: string;
    lightingAdaptation: string;
    colorHarmony: string;
}
export interface PlatformTransformationOptimization {
    platform: ImageToImagePlatform;
    aspectRatio: string;
    resolution: string;
    safeZones: string[];
    formatNotes: string[];
    optimizationNotes: string[];
}
export interface TransformationVariation {
    variationId: string;
    variationType: ImageTransformationVariationType;
    label: string;
    styleAdjustment: string;
    backgroundAdjustment: string;
    colorAdjustment: string;
}
export interface ProductionTransformationInstructions {
    renderNotes: string[];
    maskGuidance: string[];
    layerGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface ImageToImageScores {
    transformationQualityScore: number;
    identityPreservationScore: number;
    styleConsistencyScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface ImageToImageRelationships {
    sourceImages: string[];
    generatedImages: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    prompts: string[];
    knowledgeRecords: string[];
    textToImagePlans: string[];
}
export interface ImageToImageGenerationInput {
    sourceImageId?: string;
    sourceImageMetadata?: SourceImageMetadata;
    transformationPrompt?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: ImageToImagePlatform;
    language?: string;
    targetStyle?: ImageTransformationStyle;
    targetBackground?: ImageTransformationBackgroundType;
    transformationTypes?: TransformationType[];
    preservationRules?: PreservationRule[];
    styleReferenceIds?: string[];
    knowledgeRecordIds?: string[];
    textToImagePlanId?: string;
    generateVariations?: boolean;
    generatePlatformOptimizations?: boolean;
    inputTypes?: ImageToImageInputType[];
}
export interface ImageToImageGenerationRecord {
    transformationPlanId: string;
    profile: TransformationPlanProfile;
    sourceAnalysis: SourceImageAnalysis;
    transformationPlan: TransformationPlan;
    preservationPlan: PreservationPlan;
    maskPlan: MaskPlan;
    backgroundPlan: BackgroundPlan;
    platformOptimizations: PlatformTransformationOptimization[];
    variations: TransformationVariation[];
    productionInstructions: ProductionTransformationInstructions;
    blueprintId?: string;
    scores: ImageToImageScores;
    relationships: ImageToImageRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageToImageGenerationResult {
    success: boolean;
    record?: ImageToImageGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageToImageSearchQuery {
    transformationPlanId?: string;
    sourceImageId?: string;
    generatedImageId?: string;
    productId?: string;
    brandId?: string;
    platform?: ImageToImagePlatform;
    style?: ImageTransformationStyle;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface ImageToImageGenerationEngineStatusReport {
    engineStatus: string;
    sourceAnalysisStatus: string;
    transformationPlanningStatus: string;
    maskPlanningStatus: string;
    preservationStatus: string;
    platformOptimizationStatus: string;
    transformationPlansGenerated: number;
    averageTransformationQualityScore: number;
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
export declare class ImageToImageGenerationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_IMAGE_TO_IMAGE_PLATFORMS: ImageToImagePlatform[];
export declare const ALL_TRANSFORMATION_TYPES: TransformationType[];
export declare const ALL_PRESERVATION_RULES: PreservationRule[];
export declare const PLATFORM_CONFIG: Record<ImageToImagePlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
}>;
//# sourceMappingURL=types.d.ts.map