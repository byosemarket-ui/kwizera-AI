/**

 * KWIZERA AI STUDIO — Video Quality Prediction Engine types (Step 7L)

 */
export declare enum VideoQualityPredictionPlatform {
    TikTok = "tiktok",
    Instagram = "instagram",
    Facebook = "facebook",
    YouTube = "youtube",
    WhatsApp = "whatsapp",
    Website = "website",
    Television = "television",
    DigitalSignage = "digital-signage"
}
export type VideoQualityRiskSeverity = "low" | "medium" | "high" | "critical";
export interface VideoQualityPredictionProfile {
    predictionId: string;
    projectId: string;
    videoId: string;
    product: string;
    brand: string;
    campaign: string;
    platform: VideoQualityPredictionPlatform;
    predictionVersion: number;
}
export interface VideoQualityAnalysisSummary {
    videoAnalysis: string;
    videoUnderstanding: string;
    sceneDetection: string;
    timelineIntelligence: string;
    cameraMovement: string;
    motionIntelligence: string;
    videoStyle: string;
    enhancementPlanning: string;
    creativePlanning: string;
    productionPlanning: string;
}
export interface VideoQualityCategoryScores {
    overallVideoQualityScore: number;
    visualQualityScore: number;
    audioQualityScore: number;
    storytellingScore: number;
    motionScore: number;
    cameraScore: number;
    styleScore: number;
    brandConsistencyScore: number;
    marketingEffectivenessScore: number;
    platformReadinessScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface VideoQualityChecks {
    storyConsistency: boolean;
    sceneConsistency: boolean;
    timelineConsistency: boolean;
    audioSynchronization: boolean;
    motionContinuity: boolean;
    cameraContinuity: boolean;
    brandConsistency: boolean;
    assetCompleteness: boolean;
    dependencyValidation: boolean;
}
export interface VideoQualityPredictions {
    productionSuccessProbability: number;
    viewerEngagement: number;
    viewerRetention: number;
    marketingImpact: number;
    conversionPotential: number;
    renderingComplexity: number;
    improvementOpportunities: string[];
}
export interface VideoQualityRiskItem {
    category: string;
    description: string;
    severity: VideoQualityRiskSeverity;
    resolved: boolean;
}
export interface VideoQualityPlatformEvaluation {
    platform: VideoQualityPredictionPlatform;
    readinessScore: number;
    formatFit: string;
    engagementFit: string;
    deliveryNotes: string;
}
export interface VideoQualityPredictionRelationships {
    relatedStoryboards: string[];
    relatedProductionPlans: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedScripts: string[];
    relatedKnowledge: string[];
    relatedProductionHistory: string[];
    relatedProjects: string[];
}
export interface VideoQualityRecommendation {
    category: "quality" | "visual" | "audio" | "storytelling" | "motion" | "camera" | "style" | "brand" | "marketing" | "platform" | "production" | "risk";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface VideoQualityPredictionInput {
    videoId: string;
    projectId?: string;
    campaign?: string;
    platform?: VideoQualityPredictionPlatform;
    relatedProjects?: string[];
    relatedKnowledge?: string[];
    relatedScripts?: string[];
    keywords?: string[];
}
export interface VideoQualityPredictionRecord {
    videoId: string;
    profile: VideoQualityPredictionProfile;
    analysisId: string;
    productionPlanId: string;
    creativePlanId: string;
    enhancementPlanId: string;
    analysisSummary: VideoQualityAnalysisSummary;
    scores: VideoQualityCategoryScores;
    checks: VideoQualityChecks;
    predictions: VideoQualityPredictions;
    risks: VideoQualityRiskItem[];
    platformQuality: VideoQualityPlatformEvaluation[];
    relationships: VideoQualityPredictionRelationships;
    recommendations: VideoQualityRecommendation[];
    keywords: string[];
    highestRiskLevel: VideoQualityRiskSeverity;
    productionReady: boolean;
    validated: boolean;
    predictedAt: string;
    lastUpdated: string;
    version: number;
}
export interface VideoQualityPredictionResult {
    success: boolean;
    record?: VideoQualityPredictionRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface VideoQualityPredictionSearchQuery {
    predictionId?: string;
    videoId?: string;
    brand?: string;
    product?: string;
    campaign?: string;
    platform?: VideoQualityPredictionPlatform;
    minQualityScore?: number;
    riskLevel?: VideoQualityRiskSeverity;
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface VideoQualityPredictionEngineStatusReport {
    engineStatus: string;
    qualityAnalysisStatus: string;
    predictionStatus: string;
    riskDetectionStatus: string;
    recommendationStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imageIntelligenceBridgeStatus: string;
    predictionsCreated: number;
    averageOverallQualityScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averagePredictionMs: number;
        averageSearchMs: number;
        averageRelationshipMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoQualityPredictionEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map