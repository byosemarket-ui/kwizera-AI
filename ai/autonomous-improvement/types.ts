/** AI Learning Step 8 — Autonomous Improvement & Self-Optimization types. */

export const AUTONOMOUS_IMPROVEMENT_VERSION = "1.0";

export type ImprovementTargetModule =
  | "ai-reasoning"
  | "planning"
  | "workflow"
  | "prompt-generation"
  | "scene-planning"
  | "storyboard"
  | "rendering"
  | "resource-allocation"
  | "ai-model-selection"
  | "knowledge-usage";

export type ImprovementStrategy =
  | "workflow-refinement"
  | "prompt-optimization"
  | "resource-optimization"
  | "cache-optimization"
  | "search-optimization"
  | "memory-optimization"
  | "scheduling-optimization"
  | "knowledge-optimization";

export interface ImprovementSignalInput {
  source:
    | "performance-analytics"
    | "workflow-optimization"
    | "ai-model-analytics"
    | "user-feedback"
    | "production-history"
    | "knowledge-foundation"
    | "learning-memory"
    | "optimization-memory";
  label: string;
  score?: number;
  detail?: string;
  moduleHint?: ImprovementTargetModule;
  strategyHint?: ImprovementStrategy;
}

export interface AutonomousImprovementCycleInput {
  signals?: ImprovementSignalInput[];
  maxApply?: number;
  forceUnsafeCandidate?: boolean;
}

export interface SafetyVerification {
  noFunctionalityBreak: boolean;
  apisCompatible: boolean;
  workflowsFunctional: boolean;
  projectDataSafe: boolean;
  safeToApply: boolean;
  failedChecks: string[];
  notes: string;
}

export interface ImprovementOpportunity {
  id: string;
  module: ImprovementTargetModule;
  strategy: ImprovementStrategy;
  reason: string;
  expectedBenefit: string;
  confidenceScore: number;
  signalSources: string[];
  safety: SafetyVerification;
}

export interface ImprovementEvaluation {
  performanceGain: number;
  qualityGain: number;
  resourceReduction: number;
  productionTimeReduction: number;
  errorReduction: number;
  userSatisfactionImprovement: number;
}

export interface RollbackPoint {
  id: string;
  improvementId: string;
  backupPath: string;
  previousVersion: number;
  newVersion: number;
  createdAt: string;
  rolledBack: boolean;
}

export interface ImprovementMemoryEntry {
  id: string;
  moduleImproved: ImprovementTargetModule;
  previousVersion: number;
  newVersion: number;
  improvementReason: string;
  expectedBenefit: string;
  actualBenefit: string;
  confidenceScore: number;
  strategy: ImprovementStrategy;
  applied: boolean;
  recommendationOnly: boolean;
  timestamp: string;
  rollbackPointId?: string;
  evaluation?: ImprovementEvaluation;
}

export interface ManualImprovementRecommendation {
  id: string;
  module: ImprovementTargetModule;
  strategy: ImprovementStrategy;
  reason: string;
  whyUnsafeAutomatic: string;
  recommendedAction: string;
}

export interface AutonomousImprovementResult {
  runId: string;
  version: typeof AUTONOMOUS_IMPROVEMENT_VERSION;
  processedAt: string;
  opportunities: ImprovementOpportunity[];
  applied: ImprovementMemoryEntry[];
  recommendations: ManualImprovementRecommendation[];
  rollbacksAvailable: RollbackPoint[];
  evaluations: ImprovementEvaluation[];
  performanceImprovementSummary: string[];
  qualityImprovementSummary: string[];
  stabilityStatus: "stable" | "degraded" | "rolled-back";
  userProjectsModified: false;
  userDataDeleted: false;
  issuesFound: string[];
  issuesRepaired: string[];
  autonomousIntelligenceCertificationDeferred: false;
  summary: string;
}

export interface AiMeAutonomousImprovementAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainEveryImprovement: boolean;
  canExplainWhyApplied: boolean;
  canPredictExpectedBenefits: boolean;
  canRecommendManualWhenUnsafe: boolean;
  autonomousIntelligenceCertificationDeferred: false;
  summary: string;
}

export interface AutonomousImprovementExplainResult {
  improvementId?: string;
  whatImproved: string;
  whyApplied: string;
  expectedBenefits: string;
  actualBenefits: string;
  recommendManual: string[];
}

export interface AutonomousImprovementHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface AutonomousImprovementReportData {
  generatedAt: string;
  existingSelfImprovementCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  improvementsApplied: Array<{ id: string; module: string; version: string }>;
  rollbackStatus: string;
  stabilityStatus: string;
  performanceImprovement: string[];
  qualityImprovement: string[];
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep9: string[];
}

export interface AutonomousImprovementStore {
  opportunities: ImprovementOpportunity[];
  memory: ImprovementMemoryEntry[];
  rollbacks: RollbackPoint[];
  recommendations: ManualImprovementRecommendation[];
  backups: Array<{ improvementId: string; path: string; payload: string; at: string }>;
  runs: AutonomousImprovementResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
  moduleVersions: Record<string, number>;
}
