/**
 * KWIZERA AI STUDIO — Knowledge Health Monitor Engine types (Step 4N)
 */

export enum KnowledgeHealthScoreLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum MonitoredKnowledgeModule {
  KnowledgeFoundation = "knowledge-foundation",
  StorageEngine = "knowledge-storage-engine",
  RetrievalEngine = "knowledge-retrieval-engine",
  GraphEngine = "knowledge-graph-engine",
  ImageKnowledge = "image-knowledge-engine",
  VideoKnowledge = "video-knowledge-engine",
  MarketingKnowledge = "marketing-knowledge-engine",
  ProductKnowledge = "product-knowledge-engine",
  BrandKnowledge = "brand-knowledge-engine",
  LanguageKnowledge = "language-knowledge-engine",
  CreativeKnowledge = "creative-knowledge-engine",
  OptimizationEngine = "knowledge-optimization-engine",
  ValidationEngine = "knowledge-validation-engine",
  KnowledgeRegistry = "knowledge-registry",
  KnowledgeDatabase = "knowledge-database",
  KnowledgeCache = "knowledge-cache",
  KnowledgeRelationships = "knowledge-relationships",
  KnowledgeSearch = "knowledge-search",
  KnowledgeStorage = "knowledge-storage",
}

export enum KnowledgeWarningType {
  KnowledgeCorruption = "knowledge-corruption",
  BrokenRelationships = "broken-relationships",
  InvalidSources = "invalid-sources",
  DuplicateKnowledge = "duplicate-knowledge",
  OutdatedKnowledge = "outdated-knowledge",
  IncompleteKnowledge = "incomplete-knowledge",
  GraphProblems = "graph-problems",
  SearchFailure = "search-failure",
  RetrievalFailure = "retrieval-failure",
  ValidationFailure = "validation-failure",
  StorageProblems = "storage-problems",
  HighDiskUsage = "high-disk-usage",
  HighMemoryUsage = "high-memory-usage",
  SlowRetrieval = "slow-retrieval",
  SlowSearch = "slow-search",
}

export interface MonitoredKnowledgeModuleHealthScore {
  module: MonitoredKnowledgeModule;
  score: number;
  level: KnowledgeHealthScoreLevel;
  available: boolean;
  issues: string[];
}

export interface KnowledgeHealthWarning {
  type: KnowledgeWarningType;
  severity: KnowledgeHealthScoreLevel;
  message: string;
  module: MonitoredKnowledgeModule;
  recommendation: string;
}

export interface KnowledgeHealthCheckResult {
  checkId: string;
  timestamp: string;
  overallScore: number;
  overallLevel: KnowledgeHealthScoreLevel;
  moduleScores: MonitoredKnowledgeModuleHealthScore[];
  warnings: KnowledgeHealthWarning[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performance: {
    checkDurationMs: number;
    searchPerformanceMs: number;
    retrievalPerformanceMs: number;
    validationPerformanceMs: number;
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
  };
  validationReadiness: boolean;
  optimizationReadiness: boolean;
  recoveryNotified: boolean;
}

export interface KnowledgeAuditResult {
  auditId: string;
  timestamp: string;
  knowledgeIntegrity: boolean;
  knowledgeConsistency: boolean;
  relationshipIntegrity: boolean;
  graphIntegrity: boolean;
  validationStatus: boolean;
  optimizationStatus: boolean;
  searchQuality: boolean;
  recommendationQuality: boolean;
  knowledgeQuality: boolean;
  valid: boolean;
  durationMs: number;
}

export interface KnowledgeHealthHistoryEntry {
  checkId: string;
  timestamp: string;
  module: string;
  healthScore: number;
  level: KnowledgeHealthScoreLevel;
  warnings: string[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performanceMs: number;
}

export interface KnowledgeTrendAnalysis {
  direction: "improving" | "stable" | "declining";
  averageScore: number;
  scoreChange: number;
  warningTrend: number;
  prediction: string;
}

export interface KnowledgeAutoRepairResult {
  attempted: boolean;
  success: boolean;
  repairs: string[];
  validated: boolean;
}

export interface KnowledgeHealthMonitorStatusReport {
  engineStatus: string;
  overallKnowledgeHealth: string;
  moduleHealthSummary: string;
  knowledgeQuality: string;
  graphHealth: string;
  relationshipHealth: string;
  totalChecks: number;
  totalWarnings: number;
  performance: {
    averageCheckMs: number;
    lastCheckMs: number;
    averageDiskMb: number;
  };
  trendAnalysis: KnowledgeTrendAnalysis;
  recommendations: string[];
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class KnowledgeHealthMonitorEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "KnowledgeHealthMonitorEngineError";
  }
}
