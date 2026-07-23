/**
 * KWIZERA AI STUDIO — Image Understanding Engine types (Step 6C)
 */
export declare enum ImageUnderstandingMarketingGoal {
    Conversion = "conversion",
    Awareness = "awareness",
    Engagement = "engagement",
    Retention = "retention",
    Launch = "launch",
    Education = "education"
}
export declare enum ImageSceneType {
    Indoor = "indoor",
    Outdoor = "outdoor",
    Studio = "studio",
    Lifestyle = "lifestyle",
    Commercial = "commercial",
    ProductShowcase = "product-showcase",
    Promotional = "promotional",
    BackgroundContext = "background-context"
}
export declare enum ImageUnderstandingPlatform {
    Web = "web",
    Social = "social",
    Ecommerce = "ecommerce",
    Print = "print",
    Mobile = "mobile",
    MultiPlatform = "multi-platform"
}
export interface ImageIdentity {
    imageId: string;
    imageName: string;
    imageType: string;
    analysisId: string;
    visualSummary: string;
}
export interface ImagePurpose {
    primaryPurpose: string;
    intendedUse: string;
    creativeIntent: string;
    whyThisImageExists: string;
}
export interface ImageContextUnderstanding {
    visualContext: string;
    productContext: string;
    brandContext: string;
    marketingContext: string;
    creativeContext: string;
}
export interface SceneUnderstanding {
    sceneType: ImageSceneType;
    environment: string;
    setting: string;
    mood: string;
    sceneDescription: string;
    preparedScenes: ImageSceneType[];
}
export interface VisualUnderstanding {
    mainSubject: string;
    secondarySubjects: string[];
    foreground: string;
    background: string;
    composition: string;
    perspective: string;
    visualFocus: string;
    visualHierarchy: string;
}
export interface ProductInImageUnderstanding {
    productVisibility: number;
    productPosition: string;
    productImportance: string;
    productContext: string;
    productPresentation: string;
    productReadiness: boolean;
}
export interface BrandUnderstanding {
    logoPresence: boolean;
    brandIdentity: string;
    brandVisibility: number;
    brandConsistency: number;
    brandCommunication: string;
}
export interface MarketingUnderstanding {
    promotionalPurpose: string;
    audienceRelevance: string;
    marketingOpportunity: string;
    storytellingOpportunity: string;
    ctaOpportunity: string;
}
export interface UnderstandingRecommendation {
    category: "composition" | "branding" | "marketing" | "product" | "creative" | "enhancement";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface ImageUnderstandingScores {
    imageUnderstandingScore: number;
    productUnderstandingScore: number;
    marketingReadinessScore: number;
    brandConsistencyScore: number;
    creativeReadinessScore: number;
    aiConfidenceScore: number;
}
export interface ImageUnderstandingRelationships {
    relatedProducts: string[];
    relatedBrands: string[];
    relatedProjects: string[];
    relatedMarketingCampaigns: string[];
    relatedCreativeStyles: string[];
    relatedKnowledge: string[];
    relatedImages: string[];
    relatedStoryboards: string[];
    relatedMemory: string[];
}
export interface ImageUnderstandingInput {
    imageId: string;
    marketingGoal?: ImageUnderstandingMarketingGoal;
    platform?: ImageUnderstandingPlatform;
    industry?: string;
    relatedProjects?: string[];
    relatedKnowledge?: string[];
    relatedStoryboards?: string[];
}
export interface ImageUnderstandingRecord {
    imageId: string;
    understandingId: string;
    analysisId: string;
    identity: ImageIdentity;
    purpose: ImagePurpose;
    context: ImageContextUnderstanding;
    scene: SceneUnderstanding;
    visual: VisualUnderstanding;
    product: ProductInImageUnderstanding;
    brand: BrandUnderstanding;
    marketing: MarketingUnderstanding;
    scores: ImageUnderstandingScores;
    relationships: ImageUnderstandingRelationships;
    recommendations: UnderstandingRecommendation[];
    marketingGoal: ImageUnderstandingMarketingGoal;
    platform: ImageUnderstandingPlatform;
    industry: string;
    keywords: string[];
    validated: boolean;
    understoodAt: string;
    lastUpdated: string;
    version: number;
}
export interface ImageUnderstandingResult {
    success: boolean;
    record?: ImageUnderstandingRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageUnderstandingSearchQuery {
    imagePurpose?: string;
    product?: string;
    brand?: string;
    marketingGoal?: ImageUnderstandingMarketingGoal;
    creativeStyle?: string;
    industry?: string;
    platform?: ImageUnderstandingPlatform;
    sceneType?: ImageSceneType;
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface ImageUnderstandingEngineStatusReport {
    engineStatus: string;
    sceneUnderstandingStatus: string;
    productUnderstandingStatus: string;
    brandUnderstandingStatus: string;
    marketingUnderstandingStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imagesUnderstood: number;
    averageUnderstandingScore: number;
    averageMarketingReadinessScore: number;
    performance: {
        averageUnderstandingMs: number;
        averageSearchMs: number;
        averageRelationshipMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageUnderstandingEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map