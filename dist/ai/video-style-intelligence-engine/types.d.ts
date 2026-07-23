/**
 * KWIZERA AI STUDIO — Video Style Intelligence Engine types (Step 7H)
 */
export declare enum StyleCategory {
    Commercial = "commercial",
    Corporate = "corporate",
    Social = "social",
    Educational = "educational",
    Promotional = "promotional",
    Cinematic = "cinematic",
    Branded = "branded"
}
export declare enum CinematicStyleClass {
    Commercial = "commercial",
    Documentary = "documentary",
    Corporate = "corporate",
    Luxury = "luxury",
    Modern = "modern",
    Minimal = "minimal",
    Technology = "technology",
    Fashion = "fashion",
    Food = "food",
    Beauty = "beauty",
    RealEstate = "real-estate",
    Education = "education",
    Healthcare = "healthcare",
    SocialMedia = "social-media",
    Entertainment = "entertainment"
}
export declare enum StyleTemplatePlatform {
    ProductAds = "product-ads",
    SocialMedia = "social-media",
    Shorts = "shorts",
    Reels = "reels",
    TikTok = "tiktok",
    YouTube = "youtube",
    Website = "website",
    CorporateVideos = "corporate-videos"
}
export interface VideoStyleProfile {
    styleId: string;
    styleName: string;
    styleCategory: StyleCategory;
    industry: string;
    brand: string;
    campaign: string;
    styleVersion: number;
}
export interface VisualStyleAnalysis {
    colorGradingStyle: string;
    lightingStyle: string;
    compositionStyle: string;
    cameraStyle: string;
    motionStyle: string;
    backgroundStyle: string;
    typographyStyle: string;
    graphicStyle: string;
    visualIdentity: string;
}
export interface EditingStyleAnalysis {
    editingRhythm: string;
    pacing: string;
    transitionStyle: string;
    cutStyle: string;
    effectStyle: string;
    animationStyle: string;
    captionStyle: string;
    audioSyncStyle: string;
}
export interface BrandStyleAnalysis {
    brandColors: string[];
    brandTypography: string;
    logoUsage: string;
    visualConsistency: number;
    ctaStyle: string;
    marketingIdentity: string;
}
export interface StyleTemplate {
    templateId: string;
    platform: StyleTemplatePlatform;
    name: string;
    description: string;
    recommendedVisual: Partial<VisualStyleAnalysis>;
    recommendedEditing: Partial<EditingStyleAnalysis>;
    matchScore: number;
}
export interface StyleRecommendation {
    category: "editing" | "color" | "motion" | "camera" | "typography" | "effects" | "transitions";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface StyleQualityScores {
    styleConsistencyScore: number;
    cinematicScore: number;
    brandStyleScore: number;
    editingQualityScore: number;
    marketingReadinessScore: number;
    aiConfidenceScore: number;
}
export interface StyleRelationships {
    relatedBrands: string[];
    relatedProducts: string[];
    relatedCampaigns: string[];
    relatedStoryboards: string[];
    relatedCreativePlans: string[];
    relatedMotionPlans: string[];
    relatedCameraPlans: string[];
    relatedTimelines: string[];
    relatedKnowledge: string[];
    relatedVideos: string[];
    relatedMemory: string[];
    relatedProjects: string[];
}
export interface VideoStyleIntelligenceInput {
    videoId: string;
    projectId?: string;
    industry?: string;
    relatedStoryboards?: string[];
    relatedCreativePlans?: string[];
    relatedKnowledge?: string[];
    relatedProjects?: string[];
}
export interface VideoStyleIntelligenceRecord {
    videoId: string;
    intelligenceId: string;
    analysisId: string;
    detectionId: string;
    motionIntelligenceId?: string;
    cameraIntelligenceId?: string;
    timelineId?: string;
    profile: VideoStyleProfile;
    visualStyle: VisualStyleAnalysis;
    editingStyle: EditingStyleAnalysis;
    cinematicStyles: CinematicStyleClass[];
    dominantCinematicStyle: CinematicStyleClass;
    brandStyle: BrandStyleAnalysis;
    templates: StyleTemplate[];
    scores: StyleQualityScores;
    relationships: StyleRelationships;
    recommendations: StyleRecommendation[];
    keywords: string[];
    validated: boolean;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface VideoStyleIntelligenceResult {
    success: boolean;
    record?: VideoStyleIntelligenceRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface VideoStyleSearchQuery {
    videoId?: string;
    style?: CinematicStyleClass;
    industry?: string;
    brand?: string;
    campaign?: string;
    platform?: StyleTemplatePlatform;
    product?: string;
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface VideoStyleEngineStatusReport {
    engineStatus: string;
    styleAnalysisStatus: string;
    editingStyleStatus: string;
    cinematicClassificationStatus: string;
    brandStyleStatus: string;
    templateLibraryStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imageIntelligenceBridgeStatus: string;
    videosProcessed: number;
    templatesAvailable: number;
    averageStyleConsistencyScore: number;
    averageBrandStyleScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoStyleIntelligenceEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map