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
import { ProfessionalPlanMemoryStore } from "./professional-plan-memory.js";
import {
  buildProfessionalPlanFromDecision,
  modifyProfessionalPlanResult,
  optimizeProfessionalPlanResult,
} from "./professional-planning.js";
import type {
  AiMeProfessionalPlanningAwareness,
  ProfessionalPlanModification,
  ProfessionalPlanningHealthReport,
  ProfessionalPlanningRepairResult,
  ProfessionalPlanningRequest,
  ProfessionalPlanningResult,
} from "./professional-planning-types.js";
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
 * planFromDecision remains Step 2D workflow planning. planProfessional() adds
 * Knowledge-Foundation Planning Intelligence (Step 3) without duplicating decision logic.
 */
export class AiPlanningEngine {
  readonly logger = new PlanningLogger();
  readonly history = new PlanningHistoryStore();
  readonly professionalMemory = new ProfessionalPlanMemoryStore();
  readonly taskBreakdown = new TaskBreakdown();
  readonly dependencyAnalyzer = new DependencyAnalyzer();
  readonly resourceEstimator = new ResourceEstimator();
  readonly riskAnalyzer = new PlanRiskAnalyzer();
  readonly recoveryPlanner = new RecoveryPlanner();
  readonly planValidator = new PlanValidator();

  private readonly storageRoot: string;
  private readonly planningDurations: number[] = [];
  private readonly professionalPlanningDurations: number[] = [];
  private initialized = false;
  private core: AiCoreManager | null = null;
  private lastProfessionalResult: ProfessionalPlanningResult | null = null;
  private lastProfessionalHealth: ProfessionalPlanningHealthReport | null = null;
  private readonly professionalResults = new Map<string, ProfessionalPlanningResult>();

  constructor(options: AiPlanningEngineOptions) {
    this.storageRoot = options.storageRoot;
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    const logDir = resolveLogDirectory(this.storageRoot);
    const plansDir = path.join(this.storageRoot, "plans");

    this.logger.initialize(logDir);
    this.history.initialize(plansDir);
    this.professionalMemory.initialize(plansDir);
    this.initialized = true;

    this.logger.log("info", "planning", "Planning Engine initialized", {
      logDirectory: logDir,
      plansDirectory: plansDir,
      professionalPlanMemory: this.professionalMemory.getMemoryPath(),
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

  /**
   * Professional Planning Intelligence — builds execution plans from Knowledge Foundation
   * decisions. Does not generate media and does not start Workflow Intelligence.
   */
  async planProfessional(input: ProfessionalPlanningRequest): Promise<ProfessionalPlanningResult> {
    if (!this.initialized || !this.core) {
      throw new PlanningEngineError("Planning Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const request = input.request.trim();
    const objective = input.objective?.trim() || request;

    try {
      const foundation = this.core.knowledgeFoundation;
      const decisionEngine = this.core.decisionEngine;
      if (!foundation?.isStartupComplete() || !decisionEngine?.isInitialized()) {
        return this.buildUnsupportedProfessionalPlan({
          request,
          objective,
          start,
          reason: "Knowledge Foundation and Decision Engine must be ready before professional planning.",
        });
      }

      let decision = null as Awaited<ReturnType<NonNullable<AiCoreManager["decisionEngine"]>["decideProfessional"]>> | null;
      if (input.decisionId) {
        const last = decisionEngine.getLastProfessionalDecision();
        if (last?.decisionId === input.decisionId) decision = last;
      }
      if (!decision) {
        decision = await decisionEngine.decideProfessional({
          request,
          objective,
          context: input.context ?? {},
          requiredDomains: input.requiredDomains,
          constraints: input.constraints,
          availableResources: input.availableResources,
          includeDomainModules: input.includeDomainModules !== false,
        });
      }

      if (!decision.grounded || decision.unsupported) {
        return this.buildUnsupportedProfessionalPlan({
          request,
          objective,
          start,
          reason: "Professional planning refused because the upstream decision is unsupported by verified knowledge.",
          decisionId: decision.decisionId,
        });
      }

      const similar =
        input.reuseSimilarPlans === false
          ? []
          : this.professionalMemory.findSimilar(objective, decision.explanation.domainsUsed, 5);
      const reusedFromPlanId = similar[0]?.planId ?? null;

      const built = buildProfessionalPlanFromDecision({
        request: input,
        decision,
        similarPlans: similar,
        reusedFromPlanId,
      });

      const durationMs = Math.round(performance.now() - start);
      this.professionalPlanningDurations.push(durationMs);
      const result: ProfessionalPlanningResult = { ...built, durationMs };
      this.professionalMemory.append(result.memoryRecord);
      this.professionalResults.set(result.planId, structuredClone(result));
      this.lastProfessionalResult = structuredClone(result);
      this.logger.log("info", "planning", "Professional plan recorded", {
        planId: result.planId,
        decisionId: result.relatedDecisionId,
        tasks: result.framework.taskBreakdown.length,
        confidence: result.confidenceScore,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log("error", "error", "Professional planning failed", { error: message });
      throw new PlanningEngineError(message, "PROFESSIONAL_PLANNING_FAILED");
    }
  }

  modifyProfessionalPlan(planId: string, modification: ProfessionalPlanModification): ProfessionalPlanningResult {
    const current = this.requireProfessionalPlan(planId);
    const modified = modifyProfessionalPlanResult(current, modification, this.professionalMemory);
    this.professionalResults.set(modified.planId, structuredClone(modified));
    this.lastProfessionalResult = structuredClone(modified);
    return modified;
  }

  optimizeProfessionalPlan(planId: string): ProfessionalPlanningResult {
    const current = this.requireProfessionalPlan(planId);
    const optimized = optimizeProfessionalPlanResult(current, this.professionalMemory);
    this.professionalResults.set(optimized.planId, structuredClone(optimized));
    this.lastProfessionalResult = structuredClone(optimized);
    return optimized;
  }

  explainProfessionalPlan(planId: string): ProfessionalPlanningResult["explanation"] & { planId: string; goal: string } {
    const current = this.requireProfessionalPlan(planId);
    return { planId: current.planId, goal: current.goal, ...current.explanation };
  }

  reuseProfessionalPlan(goal: string, domains: string[] = []): ProfessionalPlanningResult | null {
    const similar = this.professionalMemory.findSimilar(goal, domains, 1)[0];
    if (!similar) return null;
    const existing = this.professionalResults.get(similar.planId);
    if (existing) return structuredClone(existing);
    return null;
  }

  getAiMeProfessionalPlanningAwareness(): AiMeProfessionalPlanningAwareness {
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const decisionReady = Boolean(this.core?.decisionEngine?.isInitialized());
    return {
      available: this.initialized && foundationReady && decisionReady,
      enabled: this.initialized && foundationReady && decisionReady,
      summary:
        "AI Me can create, modify, optimize, explain, and reuse professional execution plans grounded in the Knowledge Foundation and Professional Decision Intelligence. Workflow Intelligence is available through the Workflow Engine (createProfessionalWorkflow). Recommendation Intelligence is not enabled in this step.",
      capabilities: [
        "create professional plans",
        "modify existing plans",
        "optimize plans",
        "explain planning decisions",
        "reuse previous plans when appropriate",
      ],
      groundedInKnowledgeFoundation: true,
      workflowIntelligenceEnabled: true,
      planHistoryCount: this.professionalMemory.getCount(),
      lastConfidenceScore: this.lastProfessionalResult?.confidenceScore ?? null,
    };
  }

  getLastProfessionalPlan(): ProfessionalPlanningResult | null {
    return this.lastProfessionalResult ? structuredClone(this.lastProfessionalResult) : null;
  }

  getProfessionalPlanHistory() {
    return this.professionalMemory.getAll().map((record) => structuredClone(record));
  }

  async runProfessionalPlanningHealthCheck(): Promise<ProfessionalPlanningHealthReport> {
    const issues: string[] = [];
    if (!this.initialized) issues.push("Planning Engine is not initialized.");
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const decisionReady = Boolean(this.core?.decisionEngine?.isInitialized());
    if (!foundationReady) issues.push("Knowledge Foundation startup is incomplete.");
    if (!decisionReady) issues.push("Decision Engine is not ready.");
    const memoryWritable = this.professionalMemory.ensureWritable();
    if (!memoryWritable) issues.push("Professional plan memory is not writable.");

    let canPlan = false;
    if (this.initialized && foundationReady && decisionReady) {
      try {
        const sample =
          this.lastProfessionalResult?.grounded && this.lastProfessionalResult.framework.taskBreakdown.length > 0
            ? this.lastProfessionalResult
            : await this.planProfessional({
                request: "create a professional plan for camera lighting product advertisement",
                objective: "Plan a knowledge-backed product ad approach",
                context: { product: "demo product", audience: "general buyers" },
                requiredDomains: ["camera-knowledge", "lighting-knowledge", "industry-standards-knowledge"],
                includeDomainModules: true,
              });
        canPlan =
          sample.grounded &&
          !sample.unsupported &&
          sample.framework.taskBreakdown.length >= 3 &&
          sample.framework.dependencies.length > 0;
        if (!sample.grounded) issues.push("Sample professional plan was not grounded.");
        if (!sample.framework.dependencies.length) issues.push("Sample professional plan missing dependencies.");
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }

    const report: ProfessionalPlanningHealthReport = {
      healthy: issues.length === 0 && canPlan && memoryWritable,
      initialized: this.initialized,
      foundationReady,
      decisionReady,
      canPlan,
      memoryWritable,
      issues,
      checkedAt: new Date().toISOString(),
    };
    this.lastProfessionalHealth = report;
    return structuredClone(report);
  }

  async repairProfessionalPlanningIntelligence(): Promise<ProfessionalPlanningRepairResult> {
    const actions: string[] = [];
    if (this.professionalMemory.ensureWritable()) actions.push("Ensured professional plan memory is writable.");
    const health = await this.runProfessionalPlanningHealthCheck();
    if (!health.healthy && this.core?.knowledgeFoundation?.isStartupComplete() && this.core.decisionEngine) {
      await this.planProfessional({
        request: "professional video production planning sample",
        objective: "Validate professional planning path",
        includeDomainModules: true,
      });
      actions.push("Re-ran grounded professional planning sample.");
    }
    const recheck = await this.runProfessionalPlanningHealthCheck();
    return { repaired: recheck.healthy, actions, remainingIssues: recheck.issues };
  }

  private requireProfessionalPlan(planId: string): ProfessionalPlanningResult {
    const current = this.professionalResults.get(planId);
    if (!current) throw new PlanningEngineError(`Professional plan not found: ${planId}`, "PLAN_NOT_FOUND");
    return current;
  }

  private buildUnsupportedProfessionalPlan(input: {
    request: string;
    objective: string;
    start: number;
    reason: string;
    decisionId?: string;
  }): ProfessionalPlanningResult {
    const planId = randomUUID();
    const memoryRecord = {
      planId,
      goal: input.objective,
      reasoningSummary: input.reason,
      knowledgeUsed: [],
      tasks: [],
      dependencies: [],
      confidenceScore: 0,
      timestamp: new Date().toISOString(),
      relatedDecisionId: input.decisionId ?? null,
      domainsUsed: [],
      relatedKnowledgePacks: [],
      priorPlanIds: [],
      grounded: false,
    };
    this.professionalMemory.append(memoryRecord);
    const durationMs = Math.round(performance.now() - input.start);
    this.professionalPlanningDurations.push(durationMs);
    const result: ProfessionalPlanningResult = {
      planId,
      available: false,
      grounded: false,
      unsupported: true,
      goal: input.objective,
      constraints: [],
      missingInformation: [{ field: "verified-knowledge", severity: "critical", reason: input.reason }],
      framework: {
        goal: input.objective,
        requirements: [],
        assumptions: [],
        requiredKnowledge: [],
        requiredResources: [],
        professionalWorkflow: [],
        taskBreakdown: [],
        stepOrder: [],
        dependencies: [],
        parallelTasks: [],
        expectedResults: [],
        risks: [input.reason],
        recommendations: ["Provide verified Knowledge Foundation evidence before planning."],
        complexity: "low",
        estimatedExecutionMinutes: 0,
      },
      explanation: {
        whySelected: input.reason,
        knowledgePacksUsed: [],
        knowledgeIdsUsed: [],
        taskOrderReason: "No tasks were generated because planning is unsupported.",
        expectedOutcome: "No professional plan can be issued without Knowledge Foundation evidence.",
        confidenceScore: 0,
        domainsUsed: [],
      },
      confidenceScore: 0,
      confidenceExplanation: "Confidence is 0 because the plan is unsupported.",
      memoryRecord,
      relatedDecisionId: input.decisionId ?? null,
      reusedFromPlanId: null,
      multiDomain: false,
      durationMs,
    };
    this.lastProfessionalResult = structuredClone(result);
    this.professionalResults.set(planId, structuredClone(result));
    return result;
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
    if (!this.core?.knowledgeFoundation?.isStartupComplete()) {
      knownIssues.push("Professional Planning Intelligence waiting on Knowledge Foundation");
    }

    const checks = [this.initialized, this.history.getHistoryPath() !== null, this.professionalMemory.isReady()];
    const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      planningEngineStatus: this.initialized ? "operational" : "not-initialized",
      planningQuality,
      resourceEstimationAccuracy: "estimated",
      validationStatus: this.initialized ? "ready" : "not-ready",
      performance: {
        averagePlanningMs,
        totalPlans: this.history.getCount() + this.professionalMemory.getCount(),
      },
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
