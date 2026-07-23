/**
 * KWIZERA AI STUDIO — Image Generation Health Monitor Engine types (Step 9N)
 */

export enum ImageGenerationHealthScoreLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum MonitoredImageGenerationModule {
  ImageGenerationFoundation = "image-generation-foundation",
  TextToImageGeneration = "text-to-image-generation-engine",
  ImageToImageGeneration = "image-to-image-generation-engine",
  ProductImageGeneration = "product-image-generation-engine",
  BackgroundGeneration = "background-generation-engine",
  ImageEditing = "image-editing-generation-engine",
  ImageEnhancement = "image-enhancement-generation-engine",
  BrandingDesign = "branding-design-generation-engine",
  MultiStyleImageGeneration = "multi-style-image-generation-engine",
  ImageProduction = "image-production-engine",
  ImageRenderingPreparation = "image-rendering-preparation-engine",
  ImageQualityValidation = "image-quality-validation-engine",
  ImageGenerationOptimization = "image-generation-optimization-engine",
  AssetRegistry = "asset-registry",
  PromptRegistry = "prompt-registry",
  LayerRegistry = "layer-registry",
  MaskRegistry = "mask-registry",
  ProductionRegistry = "production-registry",
}

export enum ImageGenerationWarningType {
  PromptProblems = "prompt-problems",
  ImageProblems = "image-problems",
  LayerProblems = "layer-problems",
  MaskProblems = "mask-problems",
  BrandingProblems = "branding-problems",
  ProductionProblems = "production-problems",
  RenderPreparationProblems = "render-preparation-problems",
  ValidationProblems = "validation-problems",
  RelationshipFailure = "relationship-failure",
  BrokenDependencies = "broken-dependencies",
  HighResourceUsage = "high-resource-usage",
  SearchFailure = "search-failure",
  DatabaseProblems = "database-problems",
  RegistryProblems = "registry-problems",
  CacheProblems = "cache-problems",
}

export interface MonitoredImageGenerationModuleHealthScore {
  module: MonitoredImageGenerationModule;
  score: number;
  level: ImageGenerationHealthScoreLevel;
  available: boolean;
  issues: string[];
}

export interface ImageGenerationHealthWarning {
  type: ImageGenerationWarningType;
  severity: ImageGenerationHealthScoreLevel;
  message: string;
  module: MonitoredImageGenerationModule;
  recommendation: string;
}

export interface ImageGenerationHealthCheckResult {
  checkId: string;
  timestamp: string;
  overallScore: number;
  overallLevel: ImageGenerationHealthScoreLevel;
  moduleScores: MonitoredImageGenerationModuleHealthScore[];
  warnings: ImageGenerationHealthWarning[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performance: {
    checkDurationMs: number;
    searchPerformanceMs: number;
    planningPerformanceMs: number;
    validationPerformanceMs: number;
    optimizationPerformanceMs: number;
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    gpuUsagePercent: number;
  };
  promptIntegrity: boolean;
  imageIntegrity: boolean;
  layerIntegrity: boolean;
  maskIntegrity: boolean;
  brandIntegrity: boolean;
  productionIntegrity: boolean;
  renderPreparationIntegrity: boolean;
  validationIntegrity: boolean;
  assetIntegrity: boolean;
  registryIntegrity: boolean;
  optimizationStatus: boolean;
  recoveryNotified: boolean;
}

export interface ImageGenerationAuditResult {
  auditId: string;
  timestamp: string;
  promptQuality: boolean;
  imageQuality: boolean;
  productImageQuality: boolean;
  backgroundQuality: boolean;
  editingQuality: boolean;
  enhancementQuality: boolean;
  brandingConsistency: boolean;
  multiStyleConsistency: boolean;
  dependencyValidation: boolean;
  optimizationStatus: boolean;
  valid: boolean;
  durationMs: number;
}

export interface ImageGenerationHealthHistoryEntry {
  checkId: string;
  timestamp: string;
  module: string;
  healthScore: number;
  level: ImageGenerationHealthScoreLevel;
  warnings: string[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performanceMs: number;
}

export interface ImageGenerationTrendAnalysis {
  direction: "improving" | "stable" | "declining";
  averageScore: number;
  scoreChange: number;
  warningTrend: number;
  prediction: string;
}

export interface ImageGenerationAutoRepairResult {
  attempted: boolean;
  success: boolean;
  repairs: string[];
  validated: boolean;
}

export interface ImageGenerationHealthMonitorStatusReport {
  engineStatus: string;
  overallImageGenerationHealth: string;
  moduleHealthSummary: string;
  promptHealth: string;
  productionHealth: string;
  renderReadinessHealth: string;
  totalChecks: number;
  totalWarnings: number;
  performance: {
    averageCheckMs: number;
    lastCheckMs: number;
    averageDiskMb: number;
  };
  trendAnalysis: ImageGenerationTrendAnalysis;
  recommendations: string[];
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ImageGenerationHealthMonitorEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageGenerationHealthMonitorEngineError";
  }
}
