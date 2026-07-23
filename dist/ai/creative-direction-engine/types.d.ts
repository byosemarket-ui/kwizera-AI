/**
 * KWIZERA AI STUDIO — Creative Direction Engine types (Step 5F)
 */
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";
export declare enum CreativePlatform {
    TikTok = "tiktok",
    InstagramReels = "instagram-reels",
    Facebook = "facebook",
    YouTubeShorts = "youtube-shorts",
    YouTube = "youtube",
    WhatsAppStatus = "whatsapp-status",
    Website = "website"
}
export declare enum CreativeDirectionStyle {
    Emotional = "emotional",
    Educational = "educational",
    Promotional = "promotional",
    Storytelling = "storytelling",
    Demonstration = "demonstration",
    Luxury = "luxury",
    Lifestyle = "lifestyle",
    SocialProof = "social-proof",
    ValueBased = "value-based",
    ProblemSolution = "problem-solution",
    ModernMinimal = "modern-minimal",
    PremiumVisual = "premium-visual"
}
export interface CreativeDirectionProfile {
    creativeId: string;
    projectId: string;
    product: string;
    brand: string;
    campaignGoal: MarketingObjective;
    targetAudience: string;
    platform: CreativePlatform;
    creativeTheme: string;
    creativeStyle: CreativeDirectionStyle;
    mood: string;
    tone: string;
    emotionalDirection: string;
}
export interface VisualDirection {
    colorPalette: string[];
    typographyStyle: string;
    designStyle: string;
    compositionStyle: string;
    productPlacement: string;
    backgroundStyle: string;
    lightingStyle: string;
    visualHierarchy: string;
    iconStyle: string;
    graphicStyle: string;
}
export interface CinematicDirection {
    cameraStyle: string;
    cameraMovement: string;
    framingStyle: string;
    sceneRhythm: string;
    motionStyle: string;
    transitionStyle: string;
    introStyle: string;
    outroStyle: string;
    editingStyle: string;
}
export interface BrandDirection {
    logoPlacement: string;
    brandColors: string[];
    brandTypography: string;
    brandIdentity: string;
    brandVoice: string;
    brandConsistency: string;
}
export interface MarketingDirection {
    hookDirection: string;
    storytellingDirection: string;
    productPresentation: string;
    emotionalFlow: string;
    callToActionPlacement: string;
    closingStrategy: string;
}
export interface PlatformCreativeDirection {
    platform: CreativePlatform;
    formatGuidance: string;
    aspectRatio: string;
    durationGuidance: string;
    contentPacing: string;
    platformOptimizations: string[];
}
export interface CreativeScores {
    creativeQualityScore: number;
    brandConsistencyScore: number;
    marketingAlignmentScore: number;
    visualDirectionScore: number;
    audienceAlignmentScore: number;
    aiConfidenceScore: number;
}
export interface CreativeRelationships {
    products: string[];
    brands: string[];
    creativeStyles: string[];
    campaigns: string[];
    storyboards: string[];
    scripts: string[];
    visualPlans: string[];
    audioPlans: string[];
    knowledgeRecords: string[];
}
export interface CreativeDirectionInput {
    productId: string;
    creativeId?: string;
    projectId?: string;
    strategyId?: string;
    platform?: CreativePlatform;
    campaignGoal?: MarketingObjective;
}
export interface CreativeDirectionRecord {
    creativeId: string;
    productId: string;
    projectId: string;
    strategyId: string;
    audienceId: string;
    understandingId: string;
    analysisId: string;
    profile: CreativeDirectionProfile;
    visualDirection: VisualDirection;
    cinematicDirection: CinematicDirection;
    brandDirection: BrandDirection;
    marketingDirection: MarketingDirection;
    platformDirections: PlatformCreativeDirection[];
    scores: CreativeScores;
    relationships: CreativeRelationships;
    validated: boolean;
    createdAt: string;
    lastUpdated: string;
    version: number;
}
export interface CreativeDirectionResult {
    success: boolean;
    record?: CreativeDirectionRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface CreativeDirectionSearchQuery {
    creativeStyle?: CreativeDirectionStyle;
    platform?: CreativePlatform;
    industry?: string;
    brand?: string;
    productId?: string;
    theme?: string;
    mood?: string;
    campaignGoal?: MarketingObjective;
    audience?: string;
    text?: string;
    limit?: number;
}
export interface CreativeDirectionEngineStatusReport {
    engineStatus: string;
    creativePlanningStatus: string;
    brandAlignmentStatus: string;
    marketingAlignmentStatus: string;
    directionsPrepared: number;
    averageCreativeQualityScore: number;
    averageBrandConsistencyScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
        averageRelationshipMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class CreativeDirectionEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map