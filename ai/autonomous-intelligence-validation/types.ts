/** AI Learning Step 9 — Autonomous Intelligence Validation & Production Readiness types. */

export const AUTONOMOUS_INTELLIGENCE_VALIDATION_VERSION = "1.0";

export type AutonomousCapabilityId =
  | "online-research"
  | "knowledge-acquisition"
  | "knowledge-validation"
  | "knowledge-expansion"
  | "continuous-learning"
  | "feedback-learning"
  | "workflow-optimization"
  | "ai-model-optimization"
  | "self-improvement"
  | "decision-improvement";

export type ProductionScenarioId =
  | "product-marketing-video"
  | "luxury-product-campaign"
  | "social-media-advertisement"
  | "product-photography-workflow";

export type ValidationStatus = "pass" | "fail" | "warn" | "repaired";

export interface CapabilityValidationResult {
  capability: AutonomousCapabilityId;
  status: ValidationStatus;
  detail: string;
  score: number;
}

export interface SafetyValidationResult {
  check: string;
  passed: boolean;
  detail: string;
}

export interface LearningValidationResult {
  source: string;
  learnedCorrectly: boolean;
  detail: string;
}

export interface ScenarioSimulationResult {
  scenario: ProductionScenarioId;
  label: string;
  modulesBehavedCorrectly: boolean;
  qualityPreserved: boolean;
  offlineCompatible: boolean;
  detail: string;
  score: number;
}

export interface StabilityMetrics {
  stability: number;
  reliability: number;
  recoveryCapability: number;
  rollbackSuccess: number;
  knowledgeIntegrity: number;
  versionIntegrity: number;
  memoryIntegrity: number;
}

export interface AiMeValidationResult {
  canLearnSafely: boolean;
  canImproveSafely: boolean;
  canExplainLearnedKnowledge: boolean;
  canExplainImprovements: boolean;
  canRecommendImprovements: boolean;
  canRollBackUnsafeChanges: boolean;
  detail: string;
}

export interface ReadinessScores {
  learningScore: number;
  stabilityScore: number;
  safetyScore: number;
  knowledgeScore: number;
  optimizationScore: number;
  reliabilityScore: number;
  productionReadinessScore: number;
}

export interface AutonomousIntelligenceValidationResult {
  runId: string;
  version: typeof AUTONOMOUS_INTELLIGENCE_VALIDATION_VERSION;
  processedAt: string;
  capabilityValidations: CapabilityValidationResult[];
  safetyValidations: SafetyValidationResult[];
  learningValidations: LearningValidationResult[];
  scenarioSimulations: ScenarioSimulationResult[];
  stability: StabilityMetrics;
  aiMeValidation: AiMeValidationResult;
  readiness: ReadinessScores;
  certifiedForProduction: boolean;
  remainingRisks: string[];
  issuesFound: string[];
  issuesRepaired: string[];
  versionHistoryPreserved: true;
  userDataDeleted: false;
  offlineCompatible: true;
  learningCertificationDeferred: false;
  summary: string;
}

export interface AiMeAutonomousIntelligenceValidationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainEveryValidationResult: boolean;
  canExplainFailedValidations: boolean;
  canRecommendCorrectiveActions: boolean;
  canPredictLongTermSystemHealth: boolean;
  learningCertificationDeferred: false;
  summary: string;
}

export interface AutonomousIntelligenceValidationExplainResult {
  runId?: string;
  validationOverview: string;
  failedValidations: string[];
  correctiveActions: string[];
  longTermHealthPrediction: string;
}

export interface AutonomousIntelligenceValidationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface AutonomousIntelligenceValidationReportData {
  generatedAt: string;
  existingValidationCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  learningValidationStatus: string;
  safetyValidationStatus: string;
  stabilityStatus: string;
  productionReadinessScore: number;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingRisks: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep10: string[];
}

export interface AutonomousIntelligenceValidationStore {
  runs: AutonomousIntelligenceValidationResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
