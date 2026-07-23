/**
 * KWIZERA AI STUDIO — Image Enhancement Planning Engine types (Step 6I)
 */
export declare enum EnhancementPlatform {
    TikTok = "tiktok",
    Instagram = "instagram",
    Facebook = "facebook",
    YouTube = "youtube",
    WhatsApp = "whatsapp",
    Website = "website"
}
export declare enum EnhancementPlanType {
    Restoration = "restoration",
    Optimization = "optimization",
    Cleanup = "cleanup",
    Background = "background",
    Lighting = "lighting",
    Color = "color",
    Sharpness = "sharpness",
    Quality = "quality"
}
export interface ImageEnhancementProfile {
    enhancementPlanId: string;
    projectId: string;
    imageId: string;
    product: string;
    brand: string;
    platform: EnhancementPlatform;
    enhancementVersion: string;
}
export interface ImageQualityAnalysis {
    resolutionQuality: number;
    sharpness: number;
    noise: number;
    compressionArtifacts: number;
    exposure: number;
    contrast: number;
    whiteBalance: number;
    colorAccuracy: number;
    dynamicRange: number;
    visualClarity: number;
}
export interface EnhancementPlanningSteps {
    resolutionEnhancement: string;
    noiseReduction: string;
    sharpening: string;
    exposureCorrection: string;
    contrastImprovement: string;
    whiteBalanceCorrection: string;
    colorBalance: string;
    backgroundEnhancement: string;
    objectEnhancement: string;
    reflectionControl: string;
}
export interface RestorationPlanning {
    scratchRemoval: string;
    dustRemoval: string;
    artifactReduction: string;
    blurReduction: string;
    qualityRecovery: string;
}
export interface BackgroundEnhancementPlanning {
    backgroundCleanup: string;
    backgroundBlur: string;
    backgroundSimplification: string;
    backgroundHarmonization: string;
    backgroundIsolationPreparation: string;
}
export interface PlatformOptimizationRules {
    tiktok: string;
    instagram: string;
    facebook: string;
    youtube: string;
    whatsapp: string;
    website: string;
}
export interface ImageEnhancementPlanningScores {
    enhancementReadinessScore: number;
    imageQualityScore: number;
    restorationScore: number;
    platformReadinessScore: number;
    creativeReadinessScore: number;
    aiConfidenceScore: number;
}
export interface ImageEnhancementPlanningRelationships {
    relatedImages: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedBackgroundIntelligence: string[];
    relatedCompositionIntelligence: string[];
    relatedLightingIntelligence: string[];
    relatedCreativeStyles: string[];
    relatedProjects: string[];
    relatedKnowledge: string[];
}
export interface ImageEnhancementPlanningRecommendation {
    category: "quality" | "restoration" | "background" | "lighting" | "color" | "platform" | "creative";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface ImageEnhancementPlanningInput {
    imageId: string;
    projectId?: string;
    platform?: EnhancementPlatform;
    enhancementTypes?: EnhancementPlanType[];
    relatedProjects?: string[];
    relatedKnowledge?: string[];
    keywords?: string[];
}
export interface ImageEnhancementPlanningRecord {
    imageId: string;
    profile: ImageEnhancementProfile;
    analysisId: string;
    understandingId: string;
    qualityAnalysis: ImageQualityAnalysis;
    enhancementPlan: EnhancementPlanningSteps;
    restorationPlan: RestorationPlanning;
    backgroundPlan: BackgroundEnhancementPlanning;
    platformOptimization: PlatformOptimizationRules;
    scores: ImageEnhancementPlanningScores;
    relationships: ImageEnhancementPlanningRelationships;
    recommendations: ImageEnhancementPlanningRecommendation[];
    keywords: string[];
    nonDestructive: boolean;
    validated: boolean;
    plannedAt: string;
    lastUpdated: string;
    version: number;
}
export interface ImageEnhancementPlanningResult {
    success: boolean;
    record?: ImageEnhancementPlanningRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageEnhancementPlanningSearchQuery {
    imageId?: string;
    enhancementType?: EnhancementPlanType;
    brand?: string;
    product?: string;
    platform?: EnhancementPlatform;
    minQualityScore?: number;
    keywords?: string[];
    limit?: number;
}
export interface ImageEnhancementPlanningEngineStatusReport {
    engineStatus: string;
    enhancementPlanningStatus: string;
    qualityAnalysisStatus: string;
    restorationPlanningStatus: string;
    backgroundPlanningStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    plansCreated: number;
    averageReadinessScore: number;
    averageQualityScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
        averageRelationshipMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageEnhancementPlanningEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map