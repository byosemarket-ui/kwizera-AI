/**
 * Professional Reasoning & Decision Certification types (Step 8 — final).
 * Orchestrates verification of Steps 1–7. Does not generate media.
 * Does not begin the next development phase.
 */

export const PROFESSIONAL_REASONING_DECISION_VERSION = "1.0";

export type CertificationCheckStatus = "passed" | "failed" | "blocked" | "skipped";

export interface CertificationCheck {
  id: string;
  label: string;
  status: CertificationCheckStatus;
  detail: string;
  score?: number;
  issues: string[];
}

export interface CapabilityCertificationStatus {
  professionalReasoning: CertificationCheck;
  decisionIntelligence: CertificationCheck;
  planningIntelligence: CertificationCheck;
  workflowIntelligence: CertificationCheck;
  recommendationIntelligence: CertificationCheck;
  multiDomainReasoning: CertificationCheck;
  selfReview: CertificationCheck;
  professionalEvaluation: CertificationCheck;
}

export interface KnowledgeFoundationCertificationStatus {
  knowledgeDomains: CertificationCheck;
  knowledgePacks: CertificationCheck;
  knowledgeGraph: CertificationCheck;
  semanticSearch: CertificationCheck;
  decisionRules: CertificationCheck;
  workflowTemplates: CertificationCheck;
  professionalStandards: CertificationCheck;
  qualityRules: CertificationCheck;
}

export interface ScenarioCertificationResult {
  scenarioId: string;
  name: string;
  passed: boolean;
  grounded: boolean;
  unsupported: boolean;
  readyForDelivery: boolean;
  confidenceScore: number;
  domainsUsed: string[];
  knowledgeIdsUsed: number;
  reusedRecommendation: boolean;
  reusedWorkflow: boolean;
  reviewId: string | null;
  recommendationId: string | null;
  workflowId: string | null;
  decisionId: string | null;
  issues: string[];
  explanationChars: number;
}

export interface ConsistencyCertificationResult {
  noDuplicatedReasoning: CertificationCheck;
  noDuplicatedWorkflows: CertificationCheck;
  noDuplicatedRecommendations: CertificationCheck;
  noBrokenRelationships: CertificationCheck;
  noMissingKnowledgeDomains: CertificationCheck;
  noUnsupportedRecommendations: CertificationCheck;
}

export interface SystemHealthScores {
  overallReasoningQuality: number;
  overallDecisionQuality: number;
  planningQuality: number;
  workflowQuality: number;
  recommendationQuality: number;
  knowledgeUsage: number;
  explanationQuality: number;
  selfReviewQuality: number;
  confidenceScore: number;
  professionalReadinessScore: number;
}

export interface AiMeCertificationAnswers {
  canThinkProfessionally: boolean;
  canMakeExplainableDecisions: boolean;
  isVersionOneComplete: boolean;
}

export interface ProfessionalReasoningCertificationResult {
  version: typeof PROFESSIONAL_REASONING_DECISION_VERSION;
  verifiedAt: string;
  certified: boolean;
  capabilities: CapabilityCertificationStatus;
  knowledgeFoundation: KnowledgeFoundationCertificationStatus;
  scenarios: ScenarioCertificationResult[];
  consistency: ConsistencyCertificationResult;
  systemHealth: SystemHealthScores;
  aiMeAnswers: AiMeCertificationAnswers;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingLimitations: string[];
  blockers: string[];
  certificatePath: string | null;
  verificationPath: string;
  durationMs: number;
}

export interface ProfessionalReasoningCertificationRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface AiMeProfessionalReasoningCertificationAwareness {
  available: boolean;
  enabled: boolean;
  certified: boolean;
  version: string;
  summary: string;
  capabilities: string[];
  groundedInKnowledgeFoundation: boolean;
  nextDevelopmentPhaseEnabled: boolean;
  lastReadinessScore: number | null;
  lastConfidenceScore: number | null;
}

export class ProfessionalReasoningCertificationError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalReasoningCertificationError";
  }
}
