/**
 * KWIZERA AI STUDIO — Image Quality Prediction Engine types (Step 6L)
 */

export enum ImageQualityPredictionPlatform {
  Instagram = "instagram",
  Facebook = "facebook",
  TikTok = "tiktok",
  YouTube = "youtube",
  WhatsApp = "whatsapp",
  Website = "website",
  Print = "print",
}

export type ImageQualityRiskSeverity = "low" | "medium" | "high" | "critical";

export interface ImageQualityPredictionProfile {
  predictionId: string;
  projectId: string;
  imageId: string;
  product: string;
  brand: string;
  campaign: string;
  platform: ImageQualityPredictionPlatform;
  predictionVersion: string;
}

export interface ImageQualityAnalysisSummary {
  imageAnalysis: string;
  imageUnderstanding: string;
  objectDetection: string;
  backgroundIntelligence: string;
  compositionIntelligence: string;
  lightingColorIntelligence: string;
  brandVisualIntelligence: string;
  enhancementPlanning: string;
  creativeIntelligence: string;
  productionPlanning: string;
}

export interface ImageQualityCategoryScores {
  overallImageQualityScore: number;
  technicalQualityScore: number;
  compositionScore: number;
  lightingScore: number;
  colorScore: number;
  brandConsistencyScore: number;
  marketingEffectivenessScore: number;
  platformReadinessScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface ImageQualityChecks {
  brandConsistency: boolean;
  compositionConsistency: boolean;
  backgroundSuitability: boolean;
  productVisibility: boolean;
  objectVisibility: boolean;
  lightingConsistency: boolean;
  colorConsistency: boolean;
  typographyReadiness: boolean;
  assetCompleteness: boolean;
  dependencyValidation: boolean;
}

export interface ImageQualityPredictions {
  productionSuccessProbability: number;
  marketingImpact: number;
  viewerAttentionPotential: number;
  readability: number;
  platformPerformance: number;
  productionComplexity: number;
  improvementOpportunities: string[];
}

export interface ImageQualityRiskItem {
  category: string;
  description: string;
  severity: ImageQualityRiskSeverity;
  resolved: boolean;
}

export interface ImageQualityPlatformEvaluation {
  platform: ImageQualityPredictionPlatform;
  readinessScore: number;
  formatFit: string;
  engagementFit: string;
  deliveryNotes: string;
}

export interface ImageQualityPredictionRelationships {
  relatedImagePlans: string[];
  relatedCreativePlans: string[];
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCampaigns: string[];
  relatedKnowledge: string[];
  relatedProductionHistory: string[];
  relatedProjects: string[];
}

export interface ImageQualityRecommendation {
  category: "quality" | "composition" | "lighting" | "color" | "brand" | "marketing" | "platform" | "production" | "risk";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface ImageQualityPredictionInput {
  imageId: string;
  projectId?: string;
  campaign?: string;
  platform?: ImageQualityPredictionPlatform;
  relatedProjects?: string[];
  relatedKnowledge?: string[];
  keywords?: string[];
}

export interface ImageQualityPredictionRecord {
  imageId: string;
  profile: ImageQualityPredictionProfile;
  analysisId: string;
  productionPlanId: string;
  creativePlanId: string;
  enhancementPlanId: string;
  analysisSummary: ImageQualityAnalysisSummary;
  scores: ImageQualityCategoryScores;
  checks: ImageQualityChecks;
  predictions: ImageQualityPredictions;
  risks: ImageQualityRiskItem[];
  platformQuality: ImageQualityPlatformEvaluation[];
  relationships: ImageQualityPredictionRelationships;
  recommendations: ImageQualityRecommendation[];
  keywords: string[];
  highestRiskLevel: ImageQualityRiskSeverity;
  productionReady: boolean;
  validated: boolean;
  predictedAt: string;
  lastUpdated: string;
  version: number;
}

export interface ImageQualityPredictionResult {
  success: boolean;
  record?: ImageQualityPredictionRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ImageQualityPredictionSearchQuery {
  predictionId?: string;
  imageId?: string;
  brand?: string;
  product?: string;
  campaign?: string;
  platform?: ImageQualityPredictionPlatform;
  minQualityScore?: number;
  riskLevel?: ImageQualityRiskSeverity;
  keywords?: string[];
  limit?: number;
}

export interface ImageQualityPredictionEngineStatusReport {
  engineStatus: string;
  qualityAnalysisStatus: string;
  predictionStatus: string;
  riskDetectionStatus: string;
  recommendationStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
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

export class ImageQualityPredictionEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageQualityPredictionEngineError";
  }
}
