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
import { ProfessionalWorkflowMemoryStore } from "./professional-workflow-memory.js";
import {
  buildProfessionalWorkflowFromPlan,
  executeProfessionalWorkflowCoordination,
  modifyProfessionalWorkflowResult,
  optimizeProfessionalWorkflowResult,
  workflowFingerprint,
} from "./professional-workflow.js";
import type {
  AiMeProfessionalWorkflowAwareness,
  ProfessionalWorkflowExecutionResult,
  ProfessionalWorkflowHealthReport,
  ProfessionalWorkflowModification,
  ProfessionalWorkflowRepairResult,
  ProfessionalWorkflowRequest,
  ProfessionalWorkflowResult,
} from "./professional-workflow-types.js";
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
 * execute() remains Step 2E coordinator. createProfessionalWorkflow() adds
 * Knowledge-Foundation Workflow Intelligence (Step 4) without duplicating planning.
 */
export class AiWorkflowEngine {
  readonly logger = new WorkflowLogger();
  readonly history = new WorkflowHistoryStore();
  readonly professionalMemory = new ProfessionalWorkflowMemoryStore();
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
  private readonly professionalWorkflowDurations: number[] = [];
  private initialized = false;
  private core: AiCoreManager | null = null;
  private taskManager: AiTaskManager | null = null;
  private lastProfessionalResult: ProfessionalWorkflowResult | null = null;
  private lastProfessionalHealth: ProfessionalWorkflowHealthReport | null = null;
  private readonly professionalResults = new Map<string, ProfessionalWorkflowResult>();

  constructor(options: AiWorkflowEngineOptions) {
    this.storageRoot = options.storageRoot;
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    const logDir = resolveLogDirectory(this.storageRoot);
    const workflowsDir = path.join(this.storageRoot, "workflows");

    this.logger.initialize(logDir);
    this.history.initialize(workflowsDir);
    this.professionalMemory.initialize(workflowsDir);
    this.initialized = true;

    this.logger.log("info", "workflow-start", "Workflow Engine initialized", {
      logDirectory: logDir,
      workflowsDirectory: workflowsDir,
      professionalWorkflowMemory: this.professionalMemory.getMemoryPath(),
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

  /**
   * Professional Workflow Intelligence — create reusable KF-grounded workflows from plans.
   * Does not generate media. Does not start Recommendation Intelligence.
   */
  async createProfessionalWorkflow(input: ProfessionalWorkflowRequest): Promise<ProfessionalWorkflowResult> {
    if (!this.initialized || !this.core) {
      throw new WorkflowEngineError("Workflow Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const request = input.request.trim();
    const objective = input.objective?.trim() || request;

    try {
      const foundation = this.core.knowledgeFoundation;
      const planningEngine = this.core.planningEngine;
      if (!foundation?.isStartupComplete() || !planningEngine?.isInitialized()) {
        return this.buildUnsupportedProfessionalWorkflow({
          request,
          objective,
          start,
          reason: "Knowledge Foundation and Planning Engine must be ready before professional workflows.",
        });
      }

      let plan = null as Awaited<ReturnType<NonNullable<AiCoreManager["planningEngine"]>["planProfessional"]>> | null;
      if (input.planId) {
        const last = planningEngine.getLastProfessionalPlan();
        if (last?.planId === input.planId) plan = last;
      }
      if (!plan) {
        plan = await planningEngine.planProfessional({
          request,
          objective,
          context: input.context ?? {},
          requiredDomains: input.requiredDomains,
          constraints: input.constraints,
          availableResources: input.availableResources,
          includeDomainModules: input.includeDomainModules !== false,
          reuseSimilarPlans: true,
        });
      }

      if (!plan.grounded || plan.unsupported) {
        return this.buildUnsupportedProfessionalWorkflow({
          request,
          objective,
          start,
          reason: "Professional workflow refused because the upstream plan is unsupported by verified knowledge.",
          planId: plan.planId,
        });
      }

      // Domains must match buildProfessionalWorkflowFromPlan (plan domains + request requiredDomains).
      const domains = Array.from(
        new Set([...plan.explanation.domainsUsed, ...(input.requiredDomains ?? [])])
      );
      const taskTitles = plan.framework.taskBreakdown.map((task) => task.title);
      const fingerprint = workflowFingerprint(plan.goal, domains, taskTitles);
      const exactMatch =
        input.reuseSimilarWorkflows === false ? null : this.professionalMemory.findByFingerprint(fingerprint);
      const similar =
        input.reuseSimilarWorkflows === false
          ? []
          : this.professionalMemory.findSimilar(objective, domains, 5);

      const built = buildProfessionalWorkflowFromPlan({
        request: input,
        plan,
        similarWorkflows: similar,
        exactMatch,
      });

      const durationMs = Math.round(performance.now() - start);
      this.professionalWorkflowDurations.push(durationMs);
      const result: ProfessionalWorkflowResult = { ...built, durationMs };
      if (!result.reused) this.professionalMemory.append(result.memoryRecord);
      else this.professionalMemory.update(result.memoryRecord);
      this.professionalResults.set(result.workflowId, structuredClone(result));
      this.lastProfessionalResult = structuredClone(result);
      this.logger.log("info", "workflow-start", "Professional workflow recorded", {
        workflowId: result.workflowId,
        reused: result.reused,
        planId: result.relatedPlanId,
        confidence: result.confidenceScore,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log("error", "error", "Professional workflow creation failed", { error: message });
      throw new WorkflowEngineError(message, "PROFESSIONAL_WORKFLOW_FAILED");
    }
  }

  modifyProfessionalWorkflow(workflowId: string, modification: ProfessionalWorkflowModification): ProfessionalWorkflowResult {
    const current = this.requireProfessionalWorkflow(workflowId);
    const modified = modifyProfessionalWorkflowResult(current, modification, this.professionalMemory);
    this.professionalResults.set(modified.workflowId, structuredClone(modified));
    this.lastProfessionalResult = structuredClone(modified);
    return modified;
  }

  optimizeProfessionalWorkflow(workflowId: string): ProfessionalWorkflowResult {
    const current = this.requireProfessionalWorkflow(workflowId);
    const optimized = optimizeProfessionalWorkflowResult(current, this.professionalMemory);
    this.professionalResults.set(optimized.workflowId, structuredClone(optimized));
    this.lastProfessionalResult = structuredClone(optimized);
    return optimized;
  }

  explainProfessionalWorkflow(workflowId: string): ProfessionalWorkflowResult["explanation"] & {
    workflowId: string;
    workflowName: string;
    goal: string;
  } {
    const current = this.requireProfessionalWorkflow(workflowId);
    return {
      workflowId: current.workflowId,
      workflowName: current.definition.workflowName,
      goal: current.definition.goal,
      ...current.explanation,
    };
  }

  reuseProfessionalWorkflow(goal: string, domains: string[] = []): ProfessionalWorkflowResult | null {
    const similar = this.professionalMemory.findSimilar(goal, domains, 1)[0];
    if (!similar) return null;
    const existing = this.professionalResults.get(similar.workflowId);
    return existing ? structuredClone(existing) : null;
  }

  detectProfessionalWorkflowImprovements(workflowId: string): string[] {
    const current = this.requireProfessionalWorkflow(workflowId);
    const similar = this.professionalMemory.findSimilar(current.definition.goal, current.explanation.domainsUsed, 3);
    const peer = similar.find((item) => item.workflowId !== workflowId) ?? null;
    const improvements = [...current.explanation.improvementsDetected];
    if (peer && current.definition.estimatedExecutionMinutes > peer.performanceMetrics.estimatedMinutes) {
      improvements.push("Peer workflow estimates shorter duration — consider optimizeProfessionalWorkflow");
    }
    if (!current.definition.parallelGroups.length) {
      improvements.push("No parallel groups detected — optimization may unlock concurrency");
    }
    return [...new Set(improvements)];
  }

  executeProfessionalWorkflow(workflowId: string): ProfessionalWorkflowExecutionResult {
    const current = this.requireProfessionalWorkflow(workflowId);
    const execution = executeProfessionalWorkflowCoordination(current, this.professionalMemory);
    const updated = {
      ...current,
      memoryRecord: {
        ...current.memoryRecord,
        executionHistory: execution.executionHistory,
        performanceMetrics: execution.performanceMetrics,
      },
      explanation: {
        ...current.explanation,
        improvementsDetected: execution.improvementsDetected,
      },
    };
    this.professionalResults.set(workflowId, structuredClone(updated));
    this.lastProfessionalResult = structuredClone(updated);
    return execution;
  }

  getAiMeProfessionalWorkflowAwareness(): AiMeProfessionalWorkflowAwareness {
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const planningReady = Boolean(this.core?.planningEngine?.isInitialized());
    return {
      available: this.initialized && foundationReady && planningReady,
      enabled: this.initialized && foundationReady && planningReady,
      summary:
        "AI Me can create, modify, optimize, explain, reuse, and coordinate professional workflows grounded in the Knowledge Foundation and Professional Planning Intelligence. Recommendation Intelligence is available via the Recommendation Engine.",
      capabilities: [
        "create workflows",
        "modify workflows",
        "optimize workflows",
        "explain workflows",
        "reuse existing workflows",
        "detect workflow improvements",
      ],
      groundedInKnowledgeFoundation: true,
      recommendationIntelligenceEnabled: true,
      workflowHistoryCount: this.professionalMemory.getCount(),
      lastConfidenceScore: this.lastProfessionalResult?.confidenceScore ?? null,
    };
  }

  getLastProfessionalWorkflow(): ProfessionalWorkflowResult | null {
    return this.lastProfessionalResult ? structuredClone(this.lastProfessionalResult) : null;
  }

  getProfessionalWorkflowHistory() {
    return this.professionalMemory.getAll().map((record) => structuredClone(record));
  }

  async runProfessionalWorkflowHealthCheck(): Promise<ProfessionalWorkflowHealthReport> {
    const issues: string[] = [];
    if (!this.initialized) issues.push("Workflow Engine is not initialized.");
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const planningReady = Boolean(this.core?.planningEngine?.isInitialized());
    if (!foundationReady) issues.push("Knowledge Foundation startup is incomplete.");
    if (!planningReady) issues.push("Planning Engine is not ready.");
    const memoryWritable = this.professionalMemory.ensureWritable();
    if (!memoryWritable) issues.push("Professional workflow memory is not writable.");

    let canCreateWorkflow = false;
    if (this.initialized && foundationReady && planningReady) {
      try {
        const sample =
          this.lastProfessionalResult?.grounded && this.lastProfessionalResult.definition.allTasks.length > 0
            ? this.lastProfessionalResult
            : await this.createProfessionalWorkflow({
                request: "create a professional workflow for camera lighting product advertisement",
                objective: "Coordinate a knowledge-backed product ad workflow",
                context: { product: "demo product", audience: "general buyers" },
                requiredDomains: ["camera-knowledge", "lighting-knowledge", "industry-standards-knowledge"],
                includeDomainModules: true,
                reuseSimilarWorkflows: true,
              });
        canCreateWorkflow =
          sample.grounded &&
          !sample.unsupported &&
          sample.definition.allTasks.length >= 3 &&
          sample.definition.dependencies.length > 0;
        if (!sample.grounded) issues.push("Sample professional workflow was not grounded.");
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }

    const report: ProfessionalWorkflowHealthReport = {
      healthy: issues.length === 0 && canCreateWorkflow && memoryWritable,
      initialized: this.initialized,
      foundationReady,
      planningReady,
      canCreateWorkflow,
      memoryWritable,
      issues,
      checkedAt: new Date().toISOString(),
    };
    this.lastProfessionalHealth = report;
    return structuredClone(report);
  }

  async repairProfessionalWorkflowIntelligence(): Promise<ProfessionalWorkflowRepairResult> {
    const actions: string[] = [];
    if (this.professionalMemory.ensureWritable()) actions.push("Ensured professional workflow memory is writable.");
    const health = await this.runProfessionalWorkflowHealthCheck();
    if (!health.healthy && this.core?.knowledgeFoundation?.isStartupComplete() && this.core.planningEngine) {
      await this.createProfessionalWorkflow({
        request: "professional video production workflow sample",
        objective: "Validate professional workflow path",
        includeDomainModules: true,
        reuseSimilarWorkflows: true,
      });
      actions.push("Re-ran grounded professional workflow sample.");
    }
    const recheck = await this.runProfessionalWorkflowHealthCheck();
    return { repaired: recheck.healthy, actions, remainingIssues: recheck.issues };
  }

  private requireProfessionalWorkflow(workflowId: string): ProfessionalWorkflowResult {
    const current = this.professionalResults.get(workflowId);
    if (!current) throw new WorkflowEngineError(`Professional workflow not found: ${workflowId}`, "WORKFLOW_NOT_FOUND");
    return current;
  }

  private buildUnsupportedProfessionalWorkflow(input: {
    request: string;
    objective: string;
    start: number;
    reason: string;
    planId?: string;
  }): ProfessionalWorkflowResult {
    const workflowId = randomUUID();
    const memoryRecord = {
      workflowId,
      goal: input.objective,
      knowledgeUsed: [],
      taskStructure: [],
      dependencies: [],
      executionHistory: [],
      performanceMetrics: {
        estimatedMinutes: 0,
        actualMinutes: null,
        taskCount: 0,
        parallelGroupCount: 0,
        successRate: null,
      },
      confidenceScore: 0,
      timestamp: new Date().toISOString(),
      relatedPlanId: input.planId ?? null,
      relatedDecisionId: null,
      domainsUsed: [],
      relatedKnowledgePacks: [],
      priorWorkflowIds: [],
      grounded: false,
      fingerprint: workflowFingerprint(input.objective, [], []),
    };
    this.professionalMemory.append(memoryRecord);
    const durationMs = Math.round(performance.now() - input.start);
    this.professionalWorkflowDurations.push(durationMs);
    const result: ProfessionalWorkflowResult = {
      workflowId,
      available: false,
      grounded: false,
      unsupported: true,
      reused: false,
      definition: {
        workflowId,
        workflowName: "unsupported-workflow",
        goal: input.objective,
        requiredKnowledge: [],
        requiredModules: [],
        requiredResources: [],
        mainTasks: [],
        subTasks: [],
        allTasks: [],
        dependencies: [],
        validationSteps: [],
        expectedResults: [],
        recoverySteps: [],
        parallelGroups: [],
        executionOrder: [],
        estimatedExecutionMinutes: 0,
      },
      explanation: {
        whySelected: input.reason,
        taskOrderReason: "No tasks generated because workflow is unsupported.",
        knowledgePacksUsed: [],
        knowledgeIdsUsed: [],
        dependenciesSummary: "None",
        expectedOutcome: "No professional workflow can be issued without Knowledge Foundation evidence.",
        confidenceScore: 0,
        domainsUsed: [],
        improvementsDetected: [],
      },
      confidenceScore: 0,
      confidenceExplanation: "Confidence is 0 because the workflow is unsupported.",
      memoryRecord,
      relatedPlanId: input.planId ?? null,
      relatedDecisionId: null,
      multiDomain: false,
      durationMs,
    };
    this.lastProfessionalResult = structuredClone(result);
    this.professionalResults.set(workflowId, structuredClone(result));
    return result;
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
    if (!this.core?.knowledgeFoundation?.isStartupComplete()) {
      knownIssues.push("Professional Workflow Intelligence waiting on Knowledge Foundation");
    }

    const checks = [this.initialized, this.history.getHistoryPath() !== null, this.professionalMemory.isReady()];
    const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      workflowEngineStatus: this.initialized ? "operational" : "not-initialized",
      executionStatus: this.initialized ? "ready" : "not-ready",
      schedulingQuality: successRate >= 80 ? "high" : successRate >= 50 ? "medium" : "low",
      recoveryStatus: recovered > 0 ? "verified" : "ready",
      performance: {
        averageWorkflowMs,
        totalWorkflows: this.history.getCount() + this.professionalMemory.getCount(),
        successRate,
      },
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
