/**
 * KWIZERA AI STUDIO — Image Quality Validation Engine types (Step 9L)
 */
export declare enum QualityValidationPlatform {
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
export declare enum ImageQualityCheck {
    ImageResolution = "image-resolution",
    Sharpness = "sharpness",
    Noise = "noise",
    CompressionArtifacts = "compression-artifacts",
    ColorAccuracy = "color-accuracy",
    WhiteBalance = "white-balance",
    Exposure = "exposure",
    Contrast = "contrast",
    DynamicRange = "dynamic-range",
    TextureQuality = "texture-quality"
}
export declare enum QualityLayerCheck {
    LayerStructure = "layer-structure",
    LayerOrder = "layer-order",
    LayerGroups = "layer-groups",
    BlendModes = "blend-modes",
    Opacity = "opacity",
    ClippingMasks = "clipping-masks"
}
export declare enum QualityMaskType {
    SubjectMask = "subject-mask",
    ObjectMask = "object-mask",
    BackgroundMask = "background-mask",
    LayerMask = "layer-mask",
    AlphaMask = "alpha-mask",
    EditableRegion = "editable-region"
}
export declare enum TypographyCheck {
    FontUsage = "font-usage",
    FontConsistency = "font-consistency",
    TypographyHierarchy = "typography-hierarchy",
    Spacing = "spacing",
    Alignment = "alignment",
    Readability = "readability",
    Spelling = "spelling"
}
export declare enum BrandValidationCheck {
    LogoUsage = "logo-usage",
    BrandColors = "brand-colors",
    Typography = "typography",
    BrandAssets = "brand-assets",
    DesignConsistency = "design-consistency",
    CampaignConsistency = "campaign-consistency"
}
export declare enum PrintValidationCheck {
    Dpi = "dpi",
    Resolution = "resolution",
    Cmyk = "cmyk",
    Rgb = "rgb",
    IccProfiles = "icc-profiles",
    BleedPreparation = "bleed-preparation",
    SafeMargins = "safe-margins",
    CropMarks = "crop-marks"
}
export declare enum TechnicalValidationCheck {
    FileFormat = "file-format",
    ColorSpace = "color-space",
    BitDepth = "bit-depth",
    Transparency = "transparency",
    Metadata = "metadata",
    Compression = "compression",
    AlphaChannel = "alpha-channel"
}
export declare enum QualityIssueSeverity {
    Low = "low",
    Medium = "medium",
    High = "high",
    Critical = "critical"
}
export declare enum QualityIssueCategory {
    MissingAsset = "missing-asset",
    BrokenLayer = "broken-layer",
    BrokenMask = "broken-mask",
    Typography = "typography",
    Color = "color",
    Branding = "branding",
    RenderingRisk = "rendering-risk"
}
export interface QualityValidationProfile {
    qualityValidationId: string;
    projectId: string;
    productionId: string;
    renderPlanId: string;
    imagePlanId: string;
    productId: string;
    brandId: string;
    platform: QualityValidationPlatform;
    validationVersion: number;
}
export interface ImageQualityValidationEntry {
    check: ImageQualityCheck;
    validated: boolean;
    score: number;
    notes: string[];
}
export interface QualityLayerValidationEntry {
    check: QualityLayerCheck;
    validated: boolean;
    notes: string[];
}
export interface QualityMaskValidationEntry {
    maskType: QualityMaskType;
    validated: boolean;
    maskId: string;
    notes: string[];
}
export interface TypographyValidationEntry {
    check: TypographyCheck;
    validated: boolean;
    notes: string[];
}
export interface BrandValidationEntry {
    check: BrandValidationCheck;
    validated: boolean;
    notes: string[];
}
export interface PrintValidationEntry {
    check: PrintValidationCheck;
    validated: boolean;
    notes: string[];
}
export interface PlatformValidationEntry {
    platform: QualityValidationPlatform;
    validated: boolean;
    ready: boolean;
    notes: string[];
}
export interface TechnicalValidationEntry {
    check: TechnicalValidationCheck;
    validated: boolean;
    notes: string[];
}
export interface QualityIssue {
    issueId: string;
    category: QualityIssueCategory;
    severity: QualityIssueSeverity;
    message: string;
    repaired: boolean;
    repairNotes?: string[];
}
export interface QualityValidationScores {
    overallQualityScore: number;
    visualQualityScore: number;
    colorAccuracyScore: number;
    layerIntegrityScore: number;
    typographyScore: number;
    brandConsistencyScore: number;
    printReadinessScore: number;
    platformCompatibilityScore: number;
    aiConfidenceScore: number;
}
export interface QualityValidationRelationships {
    imagePlans: string[];
    productionPlans: string[];
    renderPlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    templates: string[];
    knowledgeRecords: string[];
}
export interface ImageQualityValidationInput {
    productId?: string;
    projectId?: string;
    productionId?: string;
    renderPlanId?: string;
    imagePlanId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: QualityValidationPlatform;
    templateIds?: string[];
    knowledgeRecordIds?: string[];
    sourceImageId?: string;
    generatedImageId?: string;
    validatePrint?: boolean;
    validatePlatform?: boolean;
    autoRepair?: boolean;
}
export interface ImageQualityValidationRecord {
    qualityValidationId: string;
    profile: QualityValidationProfile;
    imageQuality: ImageQualityValidationEntry[];
    layerValidation: QualityLayerValidationEntry[];
    maskValidation: QualityMaskValidationEntry[];
    typographyValidation: TypographyValidationEntry[];
    brandValidation: BrandValidationEntry[];
    printValidation: PrintValidationEntry[];
    platformValidation: PlatformValidationEntry[];
    technicalValidation: TechnicalValidationEntry[];
    issues: QualityIssue[];
    repairsApplied: string[];
    blueprintId?: string;
    scores: QualityValidationScores;
    relationships: QualityValidationRelationships;
    recommendations: string[];
    validated: boolean;
    approved: boolean;
    productionReady: boolean;
    renderReady: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface ImageQualityValidationResult {
    success: boolean;
    record?: ImageQualityValidationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageQualityValidationSearchQuery {
    qualityValidationId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: QualityValidationPlatform;
    minQualityScore?: number;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface ImageQualityValidationEngineStatusReport {
    engineStatus: string;
    imageQualityStatus: string;
    layerValidationStatus: string;
    brandValidationStatus: string;
    validationsPerformed: number;
    averageOverallQualityScore: number;
    averageApprovalRate: number;
    performance: {
        averageValidationMs: number;
        averageSearchMs: number;
        averageRepairMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageQualityValidationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_QUALITY_VALIDATION_PLATFORMS: QualityValidationPlatform[];
export declare const ALL_IMAGE_QUALITY_CHECKS: ImageQualityCheck[];
export declare const ALL_QUALITY_LAYER_CHECKS: QualityLayerCheck[];
export declare const ALL_QUALITY_MASK_TYPES: QualityMaskType[];
export declare const ALL_TYPOGRAPHY_CHECKS: TypographyCheck[];
export declare const ALL_BRAND_VALIDATION_CHECKS: BrandValidationCheck[];
export declare const ALL_PRINT_VALIDATION_CHECKS: PrintValidationCheck[];
export declare const ALL_TECHNICAL_VALIDATION_CHECKS: TechnicalValidationCheck[];
export declare const QUALITY_PLATFORM_CONFIG: Record<QualityValidationPlatform, {
    resolution: string;
    dpi: number;
    aspectRatio: string;
}>;
//# sourceMappingURL=types.d.ts.map