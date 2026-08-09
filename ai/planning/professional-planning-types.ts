/**
 * Professional Planning Intelligence types (Reasoning & Decision Intelligence Step 3).
 * Plans are knowledge-foundation grounded via Professional Decision/Reasoning.
 * Does not generate media or run Workflow Intelligence.
 */

export interface ProfessionalPlanningRequest {
  request: string;
  objective?: string;
  context?: Record<string, unknown>;
  requiredDomains?: string[];
  constraints?: string[];
  availableResources?: string[];
  /** Prefer an existing professional decision instead of deciding again. */
  decisionId?: string;
  includeDomainModules?: boolean;
  reuseSimilarPlans?: boolean;
}

export interface ProfessionalPlanTask {
  taskId: string;
  title: string;
  kind: "main" | "sub" | "validation" | "parallel";
  domain: string;
  description: string;
  order: number;
  dependsOn: string[];
  parallelGroup?: string;
  estimatedMinutes: number;
  requiredKnowledge: string[];
  expectedResult: string;
}

export interface ProfessionalPlanDependency {
  fromTaskId: string;
  toTaskId: string;
  reason: string;
}

export interface ProfessionalPlanFramework {
  goal: string;
  requirements: string[];
  assumptions: string[];
  requiredKnowledge: string[];
  requiredResources: string[];
  professionalWorkflow: string[];
  taskBreakdown: ProfessionalPlanTask[];
  stepOrder: string[];
  dependencies: ProfessionalPlanDependency[];
  parallelTasks: string[][];
  expectedResults: string[];
  risks: string[];
  recommendations: string[];
  complexity: "low" | "medium" | "high";
  estimatedExecutionMinutes: number;
}

export interface ProfessionalPlanExplanation {
  whySelected: string;
  knowledgePacksUsed: string[];
  knowledgeIdsUsed: string[];
  taskOrderReason: string;
  expectedOutcome: string;
  confidenceScore: number;
  domainsUsed: string[];
}

export interface ProfessionalPlanMemoryRecord {
  planId: string;
  goal: string;
  reasoningSummary: string;
  knowledgeUsed: Array<{ knowledgeId: string; title: string; domain: string; source: string }>;
  tasks: Array<{ taskId: string; title: string; order: number; dependsOn: string[] }>;
  dependencies: ProfessionalPlanDependency[];
  confidenceScore: number;
  timestamp: string;
  relatedDecisionId: string | null;
  domainsUsed: string[];
  relatedKnowledgePacks: string[];
  priorPlanIds: string[];
  grounded: boolean;
}

export interface ProfessionalPlanningResult {
  planId: string;
  available: boolean;
  grounded: boolean;
  unsupported: boolean;
  goal: string;
  constraints: string[];
  missingInformation: Array<{ field: string; severity: string; reason: string }>;
  framework: ProfessionalPlanFramework;
  explanation: ProfessionalPlanExplanation;
  confidenceScore: number;
  confidenceExplanation: string;
  memoryRecord: ProfessionalPlanMemoryRecord;
  relatedDecisionId: string | null;
  reusedFromPlanId: string | null;
  multiDomain: boolean;
  durationMs: number;
}

export interface ProfessionalPlanModification {
  addRequirements?: string[];
  addRecommendations?: string[];
  removeTaskIds?: string[];
  reorderTaskIds?: string[];
  notes?: string;
}

export interface AiMeProfessionalPlanningAwareness {
  available: boolean;
  enabled: boolean;
  summary: string;
  capabilities: string[];
  groundedInKnowledgeFoundation: boolean;
  workflowIntelligenceEnabled: boolean;
  planHistoryCount: number;
  lastConfidenceScore: number | null;
}

export interface ProfessionalPlanningHealthReport {
  healthy: boolean;
  initialized: boolean;
  foundationReady: boolean;
  decisionReady: boolean;
  canPlan: boolean;
  memoryWritable: boolean;
  issues: string[];
  checkedAt: string;
}

export interface ProfessionalPlanningRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}
