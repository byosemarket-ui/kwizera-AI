/**
 * KWIZERA AI STUDIO — Branding & Graphic Design Engine types (Step 9H)
 */
export declare enum BrandDesignGenPlatform {
    Website = "website",
    Mobile = "mobile",
    Instagram = "instagram",
    Facebook = "facebook",
    LinkedIn = "linkedin",
    TikTok = "tiktok",
    YouTube = "youtube",
    Print = "print",
    Catalogue = "catalogue",
    Billboard = "billboard"
}
export declare enum BrandDesignGenInputType {
    BrandGuidelines = "brand-guidelines",
    Product = "product",
    Campaign = "campaign",
    MarketingObjective = "marketing-objective",
    Prompt = "prompt",
    Image = "image",
    Logo = "logo",
    Font = "font",
    Icon = "icon",
    ColorPalette = "color-palette",
    Template = "template",
    KnowledgeRecord = "knowledge-record"
}
export declare enum BrandDesignType {
    BrandingPlan = "branding-plan",
    LogoDesign = "logo-design",
    PosterLayout = "poster-layout",
    FlyerLayout = "flyer-layout",
    BannerLayout = "banner-layout",
    BusinessCardLayout = "business-card-layout",
    BrochureLayout = "brochure-layout",
    PackagingLayout = "packaging-layout",
    SocialMediaGraphic = "social-media-graphic",
    ThumbnailLayout = "thumbnail-layout",
    PresentationGraphic = "presentation-graphic"
}
export declare enum BrandDesignMaterialType {
    Poster = "poster",
    Flyer = "flyer",
    Brochure = "brochure",
    RollUpBanner = "roll-up-banner",
    Billboard = "billboard",
    SocialMediaPost = "social-media-post",
    Story = "story",
    Cover = "cover",
    BusinessCard = "business-card",
    Letterhead = "letterhead",
    Envelope = "envelope",
    Packaging = "packaging"
}
export declare enum BrandDesignSocialFormat {
    InstagramPost = "instagram-post",
    InstagramStory = "instagram-story",
    FacebookPost = "facebook-post",
    FacebookCover = "facebook-cover",
    LinkedInPost = "linkedin-post",
    LinkedInBanner = "linkedin-banner",
    TikTokCover = "tiktok-cover",
    YouTubeThumbnail = "youtube-thumbnail",
    YouTubeBanner = "youtube-banner"
}
export declare enum BrandDesignPrintFormat {
    A4 = "a4",
    A5 = "a5",
    A3 = "a3",
    BusinessCard = "business-card",
    RollUpBanner = "roll-up-banner",
    Billboard = "billboard",
    Packaging = "packaging",
    Sticker = "sticker",
    Label = "label"
}
export declare enum BrandDesignLogoVariant {
    PrimaryLogo = "primary-logo",
    SecondaryLogo = "secondary-logo",
    IconVersion = "icon-version",
    MonochromeVersion = "monochrome-version",
    LightBackgroundVersion = "light-background-version",
    DarkBackgroundVersion = "dark-background-version"
}
export declare enum BrandDesignConsistencyElement {
    LogoUsage = "logo-usage",
    Typography = "typography",
    ColorPalette = "color-palette",
    BrandStyle = "brand-style",
    BrandVoice = "brand-voice",
    VisualIdentity = "visual-identity"
}
export interface BrandDesignProfile {
    brandDesignId: string;
    projectId: string;
    brandId: string;
    campaignId: string;
    productId: string;
    platform: BrandDesignGenPlatform;
    designType: BrandDesignType;
    promptId: string;
    version: number;
    language: string;
}
export interface DesignPlanningPlan {
    layoutStructure: string;
    visualHierarchy: string;
    gridSystem: string;
    composition: string;
    alignment: string;
    whiteSpacePlanning: string;
    typographyPlanning: string[];
    iconPlanning: string[];
    illustrationPlanning: string[];
}
export interface LogoPlanningPlan {
    variants: BrandDesignLogoVariant[];
    primaryLogoNotes: string;
    secondaryLogoNotes: string;
    iconVersionNotes: string;
    monochromeNotes: string;
    lightBackgroundNotes: string;
    darkBackgroundNotes: string;
    usageGuidelines: string[];
}
export interface MarketingMaterialsPlan {
    materials: BrandDesignMaterialType[];
    materialNotes: Record<string, string>;
    campaignAdaptations: string[];
}
export interface SocialMediaDesignPlan {
    formats: BrandDesignSocialFormat[];
    formatSpecs: Record<string, {
        aspectRatio: string;
        resolution: string;
    }>;
    platformNotes: string[];
}
export interface PrintDesignPlan {
    formats: BrandDesignPrintFormat[];
    formatSpecs: Record<string, {
        dimensions: string;
        bleed: string;
    }>;
    printNotes: string[];
}
export interface BrandConsistencyPlan {
    elements: BrandDesignConsistencyElement[];
    logoUsageRules: string[];
    typographyRules: string[];
    colorPaletteRules: string[];
    brandStyleRules: string[];
    brandVoiceNotes: string[];
    visualIdentityNotes: string[];
}
export interface ColorManagementPlan {
    rgbPalette: string[];
    cmykPalette: string[];
    pantoneReferences: string[];
    iccProfilePlanning: string;
    contrastValidation: string;
}
export interface BrandingDesignScores {
    brandingScore: number;
    graphicDesignScore: number;
    layoutScore: number;
    typographyScore: number;
    brandConsistencyScore: number;
    printReadinessScore: number;
    aiConfidenceScore: number;
}
export interface BrandingDesignRelationships {
    brands: string[];
    products: string[];
    campaigns: string[];
    templates: string[];
    images: string[];
    logos: string[];
    knowledgeRecords: string[];
    productImagePlans: string[];
    enhancementPlans: string[];
}
export interface BrandingDesignInput {
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    marketingObjective?: string;
    designPrompt?: string;
    platform?: BrandDesignGenPlatform;
    designType?: BrandDesignType;
    language?: string;
    logoIds?: string[];
    fontIds?: string[];
    iconIds?: string[];
    colorPalette?: string[];
    templateIds?: string[];
    imageIds?: string[];
    knowledgeRecordIds?: string[];
    productImagePlanId?: string;
    enhancementPlanId?: string;
    generateLogoPlan?: boolean;
    generateMarketingMaterials?: boolean;
    generateSocialMediaDesign?: boolean;
    generatePrintDesign?: boolean;
    generatePlatformOptimizations?: boolean;
    inputTypes?: BrandDesignGenInputType[];
}
export interface BrandingDesignRecord {
    brandDesignId: string;
    profile: BrandDesignProfile;
    designPlanning: DesignPlanningPlan;
    logoPlanning: LogoPlanningPlan;
    marketingMaterials: MarketingMaterialsPlan;
    socialMediaDesign: SocialMediaDesignPlan;
    printDesign: PrintDesignPlan;
    brandConsistency: BrandConsistencyPlan;
    colorManagement: ColorManagementPlan;
    platformOptimizations: Array<{
        platform: BrandDesignGenPlatform;
        aspectRatio: string;
        resolution: string;
        notes: string[];
    }>;
    productionInstructions: {
        renderNotes: string[];
        layoutGuidance: string[];
        exportPreparation: string[];
        qualityTargets: string[];
    };
    blueprintId?: string;
    scores: BrandingDesignScores;
    relationships: BrandingDesignRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    printReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface BrandingDesignResult {
    success: boolean;
    record?: BrandingDesignRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface BrandingDesignSearchQuery {
    brandDesignId?: string;
    brandId?: string;
    productId?: string;
    campaignId?: string;
    platform?: BrandDesignGenPlatform;
    designType?: BrandDesignType;
    templateId?: string;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface BrandingDesignEngineStatusReport {
    engineStatus: string;
    designPlanningStatus: string;
    logoPlanningStatus: string;
    marketingMaterialsStatus: string;
    socialMediaDesignStatus: string;
    printDesignStatus: string;
    brandingPlansGenerated: number;
    averageBrandingScore: number;
    averagePrintReadinessScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averagePlanningMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class BrandingDesignEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_BRAND_DESIGN_TYPES: BrandDesignType[];
export declare const ALL_BRAND_DESIGN_MATERIALS: BrandDesignMaterialType[];
export declare const ALL_BRAND_DESIGN_SOCIAL_FORMATS: BrandDesignSocialFormat[];
export declare const ALL_BRAND_DESIGN_PRINT_FORMATS: BrandDesignPrintFormat[];
export declare const ALL_BRAND_DESIGN_LOGO_VARIANTS: BrandDesignLogoVariant[];
export declare const ALL_BRAND_DESIGN_CONSISTENCY_ELEMENTS: BrandDesignConsistencyElement[];
export declare const ALL_BRAND_DESIGN_GEN_PLATFORMS: BrandDesignGenPlatform[];
export declare const BRAND_DESIGN_PLATFORM_CONFIG: Record<BrandDesignGenPlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
}>;
export declare const SOCIAL_FORMAT_CONFIG: Record<BrandDesignSocialFormat, {
    aspectRatio: string;
    resolution: string;
}>;
export declare const PRINT_FORMAT_CONFIG: Record<BrandDesignPrintFormat, {
    dimensions: string;
    bleed: string;
}>;
//# sourceMappingURL=types.d.ts.map