/**
 * KWIZERA AI STUDIO — Marketing Knowledge Engine types (Step 4G)
 */
export declare enum KnowledgeMarketingPlatform {
    TikTok = "tiktok",
    Instagram = "instagram",
    Facebook = "facebook",
    YouTube = "youtube",
    WhatsApp = "whatsapp",
    Website = "website",
    Future = "future"
}
export declare enum KnowledgeCampaignType {
    ProductLaunch = "product-launch",
    BrandAwareness = "brand-awareness",
    Conversion = "conversion",
    Engagement = "engagement",
    Retargeting = "retargeting",
    ContentMarketing = "content-marketing",
    Ecommerce = "ecommerce",
    SocialMedia = "social-media",
    VideoMarketing = "video-marketing"
}
export declare enum KnowledgeMarketingGoal {
    Conversion = "conversion",
    Awareness = "awareness",
    Engagement = "engagement",
    Retention = "retention",
    LeadGeneration = "lead-generation",
    BrandBuilding = "brand-building"
}
export declare enum MarketingStyle {
    Emotional = "emotional",
    Rational = "rational",
    StoryDriven = "story-driven",
    DirectResponse = "direct-response",
    Educational = "educational",
    Premium = "premium"
}
export interface BrandStrategyKnowledge {
    brandVoice: string;
    brandPersonality: string;
    brandPositioning: string;
    brandMessaging: string;
    brandColors: string[];
    brandConsistency: number;
}
export interface ProductPositioningKnowledge {
    productName: string;
    valueProposition: string;
    uniqueSellingPoints: string[];
    competitiveAdvantage: string;
    targetSegment: string;
    positioningStatement: string;
}
export interface CustomerJourneyKnowledge {
    awarenessStage: string;
    considerationStage: string;
    decisionStage: string;
    retentionStage: string;
    touchpoints: string[];
}
export interface CustomerPsychologyKnowledge {
    customerIntent: string;
    customerMotivation: string;
    customerNeeds: string[];
    customerInterests: string[];
    customerBehavior: string;
    buyingTriggers: string[];
    trustFactors: string[];
    decisionFactors: string[];
}
export interface MarketingStructureKnowledge {
    hook: string;
    introduction: string;
    productPresentation: string;
    problem: string;
    solution: string;
    benefits: string[];
    socialProof: string;
    offer: string;
    callToAction: string;
    closing: string;
}
export interface CampaignKnowledge {
    campaignObjective: string;
    campaignFlow: string;
    campaignTiming: string;
    audienceTargeting: string;
    brandingConsistency: number;
    marketingStyle: MarketingStyle;
    performanceIndicators: string[];
}
export interface ContentKnowledge {
    headlines: string[];
    captions: string[];
    productDescriptions: string[];
    keywords: string[];
    hashtags: string[];
    promotionalScripts: string[];
    voiceStyle: string;
    copywritingStyle: string;
}
export interface PlatformKnowledge {
    platform: KnowledgeMarketingPlatform;
    contentFormat: string;
    optimalLength: string;
    bestPractices: string[];
}
export interface StorytellingKnowledge {
    narrativeArc: string;
    emotionalFlow: string;
    hookTiming: number;
    storyPacing: string;
    characterOrBrandRole: string;
}
export interface MarketingQualityScores {
    marketingQualityScore: number;
    brandConsistencyScore: number;
    customerRelevanceScore: number;
    campaignStructureScore: number;
    storytellingScore: number;
    conversionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface MarketingRelationships {
    relatedProducts: string[];
    relatedBrands: string[];
    relatedVideos: string[];
    relatedCampaigns: string[];
    relatedCustomers: string[];
    relatedCreativeStyles: string[];
    relatedBusinessGoals: string[];
}
export interface MarketingRecommendation {
    category: "headlines" | "hooks" | "cta" | "positioning" | "storytelling" | "campaign-structure" | "branding" | "targeting";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface MarketingAnalysisInput {
    campaignId?: string;
    campaignName: string;
    campaignType?: KnowledgeCampaignType;
    marketingGoal?: KnowledgeMarketingGoal;
    product?: string;
    brandName?: string;
    platform?: KnowledgeMarketingPlatform;
    audience?: string;
    language?: string;
    brand?: Partial<BrandStrategyKnowledge>;
    positioning?: Partial<ProductPositioningKnowledge>;
    customerJourney?: Partial<CustomerJourneyKnowledge>;
    customer?: Partial<CustomerPsychologyKnowledge>;
    structure?: Partial<MarketingStructureKnowledge>;
    campaign?: Partial<CampaignKnowledge>;
    content?: Partial<ContentKnowledge>;
    platformKnowledge?: Partial<PlatformKnowledge>;
    storytelling?: Partial<StorytellingKnowledge>;
    tags?: string[];
    keywords?: string[];
    relatedKnowledge?: string[];
    relatedMemory?: string[];
}
export interface MarketingAnalysisRecord {
    campaignId: string;
    knowledgeId: string;
    campaignName: string;
    campaignType: KnowledgeCampaignType;
    marketingGoal: KnowledgeMarketingGoal;
    productName: string;
    brandName: string;
    platform: KnowledgeMarketingPlatform;
    audience: string;
    brand: BrandStrategyKnowledge;
    positioning: ProductPositioningKnowledge;
    customerJourney: CustomerJourneyKnowledge;
    customer: CustomerPsychologyKnowledge;
    structure: MarketingStructureKnowledge;
    campaign: CampaignKnowledge;
    content: ContentKnowledge;
    platformKnowledge: PlatformKnowledge;
    storytelling: StorytellingKnowledge;
    scores: MarketingQualityScores;
    relationships: MarketingRelationships;
    recommendations: MarketingRecommendation[];
    tags: string[];
    keywords: string[];
    language: string;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface MarketingAnalysisResult {
    success: boolean;
    record?: MarketingAnalysisRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface MarketingSearchQuery {
    campaignType?: KnowledgeCampaignType;
    marketingGoal?: KnowledgeMarketingGoal;
    product?: string;
    brand?: string;
    platform?: KnowledgeMarketingPlatform;
    audience?: string;
    language?: string;
    storytelling?: string;
    cta?: string;
    keywords?: string[];
    text?: string;
    minConversionReadiness?: number;
    limit?: number;
}
export interface MarketingLearningPattern {
    patternId: string;
    patternType: "brand-strategy" | "positioning" | "storytelling" | "campaign" | "content" | "customer" | "conversion";
    description: string;
    sourceCampaignId: string;
    confidence: number;
    detectedAt: string;
}
export interface MarketingKnowledgeStatusReport {
    engineStatus: string;
    campaignAnalysisStatus: string;
    customerKnowledgeStatus: string;
    relationshipStatus: string;
    recommendationQuality: string;
    campaignsAnalyzed: number;
    patternsLearned: number;
    averageMarketingQualityScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageRecommendationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MarketingKnowledgeEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map