/**
 * KWIZERA AI STUDIO — Marketing Video Engine types (Step 8I)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare enum MarketingVideoPlanType {
    Conversion = "conversion",
    Awareness = "awareness",
    Engagement = "engagement",
    ProductLaunch = "product-launch",
    Combined = "combined"
}
export interface MarketingVideoProfile {
    marketingVideoId: string;
    projectId: string;
    campaignId: string;
    productId: string;
    brandId: string;
    platform: StoryboardGenerationPlatform;
    targetAudience: string;
    marketingVersion: number;
    storyboardId: string;
}
export interface MarketingStrategyPlan {
    campaignObjective: string;
    marketingGoal: string;
    targetAudience: string;
    customerPersona: string;
    valueProposition: string;
    productBenefits: string[];
    brandPositioning: string;
}
export interface HookOptimizationPlan {
    first3SecondsStrategy: string;
    attentionHook: string;
    visualHook: string;
    audioHook: string;
    emotionalHook: string;
}
export interface ProductPresentationPlan {
    productRevealTiming: string;
    productHighlight: string;
    productDemonstration: string;
    featurePresentation: string;
    benefitPresentation: string;
    productComparison: string;
}
export interface CallToActionPlan {
    ctaTiming: string;
    ctaPosition: string;
    ctaStyle: string;
    ctaAnimation: string;
    ctaVisibility: string;
    ctaPriority: string;
}
export interface EngagementOptimizationPlan {
    viewerRetentionStrategy: string;
    emotionalJourney: string;
    curiosityTriggers: string[];
    socialEngagement: string;
    shareability: string;
    watchTimeOptimization: string;
}
export interface ConversionOptimizationPlan {
    purchaseMotivation: string;
    trustBuilding: string;
    socialProofPlacement: string;
    offerTiming: string;
    urgencyStrategy: string;
    conversionPath: string;
}
export interface AbTestPreparationPlan {
    hookVariants: string[];
    ctaVariants: string[];
    endingVariants: string[];
    productPresentationVariants: string[];
}
export interface PlatformMarketingOptimization {
    platform: StoryboardGenerationPlatform;
    hookStyle: string;
    ctaAdaptation: string;
    pacingNotes: string[];
}
export interface MarketingVideoScores {
    marketingQualityScore: number;
    engagementScore: number;
    conversionScore: number;
    brandConsistencyScore: number;
    platformReadinessScore: number;
    aiConfidenceScore: number;
}
export interface MarketingVideoRelationships {
    products: string[];
    brands: string[];
    campaigns: string[];
    storyboards: string[];
    marketingPlans: string[];
    audioPlans: string[];
    visualPlans: string[];
    animationPlans: string[];
    motionPlans: string[];
    cameraPlans: string[];
    scenes: string[];
    knowledgeRecords: string[];
}
export interface MarketingVideoInput {
    storyboardId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    targetAudience?: string;
    stylePlanId?: string;
    knowledgeRecordIds?: string[];
    platform?: StoryboardGenerationPlatform;
}
export interface MarketingVideoRecord {
    marketingVideoId: string;
    profile: MarketingVideoProfile;
    planType: MarketingVideoPlanType;
    marketingStrategy: MarketingStrategyPlan;
    hookOptimization: HookOptimizationPlan;
    productPresentation: ProductPresentationPlan;
    callToAction: CallToActionPlan;
    engagementOptimization: EngagementOptimizationPlan;
    conversionOptimization: ConversionOptimizationPlan;
    abTestPreparation: AbTestPreparationPlan;
    platformOptimizations: PlatformMarketingOptimization[];
    scores: MarketingVideoScores;
    relationships: MarketingVideoRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    marketingReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface MarketingVideoResult {
    success: boolean;
    plans?: MarketingVideoRecord[];
    record?: MarketingVideoRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface MarketingVideoSearchQuery {
    marketingVideoId?: string;
    storyboardId?: string;
    campaignId?: string;
    productId?: string;
    brandId?: string;
    audience?: string;
    marketingGoal?: string;
    platform?: StoryboardGenerationPlatform;
    planType?: MarketingVideoPlanType;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface MarketingVideoEngineStatusReport {
    engineStatus: string;
    strategyStatus: string;
    hookStatus: string;
    ctaStatus: string;
    marketingPlansGenerated: number;
    averageMarketingQualityScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
        averageRecommendationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MarketingVideoEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const MARKETING_VIDEO_PLATFORM_TARGETS: StoryboardGenerationPlatform[];
export declare const PLATFORM_MARKETING_CONFIG: Record<StoryboardGenerationPlatform, {
    hookStyle: string;
    ctaAdaptation: string;
}>;
//# sourceMappingURL=types.d.ts.map