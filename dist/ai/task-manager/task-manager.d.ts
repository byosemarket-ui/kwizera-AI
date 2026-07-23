import type { AiCoreManager } from "../core/ai-core-manager.js";
import { TaskDependencyChecker } from "./task-dependency-checker.js";
import { TaskHistoryStore } from "./task-history-store.js";
import { TaskManagerLogger } from "./task-logger.js";
import { TaskModuleExecutor } from "./task-module-executor.js";
import { TaskPriorityScheduler } from "./task-priority-scheduler.js";
import { TaskProgressTracker } from "./task-progress-tracker.js";
import { TaskQueueManager } from "./task-queue-manager.js";
import { TaskResourceMonitor } from "./task-resource-monitor.js";
import { inferPriority, inferQueueCategory, inferTaskType } from "./task-type-mapper.js";
import { CreateTaskRequest, ManagedTask, QueueStatusReport, RunWorkflowTaskInput, TaskManagerStatusReport, TaskRunResult } from "./types.js";
export interface AiTaskManagerOptions {
    storageRoot: string;
}
/**
 * KWIZERA AI Task Manager — manages individual task lifecycle.
 * Step 2F: Coordinates module slots. Does not perform AI work.
 */
export declare class AiTaskManager {
    readonly logger: TaskManagerLogger;
    readonly history: TaskHistoryStore;
    readonly queueManager: TaskQueueManager;
    readonly priorityScheduler: TaskPriorityScheduler;
    readonly dependencyChecker: TaskDependencyChecker;
    readonly progressTracker: TaskProgressTracker;
    readonly resourceMonitor: TaskResourceMonitor;
    readonly moduleExecutor: TaskModuleExecutor;
    private readonly storageRoot;
    private readonly tasks;
    private readonly taskDurations;
    private readonly taskSuccesses;
    private initialized;
    private core;
    constructor(options: AiTaskManagerOptions);
    initialize(core: AiCoreManager): void;
    isInitialized(): boolean;
    createTask(request: CreateTaskRequest): ManagedTask;
    queueTask(taskId: string): void;
    pauseTask(taskId: string): void;
    resumeTask(taskId: string): Promise<TaskRunResult>;
    cancelTask(taskId: string): void;
    archiveTask(taskId: string): void;
    retryTask(taskId: string): Promise<TaskRunResult>;
    getTask(taskId: string): ManagedTask | undefined;
    getQueueStatus(): QueueStatusReport;
    /**
     * Primary entry from Workflow Engine — full task lifecycle.
     */
    runWorkflowTask(input: RunWorkflowTaskInput): Promise<TaskRunResult>;
    buildStatusReport(): TaskManagerStatusReport;
    private executeManagedTask;
    private buildFailedResult;
    private saveHistory;
    private getCompletedPlanTaskIds;
    private getTaskOrThrow;
    private ensureInitialized;
}
/** Helpers exported for workflow integration */
export { inferTaskType, inferPriority, inferQueueCategory };
//# sourceMappingURL=task-manager.d.ts.map