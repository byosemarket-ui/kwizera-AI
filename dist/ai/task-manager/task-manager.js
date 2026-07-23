import { randomUUID } from "node:crypto";
import path from "node:path";
import { resolveLogDirectory } from "../../storage/paths/storage-paths.js";
import { TaskExecutionStatus } from "../workflow/types.js";
import { TaskDependencyChecker } from "./task-dependency-checker.js";
import { TaskHistoryStore } from "./task-history-store.js";
import { TaskManagerLogger } from "./task-logger.js";
import { TaskModuleExecutor } from "./task-module-executor.js";
import { TaskPriorityScheduler } from "./task-priority-scheduler.js";
import { TaskProgressTracker } from "./task-progress-tracker.js";
import { TaskQueueManager } from "./task-queue-manager.js";
import { TaskResourceMonitor } from "./task-resource-monitor.js";
import { inferPriority, inferQueueCategory, inferTaskType, } from "./task-type-mapper.js";
import { ManagedTaskState, TaskManagerError, TaskQueueCategory, } from "./types.js";
/**
 * KWIZERA AI Task Manager — manages individual task lifecycle.
 * Step 2F: Coordinates module slots. Does not perform AI work.
 */
export class AiTaskManager {
    logger = new TaskManagerLogger();
    history = new TaskHistoryStore();
    queueManager = new TaskQueueManager();
    priorityScheduler = new TaskPriorityScheduler();
    dependencyChecker = new TaskDependencyChecker();
    progressTracker = new TaskProgressTracker();
    resourceMonitor = new TaskResourceMonitor();
    moduleExecutor = new TaskModuleExecutor();
    storageRoot;
    tasks = new Map();
    taskDurations = [];
    taskSuccesses = [];
    initialized = false;
    core = null;
    constructor(options) {
        this.storageRoot = options.storageRoot;
    }
    initialize(core) {
        this.core = core;
        const logDir = resolveLogDirectory(this.storageRoot);
        const tasksDir = path.join(this.storageRoot, "tasks");
        this.logger.initialize(logDir);
        this.history.initialize(tasksDir);
        this.initialized = true;
        this.logger.log("info", "task-create", "Task Manager initialized", {
            logDirectory: logDir,
            tasksDirectory: tasksDir,
        });
    }
    isInitialized() {
        return this.initialized;
    }
    createTask(request) {
        this.ensureInitialized();
        const task = {
            id: randomUUID(),
            name: request.name,
            taskType: request.taskType,
            priority: request.priority,
            queueCategory: request.queueCategory,
            moduleId: request.moduleId,
            workflowRunId: request.workflowRunId,
            workflowId: request.workflowId,
            planTaskId: request.planTaskId,
            dependsOn: request.dependsOn ?? [],
            state: ManagedTaskState.Created,
            progress: this.progressTracker.createInitial(),
            createdAt: new Date().toISOString(),
            parameters: request.parameters ?? {},
        };
        this.tasks.set(task.id, task);
        this.logger.log("info", "task-create", "Task created", {
            taskId: task.id,
            type: task.taskType,
            priority: task.priority,
        });
        return task;
    }
    queueTask(taskId) {
        const task = this.getTaskOrThrow(taskId);
        this.progressTracker.transition(task, ManagedTaskState.Queued, "queued", 5);
        this.queueManager.enqueue(task);
        this.logger.log("info", "task-create", "Task queued", {
            taskId,
            category: task.queueCategory,
        });
    }
    pauseTask(taskId) {
        const task = this.getTaskOrThrow(taskId);
        this.progressTracker.transition(task, ManagedTaskState.Paused, "paused", task.progress.progressPercent);
        this.queueManager.markInactive(task.queueCategory);
        this.priorityScheduler.releaseCritical(taskId);
        this.logger.log("warn", "warning", "Task paused", { taskId });
    }
    async resumeTask(taskId) {
        const task = this.getTaskOrThrow(taskId);
        this.progressTracker.transition(task, ManagedTaskState.Resuming, "resuming", task.progress.progressPercent);
        return this.executeManagedTask(task, false);
    }
    cancelTask(taskId) {
        const task = this.getTaskOrThrow(taskId);
        task.state = ManagedTaskState.Cancelled;
        task.progress.status = ManagedTaskState.Cancelled;
        this.queueManager.remove(taskId);
        this.queueManager.markInactive(task.queueCategory);
        this.priorityScheduler.releaseCritical(taskId);
        this.logger.log("info", "task-cancel", "Task cancelled", { taskId });
    }
    archiveTask(taskId) {
        const task = this.getTaskOrThrow(taskId);
        if (task.state !== ManagedTaskState.Completed &&
            task.state !== ManagedTaskState.Recovered &&
            task.state !== ManagedTaskState.Cancelled &&
            task.state !== ManagedTaskState.Failed) {
            throw new TaskManagerError("Only finished tasks can be archived", "INVALID_STATE");
        }
        task.state = ManagedTaskState.Archived;
        task.progress.status = ManagedTaskState.Archived;
        this.logger.log("info", "task-complete", "Task archived", { taskId });
    }
    async retryTask(taskId) {
        const task = this.getTaskOrThrow(taskId);
        task.progress.recoveryAttempts += 1;
        this.progressTracker.transition(task, ManagedTaskState.Retrying, "retrying", task.progress.progressPercent);
        this.logger.log("info", "task-retry", "Task retry initiated", { taskId });
        return this.executeManagedTask(task, false);
    }
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    getQueueStatus() {
        return {
            interactive: this.queueManager.getQueueLength(TaskQueueCategory.Interactive),
            background: this.queueManager.getQueueLength(TaskQueueCategory.Background),
            learning: this.queueManager.getQueueLength(TaskQueueCategory.Learning),
            maintenance: this.queueManager.getQueueLength(TaskQueueCategory.Maintenance),
            recovery: this.queueManager.getQueueLength(TaskQueueCategory.Recovery),
            totalQueued: this.queueManager.getTotalQueued(),
            activeCritical: this.priorityScheduler.hasActiveCritical(),
        };
    }
    /**
     * Primary entry from Workflow Engine — full task lifecycle.
     */
    async runWorkflowTask(input) {
        this.ensureInitialized();
        const task = this.createTask({
            name: input.planTask.name,
            taskType: input.taskType,
            priority: input.priority,
            queueCategory: input.queueCategory,
            moduleId: input.planTask.moduleId,
            workflowRunId: input.workflowRunId,
            workflowId: input.workflowId,
            planTaskId: input.planTask.id,
            dependsOn: input.planTask.dependsOn,
            estimatedMs: input.planTask.estimatedMs,
            parameters: {
                estimatedMs: input.planTask.estimatedMs,
                planTaskPriority: input.planTask.priority,
                completedTaskIds: input.completedTaskIds,
            },
        });
        this.queueTask(task.id);
        let result = await this.executeManagedTask(task, input.simulateFailure ?? false);
        if (!result.success) {
            this.logger.log("warn", "task-failure", "Attempting automatic recovery", {
                taskId: task.id,
            });
            task.progress.recoveryAttempts += 1;
            this.logger.log("info", "task-recovery", "Recovery attempt started", { taskId: task.id });
            const recovered = await this.executeManagedTask(task, false);
            if (recovered.success) {
                recovered.record.status = TaskExecutionStatus.Recovered;
                recovered.task.state = ManagedTaskState.Recovered;
                recovered.task.progress.status = ManagedTaskState.Recovered;
                this.logger.log("info", "task-recovery", "Task recovered successfully", { taskId: task.id });
                return recovered;
            }
        }
        return result;
    }
    buildStatusReport() {
        const total = this.taskDurations.length;
        const averageTaskMs = total > 0 ? Math.round(this.taskDurations.reduce((a, b) => a + b, 0) / total) : 0;
        const successes = this.taskSuccesses.filter(Boolean).length;
        const throughput = total > 0 ? Math.round((successes / total) * 100) : 100;
        const queue = this.getQueueStatus();
        const knownIssues = [];
        if (!this.initialized)
            knownIssues.push("Task Manager not initialized");
        const checks = [this.initialized, this.history.getHistoryPath() !== null];
        const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);
        return {
            taskManagerStatus: this.initialized ? "operational" : "not-initialized",
            queueStatus: queue.totalQueued === 0 ? "idle" : "active",
            schedulingQuality: throughput >= 80 ? "high" : throughput >= 50 ? "medium" : "low",
            recoveryStatus: this.history.getAll().some((r) => r.recoveryActions.length > 0)
                ? "verified"
                : "ready",
            performance: { averageTaskMs, totalTasks: this.history.getCount(), throughput },
            knownIssues,
            readinessScore,
            timestamp: new Date().toISOString(),
        };
    }
    async executeManagedTask(task, simulateFailure) {
        const start = performance.now();
        this.progressTracker.transition(task, ManagedTaskState.Waiting, "waiting", 10);
        const deps = this.dependencyChecker.verify(task.moduleId, task.dependsOn, task.parameters.completedTaskIds ??
            this.getCompletedPlanTaskIds(task.workflowRunId), this.core);
        if (!deps.satisfied) {
            this.progressTracker.transition(task, ManagedTaskState.Paused, "paused-dependencies", 15);
            task.progress.warnings.push(deps.pauseReason ?? "Dependencies not satisfied");
            this.logger.log("warn", "warning", deps.pauseReason ?? "Dependencies missing", {
                taskId: task.id,
            });
            const retryDeps = this.dependencyChecker.verify(task.moduleId, task.dependsOn, task.parameters.completedTaskIds ??
                this.getCompletedPlanTaskIds(task.workflowRunId), this.core);
            if (!retryDeps.satisfied) {
                task.state = ManagedTaskState.Failed;
                task.progress.errors.push(retryDeps.pauseReason ?? "Dependencies failed");
                return this.buildFailedResult(task, start, retryDeps.pauseReason ?? "DEPENDENCY_FAILED");
            }
        }
        const resources = this.resourceMonitor.snapshot(this.core);
        if (!this.resourceMonitor.canAcceptTask(resources)) {
            task.progress.warnings.push("Resource pressure detected — throttling");
        }
        if (!this.queueManager.canRunInParallel(task)) {
            task.progress.warnings.push("Queue conflict — waiting for compatible slot");
        }
        this.progressTracker.transition(task, ManagedTaskState.Preparing, "preparing", 25);
        this.priorityScheduler.acquireCritical(task.id, task.priority);
        this.queueManager.markActive(task.queueCategory);
        this.progressTracker.transition(task, ManagedTaskState.Running, "running", 40);
        task.startedAt = new Date().toISOString();
        this.logger.log("info", "task-start", "Task started", {
            taskId: task.id,
            moduleId: task.moduleId,
        });
        const planTask = {
            id: task.planTaskId ?? task.id,
            name: task.name,
            moduleId: task.moduleId,
            dependsOn: task.dependsOn,
            estimatedMs: task.parameters.estimatedMs ?? 1000,
            priority: task.parameters.planTaskPriority ??
                "normal",
            description: task.name,
        };
        const execResult = this.moduleExecutor.execute(planTask, this.core.registry, simulateFailure);
        const durationMs = Math.round(performance.now() - start);
        this.progressTracker.updateElapsed(task, durationMs, planTask.estimatedMs);
        this.queueManager.markInactive(task.queueCategory);
        this.priorityScheduler.releaseCritical(task.id);
        if (!execResult.success) {
            task.state = ManagedTaskState.Failed;
            task.progress.errors.push(execResult.diagnostics ?? "Task failed");
            task.completedAt = new Date().toISOString();
            this.logger.log("error", "task-failure", "Task failed", {
                taskId: task.id,
                error: execResult.record.error,
            });
            this.saveHistory(task, execResult.diagnostics ? [execResult.diagnostics] : [], []);
            this.taskDurations.push(durationMs);
            this.taskSuccesses.push(false);
            return { success: false, managedTaskId: task.id, record: execResult.record, task };
        }
        this.progressTracker.complete(task);
        task.state = ManagedTaskState.Completed;
        task.progress.status = ManagedTaskState.Completed;
        task.completedAt = new Date().toISOString();
        this.logger.log("info", "task-complete", "Task completed", {
            taskId: task.id,
            durationMs,
        });
        this.saveHistory(task, [], []);
        this.taskDurations.push(durationMs);
        this.taskSuccesses.push(true);
        return { success: true, managedTaskId: task.id, record: execResult.record, task };
    }
    buildFailedResult(task, start, error) {
        const durationMs = Math.round(performance.now() - start);
        this.queueManager.markInactive(task.queueCategory);
        this.priorityScheduler.releaseCritical(task.id);
        this.taskDurations.push(durationMs);
        this.taskSuccesses.push(false);
        return {
            success: false,
            managedTaskId: task.id,
            record: {
                taskId: task.planTaskId ?? task.id,
                taskName: task.name,
                moduleId: task.moduleId,
                status: TaskExecutionStatus.Failed,
                startedAt: task.startedAt ?? new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs,
                coordinated: false,
                message: error,
                error,
            },
            task,
        };
    }
    saveHistory(task, errors, recoveryActions) {
        const record = {
            taskId: task.id,
            workflowId: task.workflowId,
            taskType: task.taskType,
            priority: task.priority,
            startTime: task.startedAt,
            endTime: task.completedAt,
            executionDurationMs: task.progress.elapsedMs,
            status: task.state,
            errors,
            recoveryActions,
            performanceMetrics: {
                progressPercent: task.progress.progressPercent,
                recoveryAttempts: task.progress.recoveryAttempts,
            },
            futureLearningValue: task.state === ManagedTaskState.Completed || task.state === ManagedTaskState.Recovered
                ? 85
                : 25,
            timestamp: new Date().toISOString(),
        };
        this.history.append(record);
    }
    getCompletedPlanTaskIds(workflowRunId) {
        if (!workflowRunId)
            return [];
        return [...this.tasks.values()]
            .filter((t) => t.workflowRunId === workflowRunId &&
            (t.state === ManagedTaskState.Completed ||
                t.state === ManagedTaskState.Recovered))
            .map((t) => t.planTaskId ?? t.id);
    }
    getTaskOrThrow(taskId) {
        const task = this.tasks.get(taskId);
        if (!task)
            throw new TaskManagerError(`Task not found: ${taskId}`, "NOT_FOUND");
        return task;
    }
    ensureInitialized() {
        if (!this.initialized || !this.core) {
            throw new TaskManagerError("Task Manager not initialized", "NOT_INITIALIZED");
        }
    }
}
/** Helpers exported for workflow integration */
export { inferTaskType, inferPriority, inferQueueCategory };
//# sourceMappingURL=task-manager.js.map