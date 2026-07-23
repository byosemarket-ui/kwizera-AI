import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { resolveLogDirectory } from "../../storage/paths/storage-paths.js";
import { OutputValidator } from "./output-validator.js";
import { mapPlanningTypeToWorkflowType } from "./planning-type-mapper.js";
import { ProgressTracker, RecoveryManager, resolveWorkflowState } from "./progress-tracker.js";
import { TaskCoordinator } from "./task-coordinator.js";
import { TaskScheduler } from "./task-scheduler.js";
import { WorkflowDependencyManager } from "./workflow-dependency-manager.js";
import { WorkflowHistoryStore } from "./workflow-history-store.js";
import { WorkflowLogger } from "./workflow-logger.js";
import { WorkflowPlanValidator } from "./workflow-plan-validator.js";
import type { AiTaskManager } from "../task-manager/task-manager.js";
import {
  inferPriority,
  inferQueueCategory,
  inferTaskType,
} from "../task-manager/task-manager.js";
import {
  WorkflowEngineError,
  RecoveryEvent,
  TaskExecutionRecord,
  WorkflowEngineStatusReport,
  WorkflowExecutionInput,
  WorkflowHistoryRecord,
  WorkflowResult,
  WorkflowState,
  WorkflowStep,
  WorkflowType,
} from "./types.js";

export interface AiWorkflowEngineOptions {
  storageRoot: string;
}

/**
 * KWIZERA AI Workflow Engine — coordinates module execution from plans.
 * Step 2E: Does not perform AI work. Does not execute business modules.
 */
export class AiWorkflowEngine {
  readonly logger = new WorkflowLogger();
  readonly history = new WorkflowHistoryStore();
  readonly planValidator = new WorkflowPlanValidator();
  readonly dependencyManager = new WorkflowDependencyManager();
  readonly taskScheduler = new TaskScheduler();
  readonly taskCoordinator = new TaskCoordinator();
  readonly progressTracker = new ProgressTracker();
  readonly recoveryManager = new RecoveryManager();
  readonly outputValidator = new OutputValidator();

  private readonly storageRoot: string;
  private readonly workflowDurations: number[] = [];
  private readonly workflowSuccesses: boolean[] = [];
  private initialized = false;
  private core: AiCoreManager | null = null;
  private taskManager: AiTaskManager | null = null;

  constructor(options: AiWorkflowEngineOptions) {
    this.storageRoot = options.storageRoot;
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    const logDir = resolveLogDirectory(this.storageRoot);
    const workflowsDir = path.join(this.storageRoot, "workflows");

    this.logger.initialize(logDir);
    this.history.initialize(workflowsDir);
    this.initialized = true;

    this.logger.log("info", "workflow-start", "Workflow Engine initialized", {
      logDirectory: logDir,
      workflowsDirectory: workflowsDir,
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setTaskManager(manager: AiTaskManager): void {
    this.taskManager = manager;
  }

  /**
   * Execute the 13-step workflow process from a planning handoff.
   */
  async execute(input: WorkflowExecutionInput): Promise<WorkflowResult> {
    if (!this.initialized || !this.core) {
      throw new WorkflowEngineError("Workflow Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const workflowRunId = randomUUID();
    const stepsCompleted: WorkflowStep[] = [];
    const taskHistory: TaskExecutionRecord[] = [];
    const recoveryEvents: RecoveryEvent[] = [];
    let state: WorkflowState = WorkflowState.Created;
    const plan = input.executionPlan;
    const workflowType = mapPlanningTypeToWorkflowType(plan.planningType);

    this.logger.log("info", "workflow-start", "Workflow execution started", {
      workflowRunId,
      planId: input.planId,
      workflowType,
    });

    try {
      // Step 1 — Receive Execution Plan
      stepsCompleted.push(WorkflowStep.ReceiveExecutionPlan);
      state = WorkflowState.Waiting;

      // Step 2 — Validate the Plan
      stepsCompleted.push(WorkflowStep.ValidatePlan);
      const planValidation = this.planValidator.validate(plan, this.core);
      if (!planValidation.passed) {
        return this.buildFailureResult({
          workflowRunId,
          workflowType,
          input,
          stepsCompleted,
          start,
          state: WorkflowState.Failed,
          taskHistory,
          recoveryEvents,
          planValidation,
          reason: planValidation.nextAction ?? "Plan validation failed",
        });
      }

      // Step 3 — Create Workflow Session
      stepsCompleted.push(WorkflowStep.CreateWorkflowSession);
      const sessionId = this.core.coordinator.beginSession({
        purpose: `workflow:${workflowType}`,
        planId: input.planId,
      });
      state = WorkflowState.Preparing;

      // Step 4 — Prepare Required Modules
      stepsCompleted.push(WorkflowStep.PrepareRequiredModules);
      for (const moduleId of plan.requiredResources.modules) {
        const entry = this.core.registry.getEntry(moduleId);
        if (!entry) {
          this.core.coordinator.endSession(sessionId);
          return this.buildFailureResult({
            workflowRunId,
            workflowType,
            input,
            stepsCompleted,
            start,
            state: WorkflowState.Failed,
            taskHistory,
            recoveryEvents,
            planValidation,
            reason: `Required module not available: ${moduleId}`,
          });
        }
      }

      // Step 5 — Verify Dependencies
      stepsCompleted.push(WorkflowStep.VerifyDependencies);
      const depCheck = this.dependencyManager.verify(plan, this.core);
      if (!depCheck.passed) {
        this.logger.log("warn", "warning", "Dependency diagnostics generated", {
          workflowRunId,
          missing: depCheck.missingDependency,
          checks: depCheck.checks,
        });
        if (!depCheck.checks.find((c) => c.name === "system-health")?.passed) {
          this.core.coordinator.endSession(sessionId);
          return this.buildFailureResult({
            workflowRunId,
            workflowType,
            input,
            stepsCompleted,
            start,
            state: WorkflowState.Paused,
            taskHistory,
            recoveryEvents,
            planValidation,
            reason: depCheck.missingDependency ?? "Dependencies not satisfied",
          });
        }
      }

      const scheduled = this.taskScheduler.schedule(plan.executionOrder, plan.taskList);
      const tracking = this.progressTracker.createTracking(
        scheduled,
        plan.estimatedTime.totalMs
      );
      state = WorkflowState.Running;

      let hadRecovery = false;
      let taskIndex = 0;

      while (taskIndex < scheduled.length) {
        const task = scheduled[taskIndex];
        const isFirst = taskIndex === 0;

        if (isFirst) {
          stepsCompleted.push(WorkflowStep.ExecuteFirstTask);
        } else if (!stepsCompleted.includes(WorkflowStep.ContinueToNextTask)) {
          stepsCompleted.push(WorkflowStep.ContinueToNextTask);
        }

        tracking.currentTaskId = task.id;
        const simulateFail = input.simulateTaskFailure === task.id;

        let result: { success: boolean; record: TaskExecutionRecord };

        if (this.taskManager) {
          const managed = await this.taskManager.runWorkflowTask({
            planTask: task,
            workflowRunId,
            workflowId: input.workflowId,
            taskType: inferTaskType(task),
            priority: inferPriority(task),
            queueCategory: inferQueueCategory(inferTaskType(task)),
            completedTaskIds: tracking.completedTasks,
            simulateFailure: simulateFail,
          });
          result = { success: managed.success, record: managed.record };
          if (managed.success && managed.record.status === "recovered") {
            hadRecovery = true;
            tracking.recoveryAttempts += managed.task.progress.recoveryAttempts;
            recoveryEvents.push({
              timestamp: new Date().toISOString(),
              taskId: task.id,
              action: "task-manager-recovery",
              success: true,
              message: "Task recovered by Task Manager",
            });
          }
        } else {
          result = this.taskCoordinator.coordinate(
            task,
            this.core.registry,
            simulateFail
          );

          if (!result.success) {
            state = WorkflowState.Paused;
            this.progressTracker.addError(tracking, result.record.error ?? "Task failed");
            this.logger.log("error", "task-failure", `Task failed: ${task.id}`, {
              workflowRunId,
              error: result.record.error,
            });

            state = WorkflowState.Resuming;
            const recovery = await this.recoveryManager.attemptRecovery(
              task,
              this.taskCoordinator,
              this.core.registry,
              tracking
            );
            recoveryEvents.push(recovery.event);
            this.logger.log(
              recovery.recovered ? "info" : "warn",
              "recovery",
              recovery.event.message,
              { workflowRunId, taskId: task.id }
            );

            if (recovery.recovered && recovery.record) {
              hadRecovery = true;
              result = { success: true, record: recovery.record };
            } else {
              this.core.coordinator.endSession(sessionId);
              return this.buildFailureResult({
                workflowRunId,
                workflowType,
                input,
                stepsCompleted,
                start,
                state: WorkflowState.Failed,
                taskHistory: [...taskHistory, result.record],
                recoveryEvents,
                planValidation,
                tracking,
                reason: `Task ${task.id} failed after recovery attempt`,
              });
            }
          }
        }

        if (this.taskManager && !result.success) {
          this.progressTracker.addError(tracking, result.record.error ?? "Task failed");
          this.core.coordinator.endSession(sessionId);
          return this.buildFailureResult({
            workflowRunId,
            workflowType,
            input,
            stepsCompleted,
            start,
            state: WorkflowState.Failed,
            taskHistory: [...taskHistory, result.record],
            recoveryEvents,
            planValidation,
            tracking,
            reason: `Task ${task.id} failed after Task Manager recovery`,
          });
        }

        stepsCompleted.push(WorkflowStep.VerifyTaskResult);
        taskHistory.push(result.record);
        this.progressTracker.updateAfterTask(
          tracking,
          task.id,
          result.record.durationMs,
          plan.estimatedTime.perTaskMs[task.id] ?? task.estimatedMs
        );

        this.logger.log("info", "task", `Task coordinated: ${task.id}`, {
          workflowRunId,
          moduleId: task.moduleId,
        });

        taskIndex += 1;
      }

      if (!stepsCompleted.includes(WorkflowStep.RepeatUntilComplete)) {
        stepsCompleted.push(WorkflowStep.RepeatUntilComplete);
      }

      // Step 10 — Validate Final Output
      stepsCompleted.push(WorkflowStep.ValidateFinalOutput);
      const finalValidation = this.outputValidator.validate(plan, taskHistory, planValidation);
      if (!finalValidation.passed) {
        this.core.coordinator.endSession(sessionId);
        return this.buildFailureResult({
          workflowRunId,
          workflowType,
          input,
          stepsCompleted,
          start,
          state: WorkflowState.Failed,
          taskHistory,
          recoveryEvents,
          planValidation: finalValidation,
          tracking,
          reason: finalValidation.nextAction ?? "Final output validation failed",
        });
      }

      state = resolveWorkflowState(true, hadRecovery, false);

      // Step 11 — Save Workflow History
      stepsCompleted.push(WorkflowStep.SaveWorkflowHistory);
      const record = this.createHistoryRecord({
        workflowRunId,
        workflowType,
        input,
        taskHistory,
        recoveryEvents,
        state,
        tracking,
      });
      this.history.append(record);

      // Step 12 — Notify AI Core
      stepsCompleted.push(WorkflowStep.NotifyAiCore);
      const coreNotification = `Workflow ${workflowRunId} completed with status ${state}`;
      this.core.logger.info("lifecycle", coreNotification, {
        workflowRunId,
        planId: input.planId,
        workflowType,
      });

      // Step 13 — Notify User (no UI — message stored in result)
      stepsCompleted.push(WorkflowStep.NotifyUser);
      const userNotification = `KWIZERA AI workflow complete: ${plan.projectGoal} (${state})`;

      this.core.coordinator.endSession(sessionId);

      const durationMs = Math.round(performance.now() - start);
      this.workflowDurations.push(durationMs);
      this.workflowSuccesses.push(true);

      this.logger.log("info", "workflow-end", "Workflow execution completed", {
        workflowRunId,
        state,
        durationMs,
      });

      this.logger.log("info", "performance", "Workflow performance recorded", {
        workflowRunId,
        tasks: taskHistory.length,
        executionTimeMs: tracking.executionTimeMs,
      });

      return {
        workflowRunId,
        workflowType,
        state,
        success: true,
        stepsCompleted,
        tracking,
        taskHistory,
        recoveryEvents,
        validation: finalValidation,
        record,
        coreNotification,
        userNotification,
        durationMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log("error", "error", "Workflow execution failed", {
        workflowRunId,
        error: message,
      });
      throw new WorkflowEngineError(message, "WORKFLOW_FAILED");
    }
  }

  buildStatusReport(): WorkflowEngineStatusReport {
    const total = this.workflowDurations.length;
    const averageWorkflowMs =
      total > 0
        ? Math.round(this.workflowDurations.reduce((a, b) => a + b, 0) / total)
        : 0;

    const successes = this.workflowSuccesses.filter(Boolean).length;
    const successRate =
      total > 0 ? Math.round((successes / total) * 100) : 100;

    const recovered = this.history
      .getAll()
      .filter((r) => r.finalStatus === WorkflowState.Recovered).length;

    const knownIssues: string[] = [];
    if (!this.initialized) {
      knownIssues.push("Workflow Engine not initialized");
    }

    const checks = [this.initialized, this.history.getHistoryPath() !== null];
    const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      workflowEngineStatus: this.initialized ? "operational" : "not-initialized",
      executionStatus: this.initialized ? "ready" : "not-ready",
      schedulingQuality: successRate >= 80 ? "high" : successRate >= 50 ? "medium" : "low",
      recoveryStatus: recovered > 0 ? "verified" : "ready",
      performance: { averageWorkflowMs, totalWorkflows: this.history.getCount(), successRate },
      knownIssues,
      readinessScore,
      timestamp: new Date().toISOString(),
    };
  }

  private buildFailureResult(params: {
    workflowRunId: string;
    workflowType: WorkflowType;
    input: WorkflowExecutionInput;
    stepsCompleted: WorkflowStep[];
    start: number;
    state: WorkflowState;
    taskHistory: TaskExecutionRecord[];
    recoveryEvents: RecoveryEvent[];
    planValidation: WorkflowResult["validation"];
    tracking?: WorkflowResult["tracking"];
    reason: string;
  }): WorkflowResult {
    const tracking =
      params.tracking ??
      this.progressTracker.createTracking(
        params.input.executionPlan.taskList,
        params.input.executionPlan.estimatedTime.totalMs
      );

    tracking.errors.push(params.reason);

    const record = this.createHistoryRecord({
      workflowRunId: params.workflowRunId,
      workflowType: params.workflowType,
      input: params.input,
      taskHistory: params.taskHistory,
      recoveryEvents: params.recoveryEvents,
      state: params.state,
      tracking,
    });

    this.history.append(record);

    const durationMs = Math.round(performance.now() - params.start);
    this.workflowDurations.push(durationMs);
    this.workflowSuccesses.push(false);

    this.logger.log("warn", "workflow-end", params.reason, {
      workflowRunId: params.workflowRunId,
      state: params.state,
    });

    return {
      workflowRunId: params.workflowRunId,
      workflowType: params.workflowType,
      state: params.state,
      success: false,
      stepsCompleted: params.stepsCompleted,
      tracking,
      taskHistory: params.taskHistory,
      recoveryEvents: params.recoveryEvents,
      validation: params.planValidation,
      record,
      coreNotification: `Workflow failed: ${params.reason}`,
      userNotification: `KWIZERA AI workflow could not complete: ${params.reason}`,
      durationMs,
    };
  }

  private createHistoryRecord(input: {
    workflowRunId: string;
    workflowType: WorkflowType;
    input: WorkflowExecutionInput;
    taskHistory: TaskExecutionRecord[];
    recoveryEvents: RecoveryEvent[];
    state: WorkflowState;
    tracking: WorkflowResult["tracking"];
  }): WorkflowHistoryRecord {
    return {
      workflowRunId: input.workflowRunId,
      workflowType: input.workflowType,
      executionPlan: input.input.executionPlan,
      taskHistory: input.taskHistory,
      executionTimeMs: input.tracking.executionTimeMs,
      errors: input.tracking.errors,
      recoveryEvents: input.recoveryEvents,
      finalStatus: input.state,
      performance: input.taskHistory.length > 0 ? 85 : 0,
      learningValue: input.state === WorkflowState.Completed || input.state === WorkflowState.Recovered ? 90 : 30,
      planId: input.input.planId,
      decisionId: input.input.decisionId,
      timestamp: new Date().toISOString(),
    };
  }
}
