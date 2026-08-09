/** AI Learning Step 10 — Learning & Continuous Improvement Certification types (Version 1.0). */

export const LEARNING_CERTIFICATION_VERSION = "1.0";
export const LEARNING_CONTINUOUS_IMPROVEMENT_PRODUCT_VERSION = "1.0";

export type LearningSubsystemId =
  | "online-research"
  | "knowledge-acquisition"
  | "download-manager"
  | "knowledge-validation"
  | "knowledge-integration"
  | "knowledge-evolution"
  | "feedback-intelligence"
  | "performance-analytics"
  | "autonomous-learning"
  | "workflow-optimization"
  | "self-optimization"
  | "autonomous-validation";

export type CertificationScenarioId =
  | "internet-available"
  | "offline-mode"
  | "user-feedback"
  | "knowledge-update"
  | "workflow-improvement";

export type SubsystemStatus = "pass" | "fail" | "repaired" | "warn";

export interface SubsystemCertificationResult {
  subsystem: LearningSubsystemId;
  status: SubsystemStatus;
  detail: string;
  score: number;
}

export interface ScenarioCertificationResult {
  scenario: CertificationScenarioId;
  label: string;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  score: number;
}

export interface KnowledgeFoundationCertification {
  knowledgePacks: boolean;
  knowledgeGraph: boolean;
  metadata: boolean;
  searchIndex: boolean;
  versionHistory: boolean;
  relationshipIntegrity: boolean;
  score: number;
  detail: string;
}

export interface AiMeLearningCertification {
  canSearchKnowledge: boolean;
  canLearnNewKnowledge: boolean;
  canExplainLearnedKnowledge: boolean;
  canValidateKnowledge: boolean;
  canRejectLowQualityKnowledge: boolean;
  canRememberPreviousKnowledge: boolean;
  canImproveWorkflows: boolean;
  canImproveRecommendations: boolean;
  canExplainEveryImprovement: boolean;
  score: number;
  detail: string;
}

export interface SystemHealthScores {
  learningScore: number;
  knowledgeQualityScore: number;
  knowledgeCoverageScore: number;
  researchQualityScore: number;
  optimizationScore: number;
  safetyScore: number;
  stabilityScore: number;
  reliabilityScore: number;
  offlineReadinessScore: number;
  overallIntelligenceScore: number;
  productionReadinessScore: number;
}

export interface LongTermStabilityCertification {
  continuousLearning: boolean;
  versionIntegrity: boolean;
  backupIntegrity: boolean;
  rollbackIntegrity: boolean;
  knowledgeIntegrity: boolean;
  memoryIntegrity: boolean;
  storageIntegrity: boolean;
  score: number;
  detail: string;
}

export interface CertificationBlocker {
  id: string;
  area: string;
  evidence: string;
}

export interface LearningCertificationResult {
  runId: string;
  version: typeof LEARNING_CERTIFICATION_VERSION;
  productVersion: typeof LEARNING_CONTINUOUS_IMPROVEMENT_PRODUCT_VERSION;
  processedAt: string;
  subsystems: SubsystemCertificationResult[];
  scenarios: ScenarioCertificationResult[];
  knowledgeFoundation: KnowledgeFoundationCertification;
  aiMe: AiMeLearningCertification;
  health: SystemHealthScores;
  longTermStability: LongTermStabilityCertification;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingLimitations: string[];
  blockers: CertificationBlocker[];
  versionHistoryPreserved: true;
  userKnowledgePreserved: true;
  projectHistoryPreserved: true;
  validationBypassed: false;
  offlineFirst: true;
  certified: boolean;
  certificationStatement: string;
  summary: string;
}

export interface AiMeLearningCertificationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainCertificationResults: boolean;
  canListBlockers: boolean;
  canRecommendRemediation: boolean;
  learningContinuousImprovementV1Complete: boolean;
  summary: string;
}

export interface LearningCertificationExplainResult {
  runId?: string;
  overview: string;
  blockers: string[];
  remediation: string[];
  certified: boolean;
}

export interface LearningCertificationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface LearningCertificationReportData {
  generatedAt: string;
  onlineResearchStatus: string;
  knowledgeAcquisitionStatus: string;
  knowledgeValidationStatus: string;
  knowledgeEvolutionStatus: string;
  feedbackIntelligenceStatus: string;
  performanceAnalyticsStatus: string;
  autonomousLearningStatus: string;
  workflowOptimizationStatus: string;
  selfOptimizationStatus: string;
  autonomousValidationStatus: string;
  knowledgeFoundationStatus: string;
  aiMeLearningCapability: string;
  overallLearningScore: number;
  overallIntelligenceScore: number;
  productionReadinessScore: number;
  stabilityScore: number;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingLimitations: string[];
  isVersion10Complete: boolean;
  blockers: CertificationBlocker[];
  certificationStatement: string;
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
}

export interface LearningCertificationStore {
  runs: LearningCertificationResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
