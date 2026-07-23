/**
 * KWIZERA AI STUDIO — Creative Knowledge Engine types (Step 4K)
 */
export declare enum KnowledgeCreativeDomain {
    GraphicDesign = "graphic-design",
    MotionGraphics = "motion-graphics",
    VideoEditing = "video-editing",
    Storyboarding = "storyboarding",
    AdvertisingDesign = "advertising-design",
    PosterDesign = "poster-design",
    SocialMediaDesign = "social-media-design",
    ThumbnailDesign = "thumbnail-design",
    ProductShowcase = "product-showcase",
    PresentationDesign = "presentation-design",
    UIInspiration = "ui-inspiration",
    CreativeDirection = "creative-direction"
}
export declare enum KnowledgeCreativeDirectionStyle {
    Minimal = "minimal",
    Bold = "bold",
    Cinematic = "cinematic",
    Commercial = "commercial",
    Editorial = "editorial",
    Playful = "playful",
    Premium = "premium",
    Futuristic = "futuristic"
}
export declare enum KnowledgeCreativePlatform {
    TikTok = "tiktok",
    Instagram = "instagram",
    Facebook = "facebook",
    YouTube = "youtube",
    YouTubeShorts = "youtube-shorts",
    WhatsApp = "whatsapp",
    Future = "future"
}
export declare enum KnowledgeCreativeMarketingGoal {
    Conversion = "conversion",
    Awareness = "awareness",
    Engagement = "engagement",
    BrandBuilding = "brand-building"
}
export interface VisualDesignKnowledge {
    composition: string;
    layout: string;
    balance: number;
    contrast: number;
    colorHarmony: string;
    typography: string;
    visualHierarchy: string;
    negativeSpace: number;
    whiteSpace: number;
    iconography: string;
    gridSystem: string;
}
export interface CreativeStorytellingKnowledge {
    storyStructure: string;
    sceneFlow: string;
    emotionalJourney: string;
    attentionRetention: number;
    productReveal: string;
    narrativeFlow: string;
    visualRhythm: string;
    endingStrategy: string;
}
export interface AnimationKnowledge {
    motionPrinciples: string[];
    timing: string;
    spacing: string;
    easeIn: string;
    easeOut: string;
    motionCurves: string;
    cameraMotion: string;
    objectAnimation: string;
    textAnimation: string;
    logoAnimation: string;
    animationQuality: number;
}
export interface CinematicKnowledge {
    cameraLanguage: string;
    lighting: string;
    framing: string;
    composition: string;
    colorGrading: string;
    scenePacing: string;
    transitions: string[];
    visualContinuity: number;
}
export interface SocialCreativeKnowledge {
    platform: KnowledgeCreativePlatform;
    format: string;
    bestPractices: string[];
    hookStrategy: string;
    aspectRatio: string;
}
export interface CreativeKnowledgeQualityScores {
    creativeQualityScore: number;
    visualDesignScore: number;
    storytellingScore: number;
    animationScore: number;
    brandConsistencyScore: number;
    marketingReadinessScore: number;
    aiConfidenceScore: number;
}
export interface CreativeKnowledgeRelationships {
    creativeStyles: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedVideos: string[];
    relatedImages: string[];
    relatedCampaigns: string[];
    relatedMarketingStrategies: string[];
    relatedTemplates: string[];
    relatedWorkflows: string[];
}
export interface CreativeKnowledgeRecommendation {
    category: "layout" | "typography" | "composition" | "motion" | "storytelling" | "visual-style" | "branding" | "creative-direction";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface CreativeAnalysisInput {
    creativeId?: string;
    projectName: string;
    domain?: KnowledgeCreativeDomain;
    creativeStyle?: KnowledgeCreativeDirectionStyle;
    platform?: KnowledgeCreativePlatform;
    industry?: string;
    brandName?: string;
    productName?: string;
    marketingGoal?: KnowledgeCreativeMarketingGoal;
    colorPalette?: string[];
    animationStyle?: string;
    visual?: Partial<VisualDesignKnowledge>;
    storytelling?: Partial<CreativeStorytellingKnowledge>;
    animation?: Partial<AnimationKnowledge>;
    cinematic?: Partial<CinematicKnowledge>;
    social?: Partial<SocialCreativeKnowledge>;
    tags?: string[];
    keywords?: string[];
    relatedKnowledge?: string[];
    relatedMemory?: string[];
}
export interface CreativeAnalysisRecord {
    creativeId: string;
    knowledgeId: string;
    projectName: string;
    domain: KnowledgeCreativeDomain;
    creativeStyle: KnowledgeCreativeDirectionStyle;
    platform: KnowledgeCreativePlatform;
    industry: string;
    brandName: string;
    productName: string;
    marketingGoal: KnowledgeCreativeMarketingGoal;
    colorPalette: string[];
    animationStyle: string;
    visual: VisualDesignKnowledge;
    storytelling: CreativeStorytellingKnowledge;
    animation: AnimationKnowledge;
    cinematic: CinematicKnowledge;
    social: SocialCreativeKnowledge;
    scores: CreativeKnowledgeQualityScores;
    relationships: CreativeKnowledgeRelationships;
    recommendations: CreativeKnowledgeRecommendation[];
    tags: string[];
    keywords: string[];
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface CreativeAnalysisResult {
    success: boolean;
    record?: CreativeAnalysisRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface CreativeSearchQuery {
    creativeStyle?: KnowledgeCreativeDirectionStyle;
    designType?: KnowledgeCreativeDomain;
    industry?: string;
    brand?: string;
    product?: string;
    animationStyle?: string;
    colorPalette?: string[];
    typography?: string;
    platform?: KnowledgeCreativePlatform;
    marketingGoal?: KnowledgeCreativeMarketingGoal;
    text?: string;
    minCreativeQuality?: number;
    limit?: number;
}
export interface CreativeKnowledgeLearningPattern {
    patternId: string;
    patternType: "visual-design" | "storytelling" | "animation" | "cinematic" | "social" | "direction" | "workflow";
    description: string;
    sourceCreativeId: string;
    confidence: number;
    detectedAt: string;
}
export interface CreativeKnowledgeStatusReport {
    engineStatus: string;
    designKnowledgeStatus: string;
    storytellingStatus: string;
    animationKnowledgeStatus: string;
    relationshipStatus: string;
    projectsAnalyzed: number;
    patternsLearned: number;
    averageCreativeQualityScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageRecommendationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class CreativeKnowledgeEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map