/**
 * Professional Multi-Domain Reasoning types (Reasoning & Decision Intelligence Step 6).
 * Combines Knowledge Foundation domains before professional decisions/recommendations.
 * Does not generate media. Self-Review & Professional Evaluation is not enabled.
 */

export interface ProfessionalMultiDomainRequest {
  request: string;
  objective?: string;
  context?: Record<string, unknown>;
  requiredDomains?: string[];
  constraints?: string[];
  availableResources?: string[];
  /** Prefer an existing professional recommendation instead of creating one. */
  recommendationId?: string;
  includeDomainModules?: boolean;
  reuseSimilarReasoning?: boolean;
}

export interface CrossDomainDimensionScore {
  dimension:
    | "technicalQuality"
    | "creativeQuality"
    | "marketingImpact"
    | "customerExperience"
    | "brandConsistency"
    | "productionCost"
    | "workflowEfficiency"
    | "platformSuitability";
  score: number;
  notes: string;
  domains: string[];
}

export interface DomainConflict {
  conflictId: string;
  domainA: string;
  domainB: string;
  positionA: string;
  positionB: string;
  severity: "low" | "medium" | "high";
  resolution: string;
  selectedSide: "A" | "B" | "hybrid";
  whySelected: string;
}

export interface ProfessionalMultiDomainFramework {
  objective: string;
  domainsParticipating: string[];
  knowledgePacksUsed: string[];
  combinedRecommendation: string;
  crossDomainAnalysis: CrossDomainDimensionScore[];
  conflicts: DomainConflict[];
  decisionRulesApplied: string[];
  workflowsReferenced: string[];
  confidenceScore: number;
}

export interface ProfessionalMultiDomainExplanation {
  whySelected: string;
  domainsParticipating: string[];
  knowledgePacksUsed: string[];
  knowledgeIdsUsed: string[];
  workflowsReferenced: string[];
  decisionRulesApplied: string[];
  conflictsResolved: string[];
  expectedBenefits: string[];
  confidenceScore: number;
}

export interface ProfessionalMultiDomainMemoryRecord {
  reasoningId: string;
  domainsUsed: string[];
  knowledgeUsed: Array<{ knowledgeId: string; title: string; domain: string; source: string }>;
  decisionPath: string[];
  recommendation: string;
  relatedRecommendationId: string | null;
  relatedWorkflowId: string | null;
  relatedDecisionId: string | null;
  conflictCount: number;
  confidenceScore: number;
  timestamp: string;
  relatedKnowledgePacks: string[];
  priorReasoningIds: string[];
  grounded: boolean;
  fingerprint: string;
}

export interface ProfessionalMultiDomainResult {
  reasoningId: string;
  available: boolean;
  grounded: boolean;
  unsupported: boolean;
  reused: boolean;
  objective: string;
  framework: ProfessionalMultiDomainFramework;
  explanation: ProfessionalMultiDomainExplanation;
  confidenceScore: number;
  confidenceExplanation: string;
  memoryRecord: ProfessionalMultiDomainMemoryRecord;
  relatedRecommendationId: string | null;
  relatedWorkflowId: string | null;
  relatedDecisionId: string | null;
  multiDomain: boolean;
  missingInformation: Array<{ field: string; severity: string; reason: string }>;
  durationMs: number;
}

export interface AiMeProfessionalMultiDomainAwareness {
  available: boolean;
  enabled: boolean;
  summary: string;
  capabilities: string[];
  groundedInKnowledgeFoundation: boolean;
  selfReviewEnabled: boolean;
  reasoningHistoryCount: number;
  lastConfidenceScore: number | null;
}

export interface ProfessionalMultiDomainHealthReport {
  healthy: boolean;
  initialized: boolean;
  foundationReady: boolean;
  recommendationReady: boolean;
  canReasonMultiDomain: boolean;
  memoryWritable: boolean;
  issues: string[];
  checkedAt: string;
}

export interface ProfessionalMultiDomainRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}
