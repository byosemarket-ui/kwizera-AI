import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { ProfessionalRecommendationResult } from "../recommendation/professional-recommendation-types.js";
import { ProfessionalMultiDomainMemoryStore } from "./professional-multi-domain-memory.js";
import {
  buildProfessionalMultiDomainReasoning,
  detectRelevantDomains,
  multiDomainFingerprint,
} from "./professional-multi-domain.js";
import type {
  AiMeProfessionalMultiDomainAwareness,
  ProfessionalMultiDomainHealthReport,
  ProfessionalMultiDomainRepairResult,
  ProfessionalMultiDomainRequest,
  ProfessionalMultiDomainResult,
} from "./professional-multi-domain-types.js";

export interface AiMultiDomainEngineOptions {
  storageRoot: string;
}

export class MultiDomainEngineError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "MultiDomainEngineError";
  }
}

/**
 * KWIZERA AI Multi-Domain Reasoning Engine (Step 6).
 * Combines Knowledge Foundation domains before professional decisions.
 * Consumes Recommendation Intelligence. Does not generate media.
 * Does not start Self-Review & Professional Evaluation.
 */
export class AiMultiDomainEngine {
  readonly professionalMemory = new ProfessionalMultiDomainMemoryStore();

  private readonly storageRoot: string;
  private initialized = false;
  private core: AiCoreManager | null = null;
  private lastProfessionalResult: ProfessionalMultiDomainResult | null = null;
  private readonly professionalResults = new Map<string, ProfessionalMultiDomainResult>();

  constructor(options: AiMultiDomainEngineOptions) {
    this.storageRoot = options.storageRoot;
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    this.professionalMemory.initialize(path.join(this.storageRoot, "multi-domain"));
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Professional Multi-Domain Reasoning — combine domains, resolve conflicts, explain.
   */
  async reasonMultiDomain(input: ProfessionalMultiDomainRequest): Promise<ProfessionalMultiDomainResult> {
    if (!this.initialized || !this.core) {
      throw new MultiDomainEngineError("Multi-Domain Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const request = input.request.trim();
    const objective = input.objective?.trim() || request;

    try {
      const foundation = this.core.knowledgeFoundation;
      const recommendationEngine = this.core.recommendationEngine;
      if (!foundation?.isStartupComplete() || !recommendationEngine?.isInitialized()) {
        return this.buildUnsupported({
          request,
          objective,
          start,
          reason: "Knowledge Foundation and Recommendation Engine must be ready before multi-domain reasoning.",
        });
      }

      const requiredDomains = detectRelevantDomains(
        `${request} ${objective}`,
        input.requiredDomains ?? []
      );

      let recommendation: ProfessionalRecommendationResult | null = null;
      if (input.recommendationId) {
        const last = recommendationEngine.getLastProfessionalRecommendation();
        if (last?.recommendationId === input.recommendationId) recommendation = last;
      }
      if (!recommendation) {
        recommendation = await recommendationEngine.recommendProfessional({
          request,
          objective,
          context: input.context ?? {},
          requiredDomains,
          constraints: input.constraints,
          availableResources: input.availableResources,
          includeDomainModules: input.includeDomainModules !== false,
          reuseSimilarRecommendations: true,
        });
      }

      if (!recommendation.grounded || recommendation.unsupported) {
        return this.buildUnsupported({
          request,
          objective,
          start,
          reason: "Multi-domain reasoning refused because the upstream recommendation is unsupported by verified knowledge.",
          recommendationId: recommendation.recommendationId,
        });
      }

      if (recommendation.explanation.domainsUsed.length < 2 && requiredDomains.length < 2) {
        return this.buildUnsupported({
          request,
          objective,
          start,
          reason: "Multi-domain reasoning requires multiple relevant Knowledge Domains; single-domain requests should use Recommendation Intelligence.",
          recommendationId: recommendation.recommendationId,
        });
      }

      const domains = Array.from(
        new Set([...recommendation.explanation.domainsUsed, ...requiredDomains, ...(input.requiredDomains ?? [])])
      );
      const provisional =
        recommendation.framework.recommendedSolution ||
        "Multi-domain professional solution grounded in Knowledge Foundation";
      const fingerprint = multiDomainFingerprint(recommendation.objective || objective, domains, provisional);
      const exactMatch =
        input.reuseSimilarReasoning === false ? null : this.professionalMemory.findByFingerprint(fingerprint);
      // Fingerprint for stored records uses synthesized recommendation; also try similarity.
      const similar =
        input.reuseSimilarReasoning === false
          ? []
          : this.professionalMemory.findSimilar(objective, domains, 5);

      let built = buildProfessionalMultiDomainReasoning({
        request: { ...input, requiredDomains: domains },
        recommendation,
        similarReasoning: similar,
        exactMatch,
      });

      // Stored fingerprints use the synthesized recommendation text; re-check after build.
      if (!built.reused && input.reuseSimilarReasoning !== false) {
        const synthesizedMatch = this.professionalMemory.findByFingerprint(built.memoryRecord.fingerprint);
        if (synthesizedMatch) {
          built = buildProfessionalMultiDomainReasoning({
            request: { ...input, requiredDomains: domains },
            recommendation,
            similarReasoning: similar,
            exactMatch: synthesizedMatch,
          });
        }
      }

      const durationMs = Math.round(performance.now() - start);
      const result: ProfessionalMultiDomainResult = { ...built, durationMs };
      if (!result.reused) this.professionalMemory.append(result.memoryRecord);
      else this.professionalMemory.update(result.memoryRecord);
      this.professionalResults.set(result.reasoningId, structuredClone(result));
      this.lastProfessionalResult = structuredClone(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MultiDomainEngineError(message, "MULTI_DOMAIN_REASONING_FAILED");
    }
  }

  explainMultiDomainReasoning(reasoningId: string): ProfessionalMultiDomainResult["explanation"] & {
    reasoningId: string;
    objective: string;
    combinedRecommendation: string;
  } {
    const current = this.requireResult(reasoningId);
    return {
      reasoningId: current.reasoningId,
      objective: current.objective,
      combinedRecommendation: current.framework.combinedRecommendation,
      ...current.explanation,
    };
  }

  getAiMeProfessionalMultiDomainAwareness(): AiMeProfessionalMultiDomainAwareness {
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const recommendationReady = Boolean(this.core?.recommendationEngine?.isInitialized());
    return {
      available: this.initialized && foundationReady && recommendationReady,
      enabled: this.initialized && foundationReady && recommendationReady,
      summary:
        "AI Me can combine Knowledge Foundation domains, resolve conflicting professional guidance, explain cross-domain reasoning, and improve using prior multi-domain memory. Self-Review & Professional Evaluation is available via the Self-Review Engine.",
      capabilities: [
        "combine knowledge across domains",
        "resolve conflicting recommendations",
        "explain cross-domain reasoning",
        "improve reasoning using previous experiences",
      ],
      groundedInKnowledgeFoundation: true,
      selfReviewEnabled: true,
      reasoningHistoryCount: this.professionalMemory.getCount(),
      lastConfidenceScore: this.lastProfessionalResult?.confidenceScore ?? null,
    };
  }

  getLastMultiDomainReasoning(): ProfessionalMultiDomainResult | null {
    return this.lastProfessionalResult ? structuredClone(this.lastProfessionalResult) : null;
  }

  getMultiDomainReasoningHistory() {
    return this.professionalMemory.getAll().map((record) => structuredClone(record));
  }

  async runMultiDomainHealthCheck(): Promise<ProfessionalMultiDomainHealthReport> {
    const issues: string[] = [];
    if (!this.initialized) issues.push("Multi-Domain Engine is not initialized.");
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const recommendationReady = Boolean(this.core?.recommendationEngine?.isInitialized());
    if (!foundationReady) issues.push("Knowledge Foundation startup is incomplete.");
    if (!recommendationReady) issues.push("Recommendation Engine is not ready.");
    const memoryWritable = this.professionalMemory.ensureWritable();
    if (!memoryWritable) issues.push("Professional multi-domain memory is not writable.");

    let canReasonMultiDomain = false;
    if (this.initialized && foundationReady && recommendationReady) {
      try {
        const sample =
          this.lastProfessionalResult?.grounded && this.lastProfessionalResult.framework.domainsParticipating.length > 1
            ? this.lastProfessionalResult
            : await this.reasonMultiDomain({
                request:
                  "multi-domain reason about camera lighting storytelling marketing and social media product advertisement",
                objective: "Cross-domain product ad reasoning",
                context: { product: "demo product", audience: "general buyers", platform: "tiktok" },
                requiredDomains: [
                  "camera-knowledge",
                  "lighting-knowledge",
                  "storytelling-knowledge",
                  "marketing-knowledge",
                  "social-media-knowledge",
                  "industry-standards-knowledge",
                ],
                includeDomainModules: true,
                reuseSimilarReasoning: true,
              });
        canReasonMultiDomain =
          sample.grounded &&
          !sample.unsupported &&
          sample.framework.domainsParticipating.length >= 2 &&
          sample.framework.crossDomainAnalysis.length >= 6 &&
          Boolean(sample.framework.combinedRecommendation);
        if (!sample.grounded) issues.push("Sample multi-domain reasoning was not grounded.");
        if (sample.framework.domainsParticipating.length < 2) {
          issues.push("Sample multi-domain reasoning used fewer than two domains.");
        }
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      healthy: issues.length === 0 && canReasonMultiDomain && memoryWritable,
      initialized: this.initialized,
      foundationReady,
      recommendationReady,
      canReasonMultiDomain,
      memoryWritable,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }

  async repairMultiDomainIntelligence(): Promise<ProfessionalMultiDomainRepairResult> {
    const actions: string[] = [];
    if (this.professionalMemory.ensureWritable()) actions.push("Ensured multi-domain memory is writable.");
    const health = await this.runMultiDomainHealthCheck();
    if (!health.healthy && this.core?.knowledgeFoundation?.isStartupComplete() && this.core.recommendationEngine) {
      await this.reasonMultiDomain({
        request: "multi-domain professional video production marketing sample",
        objective: "Validate multi-domain reasoning path",
        includeDomainModules: true,
        reuseSimilarReasoning: true,
        requiredDomains: ["camera-knowledge", "marketing-knowledge", "industry-standards-knowledge"],
      });
      actions.push("Re-ran grounded multi-domain reasoning sample.");
    }
    const recheck = await this.runMultiDomainHealthCheck();
    return { repaired: recheck.healthy, actions, remainingIssues: recheck.issues };
  }

  private requireResult(reasoningId: string): ProfessionalMultiDomainResult {
    const current = this.professionalResults.get(reasoningId);
    if (!current) throw new MultiDomainEngineError(`Multi-domain reasoning not found: ${reasoningId}`, "NOT_FOUND");
    return current;
  }

  private buildUnsupported(input: {
    request: string;
    objective: string;
    start: number;
    reason: string;
    recommendationId?: string;
  }): ProfessionalMultiDomainResult {
    const reasoningId = randomUUID();
    const memoryRecord = {
      reasoningId,
      domainsUsed: [],
      knowledgeUsed: [],
      decisionPath: [input.reason],
      recommendation: "",
      relatedRecommendationId: input.recommendationId ?? null,
      relatedWorkflowId: null,
      relatedDecisionId: null,
      conflictCount: 0,
      confidenceScore: 0,
      timestamp: new Date().toISOString(),
      relatedKnowledgePacks: [],
      priorReasoningIds: [],
      grounded: false,
      fingerprint: multiDomainFingerprint(input.objective, [], input.reason),
    };
    const result: ProfessionalMultiDomainResult = {
      reasoningId,
      available: false,
      grounded: false,
      unsupported: true,
      reused: false,
      objective: input.objective,
      framework: {
        objective: input.objective,
        domainsParticipating: [],
        knowledgePacksUsed: [],
        combinedRecommendation: "",
        crossDomainAnalysis: [],
        conflicts: [],
        decisionRulesApplied: ["Never generate unsupported multi-domain conclusions"],
        workflowsReferenced: [],
        confidenceScore: 0,
      },
      explanation: {
        whySelected: input.reason,
        domainsParticipating: [],
        knowledgePacksUsed: [],
        knowledgeIdsUsed: [],
        workflowsReferenced: [],
        decisionRulesApplied: ["Knowledge Foundation grounding required"],
        conflictsResolved: [],
        expectedBenefits: [],
        confidenceScore: 0,
      },
      confidenceScore: 0,
      confidenceExplanation: "Unsupported multi-domain confidence 0/100.",
      memoryRecord,
      relatedRecommendationId: input.recommendationId ?? null,
      relatedWorkflowId: null,
      relatedDecisionId: null,
      multiDomain: false,
      missingInformation: [{ field: "domains", severity: "critical", reason: input.reason }],
      durationMs: Math.round(performance.now() - input.start),
    };
    this.professionalResults.set(reasoningId, structuredClone(result));
    this.lastProfessionalResult = structuredClone(result);
    return result;
  }
}
