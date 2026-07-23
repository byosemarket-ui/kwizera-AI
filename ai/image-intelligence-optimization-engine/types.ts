/**
 * KWIZERA AI STUDIO — Image Intelligence Optimization Engine types (Step 6M)
 */

import type { ImageQualityPredictionPlatform } from "../image-quality-prediction-engine/types.js";

export type ImageOptimizationStrategyType =
  | "relationship"
  | "classification"
  | "search"
  | "knowledge-retrieval"
  | "recommendation"
  | "workflow"
  | "performance"
  | "cache"
  | "metadata";

export interface ImageOptimizationProfile {
  optimizationId: string;
  projectId: string;
  imageId: string;
  product: string;
  brand: string;
  campaign: string;
  platform: ImageQualityPredictionPlatform;
  optimizationVersion: number;
}

export interface ImageModuleOptimizationResult {
  moduleId: string;
  moduleName: string;
  qualityScoreBefore: number;
  qualityScoreAfter: number;
  improved: boolean;
  strategiesApplied: ImageOptimizationStrategyType[];
  detail: string;
}

export interface ImageOptimizationStrategies {
  relationshipOptimization: string;
  classificationOptimization: string;
  searchOptimization: string;
  knowledgeRetrievalOptimization: string;
  recommendationOptimization: string;
  workflowOptimization: string;
  performanceOptimization: string;
  cacheOptimization: string;
  metadataOptimization: string;
}

export interface ImageCacheOptimization {
  images: string[];
  brands: string[];
  products: string[];
  backgrounds: string[];
  creativeStyles: string[];
  templates: string[];
  campaigns: string[];
  productionPlans: string[];
  hitRate: number;
}

export interface ImageIntelligenceRecoveryPoint {
  recoveryId: string;
  optimizationId: string;
  createdAt: string;
  baselineMetrics: Record<string, number>;
  cacheSnapshot: ImageCacheOptimization;
  restored: boolean;
}

export interface ImageOptimizationPerformanceMetrics {
  planningSpeedMs: number;
  searchSpeedMs: number;
  relationshipDetectionMs: number;
  recommendationSpeedMs: number;
  planningSpeedBeforeMs: number;
  searchSpeedBeforeMs: number;
  memoryEstimateMb: number;
  diskUsageEstimateKb: number;
}

export interface ImageOptimizationScores {
  overallImprovementScore: number;
  planningImprovementScore: number;
  searchImprovementScore: number;
  recommendationImprovementScore: number;
  relationshipImprovementScore: number;
  workflowEfficiencyScore: number;
  confidenceImprovementScore: number;
  aiConfidenceScore: number;
}

export interface ImageIntelligenceOptimizationRelationships {
  relatedImagePlans: string[];
  relatedCreativePlans: string[];
  relatedEnhancementPlans: string[];
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCampaigns: string[];
  productionPlans: string[];
  qualityPredictions: string[];
  knowledgeRecords: string[];
}

export interface ImageIntelligenceOptimizationInput {
  imageId: string;
  optimizationId?: string;
  projectId?: string;
}

export interface ImageIntelligenceOptimizationRecord {
  optimizationId: string;
  imageId: string;
  projectId: string;
  qualityPredictionId: string;
  productionPlanId: string;
  profile: ImageOptimizationProfile;
  moduleResults: ImageModuleOptimizationResult[];
  strategies: ImageOptimizationStrategies;
  cache: ImageCacheOptimization;
  performance: ImageOptimizationPerformanceMetrics;
  scores: ImageOptimizationScores;
  relationships: ImageIntelligenceOptimizationRelationships;
  recoveryPointId: string;
  validated: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
  version: number;
}

export interface ImageIntelligenceOptimizationResult {
  success: boolean;
  record?: ImageIntelligenceOptimizationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
  recovered?: boolean;
}

export interface ImageIntelligenceOptimizationSearchQuery {
  optimizationId?: string;
  imageId?: string;
  brand?: string;
  platform?: ImageQualityPredictionPlatform;
  campaign?: string;
  minImprovementScore?: number;
  text?: string;
  limit?: number;
}

export interface ImageIntelligenceOptimizationEngineStatusReport {
  engineStatus: string;
  optimizationStatus: string;
  cacheStatus: string;
  recoveryStatus: string;
  optimizationsCompleted: number;
  averageImprovementScore: number;
  averagePlanningImprovement: number;
  performance: {
    averageOptimizationMs: number;
    averageSearchMs: number;
    averageRecoveryMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ImageIntelligenceOptimizationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageIntelligenceOptimizationEngineError";
  }
}
