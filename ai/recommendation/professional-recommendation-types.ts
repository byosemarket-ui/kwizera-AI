/**
 * Professional Recommendation Intelligence types (Reasoning & Decision Intelligence Step 5).
 * Recommendations are knowledge-foundation grounded via Workflow / Planning / Decision.
 * Does not generate media. Multi-Domain Reasoning is not enabled.
 */

export interface ProfessionalRecommendationRequest {
  request: string;
  objective?: string;
  context?: Record<string, unknown>;
  requiredDomains?: string[];
  constraints?: string[];
  availableResources?: string[];
  /** Prefer an existing professional workflow instead of creating one. */
  workflowId?: string;
  includeDomainModules?: boolean;
  reuseSimilarRecommendations?: boolean;
  userFeedback?: string;
}

export interface ProfessionalRecommendationAlternative {
  rank: 1 | 2 | 3;
  title: string;
  summary: string;
  advantages: string[];
  disadvantages: string[];
  risks: string[];
  confidenceScore: number;
  whyRanked: string;
  relatedDecisionOptionId?: string;
  relatedWorkflowId?: string;
}

export interface ProfessionalRecommendationFramework {
  objective: string;
  recommendedSolution: string;
  alternativeSolutions: ProfessionalRecommendationAlternative[];
  advantages: string[];
  disadvantages: string[];
  risks: string[];
  bestPractices: string[];
  expectedResults: string[];
  professionalStandards: string[];
  confidenceScore: number;
}

export interface ProfessionalRecommendationExplanation {
  whySelected: string;
  knowledgePacksUsed: string[];
  knowledgeIdsUsed: string[];
  workflowsConsidered: string[];
  decisionsInfluenced: string[];
  professionalStandardsApplied: string[];
  expectedBenefits: string[];
  domainsUsed: string[];
  rankingReason: string;
  confidenceScore: number;
}

export interface ProfessionalRecommendationMemoryRecord {
  recommendationId: string;
  context: {
    request: string;
    objective: string;
    constraints: string[];
    availableResources: string[];
    missingInformation: string[];
  };
  knowledgeUsed: Array<{ knowledgeId: string; title: string; domain: string; source: string }>;
  relatedWorkflowId: string | null;
  relatedDecisionId: string | null;
  relatedPlanId: string | null;
  recommendedSolution: string;
  alternativeTitles: string[];
  confidenceScore: number;
  userFeedback: string | null;
  timestamp: string;
  relatedKnowledgePacks: string[];
  domainsUsed: string[];
  priorRecommendationIds: string[];
  grounded: boolean;
  fingerprint: string;
}

export interface ProfessionalRecommendationResult {
  recommendationId: string;
  available: boolean;
  grounded: boolean;
  unsupported: boolean;
  reused: boolean;
  objective: string;
  framework: ProfessionalRecommendationFramework;
  explanation: ProfessionalRecommendationExplanation;
  confidenceScore: number;
  confidenceExplanation: string;
  memoryRecord: ProfessionalRecommendationMemoryRecord;
  relatedWorkflowId: string | null;
  relatedDecisionId: string | null;
  relatedPlanId: string | null;
  multiDomain: boolean;
  missingInformation: Array<{ field: string; severity: string; reason: string }>;
  durationMs: number;
}

export interface AiMeProfessionalRecommendationAwareness {
  available: boolean;
  enabled: boolean;
  summary: string;
  capabilities: string[];
  groundedInKnowledgeFoundation: boolean;
  multiDomainReasoningEnabled: boolean;
  recommendationHistoryCount: number;
  lastConfidenceScore: number | null;
}

export interface ProfessionalRecommendationHealthReport {
  healthy: boolean;
  initialized: boolean;
  foundationReady: boolean;
  workflowReady: boolean;
  canRecommend: boolean;
  memoryWritable: boolean;
  issues: string[];
  checkedAt: string;
}

export interface ProfessionalRecommendationRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}
