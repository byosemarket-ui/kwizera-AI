/**
 * KWIZERA AI STUDIO — Product Image Generation Engine types (Step 9D)
 */
export declare enum ProductImageGenPlatform {
    Website = "website",
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    LinkedIn = "linkedin",
    Ecommerce = "ecommerce",
    Print = "print",
    Billboard = "billboard"
}
export declare enum ProductImageGenInputType {
    ProductInformation = "product-information",
    ProductImages = "product-images",
    BrandGuidelines = "brand-guidelines",
    Campaign = "campaign",
    StyleReferences = "style-references",
    KnowledgeRecord = "knowledge-record"
}
export declare enum ProductPresentationView {
    HeroImage = "hero-image",
    FrontView = "front-view",
    BackView = "back-view",
    LeftView = "left-view",
    RightView = "right-view",
    TopView = "top-view",
    BottomView = "bottom-view",
    ThreeSixtyPlanning = "360-planning",
    DetailCloseUp = "detail-close-up",
    LifestylePresentation = "lifestyle-presentation"
}
export declare enum ProductPhotographyMode {
    StudioPhotography = "studio-photography",
    LifestylePhotography = "lifestyle-photography",
    CommercialPhotography = "commercial-photography",
    LuxuryPhotography = "luxury-photography",
    WhiteBackground = "white-background",
    TransparentBackground = "transparent-background",
    CreativeBackground = "creative-background"
}
export declare enum ProductImageBackgroundType {
    WhiteBackground = "white-background",
    TransparentBackground = "transparent-background",
    StudioSetup = "studio-setup",
    HomeEnvironment = "home-environment",
    OfficeEnvironment = "office-environment",
    OutdoorEnvironment = "outdoor-environment",
    PremiumEnvironment = "premium-environment"
}
export declare enum ProductLightingType {
    StudioLighting = "studio-lighting",
    NaturalLighting = "natural-lighting",
    SoftboxLighting = "softbox-lighting",
    RimLighting = "rim-lighting",
    ProductHighlight = "product-highlight",
    ReflectionControl = "reflection-control",
    ShadowPlanning = "shadow-planning"
}
export declare enum ProductConsistencyRule {
    ProductShape = "product-shape",
    ProductColor = "product-color",
    ProductSize = "product-size",
    ProductTexture = "product-texture",
    LogoPlacement = "logo-placement",
    PackagingConsistency = "packaging-consistency"
}
export declare enum ProductMarketingVariation {
    SocialMedia = "social-media",
    Ecommerce = "ecommerce",
    Website = "website",
    Catalogue = "catalogue",
    Billboard = "billboard",
    Print = "print"
}
export interface ProductImagePlanProfile {
    productImagePlanId: string;
    productId: string;
    projectId: string;
    brandId: string;
    campaignId: string;
    platform: ProductImageGenPlatform;
    productCategory: string;
    version: number;
    language: string;
}
export interface ProductPresentationPlan {
    views: ProductPresentationViewDefinition[];
    showcaseLayout: string;
    heroPlacement: string;
    catalogueStructure: string[];
}
export interface ProductPresentationViewDefinition {
    view: ProductPresentationView;
    description: string;
    cameraAngle: string;
    framing: string;
    priority: number;
}
export interface ProductPhotographyPlan {
    primaryMode: ProductPhotographyMode;
    modes: ProductPhotographyMode[];
    studioSetup: string;
    commercialStyle: string;
    luxuryTreatment: string;
    notes: string[];
}
export interface ProductBackgroundPlan {
    primaryBackground: ProductImageBackgroundType;
    backgroundDescription: string;
    environmentNotes: string;
    replacementStrategy: string;
    colorHarmony: string;
}
export interface ProductLightingPlan {
    studioLighting: string;
    naturalLighting: string;
    softboxLighting: string;
    rimLighting: string;
    productHighlight: string;
    reflectionControl: string;
    shadowPlanning: string;
}
export interface ProductConsistencyPlan {
    rules: ProductConsistencyRule[];
    shapeLock: boolean;
    colorLock: boolean;
    sizeReference: string;
    textureNotes: string;
    logoPlacement: string;
    packagingNotes: string;
}
export interface ProductMarketingVariationPlan {
    variation: ProductMarketingVariation;
    platform: ProductImageGenPlatform;
    aspectRatio: string;
    resolution: string;
    adaptationNotes: string[];
}
export interface ProductImagePlatformOptimization {
    platform: ProductImageGenPlatform;
    aspectRatio: string;
    resolution: string;
    marketplaceNotes: string[];
    optimizationNotes: string[];
}
export interface ProductionProductImageInstructions {
    renderNotes: string[];
    photographyGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface ProductImageGenerationScores {
    productPresentationScore: number;
    photographyScore: number;
    brandConsistencyScore: number;
    marketplaceReadinessScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface ProductImageGenerationRelationships {
    products: string[];
    brands: string[];
    campaigns: string[];
    sourceImages: string[];
    generatedImages: string[];
    templates: string[];
    knowledgeRecords: string[];
    textToImagePlans: string[];
    imageToImagePlans: string[];
}
export interface ProductImageGenerationInput {
    productId: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: ProductImageGenPlatform;
    language?: string;
    productCategory?: string;
    sourceImageIds?: string[];
    styleReferenceIds?: string[];
    knowledgeRecordIds?: string[];
    photographyMode?: ProductPhotographyMode;
    backgroundType?: ProductImageBackgroundType;
    textToImagePlanId?: string;
    generateMarketingVariations?: boolean;
    generatePlatformOptimizations?: boolean;
    inputTypes?: ProductImageGenInputType[];
}
export interface ProductImageGenerationRecord {
    productImagePlanId: string;
    profile: ProductImagePlanProfile;
    presentationPlan: ProductPresentationPlan;
    photographyPlan: ProductPhotographyPlan;
    backgroundPlan: ProductBackgroundPlan;
    lightingPlan: ProductLightingPlan;
    consistencyPlan: ProductConsistencyPlan;
    marketingVariations: ProductMarketingVariationPlan[];
    platformOptimizations: ProductImagePlatformOptimization[];
    productionInstructions: ProductionProductImageInstructions;
    blueprintId?: string;
    scores: ProductImageGenerationScores;
    relationships: ProductImageGenerationRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    marketplaceReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface ProductImageGenerationResult {
    success: boolean;
    record?: ProductImageGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ProductImageGenerationSearchQuery {
    productImagePlanId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: ProductImageGenPlatform;
    productCategory?: string;
    photographyMode?: ProductPhotographyMode;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface ProductImageGenerationEngineStatusReport {
    engineStatus: string;
    productPlanningStatus: string;
    photographyPlanningStatus: string;
    backgroundPlanningStatus: string;
    consistencyStatus: string;
    marketplaceOptimizationStatus: string;
    productImagePlansGenerated: number;
    averageProductPresentationScore: number;
    averageMarketplaceReadinessScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averagePlanningMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ProductImageGenerationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_PRODUCT_PRESENTATION_VIEWS: ProductPresentationView[];
export declare const ALL_PRODUCT_PHOTOGRAPHY_MODES: ProductPhotographyMode[];
export declare const ALL_PRODUCT_CONSISTENCY_RULES: ProductConsistencyRule[];
export declare const ALL_PRODUCT_MARKETING_VARIATIONS: ProductMarketingVariation[];
export declare const ALL_PRODUCT_IMAGE_GEN_PLATFORMS: ProductImageGenPlatform[];
export declare const PLATFORM_CONFIG: Record<ProductImageGenPlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
}>;
//# sourceMappingURL=types.d.ts.map