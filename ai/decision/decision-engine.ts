import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { resolveLogDirectory } from "../../storage/paths/storage-paths.js";
import { DecisionHistoryStore } from "./decision-history-store.js";
import { DecisionLogger } from "./decision-logger.js";
import { DecisionPriorityManager } from "./decision-priority-manager.js";
import { DecisionValidator } from "./decision-validator.js";
import { QualityEvaluator } from "./quality-evaluator.js";
import { SolutionGenerator } from "./solution-generator.js";
import { SolutionScorer } from "./solution-scorer.js";
import { StubKnowledgeSearchProvider } from "./providers/knowledge-search-provider.js";
import { StubMemorySearchProvider } from "./providers/memory-search-provider.js";
import {
  DecisionEngineError,
  DecisionEngineStatusReport,
  DecisionPriority,
  DecisionRationale,
  DecisionRecord,
  DecisionRequest,
  DecisionResult,
  DecisionStatus,
  DecisionStep,
  WorkflowHandoff,
} from "./types.js";
import type { AiReasoningEngine } from "../reasoning/reasoning-engine.js";
import { mapDecisionTypeToReasoningType } from "../reasoning/decision-type-mapper.js";
import type { AiPlanningEngine } from "../planning/planning-engine.js";
import { mapDecisionTypeToPlanningType } from "../planning/decision-type-mapper.js";

export interface AiDecisionEngineOptions {
  storageRoot: string;
  memoryProvider?: StubMemorySearchProvider;
  knowledgeProvider?: StubKnowledgeSearchProvider;
}

/**
 * KWIZERA AI Decision Engine — central intelligent decision authority.
 * Step 2B: No AI models. No business module implementations.
 */
export class AiDecisionEngine {
  readonly logger = new DecisionLogger();
  readonly history = new DecisionHistoryStore();
  readonly priorityManager = new DecisionPriorityManager();
  readonly qualityEvaluator = new QualityEvaluator();
  readonly solutionGenerator = new SolutionGenerator();
  readonly solutionScorer = new SolutionScorer();
  readonly validator = new DecisionValidator();

  private readonly memoryProvider: StubMemorySearchProvider;
  private readonly knowledgeProvider: StubKnowledgeSearchProvider;
  private readonly storageRoot: string;
  private readonly decisionDurations: number[] = [];
  private initialized = false;
  private core: AiCoreManager | null = null;
  private reasoningEngine: AiReasoningEngine | null = null;
  private planningEngine: AiPlanningEngine | null = null;

  constructor(options: AiDecisionEngineOptions) {
    this.storageRoot = options.storageRoot;
    this.memoryProvider = options.memoryProvider ?? new StubMemorySearchProvider();
    this.knowledgeProvider =
      options.knowledgeProvider ?? new StubKnowledgeSearchProvider();
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    const logDir = resolveLogDirectory(this.storageRoot);
    const decisionsDir = path.join(this.storageRoot, "decisions");

    this.logger.initialize(logDir);
    this.history.initialize(decisionsDir);
    this.initialized = true;

    this.logger.log("info", "decision", "Decision Engine initialized", {
      logDirectory: logDir,
      decisionsDirectory: decisionsDir,
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setReasoningEngine(engine: AiReasoningEngine): void {
    this.reasoningEngine = engine;
  }

  setPlanningEngine(engine: AiPlanningEngine): void {
    this.planningEngine = engine;
  }

  /**
   * Execute the 12-step decision process. No important work should run before this completes.
   */
  async decide(request: DecisionRequest): Promise<DecisionResult> {
    if (!this.initialized || !this.core) {
      throw new DecisionEngineError("Decision Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const decisionId = randomUUID();
    const stepsCompleted: DecisionStep[] = [];

    this.priorityManager.acquire(request.priority, decisionId);

    try {
      // Step 1 — Receive User Request
      stepsCompleted.push(DecisionStep.ReceiveRequest);
      this.logger.log("info", "decision", "Decision request received", {
        decisionId,
        type: request.type,
        requestId: request.requestId,
      });

      // Step 2 — Understand User Goal
      stepsCompleted.push(DecisionStep.UnderstandGoal);
      const objective =
        request.statedObjective ??
        (request.availableData.objective as string | undefined) ??
        request.userRequest;

      // Reasoning Engine gate — every major decision passes through reasoning first
      let reasoningResult: DecisionResult["reasoningResult"];
      if (this.reasoningEngine) {
        reasoningResult = await this.reasoningEngine.reason({
          taskId: request.requestId,
          type: mapDecisionTypeToReasoningType(request.type),
          userObjective: objective,
          userRequest: request.userRequest,
          inputs: request.availableData,
          correlationId: request.correlationId,
        });

        if (!reasoningResult.readyForDecision) {
          return this.buildIncompleteResult({
            decisionId,
            request,
            stepsCompleted,
            start,
            missingInformation: reasoningResult.missingInformation,
            recommendations: [
              reasoningResult.confidence.explanation,
              ...(reasoningResult.explanation?.internalNotes.filter((n) =>
                n.startsWith("Missing") || n.includes("collect")
              ) ?? []),
              ...(reasoningResult.recommendation?.improvements ?? []),
            ],
            status: DecisionStatus.AwaitingInput,
            reason: `Reasoning confidence ${reasoningResult.confidence.level} — ${reasoningResult.confidence.explanation}`,
            reasoningResult,
          });
        }
      }

      // Step 3 — Analyze Available Data
      stepsCompleted.push(DecisionStep.AnalyzeData);
      const dataKeys = Object.keys(request.availableData);

      // Step 4 — Search Existing Memory
      stepsCompleted.push(DecisionStep.SearchMemory);
      const memoryResult = await this.memoryProvider.search(objective, request.availableData);

      // Step 5 — Search Knowledge Base
      stepsCompleted.push(DecisionStep.SearchKnowledge);
      const knowledgeResult = await this.knowledgeProvider.search(
        objective,
        request.availableData
      );

      // Step 6 — Detect Missing Information
      stepsCompleted.push(DecisionStep.DetectMissing);
      const missingInformation = this.qualityEvaluator.detectMissingInformation(
        request,
        request.availableData
      );

      const criticalMissing = missingInformation.filter((m) => m.severity === "critical");
      if (criticalMissing.length > 0) {
        return this.buildIncompleteResult({
          decisionId,
          request,
          stepsCompleted,
          start,
          missingInformation,
          status: DecisionStatus.AwaitingInput,
          reason: "Critical information missing — cannot approve workflow",
        });
      }

      // Quality assessment before solutions
      const qualityAssessment = this.qualityEvaluator.evaluate(
        request,
        request.availableData
      );

      if (!qualityAssessment.sufficient) {
        return this.buildIncompleteResult({
          decisionId,
          request,
          stepsCompleted,
          start,
          missingInformation,
          recommendations: qualityAssessment.recommendations,
          status: DecisionStatus.AwaitingInput,
          reason: "Quality insufficient — recommendations generated",
          qualityScore: qualityAssessment.score,
        });
      }

      // Step 7 — Generate Possible Solutions
      stepsCompleted.push(DecisionStep.GenerateSolutions);
      const candidates = this.solutionGenerator.generate(request);

      // Step 8 — Compare Solutions
      stepsCompleted.push(DecisionStep.CompareSolutions);
      const comparisonNote = this.solutionScorer.compare(
        candidates.map((c) => ({
          ...c,
          scores: { overall: 0, goalAlignment: 0, resourceFit: 0, qualityPotential: 0, risk: 0 },
        }))
      );

      // Step 9 — Score Every Solution
      stepsCompleted.push(DecisionStep.ScoreSolutions);
      const scored = this.solutionScorer.score(
        candidates,
        request,
        qualityAssessment.score
      );
      const selected = scored[0];

      // Step 10 — Select the Best Solution
      stepsCompleted.push(DecisionStep.SelectBest);

      // Step 11 — Explain the Decision Internally
      stepsCompleted.push(DecisionStep.ExplainInternally);
      const rationale: DecisionRationale = {
        summary: `Selected ${selected.label} for ${request.type}`,
        selectedReason: `Highest score (${selected.scores.overall}). ${comparisonNote}`,
        rejectedAlternatives: scored.slice(1).map((s) => ({
          id: s.id,
          reason: `Lower score: ${s.scores.overall}`,
        })),
        factorsConsidered: [
          `objective:${objective.slice(0, 60)}`,
          `dataFields:${dataKeys.join(",") || "none"}`,
          `memory:${memoryResult.found}`,
          `knowledge:${knowledgeResult.found}`,
          `qualityScore:${qualityAssessment.score}`,
          ...(reasoningResult
            ? [
                `reasoningId:${reasoningResult.reasoningId}`,
                `reasoningConfidence:${reasoningResult.confidence.level}`,
                `recommendedApproach:${reasoningResult.recommendation?.approachId ?? "none"}`,
              ]
            : []),
        ],
      };

      // Validate before approval
      const validation = this.validator.validate(request, selected, this.core);
      this.logger.log(
        validation.passed ? "info" : "warn",
        "validation",
        validation.passed ? "Decision validated" : "Decision validation failed",
        { decisionId, checks: validation.checks }
      );

      if (!validation.passed) {
        return this.buildIncompleteResult({
          decisionId,
          request,
          stepsCompleted,
          start,
          missingInformation,
          recommendations: [validation.nextAction ?? "Resolve validation failures"],
          status: DecisionStatus.Rejected,
          reason: validation.nextAction ?? "Validation failed",
          rationale,
          qualityScore: qualityAssessment.score,
          validation,
          reasoningResult,
        });
      }

      const workflowId =
        reasoningResult?.recommendation?.suggestedWorkflow ?? selected.workflowId;

      const preliminaryHandoff: WorkflowHandoff = {
        workflowId,
        requiredModules: selected.requiredModules,
        executionPriority: request.priority,
        objective,
        parameters: {
          requestId: request.requestId,
          type: request.type,
          availableData: request.availableData,
          reasoningId: reasoningResult?.reasoningId,
          recommendedApproach: reasoningResult?.recommendation?.approachId,
        },
        qualityAssessment,
      };

      // Planning Engine — transform approved decision into execution plan
      let planningResult: DecisionResult["planningResult"];
      if (this.planningEngine) {
        planningResult = await this.planningEngine.planFromDecision({
          decisionId,
          requestId: request.requestId,
          planningType: mapDecisionTypeToPlanningType(request.type),
          priority: request.priority,
          objective,
          userRequest: request.userRequest,
          availableData: request.availableData,
          workflowHandoff: preliminaryHandoff,
          reasoningResult,
        });

        if (!planningResult.readyForWorkflow) {
          return this.buildIncompleteResult({
            decisionId,
            request,
            stepsCompleted,
            start,
            missingInformation: planningResult.missingInformation.map((m) => ({
              field: m.field,
              severity: m.severity as "critical" | "important" | "optional",
              message: m.message,
            })),
            recommendations: planningResult.recommendations,
            status: DecisionStatus.AwaitingInput,
            reason: "Planning incomplete — execution plan not ready",
            rationale,
            qualityScore: qualityAssessment.score,
            validation,
            reasoningResult,
            planningResult,
          });
        }
      }

      // Step 12 — Pass the Decision to the AI Workflow Engine
      stepsCompleted.push(DecisionStep.PassToWorkflow);
      const workflowHandoff: WorkflowHandoff = {
        ...preliminaryHandoff,
        parameters: {
          ...preliminaryHandoff.parameters,
          planId: planningResult?.planId,
          executionPlan: planningResult?.executionPlan,
          workflowPlanHandoff: planningResult?.workflowHandoff,
        },
      };

      const record = this.createRecord({
        decisionId,
        request,
        selected,
        rationale,
        qualityScore: qualityAssessment.score,
        status: DecisionStatus.Approved,
        reason: rationale.selectedReason,
      });

      this.history.append(record);

      this.logger.log("info", "decision", "Decision approved and passed to workflow engine", {
        decisionId,
        workflowId: selected.workflowId,
      });

      const durationMs = Math.round(performance.now() - start);
      this.decisionDurations.push(durationMs);

      return {
        decisionId,
        status: DecisionStatus.Approved,
        approved: true,
        canExecute: true,
        missingInformation,
        recommendations: qualityAssessment.recommendations,
        selectedSolution: selected,
        rationale,
        workflowHandoff,
        validation,
        record,
        stepsCompleted,
        durationMs,
        reasoningResult,
        planningResult,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log("error", "error", "Decision failed", { decisionId, error: message });

      if (error instanceof DecisionEngineError && error.missingInformation) {
        throw error;
      }

      throw new DecisionEngineError(message, "DECISION_FAILED");
    } finally {
      this.priorityManager.release(decisionId);
    }
  }

  buildStatusReport(): DecisionEngineStatusReport {
    const total = this.decisionDurations.length;
    const averageDecisionMs =
      total > 0
        ? Math.round(this.decisionDurations.reduce((a, b) => a + b, 0) / total)
        : 0;

    const approved = this.history.getAll().filter((r) => r.status === DecisionStatus.Approved);
    const accuracy =
      total > 0 ? Math.round((approved.length / this.history.getCount()) * 100) : 100;

    const knownIssues: string[] = [];
    if (!this.initialized) {
      knownIssues.push("Decision Engine not initialized");
    }

    const checks = [this.initialized, this.history.getHistoryPath() !== null];
    const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      decisionEngineStatus: this.initialized ? "operational" : "not-initialized",
      decisionAccuracy: accuracy,
      validationStatus: this.initialized ? "ready" : "not-ready",
      performance: { averageDecisionMs, totalDecisions: this.history.getCount() },
      knownIssues,
      readinessScore,
      timestamp: new Date().toISOString(),
    };
  }

  private buildIncompleteResult(input: {
    decisionId: string;
    request: DecisionRequest;
    stepsCompleted: DecisionStep[];
    start: number;
    missingInformation: DecisionResult["missingInformation"];
    recommendations?: string[];
    status: DecisionStatus;
    reason: string;
    rationale?: DecisionRationale;
    qualityScore?: number;
    validation?: DecisionResult["validation"];
    reasoningResult?: DecisionResult["reasoningResult"];
    planningResult?: DecisionResult["planningResult"];
  }): DecisionResult {
    const rationale: DecisionRationale = input.rationale ?? {
      summary: input.reason,
      selectedReason: "No workflow approved",
      rejectedAlternatives: [],
      factorsConsidered: ["validation-or-quality-gate"],
    };

    const record = this.createRecord({
      decisionId: input.decisionId,
      request: input.request,
      rationale,
      qualityScore: input.qualityScore ?? 0,
      status: input.status,
      reason: input.reason,
    });

    this.history.append(record);

    this.logger.log("warn", "decision", input.reason, {
      decisionId: input.decisionId,
      status: input.status,
    });

    const durationMs = Math.round(performance.now() - input.start);
    this.decisionDurations.push(durationMs);

    return {
      decisionId: input.decisionId,
      status: input.status,
      approved: false,
      canExecute: false,
      missingInformation: input.missingInformation,
      recommendations: input.recommendations ?? [],
      rationale,
      validation: input.validation,
      record,
      stepsCompleted: input.stepsCompleted,
      durationMs,
      reasoningResult: input.reasoningResult,
      planningResult: input.planningResult,
    };
  }

  private createRecord(input: {
    decisionId: string;
    request: DecisionRequest;
    selected?: { workflowId: string; id: string; scores: { overall: number } };
    rationale: DecisionRationale;
    qualityScore: number;
    status: DecisionStatus;
    reason: string;
  }): DecisionRecord {
    return {
      decisionId: input.decisionId,
      decisionTime: new Date().toISOString(),
      decisionType: input.request.type,
      reason: input.reason,
      selectedWorkflow: input.selected?.workflowId ?? "none",
      alternativeSolutions: input.rationale.rejectedAlternatives.map((a) => a.id),
      qualityScore: input.qualityScore,
      executionResult: "pending",
      futureLearningValue: input.status === DecisionStatus.Approved ? 80 : 20,
      priority: input.request.priority,
      status: input.status,
      rationale: input.rationale,
      requestId: input.request.requestId,
    };
  }
}
