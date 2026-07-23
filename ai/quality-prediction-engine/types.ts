/**
 * KWIZERA AI STUDIO — Quality Prediction Engine types (Step 5L)
 */

import type { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";

export type QualityPredictionPlatform = CreativePlatform;
export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface QualityPredictionProfile {
  predictionId: string;
  projectId: string;
  productionPlanId: string;
  product: string;
  brand: string;
  campaign: MarketingObjective;
  platform: QualityPredictionPlatform;
  predictionVersion: number;
}

export interface QualityScores {
  overallQualityScore: number;
  visualQualityScore: number;
  storytellingScore: number;
  marketingEffectivenessScore: number;
  brandConsistencyScore: number;
  audienceAlignmentScore: number;
  technicalReadinessScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface QualityChecks {
  brandConsistency: boolean;
  storyConsistency: boolean;
  visualConsistency: boolean;
  audioConsistency: boolean;
  platformReadiness: boolean;
  assetCompleteness: boolean;
  dependencyValidation: boolean;
  workflowReadiness: boolean;
  issues: string[];
}

export interface QualityPredictions {
  successProbability: number;
  productionRisk: RiskSeverity;
  marketingEffectiveness: number;
  viewerEngagementPotential: number;
  productionComplexity: RiskSeverity;
  improvementOpportunities: string[];
}

export interface QualityRecommendations {
  storyImprovements: string[];
  visualImprovements: string[];
  audioImprovements: string[];
  brandingImprovements: string[];
  marketingImprovements: string[];
  platformOptimization: string[];
  productionOptimization: string[];
}

export interface RiskItem {
  category: string;
  description: string;
  severity: RiskSeverity;
  resolved: boolean;
}

export interface PlatformQualityEvaluation {
  platform: QualityPredictionPlatform;
  readinessScore: number;
  pacingFit: string;
  formatFit: string;
  engagementFit: string;
}

export interface QualityAnalysisSummary {
  productUnderstanding: string;
  audienceAlignment: string;
  marketingStrategy: string;
  creativeDirection: string;
  storyboard: string;
  scriptPlan: string;
  visualPlan: string;
  audioPlan: string;
  productionPlan: string;
}

export interface QualityPredictionRelationships {
  storyboards: string[];
  scriptPlans: string[];
  visualPlans: string[];
  audioPlans: string[];
  productionPlans: string[];
  marketingStrategies: string[];
  creativeDirections: string[];
  knowledgeRecords: string[];
}

export interface QualityPredictionInput {
  productId: string;
  predictionId?: string;
  productionPlanId?: string;
  projectId?: string;
}

export interface QualityPredictionRecord {
  predictionId: string;
  productId: string;
  projectId: string;
  productionPlanId: string;
  storyboardId: string;
  scriptPlanId: string;
  visualPlanId: string;
  audioPlanId: string;
  creativeId: string;
  strategyId: string;
  profile: QualityPredictionProfile;
  analysis: QualityAnalysisSummary;
  scores: QualityScores;
  checks: QualityChecks;
  predictions: QualityPredictions;
  recommendations: QualityRecommendations;
  risks: RiskItem[];
  platformQuality: PlatformQualityEvaluation;
  relationships: QualityPredictionRelationships;
  validated: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
  version: number;
}

export interface QualityPredictionResult {
  success: boolean;
  record?: QualityPredictionRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface QualityPredictionSearchQuery {
  predictionId?: string;
  projectId?: string;
  productionPlanId?: string;
  brand?: string;
  productId?: string;
  campaign?: MarketingObjective;
  platform?: QualityPredictionPlatform;
  minQualityScore?: number;
  riskLevel?: RiskSeverity;
  text?: string;
  limit?: number;
}

export interface QualityPredictionEngineStatusReport {
  engineStatus: string;
  qualityAnalysisStatus: string;
  predictionStatus: string;
  riskAnalysisStatus: string;
  predictionsPrepared: number;
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

export class QualityPredictionEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "QualityPredictionEngineError";
  }
}
