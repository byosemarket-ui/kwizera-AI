/**
 * KWIZERA AI STUDIO — Product Intelligence Health Monitor Engine types (Step 5N)
 */

export enum ProductIntelligenceHealthScoreLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum MonitoredProductIntelligenceModule {
  ProductIntelligenceFoundation = "product-intelligence-foundation",
  ProductAnalysis = "product-analysis-engine",
  ProductUnderstanding = "product-understanding-engine",
  AudienceIntelligence = "audience-intelligence",
  MarketingStrategy = "marketing-strategy-intelligence",
  CreativeDirection = "creative-direction",
  StoryboardIntelligence = "storyboard-intelligence",
  ScriptPlanning = "script-planning",
  VisualPlanning = "visual-planning",
  AudioPlanning = "audio-planning",
  ProductionPlanning = "production-planning",
  QualityPrediction = "quality-prediction",
  ProductIntelligenceOptimization = "product-intelligence-optimization",
  ProductIntelligenceRegistry = "product-intelligence-registry",
  ProductIntelligenceDatabase = "product-intelligence-database",
  ProductRelationships = "product-relationships",
  ProductSearch = "product-search",
  ProductCache = "product-cache",
}

export enum ProductIntelligenceWarningType {
  PlanningFailure = "planning-failure",
  RelationshipFailure = "relationship-failure",
  BrokenDependencies = "broken-dependencies",
  InvalidProductData = "invalid-product-data",
  AudienceMismatch = "audience-mismatch",
  MarketingMisalignment = "marketing-misalignment",
  CreativeInconsistency = "creative-inconsistency",
  StoryboardProblems = "storyboard-problems",
  ScriptProblems = "script-problems",
  VisualPlanningProblems = "visual-planning-problems",
  AudioPlanningProblems = "audio-planning-problems",
  ProductionPlanningProblems = "production-planning-problems",
  HighResourceUsage = "high-resource-usage",
  SearchFailure = "search-failure",
  DatabaseProblems = "database-problems",
  RegistryProblems = "registry-problems",
  CacheProblems = "cache-problems",
}

export interface MonitoredProductIntelligenceModuleHealthScore {
  module: MonitoredProductIntelligenceModule;
  score: number;
  level: ProductIntelligenceHealthScoreLevel;
  available: boolean;
  issues: string[];
}

export interface ProductIntelligenceHealthWarning {
  type: ProductIntelligenceWarningType;
  severity: ProductIntelligenceHealthScoreLevel;
  message: string;
  module: MonitoredProductIntelligenceModule;
  recommendation: string;
}

export interface ProductIntelligenceHealthCheckResult {
  checkId: string;
  timestamp: string;
  overallScore: number;
  overallLevel: ProductIntelligenceHealthScoreLevel;
  moduleScores: MonitoredProductIntelligenceModuleHealthScore[];
  warnings: ProductIntelligenceHealthWarning[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performance: {
    checkDurationMs: number;
    searchPerformanceMs: number;
    planningPerformanceMs: number;
    relationshipDetectionMs: number;
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
  };
  planningIntegrity: boolean;
  relationshipIntegrity: boolean;
  optimizationStatus: boolean;
  qualityPredictionStatus: boolean;
  recoveryNotified: boolean;
}

export interface ProductIntelligenceAuditResult {
  auditId: string;
  timestamp: string;
  planningIntegrity: boolean;
  relationshipIntegrity: boolean;
  creativeConsistency: boolean;
  marketingConsistency: boolean;
  brandConsistency: boolean;
  dependencyValidation: boolean;
  optimizationStatus: boolean;
  qualityPredictionStatus: boolean;
  valid: boolean;
  durationMs: number;
}

export interface ProductIntelligenceHealthHistoryEntry {
  checkId: string;
  timestamp: string;
  module: string;
  healthScore: number;
  level: ProductIntelligenceHealthScoreLevel;
  warnings: string[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performanceMs: number;
}

export interface ProductIntelligenceTrendAnalysis {
  direction: "improving" | "stable" | "declining";
  averageScore: number;
  scoreChange: number;
  warningTrend: number;
  prediction: string;
}

export interface ProductIntelligenceAutoRepairResult {
  attempted: boolean;
  success: boolean;
  repairs: string[];
  validated: boolean;
}

export interface ProductIntelligenceHealthMonitorStatusReport {
  engineStatus: string;
  overallProductIntelligenceHealth: string;
  moduleHealthSummary: string;
  planningQuality: string;
  relationshipHealth: string;
  totalChecks: number;
  totalWarnings: number;
  performance: {
    averageCheckMs: number;
    lastCheckMs: number;
    averageDiskMb: number;
  };
  trendAnalysis: ProductIntelligenceTrendAnalysis;
  recommendations: string[];
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ProductIntelligenceHealthMonitorEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProductIntelligenceHealthMonitorEngineError";
  }
}
