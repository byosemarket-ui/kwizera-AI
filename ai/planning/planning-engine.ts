import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { resolveLogDirectory } from "../../storage/paths/storage-paths.js";
import { getRequiredModules } from "./decision-type-mapper.js";
import { DependencyAnalyzer } from "./dependency-analyzer.js";
import { PlanRiskAnalyzer } from "./plan-risk-analyzer.js";
import { PlanValidator } from "./plan-validator.js";
import { PlanningHistoryStore } from "./planning-history-store.js";
import { PlanningLogger } from "./planning-logger.js";
import { RecoveryPlanner } from "./recovery-planner.js";
import { ResourceEstimator } from "./resource-estimator.js";
import { TaskBreakdown } from "./task-breakdown.js";
import {
  ApprovedDecisionInput,
  ExecutionPlan,
  PlanningEngineError,
  PlanningEngineStatusReport,
  PlanningRecord,
  PlanningResult,
  PlanningStatus,
  PlanningStep,
  ValidationRule,
} from "./types.js";

export interface AiPlanningEngineOptions {
  storageRoot: string;
}

/**
 * KWIZERA AI Planning Engine — transforms approved decisions into execution plans.
 * Step 2D: Never executes work. No AI models. No business module implementations.
 */
export class AiPlanningEngine {
  readonly logger = new PlanningLogger();
  readonly history = new PlanningHistoryStore();
  readonly taskBreakdown = new TaskBreakdown();
  readonly dependencyAnalyzer = new DependencyAnalyzer();
  readonly resourceEstimator = new ResourceEstimator();
  readonly riskAnalyzer = new PlanRiskAnalyzer();
  readonly recoveryPlanner = new RecoveryPlanner();
  readonly planValidator = new PlanValidator();

  private readonly storageRoot: string;
  private readonly planningDurations: number[] = [];
  private initialized = false;
  private core: AiCoreManager | null = null;

  constructor(options: AiPlanningEngineOptions) {
    this.storageRoot = options.storageRoot;
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    const logDir = resolveLogDirectory(this.storageRoot);
    const plansDir = path.join(this.storageRoot, "plans");

    this.logger.initialize(logDir);
    this.history.initialize(plansDir);
    this.initialized = true;

    this.logger.log("info", "planning", "Planning Engine initialized", {
      logDirectory: logDir,
      plansDirectory: plansDir,
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Execute the 13-step planning process from an approved decision.
   */
  async planFromDecision(input: ApprovedDecisionInput): Promise<PlanningResult> {
    if (!this.initialized || !this.core) {
      throw new PlanningEngineError("Planning Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const planId = randomUUID();
    const stepsCompleted: PlanningStep[] = [];

    try {
      // Step 1 — Receive approved decision
      stepsCompleted.push(PlanningStep.ReceiveApprovedDecision);
      this.logger.log("info", "planning", "Approved decision received for planning", {
        planId,
        decisionId: input.decisionId,
        type: input.planningType,
      });

      // Step 2 — Understand the project objective
      stepsCompleted.push(PlanningStep.UnderstandObjective);
      const projectGoal = input.objective;

      // Step 3 — Analyze available resources
      stepsCompleted.push(PlanningStep.AnalyzeResources);
      const resourceKeys = Object.keys(input.availableData);

      // Step 4 — Identify required AI modules
      stepsCompleted.push(PlanningStep.IdentifyModules);
      const moduleIds = getRequiredModules(
        input.planningType,
        input.workflowHandoff.requiredModules
      );
      const registryModuleIds = new Set(
        this.core.registry.getAllEntries().map((e) => e.id)
      );

      const missingInformation: PlanningResult["missingInformation"] = [];
      if (!projectGoal.trim()) {
        missingInformation.push({
          field: "objective",
          severity: "critical",
          message: "Project objective is required for planning",
        });
      }

      const criticalFields = this.getCriticalFields(input.planningType);
      for (const field of criticalFields) {
        if (
          input.availableData[field] === undefined ||
          input.availableData[field] === null ||
          input.availableData[field] === ""
        ) {
          missingInformation.push({
            field,
            severity: "critical",
            message: `Missing required field for planning: ${field}`,
          });
        }
      }

      if (missingInformation.some((m) => m.severity === "critical")) {
        return this.buildIncompleteResult({
          planId,
          input,
          stepsCompleted,
          start,
          missingInformation,
          recommendations: missingInformation.map((m) => m.message),
          reason: "Critical information missing — planning stopped",
        });
      }

      // Step 5 — Break work into smaller tasks
      stepsCompleted.push(PlanningStep.BreakIntoTasks);
      const tasks = this.taskBreakdown.breakDown(input, moduleIds);

      // Step 6 — Define execution order
      stepsCompleted.push(PlanningStep.DefineExecutionOrder);
      const executionOrder = this.taskBreakdown.getExecutionOrder(tasks);

      // Step 7 — Define dependencies
      stepsCompleted.push(PlanningStep.DefineDependencies);
      const dependencies = this.dependencyAnalyzer.analyze(tasks, registryModuleIds);

      // Step 8 — Estimate execution time
      stepsCompleted.push(PlanningStep.EstimateExecutionTime);
      const { resources, time } = this.resourceEstimator.estimate(
        input.planningType,
        tasks,
        moduleIds
      );

      // Step 9 — Estimate required storage
      stepsCompleted.push(PlanningStep.EstimateStorage);

      // Step 10 — Estimate required memory
      stepsCompleted.push(PlanningStep.EstimateMemory);

      const riskAnalysis = this.riskAnalyzer.analyze(input);

      // Step 11 — Create recovery plan
      stepsCompleted.push(PlanningStep.CreateRecoveryPlan);
      const recoveryStrategy = this.recoveryPlanner.create(
        tasks,
        input.workflowHandoff.workflowId
      );

      const validationRules: ValidationRule[] = [
        { id: "vr-inputs", description: "All required inputs validated before each task", required: true },
        { id: "vr-quality", description: "Output meets KWIZERA quality standards", required: true },
        { id: "vr-brand", description: "Brand consistency verified where applicable", required: false },
        { id: "vr-checkpoint", description: "Checkpoint saved after critical tasks", required: true },
      ];

      const executionPlan: ExecutionPlan = {
        projectGoal,
        planningType: input.planningType,
        taskList: tasks,
        executionOrder,
        priority: input.priority,
        dependencies,
        requiredResources: resources,
        estimatedTime: time,
        expectedOutput: this.buildExpectedOutput(input),
        validationRules,
        recoveryStrategy,
      };

      // Step 12 — Validate the complete plan
      stepsCompleted.push(PlanningStep.ValidatePlan);
      const validation = this.planValidator.validate(input, executionPlan, this.core);

      this.logger.log(
        validation.passed ? "info" : "warn",
        "validation",
        validation.passed ? "Execution plan validated" : "Plan validation failed",
        { planId, checks: validation.checks }
      );

      if (!validation.passed) {
        return this.buildIncompleteResult({
          planId,
          input,
          stepsCompleted,
          start,
          missingInformation,
          recommendations: [validation.nextAction ?? "Resolve validation failures"],
          reason: validation.nextAction ?? "Plan validation failed",
          executionPlan,
          riskAnalysis,
          validation,
        });
      }

      // Step 13 — Send the execution plan to the AI Workflow Engine
      stepsCompleted.push(PlanningStep.SendToWorkflowEngine);
      const workflowHandoff = {
        planId,
        decisionId: input.decisionId,
        workflowId: input.workflowHandoff.workflowId,
        executionPlan,
        objective: projectGoal,
        parameters: {
          requestId: input.requestId,
          reasoningId: input.reasoningResult?.reasoningId,
          resources: resourceKeys,
          expectedSuccessRate: riskAnalysis.expectedSuccessRate,
        },
      };

      const record = this.createRecord({
        planId,
        input,
        executionPlan,
        riskAnalysis,
      });

      this.history.append(record);

      this.logger.log("info", "plan", "Execution plan sent to Workflow Engine", {
        planId,
        taskCount: tasks.length,
        estimatedTime: time.humanReadable,
      });

      const durationMs = Math.round(performance.now() - start);
      this.planningDurations.push(durationMs);

      return {
        planId,
        status: PlanningStatus.Complete,
        readyForWorkflow: true,
        stepsCompleted,
        executionPlan,
        riskAnalysis,
        validation,
        workflowHandoff,
        missingInformation,
        recommendations: [],
        record,
        durationMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log("error", "error", "Planning failed", { planId, error: message });
      throw new PlanningEngineError(message, "PLANNING_FAILED");
    }
  }

  buildStatusReport(): PlanningEngineStatusReport {
    const total = this.planningDurations.length;
    const averagePlanningMs =
      total > 0
        ? Math.round(this.planningDurations.reduce((a, b) => a + b, 0) / total)
        : 0;

    const complete = this.history.getAll().filter((r) => r.actualResult === "pending");
    const planningQuality =
      this.history.getCount() > 0
        ? Math.round((complete.length / this.history.getCount()) * 100)
        : 100;

    const knownIssues: string[] = [];
    if (!this.initialized) {
      knownIssues.push("Planning Engine not initialized");
    }

    const checks = [this.initialized, this.history.getHistoryPath() !== null];
    const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      planningEngineStatus: this.initialized ? "operational" : "not-initialized",
      planningQuality,
      resourceEstimationAccuracy: "estimated",
      validationStatus: this.initialized ? "ready" : "not-ready",
      performance: { averagePlanningMs, totalPlans: this.history.getCount() },
      knownIssues,
      readinessScore,
      timestamp: new Date().toISOString(),
    };
  }

  private getCriticalFields(type: ApprovedDecisionInput["planningType"]): string[] {
    const map: Partial<Record<ApprovedDecisionInput["planningType"], string[]>> = {
      "product-analysis": ["productName"],
      export: ["projectId"],
    };
    return map[type] ?? [];
  }

  private buildExpectedOutput(input: ApprovedDecisionInput): string {
    return `${input.planningType} deliverable for: ${input.objective.slice(0, 100)}`;
  }

  private buildIncompleteResult(params: {
    planId: string;
    input: ApprovedDecisionInput;
    stepsCompleted: PlanningStep[];
    start: number;
    missingInformation: PlanningResult["missingInformation"];
    recommendations: string[];
    reason: string;
    executionPlan?: ExecutionPlan;
    riskAnalysis?: PlanningResult["riskAnalysis"];
    validation?: PlanningResult["validation"];
  }): PlanningResult {
    const riskAnalysis =
      params.riskAnalysis ??
      this.riskAnalyzer.analyze(params.input);

    const executionPlan =
      params.executionPlan ??
      ({
        projectGoal: params.input.objective,
        planningType: params.input.planningType,
        taskList: [],
        executionOrder: [],
        priority: params.input.priority,
        dependencies: [],
        requiredResources: { modules: [], storageBytes: 0, memoryMb: 0, cpuIntensity: "low" },
        estimatedTime: { totalMs: 0, perTaskMs: {}, humanReadable: "0 sec" },
        expectedOutput: "none",
        validationRules: [],
        recoveryStrategy: {
          primary: "none",
          fallback: "none",
          checkpoints: [],
          rollbackSteps: [],
        },
      } satisfies ExecutionPlan);

    const record = this.createRecord({
      planId: params.planId,
      input: params.input,
      executionPlan,
      riskAnalysis,
    });

    this.history.append(record);
    this.logger.log("warn", "warning", params.reason, { planId: params.planId });

    const durationMs = Math.round(performance.now() - params.start);
    this.planningDurations.push(durationMs);

    return {
      planId: params.planId,
      status: PlanningStatus.AwaitingInput,
      readyForWorkflow: false,
      stepsCompleted: params.stepsCompleted,
      executionPlan,
      riskAnalysis,
      validation: params.validation ?? { passed: false, checks: [] },
      missingInformation: params.missingInformation,
      recommendations: params.recommendations,
      record,
      durationMs,
    };
  }

  private createRecord(input: {
    planId: string;
    input: ApprovedDecisionInput;
    executionPlan: ExecutionPlan;
    riskAnalysis: PlanningResult["riskAnalysis"];
  }): PlanningRecord {
    return {
      planId: input.planId,
      projectType: input.input.planningType,
      executionPlan: input.executionPlan,
      dependencies: input.executionPlan.dependencies,
      estimatedTimeMs: input.executionPlan.estimatedTime.totalMs,
      actualResult: "pending",
      performance: input.riskAnalysis.expectedSuccessRate,
      lessonsLearned: [],
      futureImprovementSuggestions: input.riskAnalysis.alternativeStrategies,
      decisionId: input.input.decisionId,
      timestamp: new Date().toISOString(),
    };
  }
}
