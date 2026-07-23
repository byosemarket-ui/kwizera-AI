/**
 * KWIZERA AI STUDIO — AI Planning Engine types (Step 2D)
 */
import type { DecisionPriority, WorkflowHandoff } from "../decision/types.js";
import type { ReasoningResult } from "../reasoning/types.js";
export declare enum PlanningType {
    ProductAnalysis = "product-analysis",
    ImageAnalysis = "image-analysis",
    ImageEnhancement = "image-enhancement",
    VideoEnhancement = "video-enhancement",
    PromotionalVideoProduction = "promotional-video-production",
    PosterGeneration = "poster-generation",
    MarketingCampaign = "marketing-campaign",
    Translation = "translation",
    Learning = "learning",
    MemoryUpdates = "memory-updates",
    Export = "export",
    Backup = "backup",
    Recovery = "recovery"
}
export declare enum PlanningStep {
    ReceiveApprovedDecision = 1,
    UnderstandObjective = 2,
    AnalyzeResources = 3,
    IdentifyModules = 4,
    BreakIntoTasks = 5,
    DefineExecutionOrder = 6,
    DefineDependencies = 7,
    EstimateExecutionTime = 8,
    EstimateStorage = 9,
    EstimateMemory = 10,
    CreateRecoveryPlan = 11,
    ValidatePlan = 12,
    SendToWorkflowEngine = 13
}
export declare enum PlanningStatus {
    Pending = "pending",
    InProgress = "in-progress",
    AwaitingInput = "awaiting-input",
    Complete = "complete",
    Failed = "failed"
}
export declare enum PlanTaskPriority {
    Critical = "critical",
    High = "high",
    Normal = "normal",
    Low = "low"
}
export interface PlanTask {
    id: string;
    name: string;
    moduleId: string;
    dependsOn: string[];
    estimatedMs: number;
    priority: PlanTaskPriority;
    description: string;
}
export interface PlanDependency {
    taskId: string;
    dependsOn: string[];
    satisfied: boolean;
}
export interface ResourceEstimate {
    modules: string[];
    storageBytes: number;
    memoryMb: number;
    cpuIntensity: "low" | "medium" | "high";
}
export interface TimeEstimate {
    totalMs: number;
    perTaskMs: Record<string, number>;
    humanReadable: string;
}
export interface RecoveryStrategy {
    primary: string;
    fallback: string;
    checkpoints: string[];
    rollbackSteps: string[];
}
export interface ValidationRule {
    id: string;
    description: string;
    required: boolean;
}
export interface ExecutionPlan {
    projectGoal: string;
    planningType: PlanningType;
    taskList: PlanTask[];
    executionOrder: string[];
    priority: DecisionPriority;
    dependencies: PlanDependency[];
    requiredResources: ResourceEstimate;
    estimatedTime: TimeEstimate;
    expectedOutput: string;
    validationRules: ValidationRule[];
    recoveryStrategy: RecoveryStrategy;
}
export interface PlanRiskAnalysis {
    possibleRisks: string[];
    possibleFailures: string[];
    recoveryOptions: string[];
    alternativeStrategies: string[];
    expectedSuccessRate: number;
}
export interface PlanValidationResult {
    passed: boolean;
    checks: Array<{
        name: string;
        passed: boolean;
        message: string;
    }>;
    nextAction?: string;
}
export interface WorkflowPlanHandoff {
    planId: string;
    decisionId: string;
    workflowId: string;
    executionPlan: ExecutionPlan;
    objective: string;
    parameters: Record<string, unknown>;
}
export interface ApprovedDecisionInput {
    decisionId: string;
    requestId: string;
    planningType: PlanningType;
    priority: DecisionPriority;
    objective: string;
    userRequest: string;
    availableData: Record<string, unknown>;
    workflowHandoff: WorkflowHandoff;
    reasoningResult?: ReasoningResult;
}
export interface PlanningRecord {
    planId: string;
    projectType: PlanningType;
    executionPlan: ExecutionPlan;
    dependencies: PlanDependency[];
    estimatedTimeMs: number;
    actualResult: "pending" | "success" | "failure";
    performance: number;
    lessonsLearned: string[];
    futureImprovementSuggestions: string[];
    decisionId: string;
    timestamp: string;
}
export interface PlanningResult {
    planId: string;
    status: PlanningStatus;
    readyForWorkflow: boolean;
    stepsCompleted: PlanningStep[];
    executionPlan?: ExecutionPlan;
    riskAnalysis: PlanRiskAnalysis;
    validation: PlanValidationResult;
    workflowHandoff?: WorkflowPlanHandoff;
    missingInformation: Array<{
        field: string;
        severity: string;
        message: string;
    }>;
    recommendations: string[];
    record: PlanningRecord;
    durationMs: number;
}
export declare class PlanningEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export interface PlanningEngineStatusReport {
    planningEngineStatus: string;
    planningQuality: number;
    resourceEstimationAccuracy: string;
    validationStatus: string;
    performance: {
        averagePlanningMs: number;
        totalPlans: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
//# sourceMappingURL=types.d.ts.map