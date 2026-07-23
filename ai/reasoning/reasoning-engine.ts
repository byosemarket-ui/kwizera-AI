import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { StubKnowledgeSearchProvider } from "../decision/providers/knowledge-search-provider.js";
import { StubMemorySearchProvider } from "../decision/providers/memory-search-provider.js";
import { resolveLogDirectory } from "../../storage/paths/storage-paths.js";
import { ApproachComparator } from "./approach-comparator.js";
import { ApproachGenerator } from "./approach-generator.js";
import { ConfidenceCalculator } from "./confidence-calculator.js";
import { ContextAnalyzer } from "./context-analyzer.js";
import { ErrorAnalyzer } from "./error-analyzer.js";
import { MissingInformationDetector } from "./missing-information-detector.js";
import { ReasoningHistoryStore } from "./reasoning-history-store.js";
import { ReasoningLogger } from "./reasoning-logger.js";
import { RiskEvaluator } from "./risk-evaluator.js";
import {
  ErrorAnalysisInput,
  ErrorAnalysisResult,
  ReasoningEngineError,
  ReasoningEngineStatusReport,
  ReasoningExplanation,
  ReasoningRecommendation,
  ReasoningRecord,
  ReasoningRequest,
  ReasoningResult,
  ReasoningStatus,
  ReasoningStep,
  ReasoningType,
} from "./types.js";

export interface AiReasoningEngineOptions {
  storageRoot: string;
  memoryProvider?: StubMemorySearchProvider;
  knowledgeProvider?: StubKnowledgeSearchProvider;
}

/**
 * KWIZERA AI Reasoning Engine — analysis and explanation before decisions.
 * Step 2C: No AI models. No business module implementations.
 */
export class AiReasoningEngine {
  readonly logger = new ReasoningLogger();
  readonly history = new ReasoningHistoryStore();
  readonly contextAnalyzer = new ContextAnalyzer();
  readonly approachGenerator = new ApproachGenerator();
  readonly approachComparator = new ApproachComparator();
  readonly confidenceCalculator = new ConfidenceCalculator();
  readonly riskEvaluator = new RiskEvaluator();
  readonly missingDetector = new MissingInformationDetector();
  readonly errorAnalyzer = new ErrorAnalyzer();

  private readonly memoryProvider: StubMemorySearchProvider;
  private readonly knowledgeProvider: StubKnowledgeSearchProvider;
  private readonly storageRoot: string;
  private readonly reasoningDurations: number[] = [];
  private initialized = false;
  private core: AiCoreManager | null = null;

  constructor(options: AiReasoningEngineOptions) {
    this.storageRoot = options.storageRoot;
    this.memoryProvider = options.memoryProvider ?? new StubMemorySearchProvider();
    this.knowledgeProvider =
      options.knowledgeProvider ?? new StubKnowledgeSearchProvider();
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    const logDir = resolveLogDirectory(this.storageRoot);
    const reasoningDir = path.join(this.storageRoot, "reasoning");

    this.logger.initialize(logDir);
    this.history.initialize(reasoningDir);
    this.initialized = true;

    this.logger.log("info", "reasoning", "Reasoning Engine initialized", {
      logDirectory: logDir,
      reasoningDirectory: reasoningDir,
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Execute the 12-step reasoning process.
   */
  async reason(request: ReasoningRequest): Promise<ReasoningResult> {
    if (!this.initialized) {
      throw new ReasoningEngineError("Reasoning Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const reasoningId = randomUUID();
    const stepsCompleted: ReasoningStep[] = [];

    try {
      // Step 1 — Receive task
      stepsCompleted.push(ReasoningStep.ReceiveTask);
      this.logger.log("info", "reasoning", "Reasoning task received", {
        reasoningId,
        taskId: request.taskId,
        type: request.type,
      });

      // Step 2 — Understand user objective
      stepsCompleted.push(ReasoningStep.UnderstandObjective);

      // Step 3 — Collect available information
      stepsCompleted.push(ReasoningStep.CollectInformation);
      const inputKeys = Object.keys(request.inputs);

      // Step 4 — Search Memory
      stepsCompleted.push(ReasoningStep.SearchMemory);
      const memoryResult = await this.memoryProvider.search(
        request.userObjective,
        request.inputs
      );

      // Step 5 — Search Knowledge
      stepsCompleted.push(ReasoningStep.SearchKnowledge);
      const knowledgeResult = await this.knowledgeProvider.search(
        request.userObjective,
        request.inputs
      );

      // Step 6 — Analyze context
      stepsCompleted.push(ReasoningStep.AnalyzeContext);
      const contextAnalysis = this.contextAnalyzer.analyze(request, this.core);
      contextAnalysis.factors.push(
        `memory:${memoryResult.found}`,
        `knowledge:${knowledgeResult.found}`,
        `inputs:${inputKeys.join(",") || "none"}`
      );

      const missingInformation = this.missingDetector.detect(request);

      // Step 7 — Generate multiple possible approaches
      stepsCompleted.push(ReasoningStep.GenerateApproaches);
      const approaches = this.approachGenerator.generate(request);

      // Step 8 — Compare advantages and disadvantages
      stepsCompleted.push(ReasoningStep.CompareApproaches);
      const comparison = this.approachComparator.compare(approaches);

      const riskAssessment = this.riskEvaluator.evaluate(request, approaches);
      const improvements = this.buildImprovements(missingInformation, riskAssessment, contextAnalysis);

      // Step 9 — Calculate confidence score
      stepsCompleted.push(ReasoningStep.CalculateConfidence);
      const confidence = this.confidenceCalculator.calculate(
        contextAnalysis,
        approaches,
        missingInformation
      );

      this.logger.log("info", "confidence", confidence.explanation, {
        reasoningId,
        level: confidence.level,
        score: confidence.score,
      });

      if (!confidence.sufficient) {
        return this.buildResult({
          reasoningId,
          request,
          stepsCompleted,
          start,
          contextAnalysis,
          approaches,
          comparison,
          confidence,
          missingInformation,
          riskAssessment,
          improvements,
          status: ReasoningStatus.AwaitingInput,
          readyForDecision: false,
        });
      }

      // Step 10 — Recommend the best solution
      stepsCompleted.push(ReasoningStep.RecommendBest);
      const bestId = comparison.rankedApproachIds[0] ?? approaches[0].id;
      const bestApproach = approaches.find((a) => a.id === bestId) ?? approaches[0];

      const recommendation: ReasoningRecommendation = {
        approachId: bestApproach.id,
        label: bestApproach.label,
        summary: bestApproach.description,
        suggestedWorkflow: bestApproach.suggestedWorkflow,
        improvements,
      };

      // Step 11 — Explain internal reasoning
      stepsCompleted.push(ReasoningStep.ExplainInternally);
      const explanation: ReasoningExplanation = {
        summary: `Recommend ${bestApproach.label} for ${request.type}`,
        whyBest: `Lowest risk among compared approaches (${bestApproach.estimatedRisk}). ${comparison.summary}`,
        rejectedAlternatives: approaches
          .filter((a) => a.id !== bestApproach.id)
          .map((a) => ({
            id: a.id,
            reason: `Higher risk (${a.estimatedRisk}) or lower alignment`,
          })),
        internalNotes: [
          ...contextAnalysis.factors,
          ...confidence.factors,
          `risk:${riskAssessment.overallRisk}`,
        ],
      };

      // Step 12 — Send recommendation to the Decision Engine
      stepsCompleted.push(ReasoningStep.SendToDecisionEngine);
      this.logger.log("info", "recommendation", "Recommendation sent to Decision Engine", {
        reasoningId,
        approachId: recommendation.approachId,
        confidence: confidence.level,
      });

      return this.buildResult({
        reasoningId,
        request,
        stepsCompleted,
        start,
        contextAnalysis,
        approaches,
        comparison,
        confidence,
        missingInformation,
        riskAssessment,
        improvements,
        recommendation,
        explanation,
        status: ReasoningStatus.Complete,
        readyForDecision: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log("error", "error", "Reasoning failed", { reasoningId, error: message });
      throw new ReasoningEngineError(message, "REASONING_FAILED");
    }
  }

  analyzeError(input: ErrorAnalysisInput): ErrorAnalysisResult {
    const result = this.errorAnalyzer.analyze(input);
    this.logger.log("warn", "recovery", result.explanation, {
      rootCause: result.rootCause,
      safestOption: result.safestOptionId,
    });
    return result;
  }

  buildStatusReport(): ReasoningEngineStatusReport {
    const total = this.reasoningDurations.length;
    const averageReasoningMs =
      total > 0
        ? Math.round(this.reasoningDurations.reduce((a, b) => a + b, 0) / total)
        : 0;

    const complete = this.history
      .getAll()
      .filter((r) => r.confidenceScore >= 45);
    const accuracy =
      this.history.getCount() > 0
        ? Math.round((complete.length / this.history.getCount()) * 100)
        : 100;

    const avgConfidence =
      this.history.getCount() > 0
        ? Math.round(
            this.history.getAll().reduce((sum, r) => sum + r.confidenceScore, 0) /
              this.history.getCount()
          )
        : 0;

    const confidenceQuality =
      avgConfidence >= 75 ? "high" : avgConfidence >= 50 ? "medium" : "low";

    const knownIssues: string[] = [];
    if (!this.initialized) {
      knownIssues.push("Reasoning Engine not initialized");
    }

    const checks = [this.initialized, this.history.getHistoryPath() !== null];
    const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      reasoningEngineStatus: this.initialized ? "operational" : "not-initialized",
      reasoningAccuracy: accuracy,
      confidenceQuality,
      performance: {
        averageReasoningMs,
        totalReasonings: this.history.getCount(),
      },
      knownIssues,
      readinessScore,
      timestamp: new Date().toISOString(),
    };
  }

  private buildImprovements(
    missing: ReasoningResult["missingInformation"],
    risk: ReasoningResult["riskAssessment"],
    context: ReasoningResult["contextAnalysis"]
  ): string[] {
    const improvements: string[] = [];
    for (const m of missing) {
      improvements.push(m.message);
    }
    for (const r of risk.risks) {
      improvements.push(r.mitigation);
    }
    if (context.completenessScore < 70) {
      improvements.push("Provide additional context to improve reasoning confidence");
    }
    return [...new Set(improvements)];
  }

  private buildResult(input: {
    reasoningId: string;
    request: ReasoningRequest;
    stepsCompleted: ReasoningStep[];
    start: number;
    contextAnalysis: ReasoningResult["contextAnalysis"];
    approaches: ReasoningResult["approaches"];
    comparison: ReasoningResult["comparison"];
    confidence: ReasoningResult["confidence"];
    missingInformation: ReasoningResult["missingInformation"];
    riskAssessment: ReasoningResult["riskAssessment"];
    improvements: string[];
    recommendation?: ReasoningRecommendation;
    explanation?: ReasoningExplanation;
    status: ReasoningStatus;
    readyForDecision: boolean;
    errorAnalysis?: ErrorAnalysisResult;
  }): ReasoningResult {
    const explanation: ReasoningExplanation = input.explanation ?? {
      summary: input.confidence.explanation,
      whyBest: "Insufficient confidence — no recommendation approved",
      rejectedAlternatives: input.approaches.map((a) => ({
        id: a.id,
        reason: "Confidence too low for approval",
      })),
      internalNotes: input.confidence.factors,
    };

    const record: ReasoningRecord = {
      reasoningId: input.reasoningId,
      task: input.request.userRequest,
      reasoningType: input.request.type,
      inputs: input.request.inputs,
      context: input.contextAnalysis,
      alternatives: input.approaches.map((a) => a.id),
      chosenRecommendation: input.recommendation?.approachId ?? "none",
      confidenceLevel: input.confidence.level,
      confidenceScore: input.confidence.score,
      explanation,
      executionResult: "pending",
      futureLearningValue: input.readyForDecision ? 85 : 25,
      taskId: input.request.taskId,
      timestamp: new Date().toISOString(),
    };

    this.history.append(record);

    if (!input.readyForDecision) {
      this.logger.log("warn", "warning", input.confidence.explanation, {
        reasoningId: input.reasoningId,
      });
    }

    const durationMs = Math.round(performance.now() - input.start);
    this.reasoningDurations.push(durationMs);

    return {
      reasoningId: input.reasoningId,
      status: input.status,
      readyForDecision: input.readyForDecision,
      stepsCompleted: input.stepsCompleted,
      contextAnalysis: input.contextAnalysis,
      approaches: input.approaches,
      comparison: input.comparison,
      confidence: input.confidence,
      recommendation: input.recommendation,
      explanation,
      missingInformation: input.missingInformation,
      riskAssessment: input.riskAssessment,
      errorAnalysis: input.errorAnalysis,
      record,
      durationMs,
    };
  }
}
