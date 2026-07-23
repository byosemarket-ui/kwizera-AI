/**
 * KWIZERA AI STUDIO — Image Generation Optimization Engine types (Step 9M)
 */

export enum OptimizationPlatform {
  Website = "website",
  Mobile = "mobile",
  Instagram = "instagram",
  Facebook = "facebook",
  TikTok = "tiktok",
  LinkedIn = "linkedin",
  Print = "print",
  Packaging = "packaging",
  Billboard = "billboard",
}

export enum PipelineOptimizationArea {
  PromptUnderstanding = "prompt-understanding",
  ImageComposition = "image-composition",
  LayerStructure = "layer-structure",
  MaskStructure = "mask-structure",
  ColorManagement = "color-management",
  Typography = "typography",
  AssetOrganization = "asset-organization",
  Metadata = "metadata",
}

export interface OptimizationProfile {
  optimizationId: string;
  projectId: string;
  validationId: string;
  renderPlanId: string;
  productionId: string;
  imagePlanId: string;
  productId: string;
  brandId: string;
  platform: OptimizationPlatform;
  optimizationVersion: number;
}

export interface ComponentOptimizationPlan {
  promptProcessingOptimized: boolean;
  textToImageOptimized: boolean;
  imageToImageOptimized: boolean;
  productImageOptimized: boolean;
  backgroundOptimized: boolean;
  imageEditingOptimized: boolean;
  enhancementOptimized: boolean;
  brandingOptimized: boolean;
  multiStyleOptimized: boolean;
  productionOptimized: boolean;
  renderPreparationOptimized: boolean;
  validationResultsOptimized: boolean;
  creativeDecisionsPreserved: boolean;
  notes: string[];
}

export interface PipelineOptimizationPlan {
  areas: Array<{ area: PipelineOptimizationArea; optimized: boolean; improvement: string }>;
  promptUnderstanding: string;
  imageComposition: string;
  layerStructure: string;
  maskStructure: string;
  colorManagement: string;
  typography: string;
  assetOrganization: string;
  metadata: string;
  creativeDecisionsPreserved: boolean;
  allPipelineOptimized: boolean;
}

export interface ResourceOptimizationPlan {
  cpuUsage: string;
  gpuUsage: string;
  ramUsage: string;
  diskUsage: string;
  cacheUsage: string;
  temporaryFiles: string;
  backgroundProcessing: string;
  parallelProcessing: string;
  allResourcesOptimized: boolean;
}

export interface QualityOptimizationPlan {
  visualQuality: string;
  colorAccuracy: string;
  layerIntegrity: string;
  maskIntegrity: string;
  typography: string;
  printReadiness: string;
  brandConsistency: string;
  platformCompatibility: string;
  qualityMaintainedOrImproved: boolean;
  allQualityOptimized: boolean;
}

export interface SearchOptimizationPlan {
  searchIndexes: string;
  metadata: string;
  assetRetrieval: string;
  relationshipQueries: string;
  cachePerformance: string;
  allSearchOptimized: boolean;
}

export interface RecoveryOptimizationPlan {
  automaticRecovery: string;
  rollback: string;
  recoveryCheckpoints: string;
  resumeProcessing: string;
  versionRecovery: string;
  allRecoveryOptimized: boolean;
}

export interface PerformanceOptimizationPlan {
  generationSpeed: string;
  validationSpeed: string;
  planningSpeed: string;
  resourceScheduling: string;
  queueProcessing: string;
  scalability: string;
  allPerformanceOptimized: boolean;
}

export interface OptimizationScores {
  optimizationScore: number;
  performanceScore: number;
  resourceEfficiencyScore: number;
  qualityImprovementScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface OptimizationRelationships {
  imagePlans: string[];
  productionPlans: string[];
  renderPlans: string[];
  validationReports: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  knowledgeRecords: string[];
}

export interface ImageGenerationOptimizationInput {
  productId?: string;
  projectId?: string;
  validationId?: string;
  renderPlanId?: string;
  productionId?: string;
  imagePlanId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: OptimizationPlatform;
  knowledgeRecordIds?: string[];
  optimizePipeline?: boolean;
  optimizeResources?: boolean;
  optimizeQuality?: boolean;
  optimizeSearch?: boolean;
  optimizeRecovery?: boolean;
  autoRepair?: boolean;
}

export interface ImageGenerationOptimizationRecord {
  optimizationId: string;
  profile: OptimizationProfile;
  componentOptimization: ComponentOptimizationPlan;
  pipelineOptimization: PipelineOptimizationPlan;
  resourceOptimization: ResourceOptimizationPlan;
  qualityOptimization: QualityOptimizationPlan;
  searchOptimization: SearchOptimizationPlan;
  recoveryOptimization: RecoveryOptimizationPlan;
  performanceOptimization: PerformanceOptimizationPlan;
  blueprintId?: string;
  scores: OptimizationScores;
  relationships: OptimizationRelationships;
  recommendations: string[];
  repairsApplied: string[];
  validated: boolean;
  approved: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface ImageGenerationOptimizationResult {
  success: boolean;
  record?: ImageGenerationOptimizationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ImageGenerationOptimizationSearchQuery {
  optimizationId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: OptimizationPlatform;
  minOptimizationScore?: number;
  minPerformanceScore?: number;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface ImageGenerationOptimizationEngineStatusReport {
  engineStatus: string;
  pipelineOptimizationStatus: string;
  resourceOptimizationStatus: string;
  qualityOptimizationStatus: string;
  optimizationsPerformed: number;
  averageOptimizationScore: number;
  averagePerformanceScore: number;
  performance: {
    averageOptimizationMs: number;
    averageSearchMs: number;
    averageRepairMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ImageGenerationOptimizationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageGenerationOptimizationEngineError";
  }
}

export const ALL_PIPELINE_OPTIMIZATION_AREAS: PipelineOptimizationArea[] = [
  PipelineOptimizationArea.PromptUnderstanding,
  PipelineOptimizationArea.ImageComposition,
  PipelineOptimizationArea.LayerStructure,
  PipelineOptimizationArea.MaskStructure,
  PipelineOptimizationArea.ColorManagement,
  PipelineOptimizationArea.Typography,
  PipelineOptimizationArea.AssetOrganization,
  PipelineOptimizationArea.Metadata,
];

export const ALL_OPTIMIZATION_PLATFORMS: OptimizationPlatform[] = [
  OptimizationPlatform.Website,
  OptimizationPlatform.Mobile,
  OptimizationPlatform.Instagram,
  OptimizationPlatform.Facebook,
  OptimizationPlatform.TikTok,
  OptimizationPlatform.LinkedIn,
  OptimizationPlatform.Print,
  OptimizationPlatform.Packaging,
  OptimizationPlatform.Billboard,
];

export const PIPELINE_COMPONENT_KEYS: (keyof ComponentOptimizationPlan)[] = [
  "promptProcessingOptimized",
  "textToImageOptimized",
  "imageToImageOptimized",
  "productImageOptimized",
  "backgroundOptimized",
  "imageEditingOptimized",
  "enhancementOptimized",
  "brandingOptimized",
  "multiStyleOptimized",
  "productionOptimized",
  "renderPreparationOptimized",
  "validationResultsOptimized",
];
