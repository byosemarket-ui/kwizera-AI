/**
 * Professional Decision Intelligence types (Reasoning & Decision Intelligence Step 2).
 * Decisions are knowledge-foundation grounded; this does not generate media or run Planning Intelligence.
 */

export interface ProfessionalDecisionRequest {
  request: string;
  objective?: string;
  context?: Record<string, unknown>;
  requiredDomains?: string[];
  constraints?: string[];
  availableResources?: string[];
  limit?: number;
  /** When true (default), consult professional domain modules via the Reasoning Engine. */
  includeDomainModules?: boolean;
}

export interface ProfessionalDecisionOption {
  optionId: string;
  title: string;
  domain: string;
  guidance: string;
  advantages: string[];
  disadvantages: string[];
  risks: string[];
  confidenceScore: number;
  selected: boolean;
  rejectionReason?: string;
  knowledgeId: string;
}

export interface ProfessionalDecisionFramework {
  objective: string;
  availableOptions: ProfessionalDecisionOption[];
  advantages: string[];
  disadvantages: string[];
  risks: string[];
  professionalStandards: string[];
  bestPractices: string[];
  confidenceScore: number;
  finalRecommendation: string;
}

export interface ProfessionalDecisionExplanation {
  whySelected: string;
  knowledgePacksUsed: string[];
  knowledgeIdsUsed: string[];
  professionalStandardsApplied: string[];
  alternativesRejected: Array<{ title: string; reason: string }>;
  expectedOutcome: string;
  domainsUsed: string[];
}

export interface ProfessionalDecisionMemoryRecord {
  decisionId: string;
  context: {
    request: string;
    objective: string;
    constraints: string[];
    availableResources: string[];
    missingInformation: string[];
  };
  knowledgeUsed: Array<{ knowledgeId: string; title: string; domain: string; source: string }>;
  reasoningPath: string[];
  finalDecision: string;
  confidenceScore: number;
  timestamp: string;
  relatedKnowledgePacks: string[];
  domainsUsed: string[];
  priorDecisionIds: string[];
  grounded: boolean;
}

export interface ProfessionalDecisionResult {
  decisionId: string;
  available: boolean;
  grounded: boolean;
  unsupported: boolean;
  objective: string;
  constraints: string[];
  availableResources: string[];
  missingInformation: Array<{ field: string; severity: string; reason: string }>;
  framework: ProfessionalDecisionFramework;
  explanation: ProfessionalDecisionExplanation;
  confidenceScore: number;
  confidenceExplanation: string;
  memoryRecord: ProfessionalDecisionMemoryRecord;
  professionalReasoningAvailable: boolean;
  multiDomain: boolean;
  learnedFromHistory: boolean;
  durationMs: number;
}

export interface AiMeProfessionalDecisionAwareness {
  available: boolean;
  enabled: boolean;
  summary: string;
  capabilities: string[];
  groundedInKnowledgeFoundation: boolean;
  planningIntelligenceEnabled: boolean;
  decisionHistoryCount: number;
  lastConfidenceScore: number | null;
}

export interface ProfessionalDecisionHealthReport {
  healthy: boolean;
  initialized: boolean;
  foundationReady: boolean;
  canDecide: boolean;
  memoryWritable: boolean;
  issues: string[];
  checkedAt: string;
}

export interface ProfessionalDecisionRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}
