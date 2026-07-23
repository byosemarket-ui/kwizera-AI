/**
 * KWIZERA AI STUDIO — Marketing Strategy Intelligence Engine types (Step 5E)
 */
export declare enum MarketingObjective {
    BrandAwareness = "brand-awareness",
    ProductPromotion = "product-promotion",
    ProductLaunch = "product-launch",
    SalesGrowth = "sales-growth",
    CustomerEngagement = "customer-engagement",
    CustomerRetention = "customer-retention",
    LeadGeneration = "lead-generation",
    EventPromotion = "event-promotion",
    BusinessPromotion = "business-promotion",
    ServicePromotion = "service-promotion"
}
export declare enum BusinessGoalType {
    Sales = "sales-objectives",
    Marketing = "marketing-objectives",
    Brand = "brand-objectives",
    Customer = "customer-objectives",
    Growth = "growth-objectives",
    Communication = "communication-objectives"
}
export declare enum StrategyType {
    Emotional = "emotional-marketing",
    Educational = "educational-marketing",
    Promotional = "promotional-marketing",
    Storytelling = "storytelling-marketing",
    Demonstration = "demonstration-marketing",
    Luxury = "luxury-marketing",
    Lifestyle = "lifestyle-marketing",
    SocialProof = "social-proof-strategy",
    ValueBased = "value-based-strategy",
    ProblemSolution = "problem-solution-strategy"
}
export declare enum StrategyMarketingPlatform {
    Instagram = "instagram",
    YouTube = "youtube",
    TikTok = "tiktok",
    Facebook = "facebook",
    WhatsApp = "whatsapp",
    Website = "website",
    LinkedIn = "linkedin",
    Email = "email",
    InStore = "in-store",
    Future = "future-platforms"
}
export interface BusinessGoalsAnalysis {
    salesObjectives: string[];
    marketingObjectives: string[];
    brandObjectives: string[];
    customerObjectives: string[];
    growthObjectives: string[];
    communicationObjectives: string[];
}
export interface AudienceAlignment {
    targetAudience: string;
    customerNeeds: string[];
    customerInterests: string[];
    buyingMotivation: string[];
    preferredPlatforms: StrategyMarketingPlatform[];
    preferredCommunicationStyle: string;
    alignmentScore: number;
}
export interface StrategyRecommendation {
    strategyType: StrategyType;
    priority: "primary" | "secondary" | "supporting";
    rationale: string;
    expectedOutcome: string;
}
export interface CreativeStrategicPreparation {
    storyboardDirection: string;
    scriptPlanningDirection: string;
    visualPlanningDirection: string;
    audioPlanningDirection: string;
    productionPlanningDirection: string;
    storyboardReady: boolean;
    scriptPlanningReady: boolean;
    visualPlanningReady: boolean;
    audioPlanningReady: boolean;
    productionPlanningReady: boolean;
}
export interface CampaignStrategicDirection {
    campaignFocus: string;
    channelStrategy: string;
    messagingTheme: string;
    timingGuidance: string;
    campaignReady: boolean;
}
export interface StrategyScores {
    strategyQualityScore: number;
    audienceAlignmentScore: number;
    businessAlignmentScore: number;
    marketingReadinessScore: number;
    confidenceScore: number;
}
export interface MarketingStrategyRelationships {
    products: string[];
    brands: string[];
    audiences: string[];
    campaigns: string[];
    creativeStyles: string[];
    businessGoals: string[];
    knowledgeRecords: string[];
}
export interface MarketingStrategyInput {
    productId: string;
    strategyId?: string;
    marketingObjective: MarketingObjective;
    businessGoals?: Partial<BusinessGoalsAnalysis>;
    brandName?: string;
    campaignId?: string;
    audienceId?: string;
    preferredPlatforms?: StrategyMarketingPlatform[];
    industry?: string;
}
export interface MarketingStrategyRecord {
    strategyId: string;
    productId: string;
    audienceId: string;
    understandingId: string;
    analysisId: string;
    marketingObjective: MarketingObjective;
    businessGoals: BusinessGoalsAnalysis;
    audienceAlignment: AudienceAlignment;
    selectedStrategies: StrategyRecommendation[];
    creativePreparation: CreativeStrategicPreparation;
    campaignDirection: CampaignStrategicDirection;
    scores: StrategyScores;
    relationships: MarketingStrategyRelationships;
    validated: boolean;
    createdAt: string;
    lastUpdated: string;
    version: number;
}
export interface MarketingStrategyResult {
    success: boolean;
    record?: MarketingStrategyRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface MarketingStrategySearchQuery {
    marketingGoal?: MarketingObjective;
    businessGoal?: BusinessGoalType;
    audience?: string;
    productId?: string;
    brand?: string;
    industry?: string;
    strategyType?: StrategyType;
    platform?: StrategyMarketingPlatform;
    text?: string;
    limit?: number;
}
export interface MarketingStrategyEngineStatusReport {
    engineStatus: string;
    strategyAnalysisStatus: string;
    audienceAlignmentStatus: string;
    businessAlignmentStatus: string;
    strategiesPrepared: number;
    averageStrategyQualityScore: number;
    averageAudienceAlignmentScore: number;
    performance: {
        averageStrategyMs: number;
        averageSearchMs: number;
        averageRelationshipMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MarketingStrategyEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map