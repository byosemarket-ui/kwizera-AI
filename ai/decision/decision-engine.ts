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
import { ProfessionalDecisionMemoryStore } from "./professional-decision-memory.js";
import { StubKnowledgeSearchProvider, type KnowledgeSearchProvider } from "./providers/knowledge-search-provider.js";
import { StubMemorySearchProvider, type MemorySearchProvider } from "./providers/memory-search-provider.js";
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
import type {
  AiMeProfessionalDecisionAwareness,
  ProfessionalDecisionFramework,
  ProfessionalDecisionHealthReport,
  ProfessionalDecisionMemoryRecord,
  ProfessionalDecisionOption,
  ProfessionalDecisionRepairResult,
  ProfessionalDecisionRequest,
  ProfessionalDecisionResult,
} from "./professional-decision-types.js";
import type { AiReasoningEngine } from "../reasoning/reasoning-engine.js";
import { mapDecisionTypeToReasoningType } from "../reasoning/decision-type-mapper.js";
import type { AiPlanningEngine } from "../planning/planning-engine.js";
import { mapDecisionTypeToPlanningType } from "../planning/decision-type-mapper.js";
import type { ProfessionalKnowledgeReasoningResult } from "../knowledge-reasoning-engine/types.js";

export interface AiDecisionEngineOptions {
  storageRoot: string;
  memoryProvider?: MemorySearchProvider;
  knowledgeProvider?: KnowledgeSearchProvider;
}

/**
 * KWIZERA AI Decision Engine — central intelligent decision authority.
 * Workflow decide() remains Step 2B authority. decideProfessional() adds
 * Knowledge-Foundation Decision Intelligence (Step 2) without duplicating reasoning logic.
 */
export class AiDecisionEngine {
  readonly logger = new DecisionLogger();
  readonly history = new DecisionHistoryStore();
  readonly professionalMemory = new ProfessionalDecisionMemoryStore();
  readonly priorityManager = new DecisionPriorityManager();
  readonly qualityEvaluator = new QualityEvaluator();
  readonly solutionGenerator = new SolutionGenerator();
  readonly solutionScorer = new SolutionScorer();
  readonly validator = new DecisionValidator();

  private readonly memoryProvider: MemorySearchProvider;
  private readonly knowledgeProvider: KnowledgeSearchProvider;
  private readonly storageRoot: string;
  private readonly decisionDurations: number[] = [];
  private readonly professionalDecisionDurations: number[] = [];
  private initialized = false;
  private core: AiCoreManager | null = null;
  private reasoningEngine: AiReasoningEngine | null = null;
  private planningEngine: AiPlanningEngine | null = null;
  private lastProfessionalResult: ProfessionalDecisionResult | null = null;
  private lastProfessionalHealth: ProfessionalDecisionHealthReport | null = null;

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
    this.professionalMemory.initialize(decisionsDir);
    this.initialized = true;

    this.logger.log("info", "decision", "Decision Engine initialized", {
      logDirectory: logDir,
      decisionsDirectory: decisionsDir,
      professionalDecisionMemory: this.professionalMemory.getMemoryPath(),
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

  /**
   * Professional Decision Intelligence — knowledge-foundation grounded decisions.
   * Consumes AiKnowledgeReasoningEngine.reasonProfessional(); does not generate media
   * and does not invoke Planning Intelligence.
   */
  async decideProfessional(input: ProfessionalDecisionRequest): Promise<ProfessionalDecisionResult> {
    if (!this.initialized || !this.core) {
      throw new DecisionEngineError("Decision Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const decisionId = randomUUID();
    const request = input.request.trim();
    const objective = input.objective?.trim() || request;
    const constraints = uniqueStrings([
      ...(input.constraints ?? []),
      ...detectConstraints(request, input.context ?? {}),
    ]);
    const availableResources = uniqueStrings([
      ...(input.availableResources ?? []),
      ...detectResources(input.context ?? {}),
    ]);

    this.priorityManager.acquire(DecisionPriority.Normal, decisionId);

    try {
      const foundation = this.core.knowledgeFoundation;
      if (!foundation?.isStartupComplete()) {
        return this.buildUnsupportedProfessionalDecision({
          decisionId,
          request,
          objective,
          constraints,
          availableResources,
          start,
          reason: "Knowledge Foundation is not ready — professional decisions require verified knowledge.",
        });
      }

      const reasoningEngine = foundation.getKnowledgeReasoningEngine();
      const professionalReasoning = await reasoningEngine.reasonProfessional({
        request,
        objective,
        context: input.context ?? {},
        requiredDomains: input.requiredDomains,
        limit: input.limit ?? 12,
        includeDomainModules: input.includeDomainModules !== false,
      });

      if (!professionalReasoning.grounded || !professionalReasoning.selected) {
        return this.buildUnsupportedProfessionalDecision({
          decisionId,
          request,
          objective,
          constraints,
          availableResources,
          start,
          reason: "No verified Knowledge Foundation evidence supports this decision.",
          professionalReasoning,
        });
      }

      const similar = this.professionalMemory.findSimilar(objective, professionalReasoning.domainsUsed, 5);
      const learnedFromHistory = similar.length > 0;
      const historyBoost = learnedFromHistory
        ? Math.min(6, similar.filter((item) => item.finalDecision === professionalReasoning.selected?.guidance).length * 2)
        : 0;

      const options = buildProfessionalOptions(professionalReasoning);
      const selectedOption = options.find((option) => option.selected) ?? options[0];
      const confidenceScore = clamp(
        Math.round(professionalReasoning.confidenceScore + historyBoost - constraintsPenalty(constraints, professionalReasoning)),
        0,
        100
      );

      const bestPractices = uniqueStrings([
        ...professionalReasoning.improvements,
        ...professionalReasoning.decisionRules.slice(0, 6),
        ...professionalReasoning.knowledgeUsed.flatMap((item) => item.guidance ? [item.guidance] : []).slice(0, 2),
      ]).slice(0, 10);

      const framework: ProfessionalDecisionFramework = {
        objective,
        availableOptions: options,
        advantages: uniqueStrings(options.flatMap((option) => option.advantages)).slice(0, 8),
        disadvantages: uniqueStrings(options.flatMap((option) => option.disadvantages)).slice(0, 8),
        risks: uniqueStrings([...professionalReasoning.risks, ...options.flatMap((option) => option.risks)]).slice(0, 8),
        professionalStandards: professionalReasoning.professionalStandards.slice(0, 12),
        bestPractices,
        confidenceScore,
        finalRecommendation: selectedOption?.guidance ?? professionalReasoning.selected.guidance,
      };

      const knowledgePacksUsed = uniqueStrings([
        ...professionalReasoning.domainContributions.map((item) => item.sourceModule),
        ...professionalReasoning.knowledgeUsed.map((item) => item.source),
        ...professionalReasoning.domainsUsed,
      ]);

      const explanation = {
        whySelected: professionalReasoning.explanation,
        knowledgePacksUsed,
        knowledgeIdsUsed: uniqueStrings([
          ...professionalReasoning.knowledgeUsed.map((item) => item.knowledgeId),
          ...professionalReasoning.relatedKnowledgeIds,
        ]),
        professionalStandardsApplied: framework.professionalStandards,
        alternativesRejected: professionalReasoning.rejectedOptions.map((option) => ({
          title: option.title,
          reason: option.rejectionReason ?? option.reason,
        })),
        expectedOutcome: buildExpectedOutcome(selectedOption, framework, similar),
        domainsUsed: professionalReasoning.domainsUsed,
      };

      const memoryRecord: ProfessionalDecisionMemoryRecord = {
        decisionId,
        context: {
          request,
          objective,
          constraints,
          availableResources,
          missingInformation: professionalReasoning.missingInformation.map((item) => item.field),
        },
        knowledgeUsed: professionalReasoning.knowledgeUsed.map((item) => ({
          knowledgeId: item.knowledgeId,
          title: item.title,
          domain: item.domain,
          source: item.source,
        })),
        reasoningPath: professionalReasoning.processSteps.map((step) => `${step.step}. ${step.name}: ${step.detail}`),
        finalDecision: framework.finalRecommendation,
        confidenceScore,
        timestamp: new Date().toISOString(),
        relatedKnowledgePacks: knowledgePacksUsed,
        domainsUsed: professionalReasoning.domainsUsed,
        priorDecisionIds: similar.map((item) => item.decisionId),
        grounded: true,
      };

      this.professionalMemory.append(memoryRecord);

      const durationMs = Math.round(performance.now() - start);
      this.professionalDecisionDurations.push(durationMs);

      const result: ProfessionalDecisionResult = {
        decisionId,
        available: true,
        grounded: true,
        unsupported: false,
        objective,
        constraints,
        availableResources,
        missingInformation: professionalReasoning.missingInformation.map((item) => ({
          field: item.field,
          severity: item.severity,
          reason: item.reason,
        })),
        framework,
        explanation,
        confidenceScore,
        confidenceExplanation: `${professionalReasoning.confidenceExplanation} Decision Intelligence confidence ${confidenceScore}/100${
          learnedFromHistory ? ` after consulting ${similar.length} prior professional decision(s).` : "."
        }`,
        memoryRecord,
        professionalReasoningAvailable: true,
        multiDomain: professionalReasoning.multiDomain,
        learnedFromHistory,
        durationMs,
      };

      this.lastProfessionalResult = structuredClone(result);
      this.logger.log("info", "decision", "Professional decision recorded", {
        decisionId,
        confidenceScore,
        grounded: true,
        domains: professionalReasoning.domainsUsed,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log("error", "error", "Professional decision failed", { decisionId, error: message });
      throw new DecisionEngineError(message, "PROFESSIONAL_DECISION_FAILED");
    } finally {
      this.priorityManager.release(decisionId);
    }
  }

  getAiMeProfessionalDecisionAwareness(): AiMeProfessionalDecisionAwareness {
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    return {
      available: this.initialized && foundationReady,
      enabled: this.initialized && foundationReady,
      summary:
        "AI Me can make professional, explainable decisions using the Knowledge Foundation and Professional Reasoning Engine. Every decision records objective, options, risks, standards, confidence, and memory for future learning. Planning Intelligence is available through the Planning Engine (planProfessional). Workflow Intelligence is not enabled in this step.",
      capabilities: [
        "make professional decisions",
        "compare multiple solutions",
        "recommend the best workflow",
        "explain every decision",
        "improve future decisions using decision history",
      ],
      groundedInKnowledgeFoundation: true,
      planningIntelligenceEnabled: true,
      decisionHistoryCount: this.professionalMemory.getCount(),
      lastConfidenceScore: this.lastProfessionalResult?.confidenceScore ?? null,
    };
  }

  getLastProfessionalDecision(): ProfessionalDecisionResult | null {
    return this.lastProfessionalResult ? structuredClone(this.lastProfessionalResult) : null;
  }

  getProfessionalDecisionHistory(): ProfessionalDecisionMemoryRecord[] {
    return this.professionalMemory.getAll().map((record) => structuredClone(record));
  }

  async runProfessionalDecisionHealthCheck(): Promise<ProfessionalDecisionHealthReport> {
    const issues: string[] = [];
    if (!this.initialized) issues.push("Decision Engine is not initialized.");
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    if (!foundationReady) issues.push("Knowledge Foundation startup is incomplete.");
    const memoryWritable = this.professionalMemory.ensureWritable();
    if (!memoryWritable) issues.push("Professional decision memory is not writable.");

    let canDecide = false;
    if (this.initialized && foundationReady) {
      try {
        const sample =
          this.lastProfessionalResult?.grounded && this.lastProfessionalResult.confidenceScore > 0
            ? this.lastProfessionalResult
            : await this.decideProfessional({
                request: "recommend professional camera lighting for a product advertisement",
                objective: "Select a knowledge-backed lighting decision",
                context: { product: "demo product", audience: "general buyers" },
                requiredDomains: ["camera-knowledge", "lighting-knowledge", "industry-standards-knowledge"],
                includeDomainModules: true,
              });
        canDecide = sample.grounded && !sample.unsupported && Boolean(sample.framework.finalRecommendation);
        if (!sample.grounded) issues.push("Sample professional decision was not grounded.");
        if (!sample.explanation.whySelected) issues.push("Sample professional decision explanation is empty.");
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }

    const report: ProfessionalDecisionHealthReport = {
      healthy: issues.length === 0 && canDecide && memoryWritable,
      initialized: this.initialized,
      foundationReady,
      canDecide,
      memoryWritable,
      issues,
      checkedAt: new Date().toISOString(),
    };
    this.lastProfessionalHealth = report;
    return structuredClone(report);
  }

  async repairProfessionalDecisionIntelligence(): Promise<ProfessionalDecisionRepairResult> {
    const actions: string[] = [];
    if (this.professionalMemory.ensureWritable()) {
      actions.push("Ensured professional decision memory is writable.");
    }
    const health = await this.runProfessionalDecisionHealthCheck();
    if (!health.healthy && this.core?.knowledgeFoundation?.isStartupComplete()) {
      await this.decideProfessional({
        request: "professional video production workflow decision",
        objective: "Validate professional decision path",
        includeDomainModules: true,
      });
      actions.push("Re-ran grounded professional decision sample.");
    }
    const recheck = await this.runProfessionalDecisionHealthCheck();
    return {
      repaired: recheck.healthy,
      actions,
      remainingIssues: recheck.issues,
    };
  }

  getLastProfessionalDecisionHealth(): ProfessionalDecisionHealthReport | null {
    return this.lastProfessionalHealth ? structuredClone(this.lastProfessionalHealth) : null;
  }

  buildStatusReport(): DecisionEngineStatusReport {
    const total = this.decisionDurations.length;
    const averageDecisionMs =
      total > 0
        ? Math.round(this.decisionDurations.reduce((a, b) => a + b, 0) / total)
        : 0;

    const approved = this.history.getAll().filter((r) => r.status === DecisionStatus.Approved);
    const accuracy =
      total > 0 ? Math.round((approved.length / Math.max(1, this.history.getCount())) * 100) : 100;

    const knownIssues: string[] = [];
    if (!this.initialized) {
      knownIssues.push("Decision Engine not initialized");
    }
    if (!this.core?.knowledgeFoundation?.isStartupComplete()) {
      knownIssues.push("Professional Decision Intelligence waiting on Knowledge Foundation");
    }

    const checks = [
      this.initialized,
      this.history.getHistoryPath() !== null,
      this.professionalMemory.isReady(),
    ];
    const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      decisionEngineStatus: this.initialized ? "operational" : "not-initialized",
      decisionAccuracy: accuracy,
      validationStatus: this.initialized ? "ready" : "not-ready",
      performance: {
        averageDecisionMs,
        totalDecisions: this.history.getCount() + this.professionalMemory.getCount(),
      },
      knownIssues,
      readinessScore,
      timestamp: new Date().toISOString(),
    };
  }

  private buildUnsupportedProfessionalDecision(input: {
    decisionId: string;
    request: string;
    objective: string;
    constraints: string[];
    availableResources: string[];
    start: number;
    reason: string;
    professionalReasoning?: ProfessionalKnowledgeReasoningResult;
  }): ProfessionalDecisionResult {
    const memoryRecord: ProfessionalDecisionMemoryRecord = {
      decisionId: input.decisionId,
      context: {
        request: input.request,
        objective: input.objective,
        constraints: input.constraints,
        availableResources: input.availableResources,
        missingInformation: input.professionalReasoning?.missingInformation.map((item) => item.field) ?? [
          "verified-knowledge",
        ],
      },
      knowledgeUsed: [],
      reasoningPath: input.professionalReasoning?.processSteps.map((step) => `${step.step}. ${step.name}`) ?? [
        "1. Understand the request",
        "2. Knowledge Foundation unavailable or ungrounded",
      ],
      finalDecision: input.reason,
      confidenceScore: 0,
      timestamp: new Date().toISOString(),
      relatedKnowledgePacks: [],
      domainsUsed: input.professionalReasoning?.domainsUsed ?? [],
      priorDecisionIds: [],
      grounded: false,
    };
    this.professionalMemory.append(memoryRecord);

    const durationMs = Math.round(performance.now() - input.start);
    this.professionalDecisionDurations.push(durationMs);

    const result: ProfessionalDecisionResult = {
      decisionId: input.decisionId,
      available: false,
      grounded: false,
      unsupported: true,
      objective: input.objective,
      constraints: input.constraints,
      availableResources: input.availableResources,
      missingInformation: input.professionalReasoning?.missingInformation.map((item) => ({
        field: item.field,
        severity: item.severity,
        reason: item.reason,
      })) ?? [{ field: "verified-knowledge", severity: "critical", reason: input.reason }],
      framework: {
        objective: input.objective,
        availableOptions: [],
        advantages: [],
        disadvantages: [],
        risks: [input.reason],
        professionalStandards: input.professionalReasoning?.professionalStandards ?? [],
        bestPractices: [],
        confidenceScore: 0,
        finalRecommendation: input.reason,
      },
      explanation: {
        whySelected: input.reason,
        knowledgePacksUsed: [],
        knowledgeIdsUsed: [],
        professionalStandardsApplied: [],
        alternativesRejected: [],
        expectedOutcome: "No professional decision can be issued without Knowledge Foundation evidence.",
        domainsUsed: input.professionalReasoning?.domainsUsed ?? [],
      },
      confidenceScore: 0,
      confidenceExplanation: "Confidence is 0 because the decision is unsupported by verified knowledge.",
      memoryRecord,
      professionalReasoningAvailable: Boolean(input.professionalReasoning),
      multiDomain: Boolean(input.professionalReasoning?.multiDomain),
      learnedFromHistory: false,
      durationMs,
    };
    this.lastProfessionalResult = structuredClone(result);
    return result;
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

function buildProfessionalOptions(reasoning: ProfessionalKnowledgeReasoningResult): ProfessionalDecisionOption[] {
  const fromConsidered = reasoning.consideredOptions.map((option, index) => ({
    optionId: option.knowledgeId || `option-${index + 1}`,
    title: option.title,
    domain: option.domain,
    guidance: option.guidance,
    advantages: option.advantages,
    disadvantages: option.disadvantages,
    risks: option.disadvantages.slice(0, 2),
    confidenceScore: option.confidenceScore,
    selected: option.selected,
    rejectionReason: option.rejectionReason,
    knowledgeId: option.knowledgeId,
  }));
  if (fromConsidered.length > 0) return fromConsidered;
  if (!reasoning.selected) return [];
  return [
    {
      optionId: reasoning.selected.knowledgeId,
      title: reasoning.selected.knowledgeId,
      domain: reasoning.domainsUsed[0] ?? "knowledge-foundation",
      guidance: reasoning.selected.guidance,
      advantages: reasoning.improvements.slice(0, 3),
      disadvantages: reasoning.risks.slice(0, 2),
      risks: reasoning.risks.slice(0, 2),
      confidenceScore: reasoning.confidenceScore,
      selected: true,
      knowledgeId: reasoning.selected.knowledgeId,
    },
  ];
}

function buildExpectedOutcome(
  selected: ProfessionalDecisionOption | undefined,
  framework: ProfessionalDecisionFramework,
  similar: ProfessionalDecisionMemoryRecord[]
): string {
  const base = selected
    ? `Applying ${selected.title} is expected to follow stored professional standards with confidence ${framework.confidenceScore}/100.`
    : `No grounded option is available.`;
  if (!similar.length) return base;
  return `${base} Consistent with ${similar.length} prior professional decision(s) in related domains.`;
}

function detectConstraints(request: string, context: Record<string, unknown>): string[] {
  const constraints: string[] = [];
  const text = request.toLowerCase();
  if (/\bbudget|low cost|cheap\b/.test(text) || context.budget) constraints.push("budget");
  if (/\bdeadline|urgent|asap|time.?limit\b/.test(text) || context.deadline) constraints.push("time");
  if (/\bmobile|phone|vertical\b/.test(text) || context.platform) constraints.push("platform-format");
  if (/\boffline|no internet\b/.test(text)) constraints.push("offline-only");
  if (context.brandVoice || context.brand) constraints.push("brand-voice");
  return constraints;
}

function detectResources(context: Record<string, unknown>): string[] {
  const resources: string[] = [];
  if (context.product || context.productName) resources.push("product-context");
  if (context.audience || context.targetAudience) resources.push("audience-context");
  if (context.platform || context.channel) resources.push("delivery-platform");
  if (context.brand || context.brandVoice) resources.push("brand-context");
  if (context.footage || context.assets) resources.push("existing-assets");
  return resources;
}

function constraintsPenalty(
  constraints: string[],
  reasoning: ProfessionalKnowledgeReasoningResult
): number {
  const importantMissing = reasoning.missingInformation.filter((item) => item.severity === "important").length;
  return constraints.length * 1 + importantMissing * 2;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
