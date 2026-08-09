/**
 * Professional Self-Review & Evaluation types (Reasoning & Decision Intelligence Step 7).
 * Evaluates AI Me professional outputs before delivery. Does not generate media.
 * Professional Reasoning Certification is not enabled.
 */

export interface ProfessionalSelfReviewRequest {
  request: string;
  objective?: string;
  context?: Record<string, unknown>;
  requiredDomains?: string[];
  constraints?: string[];
  availableResources?: string[];
  /** Prefer an existing multi-domain reasoning result. */
  reasoningId?: string;
  includeDomainModules?: boolean;
  reuseSimilarReviews?: boolean;
}

export type ProfessionalEvaluationDimension =
  | "technicalAccuracy"
  | "knowledgeAccuracy"
  | "professionalStandards"
  | "workflowQuality"
  | "decisionQuality"
  | "recommendationQuality"
  | "explanationQuality"
  | "marketingEffectiveness"
  | "storytellingQuality"
  | "creativity"
  | "consistency";

export interface ProfessionalEvaluationScore {
  dimension: ProfessionalEvaluationDimension;
  score: number;
  notes: string;
  passed: boolean;
}

export interface DetectedProfessionalIssue {
  issueId: string;
  category:
    | "missingKnowledge"
    | "weakReasoning"
    | "weakDecision"
    | "weakPlanning"
    | "weakRecommendation"
    | "brokenRelationship"
    | "missingWorkflowStep"
    | "unsupportedClaim"
    | "lowConfidence";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  repaired: boolean;
  repairAction?: string;
}

export interface ProfessionalQualityScores {
  technicalQuality: number;
  professionalQuality: number;
  creativity: number;
  marketingQuality: number;
  knowledgeUsage: number;
  workflowQuality: number;
  overallReadiness: number;
}

export interface ProfessionalSelfReviewFramework {
  objective: string;
  reviewPassed: boolean;
  evaluationScores: ProfessionalEvaluationScore[];
  qualityScores: ProfessionalQualityScores;
  detectedIssues: DetectedProfessionalIssue[];
  improvementsMade: string[];
  strengths: string[];
  weaknesses: string[];
  improvedRecommendation: string;
  improvedExplanation: string;
  confidenceScore: number;
}

export interface ProfessionalSelfReviewExplanation {
  whyReviewed: string;
  objectiveReviewed: string;
  processesReviewed: string[];
  knowledgeReferenced: string[];
  standardsApplied: string[];
  strengths: string[];
  weaknesses: string[];
  improvementsMade: string[];
  confidenceScore: number;
}

export interface ProfessionalSelfReviewMemoryRecord {
  reviewId: string;
  relatedDecisionId: string | null;
  relatedWorkflowId: string | null;
  relatedRecommendationId: string | null;
  relatedReasoningId: string | null;
  detectedIssues: DetectedProfessionalIssue[];
  improvementsMade: string[];
  qualityScores: ProfessionalQualityScores;
  confidenceScore: number;
  reviewPassed: boolean;
  timestamp: string;
  domainsUsed: string[];
  knowledgeUsed: Array<{ knowledgeId: string; title: string; domain: string; source: string }>;
  priorReviewIds: string[];
  grounded: boolean;
  fingerprint: string;
}

export interface ProfessionalSelfReviewResult {
  reviewId: string;
  available: boolean;
  grounded: boolean;
  unsupported: boolean;
  reused: boolean;
  objective: string;
  framework: ProfessionalSelfReviewFramework;
  explanation: ProfessionalSelfReviewExplanation;
  confidenceScore: number;
  confidenceExplanation: string;
  memoryRecord: ProfessionalSelfReviewMemoryRecord;
  relatedDecisionId: string | null;
  relatedWorkflowId: string | null;
  relatedRecommendationId: string | null;
  relatedReasoningId: string | null;
  readyForDelivery: boolean;
  missingInformation: Array<{ field: string; severity: string; reason: string }>;
  durationMs: number;
}

export interface AiMeProfessionalSelfReviewAwareness {
  available: boolean;
  enabled: boolean;
  summary: string;
  capabilities: string[];
  groundedInKnowledgeFoundation: boolean;
  professionalReasoningCertificationEnabled: boolean;
  reviewHistoryCount: number;
  lastConfidenceScore: number | null;
}

export interface ProfessionalSelfReviewHealthReport {
  healthy: boolean;
  initialized: boolean;
  foundationReady: boolean;
  multiDomainReady: boolean;
  canSelfReview: boolean;
  memoryWritable: boolean;
  issues: string[];
  checkedAt: string;
}

export interface ProfessionalSelfReviewRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}
