/**
 * KWIZERA AI STUDIO — AI Recovery Engine types (Step 2J)
 */
export declare enum FailureType {
    Application = "application",
    Module = "module",
    Workflow = "workflow",
    Task = "task",
    Database = "database",
    Storage = "storage",
    Communication = "communication",
    Startup = "startup",
    Shutdown = "shutdown",
    UnexpectedShutdown = "unexpected-shutdown",
    Configuration = "configuration",
    Session = "session"
}
export declare enum RecoveryType {
    Application = "application-recovery",
    Module = "module-recovery",
    Workflow = "workflow-recovery",
    Task = "task-recovery",
    Project = "project-recovery",
    Database = "database-recovery",
    Storage = "storage-recovery",
    Memory = "memory-recovery",
    Communication = "communication-recovery",
    Configuration = "configuration-recovery",
    Session = "session-recovery",
    Video = "video-recovery"
}
export declare enum RecoveryResultStatus {
    Success = "success",
    Partial = "partial",
    Failed = "failed",
    Skipped = "skipped"
}
export declare enum MonitoredComponent {
    Application = "application",
    AiCore = "ai-core",
    ModuleManager = "module-manager",
    WorkflowEngine = "workflow-engine",
    TaskManager = "task-manager",
    CommunicationBus = "communication-bus",
    StateManager = "state-manager",
    Database = "database",
    Storage = "storage",
    Logs = "logs",
    Configuration = "configuration"
}
export interface FailureReport {
    failureId: string;
    failureType: FailureType;
    affectedComponent: string;
    rootCause: string;
    timestamp: string;
    severity: "low" | "medium" | "high" | "critical";
    diagnostics: Record<string, unknown>;
}
export interface RecoveryPlanStep {
    step: number;
    action: string;
    status: "pending" | "running" | "completed" | "failed";
}
export interface RecoveryPlan {
    planId: string;
    recoveryType: RecoveryType;
    failureReport: FailureReport;
    steps: RecoveryPlanStep[];
    createdAt: string;
}
export interface RecoveryExecutionResult {
    recoveryId: string;
    planId: string;
    recoveryType: RecoveryType;
    status: RecoveryResultStatus;
    affectedModule: string;
    rootCause: string;
    recoveryMethod: string;
    recoveryTimeMs: number;
    recoveredData: string[];
    lessonsLearned: string[];
    message: string;
}
export interface RecoveryHistoryRecord {
    recoveryId: string;
    failureType: FailureType;
    affectedModule: string;
    rootCause: string;
    recoveryMethod: string;
    recoveryTimeMs: number;
    recoveredData: string[];
    result: RecoveryResultStatus;
    performanceMs: number;
    lessonsLearned: string[];
    timestamp: string;
}
export interface BackupValidationResult {
    valid: boolean;
    checks: Array<{
        name: string;
        passed: boolean;
        message: string;
    }>;
    rejectionReason?: string;
}
export interface VideoRecoveryContext {
    videoId: string;
    progressPercent: number;
    completedSegments: string[];
    resumeFromSegment?: string;
}
export interface ProjectRecoveryContext {
    projectId: string;
    assets: {
        images: string[];
        videos: string[];
        productInfo: boolean;
        brandAssets: boolean;
        generatedContent: boolean;
        workflowProgress: boolean;
        drafts: boolean;
        userSettings: boolean;
    };
}
export interface MemoryProtectionManifest {
    categories: string[];
    protectedPaths: string[];
    verified: boolean;
}
export interface RecoveryEngineStatusReport {
    recoveryEngineStatus: string;
    failureDetectionStatus: string;
    recoverySuccessRate: number;
    dataProtectionStatus: string;
    stateRestorationStatus: string;
    performance: {
        averageRecoveryMs: number;
        totalRecoveries: number;
        failuresDetected: number;
        selfHealingActions: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class RecoveryEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const RECOVERY_SEQUENCE: readonly ["detect-failure", "identify-component", "determine-root-cause", "protect-user-data", "save-diagnostics", "create-recovery-plan", "restore-latest-valid-state", "restart-affected-component", "validate-recovery", "resume-unfinished-work", "notify-ai-core", "log-complete-recovery"];
export declare const PROTECTED_MEMORY_CATEGORIES: readonly ["learning-history", "persistent-memory", "knowledge", "marketing-memory", "video-memory", "reasoning-history", "decision-history", "system-history"];
//# sourceMappingURL=types.d.ts.map