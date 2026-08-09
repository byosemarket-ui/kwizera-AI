import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import type {
  AiMeProfessionalReasoningAwareness,
  KnowledgeImpactReport,
  ProfessionalDomainContribution,
  ProfessionalKnowledgeEvidence,
  ProfessionalKnowledgeOption,
  ProfessionalKnowledgeReasoningResult,
  ProfessionalKnowledgeRecommendation,
  ProfessionalReasoningHealthReport,
  ProfessionalReasoningMissingInformation,
  ProfessionalReasoningProcessStep,
  ProfessionalReasoningRepairResult,
  ProfessionalReasoningRequest,
} from "./types.js";

/** Reasons over validated Knowledge Foundation evidence and professional domain modules; never generates media or executes decisions. */
export class AiKnowledgeReasoningEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private impactDirectory = "";
  private initialized = false;
  private lastResult: ProfessionalKnowledgeReasoningResult | null = null;
  private lastHealth: ProfessionalReasoningHealthReport | null = null;

  async initialize(foundation: AiKnowledgeFoundation, storageRoot: string): Promise<void> {
    this.foundation = foundation;
    this.impactDirectory = path.join(storageRoot, "knowledge", "impact");
    await fs.mkdir(this.impactDirectory, { recursive: true });
    this.initialized = true;
  }

  /**
   * Backwards-compatible professional reasoning entry point.
   * Prefer reasonProfessional() when objective or context is available.
   */
  async reason(topic: string, limit = 8): Promise<ProfessionalKnowledgeReasoningResult> {
    // Keep the legacy entry point foundation-first and light enough for startup capability checks.
    return this.reasonProfessional({ request: topic, limit, includeDomainModules: false });
  }

  /**
   * Reasons only over verified knowledge returned from the Knowledge Foundation
   * and installed professional domain modules. Never calls generation or decision engines.
   */
  async reasonProfessional(input: ProfessionalReasoningRequest): Promise<ProfessionalKnowledgeReasoningResult> {
    this.ensureReady();
    const request = input.request.trim();
    const objective = input.objective?.trim() || request;
    const context = input.context ?? {};
    const requestedDomains = unique([
      ...(input.requiredDomains ?? []),
      ...inferDomainsFromText(`${request} ${objective}`),
    ]).slice(0, 8);
    const processSteps: ProfessionalReasoningProcessStep[] = [
      {
        step: 1,
        name: "Understand the request",
        detail: `Objective: ${objective}`,
      },
    ];

    const missingInformation = identifyMissingInformation(request, objective, context, requestedDomains);
    processSteps.push({
      step: 2,
      name: "Search relevant Knowledge Packs",
      detail:
        requestedDomains.length > 0
          ? `Searching Knowledge Foundation and domains: ${requestedDomains.join(", ")}.`
          : "Searching Knowledge Foundation with retrieval; domain modules consulted when matches exist.",
    });

    const relatedKnowledgeIds = new Set<string>();
    const candidates = await this.collectFoundationCandidates(request, requestedDomains, input.limit ?? 12, relatedKnowledgeIds);
    const includeDomainModules = input.includeDomainModules !== false;
    const domainContributions = includeDomainModules ? this.collectDomainContributions(request, requestedDomains) : [];
    const domainCandidates = domainContributions.map((contribution) => domainContributionToCandidate(contribution));
    const merged = [...candidates, ...domainCandidates].sort((a, b) => b.score - a.score);

    processSteps.push({
      step: 3,
      name: "Analyze available knowledge",
      detail: `Analyzed ${candidates.length} verified foundation record(s) and ${domainContributions.length} domain contribution(s).`,
    });
    processSteps.push({
      step: 4,
      name: "Compare professional options",
      detail: `Compared ${Math.min(merged.length, 6)} professional option(s) using confidence, quality, relevance, graph evidence, and domain fit.`,
    });

    const selected = merged[0] ?? null;
    const consideredOptions: ProfessionalKnowledgeOption[] = merged.slice(0, 6).map((candidate, index) => ({
      ...stripCandidate(candidate),
      title: candidate.title,
      domain: candidate.domain,
      relevanceScore: candidate.relevanceScore,
      qualityScore: candidate.qualityScore,
      relationshipCount: candidate.relationshipCount,
      advantages: candidate.advantages,
      disadvantages: candidate.disadvantages,
      selected: index === 0,
      rejectionReason:
        index === 0
          ? undefined
          : buildRejectionReason(candidate, selected),
    }));
    const rejectedOptions = consideredOptions.filter((option) => !option.selected);
    const alternatives = rejectedOptions.map((option) => ({
      knowledgeId: option.knowledgeId,
      guidance: option.guidance,
      reason: option.rejectionReason ?? option.reason,
      confidenceScore: option.confidenceScore,
    }));

    processSteps.push({
      step: 5,
      name: "Select the best solution",
      detail: selected
        ? `Selected ${selected.title} (${selected.knowledgeId}) from domain ${selected.domain}.`
        : "No verified knowledge-backed option could be selected.",
    });

    const decisionRules = unique(merged.flatMap((candidate) => candidate.rules)).slice(0, 12);
    const risks = unique([
      ...merged.flatMap((candidate) => candidate.risks),
      ...domainContributions.flatMap((contribution) => contribution.disadvantages),
    ]).slice(0, 8);
    const professionalStandards = unique([
      ...merged.flatMap((candidate) => candidate.standards),
      ...this.collectStandards(request),
    ]).slice(0, 12);
    const domainsUsed = unique([
      ...merged.map((candidate) => candidate.domain),
      ...domainContributions.map((contribution) => contribution.domain),
    ]);
    const knowledgeUsed: ProfessionalKnowledgeEvidence[] = [
      ...merged.slice(0, 8).map((candidate) => ({
        knowledgeId: candidate.knowledgeId,
        title: candidate.title,
        domain: candidate.domain,
        source: candidate.source,
        confidenceScore: candidate.confidenceScore,
        qualityScore: candidate.qualityScore,
        relationshipCount: candidate.relationshipCount,
        guidance: candidate.guidance,
        usedFor: candidate === selected ? "selected recommendation" : "professional alternative comparison",
      })),
    ];

    const confidenceScore = confidenceFor(selected, domainsUsed.length, missingInformation, domainContributions.length);
    const improvements = unique([
      ...missingInformation.map((item) => `Provide ${item.field}: ${item.reason}`),
      ...(selected?.advantages ?? []),
      ...this.collectImprovementHints(request),
    ]).slice(0, 8);

    processSteps.push({
      step: 6,
      name: "Explain why it was selected",
      detail: selected
        ? `Grounded in ${selected.source}; rejected ${rejectedOptions.length} alternative(s) with documented trade-offs.`
        : "Explanation withheld because no grounded selection exists.",
    });
    processSteps.push({
      step: 7,
      name: "Recommend improvements",
      detail: improvements.length ? improvements.slice(0, 3).join(" | ") : "No additional improvements identified from stored knowledge.",
    });
    processSteps.push({
      step: 8,
      name: "Estimate confidence",
      detail: `Confidence ${confidenceScore}/100.`,
    });

    const grounded = Boolean(selected && knowledgeUsed.length > 0);
    const multiDomain = domainsUsed.length > 1;
    const editingGap = requestedDomains.includes("video-editing-knowledge")
      ? " Dedicated professional video-editing expansion is not content-ready; editing guidance is limited to verified foundation matches only."
      : "";
    const problemAnalysis = grounded
      ? `Analyzed ${knowledgeUsed.length} knowledge-backed option(s) across ${domainsUsed.length} domain(s): ${domainsUsed.join(", ")}.${editingGap}`
      : `No verified Knowledge Foundation record or professional domain recommendation could support this request.${editingGap}`;
    const confidenceExplanation = grounded
      ? `Confidence ${confidenceScore}/100 combines selected evidence confidence/quality, retrieval or domain relevance, graph relationships, multi-domain breadth (${domainsUsed.length}), domain-module contributions (${domainContributions.length}), and ${missingInformation.filter((item) => item.severity === "important").length} important missing-information item(s).`
      : "Confidence is 0 because no verified Knowledge Foundation evidence was available.";
    const explanation = selected
      ? buildExplanation(selected, rejectedOptions, professionalStandards, domainContributions, confidenceScore)
      : `No verified structured knowledge matches "${request}". Learn and approve reliable source material before making a professional recommendation.`;

    const result: ProfessionalKnowledgeReasoningResult = {
      topic: request,
      objective,
      available: grounded,
      grounded,
      multiDomain,
      confidenceScore,
      confidenceExplanation,
      problemAnalysis,
      missingInformation,
      domainsUsed,
      knowledgeUsed,
      domainContributions,
      consideredOptions,
      rejectedOptions,
      selected: selected ? stripCandidate(selected) : null,
      alternatives,
      decisionRules,
      professionalStandards,
      risks,
      tradeOffs: rejectedOptions.map(
        (alternative) =>
          `${alternative.title}: ${alternative.rejectionReason ?? alternative.reason} Trade-off: ${alternative.disadvantages[0] ?? "fewer matching professional advantages."}`
      ),
      improvements,
      relatedKnowledgeIds: [...relatedKnowledgeIds],
      processSteps,
      explanation,
    };
    this.lastResult = structuredClone(result);
    return result;
  }

  getAiMeAwareness(): AiMeProfessionalReasoningAwareness {
    return {
      available: this.initialized && Boolean(this.foundation?.isStartupComplete()),
      summary:
        "AI Me reasons over the Knowledge Foundation and professional domain modules before recommending. Decision Intelligence is available through the Decision Engine (decideProfessional). Planning Intelligence is not enabled in this step.",
      capabilities: [
        "answer professional questions",
        "recommend professional workflows",
        "explain professional decisions",
        "compare professional techniques",
        "solve problems using stored knowledge",
        "estimate recommendation confidence",
      ],
      groundedInKnowledgeFoundation: true,
      decisionIntelligenceEnabled: true,
      lastConfidenceScore: this.lastResult?.confidenceScore ?? null,
    };
  }

  getLastResult(): ProfessionalKnowledgeReasoningResult | null {
    return this.lastResult ? structuredClone(this.lastResult) : null;
  }

  async runHealthCheck(): Promise<ProfessionalReasoningHealthReport> {
    const issues: string[] = [];
    if (!this.initialized || !this.foundation) issues.push("Professional Reasoning Engine is not initialized.");
    const foundationReady = Boolean(this.foundation?.isStartupComplete());
    if (!foundationReady) issues.push("Knowledge Foundation startup is incomplete.");

    let canReason = false;
    if (this.initialized && foundationReady) {
      try {
        const sample =
          this.lastResult?.grounded && this.lastResult.processSteps.length === 8
            ? this.lastResult
            : await this.reasonProfessional({
                request: "recommend professional camera lighting for a product advertisement",
                objective: "Select a knowledge-backed lighting and camera approach",
                includeDomainModules: true,
                requiredDomains: ["camera-knowledge", "lighting-knowledge", "industry-standards-knowledge"],
              });
        canReason = sample.grounded && Boolean(sample.selected) && sample.confidenceScore > 0 && sample.processSteps.length === 8;
        if (!sample.grounded) issues.push("Sample professional reasoning was not grounded in Knowledge Foundation evidence.");
        if (!sample.explanation.includes("Selected") && sample.grounded) {
          issues.push("Sample reasoning explanation is incomplete.");
        }
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }

    const report: ProfessionalReasoningHealthReport = {
      healthy: issues.length === 0 && canReason,
      initialized: this.initialized,
      foundationReady,
      canReason,
      issues,
      checkedAt: new Date().toISOString(),
    };
    this.lastHealth = report;
    return structuredClone(report);
  }

  async repair(): Promise<ProfessionalReasoningRepairResult> {
    const actions: string[] = [];
    if (this.impactDirectory) {
      await fs.mkdir(this.impactDirectory, { recursive: true });
      actions.push("Ensured knowledge impact directory exists.");
    }
    const health = await this.runHealthCheck();
    if (!health.healthy && this.foundation?.isStartupComplete()) {
      await this.reasonProfessional({
        request: "professional video production workflow recommendation",
        objective: "Validate professional reasoning path",
      });
      actions.push("Re-ran grounded professional reasoning sample.");
    }
    const recheck = await this.runHealthCheck();
    return {
      repaired: recheck.healthy,
      actions,
      remainingIssues: recheck.issues,
    };
  }

  getLastHealth(): ProfessionalReasoningHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async analyzeImpact(knowledgeId: string, operation: "create" | "update"): Promise<KnowledgeImpactReport> {
    this.ensureReady();
    const read = await this.foundation!.getStorageEngine().getRecord(knowledgeId, "knowledge-reasoning-engine");
    const record = read.record;
    const text = [record?.title, record?.category, record?.classification.businessDomain, record?.classification.creativeDomain].filter(Boolean).join(" ").toLowerCase();
    // Do not call getRelationships() during import/impact paths — inbound edge scans are O(edges)
    // and become pathological while professional knowledge packs are still being written.
    const relatedKnowledgeIds: string[] = [];
    const report: KnowledgeImpactReport = {
      knowledgeId,
      operation,
      affectedWorkflows: match(text, {
        video: "video-production",
        camera: "camera-planning",
        motion: "motion-planning",
        render: "rendering-preparation",
        marketing: "marketing-campaign",
        image: "image-production",
      }),
      affectedDecisions: match(text, {
        video: "video-planning",
        camera: "camera-direction",
        marketing: "marketing-strategy",
        image: "image-generation",
        product: "product-presentation",
      }),
      affectedRecommendations: match(text, {
        render: "rendering",
        camera: "camera",
        marketing: "marketing",
        image: "image",
        video: "video",
      }) as KnowledgeImpactReport["affectedRecommendations"],
      relatedKnowledgeIds: unique(relatedKnowledgeIds),
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(this.impactDirectory, `${knowledgeId}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return report;
  }

  private async collectFoundationCandidates(
    request: string,
    requestedDomains: string[],
    limit: number,
    relatedKnowledgeIds: Set<string>
  ): Promise<ReasoningCandidate[]> {
    const search = await this.foundation!.getRetrievalEngine().search({
      text: request,
      limit,
      minConfidenceScore: 65,
      requesterId: "professional-knowledge-reasoning-engine",
    });
    const candidates: ReasoningCandidate[] = [];

    for (const result of search.results) {
      const record = result.record;
      if (!record || record.verificationStatus !== KnowledgeVerificationStatus.Verified) continue;
      const knowledge = asReasoningKnowledge(record.payload);
      if (!knowledge) continue;
      const guidance = [...knowledge.decisionRules, ...knowledge.bestPractices, ...knowledge.professionalTechniques][0];
      if (!guidance) continue;
      // Avoid KnowledgeGraphEngine.getRelationships() here: it scans all edges for inbound links and
      // becomes pathological during startup when hundreds of professional topics are already installed.
      const relationshipCount = 0;
      relatedKnowledgeIds.add(record.knowledgeId);
      const domain = domainForRecord(record, knowledge);
      const requestedDomainBonus =
        requestedDomains.length === 0 ||
        requestedDomains.some((requested) => domain.includes(requested) || requested.includes(domain) || domainOverlaps(requested, domain))
          ? 6
          : 0;
      const relevanceScore = Math.round(result.ranking.compositeScore);
      const score = clamp(
        Math.round(
          record.confidenceScore * 0.35 +
            record.qualityScore * 0.35 +
            relevanceScore * 0.2 +
            Math.min(relationshipCount, 10) +
            requestedDomainBonus
        ),
        0,
        100
      );
      candidates.push({
        knowledgeId: record.knowledgeId,
        guidance,
        reason: `Validated Knowledge Foundation source (${record.confidenceScore}/100 confidence) with ${relationshipCount} graph relationship(s).`,
        confidenceScore: record.confidenceScore,
        title: record.title,
        domain,
        relevanceScore,
        qualityScore: record.qualityScore,
        relationshipCount,
        advantages: unique([...knowledge.bestPractices, ...knowledge.qualityRules, ...knowledge.decisionRules]).slice(0, 3),
        disadvantages: knowledge.commonMistakes.slice(0, 3),
        standards: knowledge.qualityRules,
        risks: knowledge.commonMistakes,
        rules: knowledge.decisionRules,
        source: record.source,
        score,
      });
    }
    return candidates;
  }

  private collectDomainContributions(request: string, requestedDomains: string[]): ProfessionalDomainContribution[] {
    const foundation = this.foundation!;
    const contributions: ProfessionalDomainContribution[] = [];
    const include = (domainIds: string[]): boolean => {
      if (requestedDomains.length === 0) {
        return domainIds.some((id) => id === "video-production-knowledge" || id === "industry-standards-knowledge");
      }
      return requestedDomains.some((requested) =>
        domainIds.some((id) => requested.includes(id) || id.includes(requested) || domainOverlaps(requested, id))
      );
    };

    const push = (contribution: ProfessionalDomainContribution | null): void => {
      if (contribution) contributions.push(contribution);
    };

    try {
      if (include(["video-production-knowledge", "video-production"])) {
        const module = foundation.getProfessionalVideoProductionKnowledge();
        const workflow = module.recommendWorkflow(request);
        if (workflow.available && workflow.workflow.length) {
          const explained = module.explain(request.includes("workflow") ? request : "production workflow");
          push({
            domain: "video-production-knowledge",
            sourceModule: "professional-video-production-knowledge",
            knowledgeId: explained.knowledgeId,
            title: explained.title || "Video production workflow",
            guidance: workflow.workflow[0] ?? workflow.reason,
            advantages: unique([...workflow.workflow.slice(0, 3), ...explained.bestPractices.slice(0, 2)]),
            disadvantages: [],
            confidenceScore: workflow.confidenceScore,
            whyUsed: workflow.reason,
          });
        }
        const practices = module.recommendBestPractices(request);
        if (practices.available && practices.practices[0]) {
          const explained = module.explain(request);
          push({
            domain: "video-production-knowledge",
            sourceModule: "professional-video-production-knowledge",
            knowledgeId: explained.knowledgeId,
            title: explained.title || "Video production best practices",
            guidance: practices.practices[0],
            advantages: practices.practices.slice(0, 3),
            disadvantages: [],
            confidenceScore: practices.confidenceScore,
            whyUsed: practices.reason,
          });
        }
      }
    } catch {
      /* domain module unavailable */
    }

    try {
      if (include(["camera-knowledge", "camera-movement-knowledge", "camera"])) {
        const module = foundation.getProfessionalCameraKnowledge();
        const movement = module.recommendMovement(request);
        if (movement.available && movement.movementId) {
          push({
            domain: "camera-movement-knowledge",
            sourceModule: "professional-camera-knowledge",
            knowledgeId: movement.movementId,
            title: movement.name,
            guidance: movement.reason,
            advantages: movement.whenToUse.slice(0, 3),
            disadvantages: movement.alternatives.slice(0, 2).map((alt) => `Alternative not selected: ${alt.name} — ${alt.reason}`),
            confidenceScore: movement.confidenceScore,
            whyUsed: "Camera movement recommendation from professional camera knowledge.",
          });
        }
        const settings = module.recommendSettings(request);
        if (settings.available && settings.topicId) {
          push({
            domain: "camera-knowledge",
            sourceModule: "professional-camera-knowledge",
            knowledgeId: settings.topicId,
            title: settings.title,
            guidance: settings.settingsGuidance[0] ?? settings.title,
            advantages: unique([...settings.settingsGuidance, ...settings.decisionRules]).slice(0, 3),
            disadvantages: [],
            confidenceScore: settings.confidenceScore,
            whyUsed: "Camera settings recommendation from professional camera knowledge.",
          });
        }
      }
    } catch {
      /* domain module unavailable */
    }

    try {
      if (include(["lighting-knowledge", "composition-knowledge", "lighting", "composition"])) {
        const module = foundation.getProfessionalLightingCompositionKnowledge();
        const lighting = module.recommendLighting(request);
        if (lighting.available && lighting.topicId) {
          push({
            domain: "lighting-knowledge",
            sourceModule: "professional-lighting-composition-knowledge",
            knowledgeId: lighting.topicId,
            title: lighting.name,
            guidance: lighting.reason,
            advantages: unique([...lighting.whenToUse, ...lighting.bestPractices]).slice(0, 3),
            disadvantages: lighting.alternatives.slice(0, 2).map((alt) => `Alternative not selected: ${alt.name} — ${alt.reason}`),
            confidenceScore: lighting.confidenceScore,
            whyUsed: "Lighting recommendation from professional lighting & composition knowledge.",
          });
        }
        const composition = module.recommendComposition(request);
        if (composition.available && composition.topicId) {
          push({
            domain: "composition-knowledge",
            sourceModule: "professional-lighting-composition-knowledge",
            knowledgeId: composition.topicId,
            title: composition.name,
            guidance: composition.reason,
            advantages: unique([...composition.whenToUse, ...composition.bestPractices]).slice(0, 3),
            disadvantages: composition.alternatives.slice(0, 2).map((alt) => `Alternative not selected: ${alt.name} — ${alt.reason}`),
            confidenceScore: composition.confidenceScore,
            whyUsed: "Composition recommendation from professional lighting & composition knowledge.",
          });
        }
      }
    } catch {
      /* domain module unavailable */
    }

    try {
      if (include(["storytelling-knowledge", "scene-design", "story", "scene"])) {
        const module = foundation.getProfessionalStorytellingSceneKnowledge();
        const sequence = module.recommendSceneSequence(request);
        if (sequence.available && sequence.scenes.length) {
          push({
            domain: "storytelling-knowledge",
            sourceModule: "professional-storytelling-scene-knowledge",
            knowledgeId: sequence.knowledgeIds[0] ?? null,
            title: sequence.sequenceName,
            guidance: sequence.reason,
            advantages: sequence.scenes.slice(0, 3).map((scene) => `${scene.name}: ${scene.purpose}`),
            disadvantages: [],
            confidenceScore: sequence.confidenceScore,
            whyUsed: "Scene sequence recommendation from storytelling & scene knowledge.",
          });
        }
        const layout = module.recommendSceneLayout(request);
        if (layout.available && layout.knowledgeIds.length) {
          push({
            domain: "storytelling-knowledge",
            sourceModule: "professional-storytelling-scene-knowledge",
            knowledgeId: layout.knowledgeIds[0] ?? null,
            title: layout.sceneName,
            guidance: layout.reason,
            advantages: layout.layoutGuidance.slice(0, 3),
            disadvantages: [],
            confidenceScore: layout.confidenceScore,
            whyUsed: "Scene layout recommendation from storytelling & scene knowledge.",
          });
        }
      }
    } catch {
      /* domain module unavailable */
    }

    try {
      if (include(["animation-knowledge", "motion-graphics", "rendering-knowledge", "animation", "render"])) {
        const module = foundation.getProfessionalAnimationMotionRenderingKnowledge();
        const picks = [
          module.recommendAnimationStyle(request),
          module.recommendMotionGraphics(request),
          module.recommendRenderingSettings(request),
          module.recommendExportSettings(request),
        ];
        for (const pick of picks) {
          if (!pick.available || !pick.topicId) continue;
          const domain =
            pick.kind === "rendering" || pick.kind === "export"
              ? "rendering-knowledge"
              : pick.kind === "motion-graphics"
                ? "motion-graphics"
                : "animation-knowledge";
          push({
            domain,
            sourceModule: "professional-animation-motion-rendering-knowledge",
            knowledgeId: pick.topicId,
            title: pick.name,
            guidance: pick.reason,
            advantages: unique([...pick.bestPractices, ...pick.workflow]).slice(0, 3),
            disadvantages: pick.alternatives.slice(0, 2).map((alt) => `Alternative not selected: ${alt.name} — ${alt.reason}`),
            confidenceScore: pick.confidenceScore,
            whyUsed: `Domain recommendation (${pick.kind}) from animation/motion/rendering knowledge.`,
          });
        }
      }
    } catch {
      /* domain module unavailable */
    }

    try {
      if (include(["marketing-knowledge", "branding-knowledge", "customer-psychology", "sales-psychology", "marketing", "brand"])) {
        const module = foundation.getProfessionalMarketingBrandingPsychologyKnowledge();
        const picks = [
          module.recommendMarketingStrategy(request),
          module.recommendBrandingStrategy(request),
          module.recommendCta(request),
          module.recommendProductPresentation(request),
        ];
        for (const pick of picks) {
          if (!pick.available || !pick.topicId) continue;
          const domain =
            pick.kind === "branding"
              ? "branding-knowledge"
              : pick.kind === "customer-psychology"
                ? "customer-psychology"
                : pick.kind === "sales-psychology"
                  ? "sales-psychology"
                  : "marketing-knowledge";
          push({
            domain,
            sourceModule: "professional-marketing-branding-psychology-knowledge",
            knowledgeId: pick.topicId,
            title: pick.name,
            guidance: pick.reason,
            advantages: unique([...pick.bestPractices, ...pick.workflow]).slice(0, 3),
            disadvantages: pick.alternatives.slice(0, 2).map((alt) => `Alternative not selected: ${alt.name} — ${alt.reason}`),
            confidenceScore: pick.confidenceScore,
            whyUsed: `Domain recommendation (${pick.kind}) from marketing/branding/psychology knowledge.`,
          });
        }
      }
    } catch {
      /* domain module unavailable */
    }

    try {
      if (include(["social-media-knowledge", "social", "tiktok", "instagram", "youtube", "facebook"])) {
        const module = foundation.getProfessionalSocialMediaKnowledge();
        const picks = [
          module.recommendPlatform(request),
          module.recommendContentFormat(request),
          module.recommendPostingStrategy(request),
          module.recommendEngagementStrategy(request),
        ];
        for (const pick of picks) {
          if (!pick.available || !pick.topicId) continue;
          push({
            domain: "social-media-knowledge",
            sourceModule: "professional-social-media-knowledge",
            knowledgeId: pick.topicId,
            title: pick.name,
            guidance: pick.reason,
            advantages: unique([...pick.bestPractices, ...pick.workflow]).slice(0, 3),
            disadvantages: pick.alternatives.slice(0, 2).map((alt) => `Alternative not selected: ${alt.name} — ${alt.reason}`),
            confidenceScore: pick.confidenceScore,
            whyUsed: `Social media recommendation (${pick.kind}) from professional social media knowledge.`,
          });
        }
      }
    } catch {
      /* domain module unavailable */
    }

    try {
      if (include(["industry-standards-knowledge", "quality", "standard"])) {
        const module = foundation.getProfessionalIndustryStandardsQualityKnowledge();
        const standard = module.explainIndustryStandard(request);
        if (standard.available && standard.knowledgeId) {
          push({
            domain: "industry-standards-knowledge",
            sourceModule: "professional-industry-standards-quality-knowledge",
            knowledgeId: standard.knowledgeId,
            title: standard.title,
            guidance: standard.explanation,
            advantages: unique([...standard.bestPractices, ...standard.qualityRules]).slice(0, 3),
            disadvantages: [],
            confidenceScore: standard.confidenceScore,
            whyUsed: "Industry standard explanation used to ground professional quality expectations.",
          });
        }
        const improvement = module.recommendImprovement(request);
        if (improvement.available && improvement.topicId) {
          push({
            domain: "industry-standards-knowledge",
            sourceModule: "professional-industry-standards-quality-knowledge",
            knowledgeId: improvement.topicId,
            title: improvement.name,
            guidance: improvement.reason,
            advantages: unique([...improvement.bestPractices, ...improvement.workflow, ...improvement.qualityRules]).slice(0, 3),
            disadvantages: improvement.alternatives.slice(0, 2).map((alt) => `Alternative not selected: ${alt.name} — ${alt.reason}`),
            confidenceScore: improvement.confidenceScore,
            whyUsed: "Quality improvement recommendation from industry standards knowledge.",
          });
        }
      }
    } catch {
      /* domain module unavailable */
    }

    return dedupeContributions(contributions).slice(0, 10);
  }

  private collectStandards(request: string): string[] {
    try {
      const module = this.foundation!.getProfessionalIndustryStandardsQualityKnowledge();
      const standard = module.explainIndustryStandard(request);
      const practices = module.recommendBestPractices(request);
      const checklist = module.recommendChecklist(request);
      return unique([
        ...(standard.available ? [standard.explanation, ...standard.bestPractices, ...standard.qualityRules] : []),
        ...(practices.available ? [practices.reason, ...practices.bestPractices, ...practices.qualityRules] : []),
        ...(checklist.available ? [checklist.reason, ...checklist.bestPractices, ...checklist.qualityRules] : []),
      ]).slice(0, 8);
    } catch {
      return [];
    }
  }

  private collectImprovementHints(request: string): string[] {
    try {
      const module = this.foundation!.getProfessionalIndustryStandardsQualityKnowledge();
      const improvement = module.recommendImprovement(request);
      if (!improvement.available) return [];
      return unique([improvement.reason, ...improvement.bestPractices]).slice(0, 4);
    } catch {
      return [];
    }
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) throw new Error("Knowledge Reasoning Engine is not initialized");
  }
}

interface ReasoningKnowledge {
  decisionRules: string[];
  bestPractices: string[];
  professionalTechniques: string[];
  commonMistakes: string[];
  qualityRules: string[];
  domain?: string;
}

interface ReasoningCandidate extends ProfessionalKnowledgeRecommendation {
  title: string;
  domain: string;
  relevanceScore: number;
  qualityScore: number;
  relationshipCount: number;
  advantages: string[];
  disadvantages: string[];
  standards: string[];
  risks: string[];
  rules: string[];
  source: string;
  score: number;
}

function asReasoningKnowledge(payload: Record<string, unknown> | undefined): ReasoningKnowledge | null {
  if (!payload) return null;
  const nested =
    payload.structuredKnowledge && typeof payload.structuredKnowledge === "object"
      ? (payload.structuredKnowledge as Record<string, unknown>)
      : undefined;
  const source = arraysPresent(payload) ? payload : nested && arraysPresent(nested) ? nested : null;
  if (!source) return null;
  return {
    decisionRules: stringArray(source.decisionRules),
    bestPractices: stringArray(source.bestPractices),
    professionalTechniques: stringArray(source.professionalTechniques),
    commonMistakes: stringArray(source.commonMistakes),
    qualityRules: stringArray(source.qualityRules ?? source.professionalStandards),
    domain: typeof source.domain === "string" ? source.domain : undefined,
  };
}

function arraysPresent(value: Record<string, unknown>): boolean {
  return (
    Array.isArray(value.decisionRules) &&
    Array.isArray(value.bestPractices) &&
    Array.isArray(value.professionalTechniques)
  );
}

function stripCandidate(candidate: ReasoningCandidate): ProfessionalKnowledgeRecommendation {
  return {
    knowledgeId: candidate.knowledgeId,
    guidance: candidate.guidance,
    reason: candidate.reason,
    confidenceScore: candidate.confidenceScore,
  };
}

function domainContributionToCandidate(contribution: ProfessionalDomainContribution): ReasoningCandidate {
  const confidence = contribution.confidenceScore;
  const qualityScore = Math.max(70, confidence - 2);
  const relevanceScore = Math.min(100, confidence);
  // Domain modules contribute grounded options but must not always outrank higher-relevance verified retrieval hits.
  const score = clamp(Math.round(confidence * 0.38 + qualityScore * 0.28 + relevanceScore * 0.18 + 3), 0, 96);
  return {
    knowledgeId: contribution.knowledgeId ?? `domain:${contribution.domain}:${slug(contribution.title)}`,
    guidance: contribution.guidance,
    reason: contribution.whyUsed,
    confidenceScore: confidence,
    title: contribution.title,
    domain: contribution.domain,
    relevanceScore,
    qualityScore,
    relationshipCount: 0,
    advantages: contribution.advantages,
    disadvantages: contribution.disadvantages,
    standards: [],
    risks: contribution.disadvantages,
    rules: contribution.advantages.slice(0, 2),
    source: contribution.sourceModule,
    score,
  };
}

function domainForRecord(record: KnowledgeRecord, knowledge: ReasoningKnowledge): string {
  const metadata =
    record.payload?.metadata && typeof record.payload.metadata === "object"
      ? (record.payload.metadata as Record<string, unknown>)
      : null;
  const explicit = metadata?.domainId;
  if (typeof explicit === "string" && explicit.trim()) return explicit;
  if (knowledge.domain?.trim()) return knowledge.domain;
  const classification = [record.classification.creativeDomain, record.classification.businessDomain].filter(Boolean).join("-");
  return classification || record.category || record.knowledgeType;
}

function domainOverlaps(requested: string, domain: string): boolean {
  const a = requested.toLowerCase();
  const b = domain.toLowerCase();
  const tokens = ["camera", "light", "compos", "story", "market", "brand", "social", "render", "anim", "quality", "standard", "edit", "sales", "psych"];
  return tokens.some((token) => a.includes(token) && b.includes(token));
}

function inferDomainsFromText(text: string): string[] {
  const normalized = text.toLowerCase();
  const entries: Array<[string, string[]]> = [
    ["video-production-knowledge", ["video production", "production", "advertisement", "commercial", "workflow"]],
    ["camera-knowledge", ["camera", "lens", "aperture", "shot", "settings"]],
    ["camera-movement-knowledge", ["movement", "dolly", "gimbal", "pan", "tilt", "tracking"]],
    ["lighting-knowledge", ["lighting", "light", "key light", "softbox"]],
    ["composition-knowledge", ["composition", "framing", "rule of thirds"]],
    ["storytelling-knowledge", ["story", "storytelling", "narrative", "scene"]],
    ["animation-knowledge", ["animation", "motion graphics", "motion"]],
    ["rendering-knowledge", ["render", "rendering", "export", "codec"]],
    ["video-editing-knowledge", ["editing", "edit", "timeline", "cut", "montage"]],
    ["marketing-knowledge", ["marketing", "campaign", "audience", "conversion", "cta"]],
    ["branding-knowledge", ["brand", "branding", "identity", "voice"]],
    ["customer-psychology", ["customer", "psychology", "motivation", "attention"]],
    ["sales-psychology", ["sales", "persuasion", "scarcity", "offer"]],
    ["social-media-knowledge", ["social media", "tiktok", "instagram", "youtube", "facebook", "shorts", "reels"]],
    ["industry-standards-knowledge", ["quality", "standard", "checklist", "review", "approval"]],
  ];
  return entries.filter(([, terms]) => terms.some((term) => normalized.includes(term))).map(([domain]) => domain);
}

function identifyMissingInformation(
  request: string,
  objective: string,
  context: Record<string, unknown>,
  domains: string[]
): ProfessionalReasoningMissingInformation[] {
  const normalized = `${request} ${objective}`.toLowerCase();
  const planningRequest =
    /\b(plan|advertisement|campaign|product|workflow|strategy|recommend|compare)\b/.test(normalized) || domains.length > 0;
  if (!planningRequest) return [];

  const missing: ProfessionalReasoningMissingInformation[] = [];
  if (!hasContext(context, ["product", "productName", "service"])) {
    missing.push({
      field: "product or service",
      severity: "important",
      reason: "Professional recommendations improve when the offering is known.",
    });
  }
  if (!hasContext(context, ["audience", "targetAudience", "customer"])) {
    missing.push({
      field: "target audience",
      severity: "important",
      reason: "Audience intent determines the appropriate message, format, and channel.",
    });
  }
  if (
    (domains.includes("social-media-knowledge") || domains.includes("rendering-knowledge")) &&
    !hasContext(context, ["platform", "channel", "deliveryPlatform"])
  ) {
    missing.push({
      field: "delivery platform",
      severity: "optional",
      reason: "Platform constraints affect format, export, and social-media recommendations.",
    });
  }
  if (domains.includes("branding-knowledge") && !hasContext(context, ["brand", "brandVoice", "brandName"])) {
    missing.push({
      field: "brand context",
      severity: "optional",
      reason: "Brand voice and identity constraints improve branding recommendations.",
    });
  }
  if (domains.includes("video-editing-knowledge")) {
    missing.push({
      field: "professional video-editing knowledge pack",
      severity: "important",
      reason: "Dedicated video-editing expansion is not content-ready; editing recommendations remain limited.",
    });
  }
  return missing;
}

function hasContext(context: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => {
    const value = context[key];
    return value !== undefined && value !== null && value !== "";
  });
}

function confidenceFor(
  selected: ReasoningCandidate | null,
  domainCount: number,
  missingInformation: ProfessionalReasoningMissingInformation[],
  domainContributionCount: number
): number {
  if (!selected) return 0;
  const breadthBonus = Math.min(domainCount, 4) * 2;
  const domainBonus = Math.min(domainContributionCount, 4) * 1;
  const missingPenalty = missingInformation.filter((item) => item.severity === "important").length * 8;
  return clamp(Math.round(selected.score + breadthBonus + domainBonus - missingPenalty), 0, 100);
}

function buildRejectionReason(candidate: ReasoningCandidate, selected: ReasoningCandidate | null): string {
  if (!selected) return "Not selected because a stronger verified option was unavailable.";
  if (candidate.domain !== selected.domain) {
    return `Not selected because ${selected.title} better matched the objective in domain ${selected.domain} with a higher combined evidence score (${selected.score}/100 vs ${candidate.score}/100).`;
  }
  return `Not selected because its combined knowledge evidence score (${candidate.score}/100) was lower than the selected option (${selected.score}/100).`;
}

function buildExplanation(
  selected: ReasoningCandidate,
  rejectedOptions: ProfessionalKnowledgeOption[],
  professionalStandards: string[],
  domainContributions: ProfessionalDomainContribution[],
  confidenceScore: number
): string {
  const usedDomains = unique([selected.domain, ...domainContributions.map((item) => item.domain)]);
  const rejected =
    rejectedOptions.length > 0
      ? ` Rejected ${rejectedOptions.length} alternative(s): ${rejectedOptions
          .slice(0, 2)
          .map((option) => `${option.title} (${option.rejectionReason ?? option.reason})`)
          .join(" ")}`
      : "";
  const standards =
    professionalStandards.length > 0
      ? ` Professional standards followed include: ${professionalStandards.slice(0, 2).join(" | ")}.`
      : "";
  return `Selected ${selected.title} (${selected.knowledgeId}) from ${selected.source} because it has the strongest verified combined confidence, quality, relevance, and domain fit across ${usedDomains.join(", ")}. Knowledge was used to ground the recommendation before any decision. Confidence ${confidenceScore}/100.${standards}${rejected}`;
}

function dedupeContributions(contributions: ProfessionalDomainContribution[]): ProfessionalDomainContribution[] {
  const seen = new Set<string>();
  const result: ProfessionalDomainContribution[] = [];
  for (const contribution of contributions) {
    const key = `${contribution.domain}|${contribution.knowledgeId ?? ""}|${contribution.guidance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(contribution);
  }
  return result.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function match(text: string, entries: Record<string, string>): string[] {
  return Object.entries(entries)
    .filter(([term]) => text.includes(term))
    .map(([, value]) => value);
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
}
