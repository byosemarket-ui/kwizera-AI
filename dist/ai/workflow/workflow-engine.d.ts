import type { AiCoreManager } from "../core/ai-core-manager.js";
import { OutputValidator } from "./output-validator.js";
import { ProgressTracker, RecoveryManager } from "./progress-tracker.js";
import { TaskCoordinator } from "./task-coordinator.js";
import { TaskScheduler } from "./task-scheduler.js";
import { WorkflowDependencyManager } from "./workflow-dependency-manager.js";
import { WorkflowHistoryStore } from "./workflow-history-store.js";
import { WorkflowLogger } from "./workflow-logger.js";
import { WorkflowPlanValidator } from "./workflow-plan-validator.js";
import type { AiTaskManager } from "../task-manager/task-manager.js";
import { WorkflowEngineStatusReport, WorkflowExecutionInput, WorkflowResult } from "./types.js";
export interface AiWorkflowEngineOptions {
    storageRoot: string;
}
/**
 * KWIZERA AI Workflow Engine — coordinates module execution from plans.
 * Step 2E: Does not perform AI work. Does not execute business modules.
 */
export declare class AiWorkflowEngine {
    readonly logger: WorkflowLogger;
    readonly history: WorkflowHistoryStore;
    readonly planValidator: WorkflowPlanValidator;
    readonly dependencyManager: WorkflowDependencyManager;
    readonly taskScheduler: TaskScheduler;
    readonly taskCoordinator: TaskCoordinator;
    readonly progressTracker: ProgressTracker;
    readonly recoveryManager: RecoveryManager;
    readonly outputValidator: OutputValidator;
    private readonly storageRoot;
    private readonly workflowDurations;
    private readonly workflowSuccesses;
    private initialized;
    private core;
    private taskManager;
    constructor(options: AiWorkflowEngineOptions);
    initialize(core: AiCoreManager): void;
    isInitialized(): boolean;
    setTaskManager(manager: AiTaskManager): void;
    /**
     * Execute the 13-step workflow process from a planning handoff.
     */
    execute(input: WorkflowExecutionInput): Promise<WorkflowResult>;
    buildStatusReport(): WorkflowEngineStatusReport;
    private buildFailureResult;
    private createHistoryRecord;
}
//# sourceMappingURL=workflow-engine.d.ts.map