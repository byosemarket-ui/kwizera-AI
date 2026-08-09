/**
 * Professional Workflow Intelligence types (Reasoning & Decision Intelligence Step 4).
 * Workflows are knowledge-foundation grounded via Professional Planning.
 * Does not generate media. Recommendation Intelligence is enabled via AiRecommendationEngine.
 */

export interface ProfessionalWorkflowRequest {
  request: string;
  objective?: string;
  context?: Record<string, unknown>;
  requiredDomains?: string[];
  constraints?: string[];
  availableResources?: string[];
  /** Prefer an existing professional plan instead of planning again. */
  planId?: string;
  includeDomainModules?: boolean;
  reuseSimilarWorkflows?: boolean;
}

export interface ProfessionalWorkflowTask {
  taskId: string;
  title: string;
  kind: "main" | "sub" | "validation" | "parallel" | "recovery";
  domain: string;
  moduleHint: string;
  description: string;
  order: number;
  dependsOn: string[];
  parallelGroup?: string;
  estimatedMinutes: number;
  expectedResult: string;
  validationCheckpoint: boolean;
}

export interface ProfessionalWorkflowDependency {
  fromTaskId: string;
  toTaskId: string;
  reason: string;
}

export interface ProfessionalWorkflowDefinition {
  workflowId: string;
  workflowName: string;
  goal: string;
  requiredKnowledge: string[];
  requiredModules: string[];
  requiredResources: string[];
  mainTasks: ProfessionalWorkflowTask[];
  subTasks: ProfessionalWorkflowTask[];
  allTasks: ProfessionalWorkflowTask[];
  dependencies: ProfessionalWorkflowDependency[];
  validationSteps: ProfessionalWorkflowTask[];
  expectedResults: string[];
  recoverySteps: string[];
  parallelGroups: string[][];
  executionOrder: string[];
  estimatedExecutionMinutes: number;
}

export interface ProfessionalWorkflowExplanation {
  whySelected: string;
  taskOrderReason: string;
  knowledgePacksUsed: string[];
  knowledgeIdsUsed: string[];
  dependenciesSummary: string;
  expectedOutcome: string;
  confidenceScore: number;
  domainsUsed: string[];
  improvementsDetected: string[];
}

export interface ProfessionalWorkflowExecutionEvent {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed" | "recovered" | "skipped";
  startedAt: string;
  finishedAt?: string;
  note: string;
}

export interface ProfessionalWorkflowMemoryRecord {
  workflowId: string;
  goal: string;
  knowledgeUsed: Array<{ knowledgeId: string; title: string; domain: string; source: string }>;
  taskStructure: Array<{ taskId: string; title: string; kind: string; order: number; dependsOn: string[] }>;
  dependencies: ProfessionalWorkflowDependency[];
  executionHistory: ProfessionalWorkflowExecutionEvent[];
  performanceMetrics: {
    estimatedMinutes: number;
    actualMinutes: number | null;
    taskCount: number;
    parallelGroupCount: number;
    successRate: number | null;
  };
  confidenceScore: number;
  timestamp: string;
  relatedPlanId: string | null;
  relatedDecisionId: string | null;
  domainsUsed: string[];
  relatedKnowledgePacks: string[];
  priorWorkflowIds: string[];
  grounded: boolean;
  fingerprint: string;
}

export interface ProfessionalWorkflowResult {
  workflowId: string;
  available: boolean;
  grounded: boolean;
  unsupported: boolean;
  reused: boolean;
  definition: ProfessionalWorkflowDefinition;
  explanation: ProfessionalWorkflowExplanation;
  confidenceScore: number;
  confidenceExplanation: string;
  memoryRecord: ProfessionalWorkflowMemoryRecord;
  relatedPlanId: string | null;
  relatedDecisionId: string | null;
  multiDomain: boolean;
  durationMs: number;
}

export interface ProfessionalWorkflowModification {
  addRecoverySteps?: string[];
  addExpectedResults?: string[];
  removeTaskIds?: string[];
  reorderTaskIds?: string[];
  notes?: string;
}

export interface ProfessionalWorkflowExecutionResult {
  workflowId: string;
  status: "completed" | "failed" | "partial";
  executionHistory: ProfessionalWorkflowExecutionEvent[];
  performanceMetrics: ProfessionalWorkflowMemoryRecord["performanceMetrics"];
  improvementsDetected: string[];
  explanation: string;
  durationMs: number;
}

export interface AiMeProfessionalWorkflowAwareness {
  available: boolean;
  enabled: boolean;
  summary: string;
  capabilities: string[];
  groundedInKnowledgeFoundation: boolean;
  recommendationIntelligenceEnabled: boolean;
  workflowHistoryCount: number;
  lastConfidenceScore: number | null;
}

export interface ProfessionalWorkflowHealthReport {
  healthy: boolean;
  initialized: boolean;
  foundationReady: boolean;
  planningReady: boolean;
  canCreateWorkflow: boolean;
  memoryWritable: boolean;
  issues: string[];
  checkedAt: string;
}

export interface ProfessionalWorkflowRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}
