/**
 * KWIZERA AI STUDIO — Background Intelligence Engine types (Step 6E)
 */
export declare enum BackgroundType {
    Studio = "studio",
    Lifestyle = "lifestyle",
    Indoor = "indoor",
    Outdoor = "outdoor",
    Nature = "nature",
    Office = "office",
    Commercial = "commercial",
    Transparent = "transparent",
    Gradient = "gradient",
    Abstract = "abstract",
    Custom = "custom"
}
export declare enum BackgroundComplexity {
    Minimal = "minimal",
    Low = "low",
    Medium = "medium",
    High = "high",
    VeryHigh = "very-high"
}
export declare enum BackgroundMarketingGoal {
    Conversion = "conversion",
    Awareness = "awareness",
    Engagement = "engagement",
    Retention = "retention",
    Launch = "launch",
    Education = "education"
}
export interface BackgroundAnalysis {
    backgroundType: BackgroundType;
    backgroundComplexity: BackgroundComplexity;
    backgroundColors: string[];
    backgroundBrightness: number;
    backgroundContrast: number;
    backgroundTexture: string;
    backgroundPattern: string;
    backgroundDepth: string;
    backgroundPerspective: string;
    backgroundCleanliness: number;
}
export interface BackgroundClassification {
    backgroundType: BackgroundType;
    classificationTags: string[];
    industryFit: string;
    sceneAlignment: string;
}
export interface BackgroundQuality {
    visualQuality: number;
    productVisibility: number;
    backgroundDistraction: number;
    colorHarmony: number;
    brandCompatibility: number;
    marketingSuitability: number;
}
export interface BackgroundSuitability {
    productShowcase: number;
    advertisement: number;
    socialMedia: number;
    poster: number;
    banner: number;
    thumbnail: number;
    videoProduction: number;
}
export interface BackgroundReplacementPlan {
    backgroundIsolationPlan: string;
    replacementStrategy: string;
    colorHarmonyStrategy: string;
    lightingConsistency: string;
    perspectiveConsistency: string;
    shadowConsistency: string;
}
export interface BackgroundIntelligenceScores {
    backgroundQualityScore: number;
    backgroundSuitabilityScore: number;
    brandCompatibilityScore: number;
    creativeReadinessScore: number;
    marketingReadinessScore: number;
    aiConfidenceScore: number;
}
export interface BackgroundIntelligenceRelationships {
    relatedProducts: string[];
    relatedBrands: string[];
    relatedScenes: string[];
    relatedCreativeStyles: string[];
    relatedMarketingCampaigns: string[];
    relatedVisualPlans: string[];
    relatedKnowledge: string[];
    relatedBackgrounds: string[];
    relatedImages: string[];
    relatedProjects: string[];
}
export interface BackgroundIntelligenceRecommendation {
    category: "quality" | "suitability" | "replacement" | "branding" | "creative" | "marketing";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface BackgroundIntelligenceInput {
    imageId: string;
    industry?: string;
    marketingGoal?: BackgroundMarketingGoal;
    relatedProjects?: string[];
    relatedKnowledge?: string[];
    keywords?: string[];
}
export interface BackgroundIntelligenceRecord {
    imageId: string;
    backgroundId: string;
    analysisId: string;
    understandingId: string;
    detectionId: string;
    backgroundLabel: string;
    analysis: BackgroundAnalysis;
    classification: BackgroundClassification;
    quality: BackgroundQuality;
    suitability: BackgroundSuitability;
    replacementPlan: BackgroundReplacementPlan;
    scores: BackgroundIntelligenceScores;
    relationships: BackgroundIntelligenceRelationships;
    recommendations: BackgroundIntelligenceRecommendation[];
    keywords: string[];
    validated: boolean;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface BackgroundIntelligenceResult {
    success: boolean;
    record?: BackgroundIntelligenceRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface BackgroundIntelligenceSearchQuery {
    backgroundType?: BackgroundType;
    industry?: string;
    brand?: string;
    product?: string;
    scene?: string;
    creativeStyle?: string;
    marketingGoal?: BackgroundMarketingGoal;
    imageId?: string;
    keywords?: string[];
    limit?: number;
}
export interface BackgroundIntelligenceEngineStatusReport {
    engineStatus: string;
    backgroundAnalysisStatus: string;
    classificationStatus: string;
    suitabilityStatus: string;
    replacementPlanningStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imagesAnalyzed: number;
    averageQualityScore: number;
    averageSuitabilityScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageRelationshipMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class BackgroundIntelligenceEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map