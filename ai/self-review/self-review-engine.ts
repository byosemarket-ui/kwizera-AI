import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { ProfessionalMultiDomainResult } from "../multi-domain/professional-multi-domain-types.js";
import { ProfessionalSelfReviewMemoryStore } from "./professional-self-review-memory.js";
import { buildProfessionalSelfReview, selfReviewFingerprint } from "./professional-self-review.js";
import type {
  AiMeProfessionalSelfReviewAwareness,
  ProfessionalSelfReviewHealthReport,
  ProfessionalSelfReviewRepairResult,
  ProfessionalSelfReviewRequest,
  ProfessionalSelfReviewResult,
} from "./professional-self-review-types.js";

export interface AiSelfReviewEngineOptions {
  storageRoot: string;
}

export class SelfReviewEngineError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "SelfReviewEngineError";
  }
}

/**
 * KWIZERA AI Self-Review & Professional Evaluation Engine (Step 7).
 * Reviews multi-domain / recommendation / workflow outputs before delivery.
 * Does not generate media. Does not start Professional Reasoning Certification.
 */
export class AiSelfReviewEngine {
  readonly professionalMemory = new ProfessionalSelfReviewMemoryStore();

  private readonly storageRoot: string;
  private initialized = false;
  private core: AiCoreManager | null = null;
  private lastProfessionalResult: ProfessionalSelfReviewResult | null = null;
  private readonly professionalResults = new Map<string, ProfessionalSelfReviewResult>();

  constructor(options: AiSelfReviewEngineOptions) {
    this.storageRoot = options.storageRoot;
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    this.professionalMemory.initialize(path.join(this.storageRoot, "self-review"));
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Professional Self-Review — evaluate and improve outputs before delivery.
   */
  async reviewProfessional(input: ProfessionalSelfReviewRequest): Promise<ProfessionalSelfReviewResult> {
    if (!this.initialized || !this.core) {
      throw new SelfReviewEngineError("Self-Review Engine not initialized", "NOT_INITIALIZED");
    }

    const start = performance.now();
    const request = input.request.trim();
    const objective = input.objective?.trim() || request;

    try {
      const foundation = this.core.knowledgeFoundation;
      const multiDomainEngine = this.core.multiDomainEngine;
      if (!foundation?.isStartupComplete() || !multiDomainEngine?.isInitialized()) {
        return this.buildUnsupported({
          request,
          objective,
          start,
          reason: "Knowledge Foundation and Multi-Domain Engine must be ready before professional self-review.",
        });
      }

      let multiDomain: ProfessionalMultiDomainResult | null = null;
      if (input.reasoningId) {
        const last = multiDomainEngine.getLastMultiDomainReasoning();
        if (last?.reasoningId === input.reasoningId) multiDomain = last;
      }
      if (!multiDomain) {
        multiDomain = await multiDomainEngine.reasonMultiDomain({
          request,
          objective,
          context: input.context ?? {},
          requiredDomains: input.requiredDomains,
          constraints: input.constraints,
          availableResources: input.availableResources,
          includeDomainModules: input.includeDomainModules !== false,
          reuseSimilarReasoning: true,
        });
      }

      if (!multiDomain.grounded || multiDomain.unsupported) {
        return this.buildUnsupported({
          request,
          objective,
          start,
          reason: "Self-review refused because upstream multi-domain reasoning is unsupported by verified knowledge.",
          reasoningId: multiDomain.reasoningId,
        });
      }

      const domains = Array.from(
        new Set([...multiDomain.framework.domainsParticipating, ...(input.requiredDomains ?? [])])
      );
      const provisional = multiDomain.framework.combinedRecommendation;
      const fingerprint = selfReviewFingerprint(multiDomain.objective || objective, domains, provisional);
      const exactMatch =
        input.reuseSimilarReviews === false ? null : this.professionalMemory.findByFingerprint(fingerprint);
      const similar =
        input.reuseSimilarReviews === false ? [] : this.professionalMemory.findSimilar(objective, domains, 5);

      let built = buildProfessionalSelfReview({
        request: { ...input, requiredDomains: domains },
        multiDomain,
        similarReviews: similar,
        exactMatch,
      });

      if (!built.reused && input.reuseSimilarReviews !== false) {
        const synthesizedMatch = this.professionalMemory.findByFingerprint(built.memoryRecord.fingerprint);
        if (synthesizedMatch) {
          built = buildProfessionalSelfReview({
            request: { ...input, requiredDomains: domains },
            multiDomain,
            similarReviews: similar,
            exactMatch: synthesizedMatch,
          });
        }
      }

      const durationMs = Math.round(performance.now() - start);
      const result: ProfessionalSelfReviewResult = { ...built, durationMs };
      if (!result.reused) this.professionalMemory.append(result.memoryRecord);
      else this.professionalMemory.update(result.memoryRecord);
      this.professionalResults.set(result.reviewId, structuredClone(result));
      this.lastProfessionalResult = structuredClone(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SelfReviewEngineError(message, "PROFESSIONAL_SELF_REVIEW_FAILED");
    }
  }

  explainProfessionalSelfReview(reviewId: string): ProfessionalSelfReviewResult["explanation"] & {
    reviewId: string;
    objective: string;
    readyForDelivery: boolean;
  } {
    const current = this.requireResult(reviewId);
    return {
      reviewId: current.reviewId,
      objective: current.objective,
      readyForDelivery: current.readyForDelivery,
      ...current.explanation,
    };
  }

  getAiMeProfessionalSelfReviewAwareness(): AiMeProfessionalSelfReviewAwareness {
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const multiDomainReady = Boolean(this.core?.multiDomainEngine?.isInitialized());
    return {
      available: this.initialized && foundationReady && multiDomainReady,
      enabled: this.initialized && foundationReady && multiDomainReady,
      summary:
        "AI Me can review its own professional reasoning, planning, workflows, and recommendations; detect weaknesses; apply automatic improvements; score quality; and estimate delivery readiness. Professional Reasoning Certification is available via the Certification Engine.",
      capabilities: [
        "review its own work",
        "explain weaknesses",
        "explain strengths",
        "improve outputs automatically",
        "estimate confidence",
        "estimate overall quality",
      ],
      groundedInKnowledgeFoundation: true,
      professionalReasoningCertificationEnabled: true,
      reviewHistoryCount: this.professionalMemory.getCount(),
      lastConfidenceScore: this.lastProfessionalResult?.confidenceScore ?? null,
    };
  }

  getLastProfessionalSelfReview(): ProfessionalSelfReviewResult | null {
    return this.lastProfessionalResult ? structuredClone(this.lastProfessionalResult) : null;
  }

  getProfessionalSelfReviewHistory() {
    return this.professionalMemory.getAll().map((record) => structuredClone(record));
  }

  async runProfessionalSelfReviewHealthCheck(): Promise<ProfessionalSelfReviewHealthReport> {
    const issues: string[] = [];
    if (!this.initialized) issues.push("Self-Review Engine is not initialized.");
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const multiDomainReady = Boolean(this.core?.multiDomainEngine?.isInitialized());
    if (!foundationReady) issues.push("Knowledge Foundation startup is incomplete.");
    if (!multiDomainReady) issues.push("Multi-Domain Engine is not ready.");
    const memoryWritable = this.professionalMemory.ensureWritable();
    if (!memoryWritable) issues.push("Professional self-review memory is not writable.");

    let canSelfReview = false;
    if (this.initialized && foundationReady && multiDomainReady) {
      try {
        const sample =
          this.lastProfessionalResult?.grounded && this.lastProfessionalResult.framework.evaluationScores.length > 0
            ? this.lastProfessionalResult
            : await this.reviewProfessional({
                request:
                  "self-review a professional camera lighting storytelling marketing social media product advertisement recommendation",
                objective: "Self-review product ad professional output",
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
                reuseSimilarReviews: true,
              });
        canSelfReview =
          sample.grounded &&
          !sample.unsupported &&
          sample.framework.qualityScores.overallReadiness > 0 &&
          sample.framework.evaluationScores.length >= 8;
        if (!sample.grounded) issues.push("Sample professional self-review was not grounded.");
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      healthy: issues.length === 0 && canSelfReview && memoryWritable,
      initialized: this.initialized,
      foundationReady,
      multiDomainReady,
      canSelfReview,
      memoryWritable,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }

  async repairProfessionalSelfReviewIntelligence(): Promise<ProfessionalSelfReviewRepairResult> {
    const actions: string[] = [];
    if (this.professionalMemory.ensureWritable()) actions.push("Ensured self-review memory is writable.");
    const health = await this.runProfessionalSelfReviewHealthCheck();
    if (!health.healthy && this.core?.knowledgeFoundation?.isStartupComplete() && this.core.multiDomainEngine) {
      await this.reviewProfessional({
        request: "professional self-review sample for video production marketing",
        objective: "Validate professional self-review path",
        includeDomainModules: true,
        reuseSimilarReviews: true,
        requiredDomains: ["camera-knowledge", "marketing-knowledge", "industry-standards-knowledge"],
      });
      actions.push("Re-ran grounded professional self-review sample.");
    }
    const recheck = await this.runProfessionalSelfReviewHealthCheck();
    return { repaired: recheck.healthy, actions, remainingIssues: recheck.issues };
  }

  private requireResult(reviewId: string): ProfessionalSelfReviewResult {
    const current = this.professionalResults.get(reviewId);
    if (!current) throw new SelfReviewEngineError(`Professional self-review not found: ${reviewId}`, "NOT_FOUND");
    return current;
  }

  private buildUnsupported(input: {
    request: string;
    objective: string;
    start: number;
    reason: string;
    reasoningId?: string;
  }): ProfessionalSelfReviewResult {
    const reviewId = randomUUID();
    const qualityScores = {
      technicalQuality: 0,
      professionalQuality: 0,
      creativity: 0,
      marketingQuality: 0,
      knowledgeUsage: 0,
      workflowQuality: 0,
      overallReadiness: 0,
    };
    const memoryRecord = {
      reviewId,
      relatedDecisionId: null,
      relatedWorkflowId: null,
      relatedRecommendationId: null,
      relatedReasoningId: input.reasoningId ?? null,
      detectedIssues: [
        {
          issueId: randomUUID(),
          category: "unsupportedClaim" as const,
          severity: "critical" as const,
          description: input.reason,
          repaired: false,
        },
      ],
      improvementsMade: [],
      qualityScores,
      confidenceScore: 0,
      reviewPassed: false,
      timestamp: new Date().toISOString(),
      domainsUsed: [],
      knowledgeUsed: [],
      priorReviewIds: [],
      grounded: false,
      fingerprint: selfReviewFingerprint(input.objective, [], input.reason),
    };
    const result: ProfessionalSelfReviewResult = {
      reviewId,
      available: false,
      grounded: false,
      unsupported: true,
      reused: false,
      objective: input.objective,
      framework: {
        objective: input.objective,
        reviewPassed: false,
        evaluationScores: [],
        qualityScores,
        detectedIssues: memoryRecord.detectedIssues,
        improvementsMade: [],
        strengths: [],
        weaknesses: [input.reason],
        improvedRecommendation: "",
        improvedExplanation: input.reason,
        confidenceScore: 0,
      },
      explanation: {
        whyReviewed: input.reason,
        objectiveReviewed: input.objective,
        processesReviewed: [],
        knowledgeReferenced: [],
        standardsApplied: ["Never deliver unsupported professional outputs"],
        strengths: [],
        weaknesses: [input.reason],
        improvementsMade: [],
        confidenceScore: 0,
      },
      confidenceScore: 0,
      confidenceExplanation: "Unsupported self-review confidence 0/100.",
      memoryRecord,
      relatedDecisionId: null,
      relatedWorkflowId: null,
      relatedRecommendationId: null,
      relatedReasoningId: input.reasoningId ?? null,
      readyForDelivery: false,
      missingInformation: [{ field: "knowledge", severity: "critical", reason: input.reason }],
      durationMs: Math.round(performance.now() - input.start),
    };
    this.professionalResults.set(reviewId, structuredClone(result));
    this.lastProfessionalResult = structuredClone(result);
    return result;
  }
}
