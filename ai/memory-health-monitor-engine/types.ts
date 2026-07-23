/**
 * KWIZERA AI STUDIO — Memory Health Monitor Engine types (Step 3N)
 */

export enum MemoryHealthScoreLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum MonitoredModule {
  PersistentMemory = "persistent-memory",
  StorageEngine = "memory-storage-engine",
  IndexEngine = "memory-index-engine",
  RetrievalEngine = "memory-retrieval-engine",
  LearningMemory = "learning-memory-engine",
  ProjectMemory = "project-memory-engine",
  VideoMemory = "video-memory-engine",
  MarketingMemory = "marketing-memory-engine",
  ProductMemory = "product-memory-engine",
  RelationshipMemory = "relationship-memory-engine",
  OptimizationEngine = "memory-optimization-engine",
  BackupEngine = "memory-backup-engine",
  RecoveryEngine = "memory-recovery-engine",
  MemoryRegistry = "memory-registry",
  MemoryDatabase = "memory-database",
  MemoryCache = "memory-cache",
  MemorySearch = "memory-search",
  MemoryStorage = "memory-storage",
}

export enum WarningType {
  MemoryCorruption = "memory-corruption",
  SlowRetrieval = "slow-retrieval",
  SlowStorage = "slow-storage",
  BrokenRelationships = "broken-relationships",
  MissingIndexes = "missing-indexes",
  DuplicateRecords = "duplicate-records",
  StorageFragmentation = "storage-fragmentation",
  DatabaseError = "database-error",
  BackupFailure = "backup-failure",
  RecoveryProblem = "recovery-problem",
  HighDiskUsage = "high-disk-usage",
  HighMemoryUsage = "high-memory-usage",
}

export interface MonitoredModuleHealthScore {
  module: MonitoredModule;
  score: number;
  level: MemoryHealthScoreLevel;
  available: boolean;
  issues: string[];
}

export interface HealthWarning {
  type: WarningType;
  severity: MemoryHealthScoreLevel;
  message: string;
  module: MonitoredModule;
  recommendation: string;
}

export interface MemoryHealthCheckResult {
  checkId: string;
  timestamp: string;
  overallScore: number;
  overallLevel: MemoryHealthScoreLevel;
  moduleScores: MonitoredModuleHealthScore[];
  warnings: HealthWarning[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performance: {
    checkDurationMs: number;
    readPerformanceMs: number;
    writePerformanceMs: number;
    searchPerformanceMs: number;
    retrievalPerformanceMs: number;
    diskUsageMb: number;
    memoryUsageMb: number;
  };
  backupReadiness: boolean;
  recoveryReadiness: boolean;
}

export interface MemoryAuditResult {
  auditId: string;
  timestamp: string;
  memoryConsistency: boolean;
  relationshipIntegrity: boolean;
  storageStructure: boolean;
  indexQuality: boolean;
  learningQuality: boolean;
  projectIntegrity: boolean;
  videoIntegrity: boolean;
  marketingIntegrity: boolean;
  productIntegrity: boolean;
  recoveryReadiness: boolean;
  backupIntegrity: boolean;
  valid: boolean;
  durationMs: number;
}

export interface HealthHistoryEntry {
  checkId: string;
  timestamp: string;
  module: string;
  healthScore: number;
  level: MemoryHealthScoreLevel;
  warnings: string[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performanceMs: number;
}

export interface TrendAnalysis {
  direction: "improving" | "stable" | "declining";
  averageScore: number;
  scoreChange: number;
  warningTrend: number;
  prediction: string;
}

export interface AutoRepairResult {
  attempted: boolean;
  success: boolean;
  repairs: string[];
  validated: boolean;
}

export interface MemoryHealthMonitorStatusReport {
  engineStatus: string;
  overallMemoryHealth: string;
  moduleHealthSummary: string;
  integrityStatus: string;
  backupReadiness: string;
  recoveryReadiness: string;
  totalChecks: number;
  totalWarnings: number;
  performance: {
    averageCheckMs: number;
    lastCheckMs: number;
    averageDiskMb: number;
  };
  trendAnalysis: TrendAnalysis;
  recommendations: string[];
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class MemoryHealthMonitorEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MemoryHealthMonitorEngineError";
  }
}
