/** AI Learning Step 7 — Workflow & AI Model Optimization types. */

export const WORKFLOW_MODEL_OPTIMIZATION_VERSION = "1.0";

export type ProductionTaskKind =
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "rendering"
  | "storyboard"
  | "full-pipeline";

export interface WorkflowHistoryInput {
  workflowId: string;
  name: string;
  version?: number;
  successCount?: number;
  failureCount?: number;
  avgExecutionMs?: number;
  avgCpuPercent?: number;
  avgGpuPercent?: number;
  avgRamMb?: number;
  avgQuality?: number;
  userSatisfaction?: number;
  lastUsedAt?: string;
  active?: boolean;
  steps?: string[];
}

export interface ModelHistoryInput {
  modelId: string;
  task: ProductionTaskKind | string;
  outputQuality?: number;
  renderingQuality?: number;
  imageQuality?: number;
  videoQuality?: number;
  audioQuality?: number;
  processingSpeedScore?: number;
  gpuUsagePercent?: number;
  ramUsageMb?: number;
  stabilityScore?: number;
  errorRate?: number;
}

export interface OptimizationContextInput {
  productType?: string;
  marketingGoal?: string;
  hardwareTier?: "low" | "medium" | "high";
  qualityRequirement?: number;
  allowQualityTradeoffForSpeed?: boolean;
  performanceSignals?: Array<{ label: string; value: number }>;
  feedbackSignals?: string[];
  knowledgeHints?: string[];
  reasoningHints?: string[];
  decisionHints?: string[];
}

export interface AnalyzedWorkflow {
  workflowId: string;
  name: string;
  version: number;
  successRate: number;
  failureCount: number;
  avgExecutionMs: number;
  resourceScore: number;
  qualityResults: number;
  userSatisfaction: number;
  classification: Array<"efficient" | "inefficient" | "slow" | "unused" | "reusable">;
  active: boolean;
  steps: string[];
}

export interface AnalyzedModel {
  modelId: string;
  task: string;
  outputQuality: number;
  renderingQuality: number;
  imageQuality: number;
  videoQuality: number;
  audioQuality: number;
  processingSpeedScore: number;
  gpuUsagePercent: number;
  ramUsageMb: number;
  stabilityScore: number;
  errorRate: number;
  compositeScore: number;
}

export interface AdaptiveModelSelection {
  task: string;
  primaryModelId: string;
  secondaryModelId: string;
  backupModelId: string;
  productType: string;
  marketingGoal: string;
  hardwareTier: string;
  qualityRequirement: number;
  rationale: string;
}

export interface OptimizedWorkflowPlan {
  workflowId: string;
  previousVersion: number;
  newVersion: number;
  previousSteps: string[];
  optimizedSteps: string[];
  action: "improved" | "merged" | "replaced-obsolete";
  mergedFrom?: string[];
  obsoleteVersionArchived: boolean;
  activeReplacementCreated: boolean;
  estimatedExecutionMs: number;
  estimatedQuality: number;
  performanceImprovementPct: number;
  qualityImprovementPct: number;
}

export interface ResourceAllocationPlan {
  cpuWeight: number;
  gpuWeight: number;
  ramBudgetMb: number;
  scheduleOrder: string[];
  notes: string;
}

export interface OptimizationMemoryEntry {
  id: string;
  previousWorkflow: string;
  optimizedWorkflow: string;
  performanceImprovement: number;
  qualityImprovement: number;
  selectedModels: string[];
  confidenceScore: number;
  timestamp: string;
}

export interface WorkflowModelOptimizationResult {
  runId: string;
  version: typeof WORKFLOW_MODEL_OPTIMIZATION_VERSION;
  processedAt: string;
  analyzedWorkflows: AnalyzedWorkflow[];
  analyzedModels: AnalyzedModel[];
  optimizedWorkflows: OptimizedWorkflowPlan[];
  modelSelections: AdaptiveModelSelection[];
  modelCombinations: Array<{ task: string; models: string[]; reason: string }>;
  resourcePlan: ResourceAllocationPlan;
  optimizationMemory: OptimizationMemoryEntry[];
  performanceImprovements: string[];
  qualityImprovements: string[];
  issuesFound: string[];
  issuesRepaired: string[];
  historyPreserved: true;
  qualityNeverReducedAutomatically: true;
  autonomousImprovementDeferred: false;
  summary: string;
}

export interface AiMeWorkflowModelOptimizationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainWorkflowOptimizations: boolean;
  canExplainModelSelection: boolean;
  canCompareWorkflowVersions: boolean;
  canRecommendEfficientWorkflow: boolean;
  canPredictProductionQuality: boolean;
  autonomousImprovementDeferred: false;
  summary: string;
}

export interface WorkflowModelOptimizationExplainResult {
  workflowId?: string;
  workflowOptimizationExplanation: string;
  modelSelectionExplanation: string;
  workflowVersionComparison: string;
  recommendedWorkflow: string;
  predictedProductionQuality: number;
  predictedQualityNote: string;
}

export interface WorkflowModelOptimizationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface WorkflowModelOptimizationReportData {
  generatedAt: string;
  existingOptimizationCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  optimizedWorkflows: Array<{ workflowId: string; action: string; version: number }>;
  optimizedAiModels: Array<{ task: string; primary: string; secondary: string; backup: string }>;
  performanceImprovements: string[];
  qualityImprovements: string[];
  optimizationMemoryStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep8: string[];
}

export interface WorkflowModelOptimizationStore {
  workflows: AnalyzedWorkflow[];
  models: AnalyzedModel[];
  optimized: OptimizedWorkflowPlan[];
  selections: AdaptiveModelSelection[];
  memory: OptimizationMemoryEntry[];
  runs: WorkflowModelOptimizationResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

export interface WorkflowModelOptimizationInput {
  workflows: WorkflowHistoryInput[];
  models: ModelHistoryInput[];
  context?: OptimizationContextInput;
}
