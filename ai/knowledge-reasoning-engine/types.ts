export interface ProfessionalKnowledgeRecommendation {
  knowledgeId: string;
  guidance: string;
  reason: string;
  confidenceScore: number;
}

export interface ProfessionalReasoningRequest {
  request: string;
  objective?: string;
  context?: Record<string, unknown>;
  requiredDomains?: string[];
  limit?: number;
  /** When true (default), consult installed professional domain recommend/explain APIs. */
  includeDomainModules?: boolean;
}

export interface ProfessionalReasoningMissingInformation {
  field: string;
  severity: "important" | "optional";
  reason: string;
}

export interface ProfessionalKnowledgeEvidence {
  knowledgeId: string;
  title: string;
  domain: string;
  source: string;
  confidenceScore: number;
  qualityScore: number;
  relationshipCount: number;
  guidance: string;
  usedFor: string;
}

export interface ProfessionalKnowledgeOption extends ProfessionalKnowledgeRecommendation {
  title: string;
  domain: string;
  relevanceScore: number;
  qualityScore: number;
  relationshipCount: number;
  advantages: string[];
  disadvantages: string[];
  selected: boolean;
  rejectionReason?: string;
}

export interface ProfessionalDomainContribution {
  domain: string;
  sourceModule: string;
  knowledgeId: string | null;
  title: string;
  guidance: string;
  advantages: string[];
  disadvantages: string[];
  confidenceScore: number;
  whyUsed: string;
}

export interface ProfessionalReasoningProcessStep {
  step: number;
  name: string;
  detail: string;
}

export interface ProfessionalKnowledgeReasoningResult {
  topic: string;
  objective: string;
  available: boolean;
  grounded: boolean;
  multiDomain: boolean;
  confidenceScore: number;
  confidenceExplanation: string;
  problemAnalysis: string;
  missingInformation: ProfessionalReasoningMissingInformation[];
  domainsUsed: string[];
  knowledgeUsed: ProfessionalKnowledgeEvidence[];
  domainContributions: ProfessionalDomainContribution[];
  consideredOptions: ProfessionalKnowledgeOption[];
  rejectedOptions: ProfessionalKnowledgeOption[];
  selected: ProfessionalKnowledgeRecommendation | null;
  alternatives: ProfessionalKnowledgeRecommendation[];
  decisionRules: string[];
  professionalStandards: string[];
  risks: string[];
  tradeOffs: string[];
  improvements: string[];
  relatedKnowledgeIds: string[];
  processSteps: ProfessionalReasoningProcessStep[];
  explanation: string;
}

export interface AiMeProfessionalReasoningAwareness {
  available: boolean;
  summary: string;
  capabilities: string[];
  groundedInKnowledgeFoundation: boolean;
  decisionIntelligenceEnabled: boolean;
  lastConfidenceScore: number | null;
}

export interface ProfessionalReasoningHealthReport {
  healthy: boolean;
  initialized: boolean;
  foundationReady: boolean;
  canReason: boolean;
  issues: string[];
  checkedAt: string;
}

export interface ProfessionalReasoningRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface KnowledgeImpactReport {
  knowledgeId: string;
  operation: "create" | "update";
  affectedWorkflows: string[];
  affectedDecisions: string[];
  affectedRecommendations: Array<"rendering" | "camera" | "marketing" | "image" | "video">;
  relatedKnowledgeIds: string[];
  createdAt: string;
}
