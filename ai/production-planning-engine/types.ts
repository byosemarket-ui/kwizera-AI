/**
 * KWIZERA AI STUDIO — Production Planning Engine types (Step 5K)
 */

import type { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";

export type ProductionPlanningPlatform = CreativePlatform;

export interface ProductionPlanningProfile {
  productionPlanId: string;
  projectId: string;
  storyboardId: string;
  scriptPlanId: string;
  visualPlanId: string;
  audioPlanId: string;
  product: string;
  brand: string;
  campaignGoal: MarketingObjective;
  platform: ProductionPlanningPlatform;
  productionVersion: number;
}

export interface ProductionWorkflow {
  preProduction: string;
  assetValidation: string;
  scenePreparation: string;
  visualPreparation: string;
  audioPreparation: string;
  renderingPreparation: string;
  exportPreparation: string;
  deliveryPreparation: string;
}

export interface PlannedAsset {
  assetId: string;
  assetType: string;
  description: string;
  source: string;
  status: "planned" | "validated" | "missing";
  required: boolean;
}

export interface AssetManagement {
  images: PlannedAsset[];
  logos: PlannedAsset[];
  fonts: PlannedAsset[];
  icons: PlannedAsset[];
  videos: PlannedAsset[];
  audio: PlannedAsset[];
  music: PlannedAsset[];
  voiceOver: PlannedAsset[];
  backgrounds: PlannedAsset[];
  templates: PlannedAsset[];
  animations: PlannedAsset[];
  effects: PlannedAsset[];
  subtitles: PlannedAsset[];
  captions: PlannedAsset[];
}

export interface DependencyValidation {
  storyboard: boolean;
  scriptPlan: boolean;
  visualPlan: boolean;
  audioPlan: boolean;
  creativeDirection: boolean;
  marketingStrategy: boolean;
  productIntelligence: boolean;
  brandKnowledge: boolean;
  languageKnowledge: boolean;
  memory: boolean;
  knowledge: boolean;
  issues: string[];
  recommendations: string[];
}

export interface RenderPreparation {
  resolution: string;
  aspectRatio: string;
  frameRate: string;
  videoDuration: string;
  exportQuality: string;
  renderingPriority: string;
  compressionStrategy: string;
  outputFormat: string;
}

export interface ExportPreparation {
  mp4: string;
  mov: string;
  webm: string;
  gif: string;
  imageSequence: string;
  additionalFormats: string[];
}

export interface RecoveryPlan {
  checkpointStrategy: string;
  rollbackSteps: string[];
  retryPolicy: string;
  failureRecovery: string;
  dataPreservation: string;
}

export interface PlatformProductionRules {
  platform: ProductionPlanningPlatform;
  primaryFormat: string;
  maxDuration: string;
  recommendedBitrate: string;
  deliveryGuidance: string;
}

export interface SceneProductionPlan {
  sceneNumber: number;
  scenePurpose: string;
  renderInstructions: string;
  assetDependencies: string[];
  visualInstructions: string;
  audioInstructions: string;
  exportNotes: string;
}

export interface ProductionPlanningScores {
  productionReadinessScore: number;
  assetReadinessScore: number;
  workflowReadinessScore: number;
  dependencyScore: number;
  performanceScore: number;
  aiConfidenceScore: number;
}

export interface ProductionPlanningRelationships {
  storyboards: string[];
  scriptPlans: string[];
  visualPlans: string[];
  audioPlans: string[];
  creativeDirections: string[];
  marketingStrategies: string[];
  products: string[];
  brands: string[];
  knowledgeRecords: string[];
  productionHistory: string[];
}

export interface ProductionPlanningInput {
  productId: string;
  productionPlanId?: string;
  storyboardId?: string;
  scriptPlanId?: string;
  visualPlanId?: string;
  audioPlanId?: string;
  projectId?: string;
}

export interface ProductionPlanningRecord {
  productionPlanId: string;
  productId: string;
  projectId: string;
  storyboardId: string;
  scriptPlanId: string;
  visualPlanId: string;
  audioPlanId: string;
  creativeId: string;
  strategyId: string;
  profile: ProductionPlanningProfile;
  workflow: ProductionWorkflow;
  assets: AssetManagement;
  dependencies: DependencyValidation;
  renderPreparation: RenderPreparation;
  exportPreparation: ExportPreparation;
  recoveryPlan: RecoveryPlan;
  platformRules: PlatformProductionRules;
  sceneProductionPlans: SceneProductionPlan[];
  scores: ProductionPlanningScores;
  relationships: ProductionPlanningRelationships;
  validated: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
  version: number;
}

export interface ProductionPlanningResult {
  success: boolean;
  record?: ProductionPlanningRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ProductionPlanningSearchQuery {
  productionPlanId?: string;
  storyboardId?: string;
  scriptPlanId?: string;
  visualPlanId?: string;
  audioPlanId?: string;
  brand?: string;
  productId?: string;
  platform?: ProductionPlanningPlatform;
  projectId?: string;
  campaignGoal?: MarketingObjective;
  workflow?: string;
  asset?: string;
  text?: string;
  limit?: number;
}

export interface ProductionPlanningEngineStatusReport {
  engineStatus: string;
  productionPlanningStatus: string;
  workflowPlanningStatus: string;
  assetValidationStatus: string;
  dependencyValidationStatus: string;
  productionPlansPrepared: number;
  averageProductionReadinessScore: number;
  averageDependencyScore: number;
  performance: {
    averagePlanningMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ProductionPlanningEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProductionPlanningEngineError";
  }
}
