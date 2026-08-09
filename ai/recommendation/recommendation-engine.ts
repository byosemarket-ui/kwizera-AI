import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { ProfessionalDecisionResult } from "../decision/professional-decision-types.js";
import type { ProfessionalWorkflowResult } from "../workflow/professional-workflow-types.js";
import { ProfessionalRecommendationMemoryStore } from "./professional-recommendation-memory.js";
import {
  applyRecommendationFeedback,
  buildProfessionalRecommendation,
  recommendationFingerprint,
} from "./professional-recommendation.js";
import type {
  AiMeProfessionalRecommendationAwareness,
  ProfessionalRecommendationHealthReport,
  ProfessionalRecommendationRepairResult,
  ProfessionalRecommendationRequest,
  ProfessionalRecommendationResult,
} from "./professional-recommendation-types.js";

export interface AiRecommendationEngineOptions {
  storageRoot: string;
}

export class RecommendationEngineError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "RecommendationEngineError";
  }
}

/**
 * KWIZERA AI Recommendation Engine — Professional Recommendation Intelligence (Step 5).
 * Consumes professional workflows/decisions. Does not generate media.
 * Does not start Multi-Domain Reasoning.
 */
export class AiRecommendationEngine {
  readonly professionalMemory = new ProfessionalRecommendationMemoryStore();

  private readonly storageRoot: string;
  private readonly professionalDurations: number[] = [];
  private initialized = false;
  private core: AiCoreManager | null = null;
  private lastProfessionalResult: ProfessionalRecommendationResult | null = null;
  private lastProfessionalHealth: ProfessionalRecommendationHealthReport | null = null;
  private readonly professionalResults = new Map<string, ProfessionalRecommendationResult>();

  constructor(options: AiRecommendationEngineOptions) {
    this.storageRoot = options.storageRoot;
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    const recommendationsDir = path.join(this.storageRoot, "recommendations");
    this.professionalMemory.initialize(recommendationsDir);
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Professional Recommendation Intelligence — create explainable KF-grounded recommendations.
   * Does not generate media. Does not start Multi-Domain Reasoning.
   */
  async recommendProfessional(input: ProfessionalRecommendationRequest): Promise<ProfessionalRecommendationResult> {
    if (!this.initialized || !this.core) {
      throw new RecommendationEngineError("Recommendation Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const request = input.request.trim();
    const objective = input.objective?.trim() || request;

    try {
      const foundation = this.core.knowledgeFoundation;
      const workflowEngine = this.core.workflowEngine;
      const decisionEngine = this.core.decisionEngine;
      if (!foundation?.isStartupComplete() || !workflowEngine?.isInitialized()) {
        return this.buildUnsupportedProfessionalRecommendation({
          request,
          objective,
          start,
          reason: "Knowledge Foundation and Workflow Engine must be ready before professional recommendations.",
        });
      }

      let workflow: ProfessionalWorkflowResult | null = null;
      if (input.workflowId) {
        const last = workflowEngine.getLastProfessionalWorkflow();
        if (last?.workflowId === input.workflowId) workflow = last;
        const historyMatch = workflowEngine
          .getProfessionalWorkflowHistory()
          .find((item) => item.workflowId === input.workflowId);
        if (!workflow && historyMatch) {
          workflow = workflowEngine.reuseProfessionalWorkflow(historyMatch.goal, historyMatch.domainsUsed);
        }
      }
      if (!workflow) {
        workflow = await workflowEngine.createProfessionalWorkflow({
          request,
          objective,
          context: input.context ?? {},
          requiredDomains: input.requiredDomains,
          constraints: input.constraints,
          availableResources: input.availableResources,
          includeDomainModules: input.includeDomainModules !== false,
          reuseSimilarWorkflows: true,
        });
      }

      if (!workflow.grounded || workflow.unsupported) {
        return this.buildUnsupportedProfessionalRecommendation({
          request,
          objective,
          start,
          reason: "Professional recommendation refused because the upstream workflow is unsupported by verified knowledge.",
          workflowId: workflow.workflowId,
        });
      }

      let decision: ProfessionalDecisionResult | null = null;
      if (decisionEngine?.isInitialized()) {
        const last = decisionEngine.getLastProfessionalDecision();
        if (last && (last.decisionId === workflow.relatedDecisionId || !workflow.relatedDecisionId)) {
          decision = last;
        }
      }

      const domains = Array.from(new Set([...workflow.explanation.domainsUsed, ...(input.requiredDomains ?? [])]));
      // Must match buildAlternatives rank-1 summary used for stored fingerprints.
      const rankedOptions = (decision?.framework.availableOptions ?? [])
        .slice()
        .sort((a, b) => b.confidenceScore - a.confidenceScore);
      const selectedOption = rankedOptions.find((option) => option.selected) ?? rankedOptions[0];
      const provisionalSolution =
        selectedOption?.guidance ??
        decision?.framework.finalRecommendation ??
        `Follow professional workflow "${workflow.definition.workflowName}" grounded in verified knowledge.`;
      const fingerprint = recommendationFingerprint(workflow.definition.goal || objective, domains, provisionalSolution);
      const exactMatch =
        input.reuseSimilarRecommendations === false
          ? null
          : this.professionalMemory.findByFingerprint(fingerprint);
      const similar =
        input.reuseSimilarRecommendations === false
          ? []
          : this.professionalMemory.findSimilar(objective, domains, 5);
      const priorWorkflowIds = workflow.memoryRecord.priorWorkflowIds ?? [];

      const built = buildProfessionalRecommendation({
        request: input,
        workflow,
        decision,
        similarRecommendations: similar,
        exactMatch,
        priorWorkflowIds,
      });

      const durationMs = Math.round(performance.now() - start);
      this.professionalDurations.push(durationMs);
      const result: ProfessionalRecommendationResult = { ...built, durationMs };
      if (!result.reused) this.professionalMemory.append(result.memoryRecord);
      else this.professionalMemory.update(result.memoryRecord);
      this.professionalResults.set(result.recommendationId, structuredClone(result));
      this.lastProfessionalResult = structuredClone(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new RecommendationEngineError(message, "PROFESSIONAL_RECOMMENDATION_FAILED");
    }
  }

  explainProfessionalRecommendation(recommendationId: string): ProfessionalRecommendationResult["explanation"] & {
    recommendationId: string;
    objective: string;
    recommendedSolution: string;
  } {
    const current = this.requireProfessionalRecommendation(recommendationId);
    return {
      recommendationId: current.recommendationId,
      objective: current.objective,
      recommendedSolution: current.framework.recommendedSolution,
      ...current.explanation,
    };
  }

  recordProfessionalRecommendationFeedback(recommendationId: string, feedback: string): ProfessionalRecommendationResult {
    const current = this.requireProfessionalRecommendation(recommendationId);
    const updated = applyRecommendationFeedback(current, feedback, this.professionalMemory);
    this.professionalResults.set(updated.recommendationId, structuredClone(updated));
    this.lastProfessionalResult = structuredClone(updated);
    return updated;
  }

  reuseProfessionalRecommendation(goal: string, domains: string[] = []): ProfessionalRecommendationResult | null {
    const similar = this.professionalMemory.findSimilar(goal, domains, 1)[0];
    if (!similar) return null;
    const existing = this.professionalResults.get(similar.recommendationId);
    return existing ? structuredClone(existing) : null;
  }

  getAiMeProfessionalRecommendationAwareness(): AiMeProfessionalRecommendationAwareness {
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const workflowReady = Boolean(this.core?.workflowEngine?.isInitialized());
    return {
      available: this.initialized && foundationReady && workflowReady,
      enabled: this.initialized && foundationReady && workflowReady,
      summary:
        "AI Me can recommend professional workflows, camera/lighting/storytelling/editing/rendering/marketing strategies with Knowledge Foundation evidence, ranked alternatives, and explainable confidence. Multi-Domain Reasoning is available via the Multi-Domain Engine.",
      capabilities: [
        "recommend professional workflows",
        "recommend professional camera settings",
        "recommend lighting setups",
        "recommend storytelling strategies",
        "recommend editing techniques",
        "recommend rendering settings",
        "recommend marketing strategies",
        "explain every recommendation",
      ],
      groundedInKnowledgeFoundation: true,
      multiDomainReasoningEnabled: true,
      recommendationHistoryCount: this.professionalMemory.getCount(),
      lastConfidenceScore: this.lastProfessionalResult?.confidenceScore ?? null,
    };
  }

  getLastProfessionalRecommendation(): ProfessionalRecommendationResult | null {
    return this.lastProfessionalResult ? structuredClone(this.lastProfessionalResult) : null;
  }

  getProfessionalRecommendationHistory() {
    return this.professionalMemory.getAll().map((record) => structuredClone(record));
  }

  async runProfessionalRecommendationHealthCheck(): Promise<ProfessionalRecommendationHealthReport> {
    const issues: string[] = [];
    if (!this.initialized) issues.push("Recommendation Engine is not initialized.");
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const workflowReady = Boolean(this.core?.workflowEngine?.isInitialized());
    if (!foundationReady) issues.push("Knowledge Foundation startup is incomplete.");
    if (!workflowReady) issues.push("Workflow Engine is not ready.");
    const memoryWritable = this.professionalMemory.ensureWritable();
    if (!memoryWritable) issues.push("Professional recommendation memory is not writable.");

    let canRecommend = false;
    if (this.initialized && foundationReady && workflowReady) {
      try {
        const sample =
          this.lastProfessionalResult?.grounded && this.lastProfessionalResult.framework.alternativeSolutions.length > 0
            ? this.lastProfessionalResult
            : await this.recommendProfessional({
                request: "recommend a professional camera lighting marketing product advertisement approach",
                objective: "Recommend a knowledge-backed product ad approach",
                context: { product: "demo product", audience: "general buyers" },
                requiredDomains: ["camera-knowledge", "lighting-knowledge", "marketing-knowledge", "industry-standards-knowledge"],
                includeDomainModules: true,
                reuseSimilarRecommendations: true,
              });
        canRecommend =
          sample.grounded &&
          !sample.unsupported &&
          Boolean(sample.framework.recommendedSolution) &&
          sample.framework.alternativeSolutions.length >= 2 &&
          sample.explanation.knowledgePacksUsed.length + sample.explanation.knowledgeIdsUsed.length > 0;
        if (!sample.grounded) issues.push("Sample professional recommendation was not grounded.");
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }

    const report: ProfessionalRecommendationHealthReport = {
      healthy: issues.length === 0 && canRecommend && memoryWritable,
      initialized: this.initialized,
      foundationReady,
      workflowReady,
      canRecommend,
      memoryWritable,
      issues,
      checkedAt: new Date().toISOString(),
    };
    this.lastProfessionalHealth = report;
    return structuredClone(report);
  }

  async repairProfessionalRecommendationIntelligence(): Promise<ProfessionalRecommendationRepairResult> {
    const actions: string[] = [];
    if (this.professionalMemory.ensureWritable()) actions.push("Ensured professional recommendation memory is writable.");
    const health = await this.runProfessionalRecommendationHealthCheck();
    if (!health.healthy && this.core?.knowledgeFoundation?.isStartupComplete() && this.core.workflowEngine) {
      await this.recommendProfessional({
        request: "professional recommendation sample for video production marketing",
        objective: "Validate professional recommendation path",
        includeDomainModules: true,
        reuseSimilarRecommendations: true,
      });
      actions.push("Re-ran grounded professional recommendation sample.");
    }
    const recheck = await this.runProfessionalRecommendationHealthCheck();
    return { repaired: recheck.healthy, actions, remainingIssues: recheck.issues };
  }

  private requireProfessionalRecommendation(recommendationId: string): ProfessionalRecommendationResult {
    const current = this.professionalResults.get(recommendationId);
    if (!current) {
      throw new RecommendationEngineError(`Professional recommendation not found: ${recommendationId}`, "RECOMMENDATION_NOT_FOUND");
    }
    return current;
  }

  private buildUnsupportedProfessionalRecommendation(input: {
    request: string;
    objective: string;
    start: number;
    reason: string;
    workflowId?: string;
  }): ProfessionalRecommendationResult {
    const recommendationId = randomUUID();
    const memoryRecord = {
      recommendationId,
      context: {
        request: input.request,
        objective: input.objective,
        constraints: [],
        availableResources: [],
        missingInformation: [input.reason],
      },
      knowledgeUsed: [],
      relatedWorkflowId: input.workflowId ?? null,
      relatedDecisionId: null,
      relatedPlanId: null,
      recommendedSolution: "",
      alternativeTitles: [],
      confidenceScore: 0,
      userFeedback: null,
      timestamp: new Date().toISOString(),
      relatedKnowledgePacks: [],
      domainsUsed: [],
      priorRecommendationIds: [],
      grounded: false,
      fingerprint: recommendationFingerprint(input.objective, [], input.reason),
    };
    const result: ProfessionalRecommendationResult = {
      recommendationId,
      available: false,
      grounded: false,
      unsupported: true,
      reused: false,
      objective: input.objective,
      framework: {
        objective: input.objective,
        recommendedSolution: "",
        alternativeSolutions: [],
        advantages: [],
        disadvantages: [input.reason],
        risks: ["Unsupported recommendation must not be executed"],
        bestPractices: [],
        expectedResults: [],
        professionalStandards: ["Never generate unsupported recommendations"],
        confidenceScore: 0,
      },
      explanation: {
        whySelected: input.reason,
        knowledgePacksUsed: [],
        knowledgeIdsUsed: [],
        workflowsConsidered: input.workflowId ? [input.workflowId] : [],
        decisionsInfluenced: [],
        professionalStandardsApplied: ["Knowledge Foundation grounding required"],
        expectedBenefits: [],
        domainsUsed: [],
        rankingReason: "No ranked alternatives without grounded evidence.",
        confidenceScore: 0,
      },
      confidenceScore: 0,
      confidenceExplanation: "Unsupported recommendation confidence 0/100.",
      memoryRecord,
      relatedWorkflowId: input.workflowId ?? null,
      relatedDecisionId: null,
      relatedPlanId: null,
      multiDomain: false,
      missingInformation: [{ field: "knowledge", severity: "critical", reason: input.reason }],
      durationMs: Math.round(performance.now() - input.start),
    };
    this.professionalResults.set(recommendationId, structuredClone(result));
    this.lastProfessionalResult = structuredClone(result);
    return result;
  }
}
