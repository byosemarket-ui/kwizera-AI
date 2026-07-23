/**
 * KWIZERA AI STUDIO — Background Generation & Replacement Engine types (Step 9E)
 */
export declare enum BackgroundGenPlatform {
    Website = "website",
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    LinkedIn = "linkedin",
    AmazonStyle = "amazon-style",
    Catalogue = "catalogue",
    Print = "print",
    Billboard = "billboard"
}
export declare enum BackgroundGenInputType {
    SourceImage = "source-image",
    ProductImage = "product-image",
    SubjectMask = "subject-mask",
    BackgroundPrompt = "background-prompt",
    BrandGuidelines = "brand-guidelines",
    Campaign = "campaign",
    StyleReferences = "style-references",
    KnowledgeRecord = "knowledge-record"
}
export declare enum BackgroundGenType {
    WhiteBackground = "white-background",
    TransparentBackground = "transparent-background",
    StudioBackground = "studio-background",
    OfficeBackground = "office-background",
    HomeBackground = "home-background",
    RetailStore = "retail-store",
    Restaurant = "restaurant",
    Nature = "nature",
    City = "city",
    LuxuryInterior = "luxury-interior",
    AbstractBackground = "abstract-background",
    CustomPromptBackground = "custom-prompt-background"
}
export declare enum BackgroundReplacementVariationType {
    BackgroundVariation = "background-variation",
    BrandVariation = "brand-variation",
    SeasonalVariation = "seasonal-variation",
    CampaignVariation = "campaign-variation",
    PlatformVariation = "platform-variation"
}
export declare enum BackgroundMarketingPreset {
    Ecommerce = "ecommerce",
    LuxuryProducts = "luxury-products",
    Fashion = "fashion",
    Food = "food",
    Electronics = "electronics",
    RealEstate = "real-estate",
    Automotive = "automotive",
    Healthcare = "healthcare",
    Education = "education"
}
export declare enum SubjectPreservationTarget {
    HumanIdentity = "human-identity",
    ProductIdentity = "product-identity",
    Logo = "logo",
    Packaging = "packaging",
    Shape = "shape",
    Texture = "texture",
    Colors = "colors",
    TransparentAreas = "transparent-areas"
}
export interface BackgroundPlanProfile {
    backgroundPlanId: string;
    sourceImageId: string;
    generatedBackgroundId: string;
    promptId: string;
    projectId: string;
    productId: string;
    brandId: string;
    campaignId: string;
    platform: BackgroundGenPlatform;
    targetBackground: BackgroundGenType;
    marketingPreset: BackgroundMarketingPreset;
    version: number;
    language: string;
}
export interface BackgroundAnalysis {
    backgroundType: string;
    sceneEnvironment: string;
    perspective: string;
    lightingDirection: string;
    colorPalette: string[];
    shadowDirection: string;
    reflectionAreas: string[];
    depthInformation: string;
    horizonLine: string;
}
export interface SubjectPreservationPlan {
    targets: SubjectPreservationTarget[];
    protectedRegions: string[];
    identityLock: boolean;
    productLock: boolean;
    logoLock: boolean;
    transparentPreservation: boolean;
    notes: string[];
}
export interface LightingMatchingPlan {
    lightDirection: string;
    lightIntensity: string;
    colorTemperature: string;
    shadowConsistency: string;
    reflectionMatching: string;
    ambientLight: string;
}
export interface DepthPlanningPlan {
    foreground: string;
    midground: string;
    background: string;
    blurPlanning: string;
    depthOfField: string;
    focusSeparation: string;
}
export interface QualityImprovementPlan {
    edgeQuality: string;
    hairDetails: string;
    transparentObjects: string;
    fineDetails: string;
    objectSeparation: string;
    backgroundCleanliness: string;
}
export interface BackgroundGenerationPlan {
    targetBackground: BackgroundGenType;
    generationPrompt: string;
    environmentDescription: string;
    replacementStrategy: string;
    realismNotes: string[];
}
export interface BackgroundReplacementPlan {
    variations: BackgroundReplacementVariation[];
    brandAdaptations: string[];
    seasonalAdaptations: string[];
    campaignAdaptations: string[];
}
export interface BackgroundReplacementVariation {
    variationId: string;
    variationType: BackgroundReplacementVariationType;
    label: string;
    backgroundType: BackgroundGenType;
    description: string;
}
export interface BackgroundPlatformOptimization {
    platform: BackgroundGenPlatform;
    aspectRatio: string;
    resolution: string;
    presetNotes: string[];
    optimizationNotes: string[];
}
export interface ProductionBackgroundInstructions {
    renderNotes: string[];
    maskGuidance: string[];
    lightingGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface BackgroundGenerationScores {
    backgroundQualityScore: number;
    subjectPreservationScore: number;
    lightingConsistencyScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface BackgroundGenerationRelationships {
    sourceImages: string[];
    generatedImages: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    prompts: string[];
    templates: string[];
    knowledgeRecords: string[];
    productImagePlans: string[];
}
export interface BackgroundGenerationInput {
    sourceImageId?: string;
    productImageId?: string;
    subjectMaskId?: string;
    backgroundPrompt?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: BackgroundGenPlatform;
    language?: string;
    targetBackground?: BackgroundGenType;
    marketingPreset?: BackgroundMarketingPreset;
    styleReferenceIds?: string[];
    knowledgeRecordIds?: string[];
    productImagePlanId?: string;
    generateReplacements?: boolean;
    generatePlatformOptimizations?: boolean;
    inputTypes?: BackgroundGenInputType[];
}
export interface BackgroundGenerationRecord {
    backgroundPlanId: string;
    profile: BackgroundPlanProfile;
    backgroundAnalysis: BackgroundAnalysis;
    subjectPreservation: SubjectPreservationPlan;
    generationPlan: BackgroundGenerationPlan;
    replacementPlan: BackgroundReplacementPlan;
    lightingMatching: LightingMatchingPlan;
    depthPlanning: DepthPlanningPlan;
    qualityImprovement: QualityImprovementPlan;
    platformOptimizations: BackgroundPlatformOptimization[];
    productionInstructions: ProductionBackgroundInstructions;
    blueprintId?: string;
    scores: BackgroundGenerationScores;
    relationships: BackgroundGenerationRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface BackgroundGenerationResult {
    success: boolean;
    record?: BackgroundGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface BackgroundGenerationSearchQuery {
    backgroundPlanId?: string;
    sourceImageId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: BackgroundGenPlatform;
    targetBackground?: BackgroundGenType;
    marketingPreset?: BackgroundMarketingPreset;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface BackgroundGenerationEngineStatusReport {
    engineStatus: string;
    backgroundAnalysisStatus: string;
    generationStatus: string;
    replacementStatus: string;
    lightingMatchingStatus: string;
    depthPlanningStatus: string;
    backgroundPlansGenerated: number;
    averageBackgroundQualityScore: number;
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
export declare class BackgroundGenerationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_BACKGROUND_GEN_TYPES: BackgroundGenType[];
export declare const ALL_SUBJECT_PRESERVATION_TARGETS: SubjectPreservationTarget[];
export declare const ALL_BACKGROUND_MARKETING_PRESETS: BackgroundMarketingPreset[];
export declare const ALL_BACKGROUND_GEN_PLATFORMS: BackgroundGenPlatform[];
export declare const PLATFORM_CONFIG: Record<BackgroundGenPlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
}>;
//# sourceMappingURL=types.d.ts.map