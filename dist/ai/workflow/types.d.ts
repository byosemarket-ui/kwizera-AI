/**
 * KWIZERA AI STUDIO — AI Workflow Engine types (Step 2E)
 */
import type { ExecutionPlan, WorkflowPlanHandoff } from "../planning/types.js";
import type { PlanTask } from "../planning/types.js";
export declare enum WorkflowType {
    ProductAnalysis = "product-analysis",
    ImageAnalysis = "image-analysis",
    ImageEnhancement = "image-enhancement",
    VideoEnhancement = "video-enhancement",
    PromotionalVideoGeneration = "promotional-video-generation",
    MarketingCampaignGeneration = "marketing-campaign-generation",
    PosterGeneration = "poster-generation",
    Translation = "translation",
    MemoryUpdate = "memory-update",
    KnowledgeUpdate = "knowledge-update",
    LearningUpdate = "learning-update",
    Export = "export",
    Backup = "backup",
    Recovery = "recovery"
}
export declare enum WorkflowState {
    Created = "created",
    Waiting = "waiting",
    Preparing = "preparing",
    Running = "running",
    Paused = "paused",
    Resuming = "resuming",
    Completed = "completed",
    Failed = "failed",
    Cancelled = "cancelled",
    Recovered = "recovered"
}
export declare enum WorkflowStep {
    ReceiveExecutionPlan = 1,
    ValidatePlan = 2,
    CreateWorkflowSession = 3,
    PrepareRequiredModules = 4,
    VerifyDependencies = 5,
    ExecuteFirstTask = 6,
    VerifyTaskResult = 7,
    ContinueToNextTask = 8,
    RepeatUntilComplete = 9,
    ValidateFinalOutput = 10,
    SaveWorkflowHistory = 11,
    NotifyAiCore = 12,
    NotifyUser = 13
}
export declare enum TaskExecutionStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    Skipped = "skipped",
    Recovered = "recovered"
}
export interface WorkflowTracking {
    currentTaskId: string | null;
    completedTasks: string[];
    remainingTasks: string[];
    executionTimeMs: number;
    estimatedRemainingMs: number;
    errors: string[];
    warnings: string[];
    recoveryAttempts: number;
}
export interface TaskExecutionRecord {
    taskId: string;
    taskName: string;
    moduleId: string;
    status: TaskExecutionStatus;
    startedAt: string;
    completedAt?: string;
    durationMs: number;
    coordinated: boolean;
    message: string;
    error?: string;
}
export interface RecoveryEvent {
    timestamp: string;
    taskId: string;
    action: string;
    success: boolean;
    message: string;
}
export interface DependencyDiagnostics {
    passed: boolean;
    checks: Array<{
        name: string;
        passed: boolean;
        message: string;
    }>;
    missingDependency?: string;
}
export interface WorkflowValidationResult {
    passed: boolean;
    checks: Array<{
        name: string;
        passed: boolean;
        message: string;
    }>;
    nextAction?: string;
}
export interface WorkflowHistoryRecord {
    workflowRunId: string;
    workflowType: WorkflowType;
    executionPlan: ExecutionPlan;
    taskHistory: TaskExecutionRecord[];
    executionTimeMs: number;
    errors: string[];
    recoveryEvents: RecoveryEvent[];
    finalStatus: WorkflowState;
    performance: number;
    learningValue: number;
    planId: string;
    decisionId: string;
    timestamp: string;
}
export interface WorkflowExecutionInput extends WorkflowPlanHandoff {
    correlationId?: string;
    simulateTaskFailure?: string;
}
export interface WorkflowResult {
    workflowRunId: string;
    workflowType: WorkflowType;
    state: WorkflowState;
    success: boolean;
    stepsCompleted: WorkflowStep[];
    tracking: WorkflowTracking;
    taskHistory: TaskExecutionRecord[];
    recoveryEvents: RecoveryEvent[];
    validation: WorkflowValidationResult;
    record: WorkflowHistoryRecord;
    coreNotification: string;
    userNotification: string;
    durationMs: number;
}
export declare class WorkflowEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export interface WorkflowEngineStatusReport {
    workflowEngineStatus: string;
    executionStatus: string;
    schedulingQuality: string;
    recoveryStatus: string;
    performance: {
        averageWorkflowMs: number;
        totalWorkflows: number;
        successRate: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export type { PlanTask };
//# sourceMappingURL=types.d.ts.map