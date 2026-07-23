/**

 * KWIZERA AI STUDIO — Creative Image Intelligence Engine types (Step 6J)

 */
export declare enum CreativeImagePlatform {
    InstagramPost = "instagram-post",
    InstagramStory = "instagram-story",
    InstagramReelCover = "instagram-reel-cover",
    FacebookPost = "facebook-post",
    FacebookStory = "facebook-story",
    TikTokCover = "tiktok-cover",
    YouTubeThumbnail = "youtube-thumbnail",
    YouTubeCommunity = "youtube-community",
    WhatsAppStatus = "whatsapp-status",
    WebsiteBanner = "website-banner"
}
export declare enum CreativeLayoutType {
    Poster = "poster",
    Advertisement = "advertisement",
    Thumbnail = "thumbnail",
    Banner = "banner",
    SocialMedia = "social-media",
    Branding = "branding",
    ProductShowcase = "product-showcase"
}
export declare enum CreativeStyleCategory {
    Luxury = "luxury",
    Premium = "premium",
    Modern = "modern",
    Minimal = "minimal",
    Corporate = "corporate",
    Technology = "technology",
    Fashion = "fashion",
    Beauty = "beauty",
    Food = "food",
    Restaurant = "restaurant",
    Electronics = "electronics",
    RealEstate = "real-estate",
    Education = "education",
    Healthcare = "healthcare"
}
export declare enum MarketingLayoutType {
    Promotional = "promotional",
    ProductShowcase = "product-showcase",
    Offer = "offer",
    Discount = "discount",
    LaunchCampaign = "launch-campaign",
    SeasonalCampaign = "seasonal-campaign",
    BrandAwareness = "brand-awareness",
    LeadGeneration = "lead-generation"
}
export interface CreativeImageProfile {
    creativeImageId: string;
    projectId: string;
    imageId: string;
    product: string;
    brand: string;
    campaign: string;
    platform: CreativeImagePlatform;
    creativeVersion: string;
}
export interface LayoutPlanning {
    layoutType: CreativeLayoutType;
    visualHierarchy: string;
    productPlacement: string;
    logoPlacement: string;
    headlinePlacement: string;
    subtitlePlacement: string;
    ctaPlacement: string;
    contactInformationPlacement: string;
    qrCodePlacement: string;
    safeAreas: string;
}
export interface CreativeStylePlanning {
    primaryStyle: CreativeStyleCategory;
    secondaryStyle: CreativeStyleCategory;
    styleDirection: string;
    typographyDirection: string;
    colorDirection: string;
    moodDirection: string;
    graphicTreatment: string;
}
export interface MarketingPreparation {
    promotionalLayout: string;
    productShowcase: string;
    offerLayout: string;
    discountLayout: string;
    launchCampaign: string;
    seasonalCampaign: string;
    brandAwareness: string;
    leadGeneration: string;
}
export interface PlatformPreparation {
    instagramPost: string;
    instagramStory: string;
    instagramReelCover: string;
    facebookPost: string;
    facebookStory: string;
    tiktokCover: string;
    youtubeThumbnail: string;
    youtubeCommunity: string;
    whatsappStatus: string;
    websiteBanner: string;
}
export interface CreativeProductionInstructions {
    headlineGuidance: string;
    subtitleGuidance: string;
    ctaGuidance: string;
    imageryGuidance: string;
    brandGuidance: string;
    platformGuidance: string;
    productionNotes: string;
}
export interface CreativeImageIntelligenceScores {
    creativeLayoutScore: number;
    marketingScore: number;
    brandConsistencyScore: number;
    readabilityScore: number;
    visualImpactScore: number;
    aiConfidenceScore: number;
}
export interface CreativeImageIntelligenceRelationships {
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedCreativeStyles: string[];
    relatedMarketingStrategy: string[];
    relatedVisualPlans: string[];
    relatedEnhancementPlans: string[];
    relatedCompositionIntelligence: string[];
    relatedBrandVisualIntelligence: string[];
    relatedProjects: string[];
    relatedKnowledge: string[];
}
export interface CreativeImageRecommendation {
    category: "layout" | "style" | "marketing" | "brand" | "platform" | "production";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface CreativeImageIntelligenceInput {
    imageId: string;
    projectId?: string;
    campaign?: string;
    platform?: CreativeImagePlatform;
    layoutType?: CreativeLayoutType;
    creativeStyle?: CreativeStyleCategory;
    marketingType?: MarketingLayoutType;
    relatedProjects?: string[];
    relatedKnowledge?: string[];
    keywords?: string[];
}
export interface CreativeImageIntelligenceRecord {
    imageId: string;
    profile: CreativeImageProfile;
    analysisId: string;
    understandingId: string;
    compositionId: string;
    brandVisualId: string;
    enhancementPlanId?: string;
    layoutPlanning: LayoutPlanning;
    creativeStyle: CreativeStylePlanning;
    marketingPreparation: MarketingPreparation;
    platformPreparation: PlatformPreparation;
    productionInstructions: CreativeProductionInstructions;
    scores: CreativeImageIntelligenceScores;
    relationships: CreativeImageIntelligenceRelationships;
    recommendations: CreativeImageRecommendation[];
    keywords: string[];
    productionReady: boolean;
    validated: boolean;
    plannedAt: string;
    lastUpdated: string;
    version: number;
}
export interface CreativeImageIntelligenceResult {
    success: boolean;
    record?: CreativeImageIntelligenceRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface CreativeImageIntelligenceSearchQuery {
    imageId?: string;
    creativeType?: CreativeLayoutType;
    platform?: CreativeImagePlatform;
    brand?: string;
    product?: string;
    campaign?: string;
    creativeStyle?: CreativeStyleCategory;
    minLayoutScore?: number;
    keywords?: string[];
    limit?: number;
}
export interface CreativeImageIntelligenceEngineStatusReport {
    engineStatus: string;
    creativePlanningStatus: string;
    layoutPlanningStatus: string;
    brandConsistencyStatus: string;
    marketingAlignmentStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    plansCreated: number;
    averageLayoutScore: number;
    averageMarketingScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
        averageRelationshipMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class CreativeImageIntelligenceEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map