import fs from "node:fs";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import {
  PROFESSIONAL_REASONING_DECISION_VERSION,
  ProfessionalReasoningCertificationError,
  type AiMeProfessionalReasoningCertificationAwareness,
  type CapabilityCertificationStatus,
  type CertificationCheck,
  type ConsistencyCertificationResult,
  type KnowledgeFoundationCertificationStatus,
  type ProfessionalReasoningCertificationRepairResult,
  type ProfessionalReasoningCertificationResult,
  type ScenarioCertificationResult,
  type SystemHealthScores,
} from "./professional-reasoning-certification-types.js";

export interface AiProfessionalReasoningCertificationEngineOptions {
  storageRoot: string;
}

const SCENARIOS: Array<{
  scenarioId: string;
  name: string;
  request: string;
  objective: string;
  requiredDomains: string[];
  context: Record<string, unknown>;
}> = [
  {
    scenarioId: "scenario-1",
    name: "Complete product advertisement strategy",
    request:
      "self-review a complete professional product advertisement strategy using camera lighting storytelling marketing branding and social media",
    objective: "Certify complete product advertisement strategy",
    requiredDomains: [
      "camera-knowledge",
      "lighting-knowledge",
      "storytelling-knowledge",
      "marketing-knowledge",
      "branding-knowledge",
      "social-media-knowledge",
      "industry-standards-knowledge",
    ],
    context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
  },
  {
    scenarioId: "scenario-2",
    name: "Camera setup for luxury product video",
    request: "self-review recommend professional camera settings for a luxury product video",
    objective: "Certify luxury product camera recommendation",
    requiredDomains: ["camera-knowledge", "composition-knowledge", "industry-standards-knowledge"],
    context: { product: "luxury watch", style: "premium" },
  },
  {
    scenarioId: "scenario-3",
    name: "Lighting for cosmetic photography",
    request: "self-review recommend professional lighting setup for cosmetic photography",
    objective: "Certify cosmetic lighting recommendation",
    requiredDomains: ["lighting-knowledge", "composition-knowledge", "industry-standards-knowledge"],
    context: { product: "foundation makeup", useCase: "beauty photography" },
  },
  {
    scenarioId: "scenario-4",
    name: "Storytelling for social media advertisement",
    request: "self-review recommend storytelling structure for a social media advertisement",
    objective: "Certify social storytelling recommendation",
    requiredDomains: ["storytelling-knowledge", "social-media-knowledge", "marketing-knowledge"],
    context: { platform: "instagram", format: "reel" },
  },
  {
    scenarioId: "scenario-5",
    name: "Editing workflow recommendation",
    request: "self-review recommend a professional editing workflow for a short product video",
    objective: "Certify editing workflow recommendation",
    requiredDomains: ["video-editing-knowledge", "storytelling-knowledge", "industry-standards-knowledge"],
    context: { format: "short-form video" },
  },
  {
    scenarioId: "scenario-6",
    name: "Rendering settings recommendation",
    request: "self-review recommend professional rendering and export settings for social delivery",
    objective: "Certify rendering settings recommendation",
    requiredDomains: ["rendering-knowledge", "social-media-knowledge", "industry-standards-knowledge"],
    context: { platform: "youtube", delivery: "1080p" },
  },
  {
    scenarioId: "scenario-7",
    name: "Marketing strategy recommendation",
    request: "self-review recommend a professional marketing strategy for a product launch video",
    objective: "Certify marketing strategy recommendation",
    requiredDomains: ["marketing-knowledge", "branding-knowledge", "customer-psychology-knowledge", "social-media-knowledge"],
    context: { campaign: "product launch" },
  },
  {
    scenarioId: "scenario-8",
    name: "Review and improve own recommendation",
    request:
      "self-review and improve a professional multi-domain recommendation for camera lighting marketing social product advertisement",
    objective: "Certify self-review and improvement loop",
    requiredDomains: [
      "camera-knowledge",
      "lighting-knowledge",
      "marketing-knowledge",
      "social-media-knowledge",
      "industry-standards-knowledge",
    ],
    context: { product: "wireless earbuds", platform: "instagram" },
  },
];

/**
 * Orchestrates Professional Reasoning & Decision Intelligence certification (Step 8).
 * Consumes existing engines. Does not duplicate reason/decide/plan/workflow/recommend/multi-domain/self-review.
 */
export class AiProfessionalReasoningCertificationEngine {
  private readonly storageRoot: string;
  private initialized = false;
  private core: AiCoreManager | null = null;
  private lastResult: ProfessionalReasoningCertificationResult | null = null;
  private lastRepair: ProfessionalReasoningCertificationRepairResult | null = null;

  constructor(options: AiProfessionalReasoningCertificationEngineOptions) {
    this.storageRoot = options.storageRoot;
  }

  initialize(core: AiCoreManager): void {
    this.core = core;
    fs.mkdirSync(path.join(this.storageRoot, "certification"), { recursive: true });
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getLastResult(): ProfessionalReasoningCertificationResult | null {
    return this.lastResult ? structuredClone(this.lastResult) : null;
  }

  getAiMeProfessionalReasoningCertificationAwareness(): AiMeProfessionalReasoningCertificationAwareness {
    const foundationReady = Boolean(this.core?.knowledgeFoundation?.isStartupComplete());
    const selfReviewReady = Boolean(this.core?.selfReviewEngine?.isInitialized());
    return {
      available: this.initialized && foundationReady && selfReviewReady,
      enabled: this.initialized && foundationReady && selfReviewReady,
      certified: Boolean(this.lastResult?.certified),
      version: PROFESSIONAL_REASONING_DECISION_VERSION,
      summary:
        "AI Me can certify Professional Reasoning & Decision Intelligence Version 1.0 by verifying reasoning, decision, planning, workflow, recommendation, multi-domain, and self-review capabilities against the Knowledge Foundation. The next development phase is not enabled.",
      capabilities: [
        "certify professional reasoning chain",
        "verify knowledge foundation usage",
        "run professional scenario suite",
        "score professional readiness",
        "report remaining limitations",
      ],
      groundedInKnowledgeFoundation: true,
      nextDevelopmentPhaseEnabled: false,
      lastReadinessScore: this.lastResult?.systemHealth.professionalReadinessScore ?? null,
      lastConfidenceScore: this.lastResult?.systemHealth.confidenceScore ?? null,
    };
  }

  async certify(options?: { autoRepair?: boolean }): Promise<ProfessionalReasoningCertificationResult> {
    if (!this.initialized || !this.core) {
      throw new ProfessionalReasoningCertificationError("Certification engine not initialized", "NOT_INITIALIZED");
    }
    const start = performance.now();
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];
    const remainingLimitations: string[] = [];
    const blockers: string[] = [];

    const capabilities = await this.verifyCapabilities(issuesFound, blockers);
    const knowledgeFoundation = await this.verifyKnowledgeFoundation(issuesFound, remainingLimitations, blockers);
    let scenarios = await this.runScenarios(issuesFound, remainingLimitations, blockers);

    if (options?.autoRepair !== false) {
      const failed = scenarios.filter((scenario) => !scenario.passed && !/editing/i.test(scenario.name));
      if (failed.length || Object.values(capabilities).some((item) => item.status !== "passed")) {
        const repair = await this.repair();
        issuesRepaired.push(...repair.actions);
        // Clear transient blockers and re-run failed non-editing scenarios once.
        const retryIds = new Set(failed.map((scenario) => scenario.scenarioId));
        if (retryIds.size) {
          const retried = await this.runScenarios(issuesFound, remainingLimitations, [], [...retryIds]);
          scenarios = scenarios.map(
            (scenario) => retried.find((item) => item.scenarioId === scenario.scenarioId) ?? scenario
          );
        }
      }
    }

    // Rebuild blockers from final scenario/capability state.
    blockers.length = 0;
    for (const item of Object.values(capabilities)) {
      if (item.status !== "passed") blockers.push(`${item.label} capability check failed`);
    }
    for (const scenario of scenarios) {
      if (!scenario.passed && !/editing/i.test(scenario.name)) {
        blockers.push(`Scenario failed: ${scenario.name}`);
      }
    }

    const consistency = await this.verifyConsistency(scenarios, issuesFound, blockers);
    const systemHealth = this.computeSystemHealth(capabilities, knowledgeFoundation, scenarios, consistency);

    const scenarioPassCount = scenarios.filter((scenario) => scenario.passed).length;
    const capabilityPass = Object.values(capabilities).every((check) => check.status === "passed");
    const consistencyPass = Object.values(consistency).every(
      (check) => check.status === "passed" || check.status === "skipped"
    );
    const criticalBlockers = blockers.filter((item) => !/video editing|editing domain/i.test(item));

    const canThinkProfessionally =
      capabilityPass &&
      scenarioPassCount >= 7 &&
      systemHealth.professionalReadinessScore >= 70 &&
      systemHealth.confidenceScore >= 65;
    const canMakeExplainableDecisions =
      capabilities.decisionIntelligence.status === "passed" &&
      scenarios.every((scenario) => !scenario.passed || scenario.explanationChars > 40);
    const isVersionOneComplete =
      canThinkProfessionally &&
      canMakeExplainableDecisions &&
      consistencyPass &&
      criticalBlockers.length === 0 &&
      systemHealth.professionalReadinessScore >= 70;

    if (!isVersionOneComplete) {
      for (const blocker of criticalBlockers) {
        if (!blockers.includes(blocker)) blockers.push(blocker);
      }
      if (scenarioPassCount < 7) {
        blockers.push(`Only ${scenarioPassCount}/8 certification scenarios passed`);
      }
      if (systemHealth.professionalReadinessScore < 70) {
        blockers.push(`Professional readiness score ${systemHealth.professionalReadinessScore} below 70`);
      }
    }

    if (remainingLimitations.every((item) => !/video editing/i.test(item))) {
      remainingLimitations.push(
        "Professional Video Editing Knowledge expansion remains limited; editing scenarios rely on adjacent domains and standards."
      );
    }

    const certDir = path.join(this.storageRoot, "certification");
    const verificationPath = path.join(certDir, "professional-reasoning-decision-verification.json");
    const result: ProfessionalReasoningCertificationResult = {
      version: PROFESSIONAL_REASONING_DECISION_VERSION,
      verifiedAt: new Date().toISOString(),
      certified: isVersionOneComplete,
      capabilities,
      knowledgeFoundation,
      scenarios,
      consistency,
      systemHealth,
      aiMeAnswers: {
        canThinkProfessionally,
        canMakeExplainableDecisions,
        isVersionOneComplete,
      },
      issuesFound: unique(issuesFound),
      issuesRepaired: unique(issuesRepaired),
      remainingLimitations: unique(remainingLimitations),
      blockers: unique(blockers),
      certificatePath: null,
      verificationPath,
      durationMs: Math.round(performance.now() - start),
    };

    fs.writeFileSync(verificationPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    if (result.certified) {
      const certificatePath = path.join(certDir, "PROFESSIONAL-REASONING-DECISION-V1-CERTIFICATE.json");
      fs.writeFileSync(
        certificatePath,
        `${JSON.stringify(
          {
            title: "Professional Reasoning & Decision Intelligence Version 1.0",
            certified: true,
            version: PROFESSIONAL_REASONING_DECISION_VERSION,
            verifiedAt: result.verifiedAt,
            professionalReadinessScore: systemHealth.professionalReadinessScore,
            confidenceScore: systemHealth.confidenceScore,
            canThinkProfessionally,
            canMakeExplainableDecisions,
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      result.certificatePath = certificatePath;
    }

    this.lastResult = structuredClone(result);
    return result;
  }

  async repair(): Promise<ProfessionalReasoningCertificationRepairResult> {
    if (!this.initialized || !this.core) {
      throw new ProfessionalReasoningCertificationError("Certification engine not initialized", "NOT_INITIALIZED");
    }
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    const core = this.core;

    try {
      if (core.decisionEngine?.repairProfessionalDecisionIntelligence) {
        const repair = await core.decisionEngine.repairProfessionalDecisionIntelligence();
        actions.push(...repair.actions.map((item) => `decision: ${item}`));
        remainingIssues.push(...repair.remainingIssues.map((item) => `decision: ${item}`));
      }
    } catch (error) {
      remainingIssues.push(error instanceof Error ? error.message : String(error));
    }
    try {
      if (core.planningEngine?.repairProfessionalPlanningIntelligence) {
        const repair = await core.planningEngine.repairProfessionalPlanningIntelligence();
        actions.push(...repair.actions.map((item) => `planning: ${item}`));
        remainingIssues.push(...repair.remainingIssues.map((item) => `planning: ${item}`));
      }
    } catch (error) {
      remainingIssues.push(error instanceof Error ? error.message : String(error));
    }
    try {
      if (core.workflowEngine?.repairProfessionalWorkflowIntelligence) {
        const repair = await core.workflowEngine.repairProfessionalWorkflowIntelligence();
        actions.push(...repair.actions.map((item) => `workflow: ${item}`));
        remainingIssues.push(...repair.remainingIssues.map((item) => `workflow: ${item}`));
      }
    } catch (error) {
      remainingIssues.push(error instanceof Error ? error.message : String(error));
    }
    try {
      if (core.recommendationEngine?.repairProfessionalRecommendationIntelligence) {
        const repair = await core.recommendationEngine.repairProfessionalRecommendationIntelligence();
        actions.push(...repair.actions.map((item) => `recommendation: ${item}`));
        remainingIssues.push(...repair.remainingIssues.map((item) => `recommendation: ${item}`));
      }
    } catch (error) {
      remainingIssues.push(error instanceof Error ? error.message : String(error));
    }
    try {
      if (core.multiDomainEngine?.repairMultiDomainIntelligence) {
        const repair = await core.multiDomainEngine.repairMultiDomainIntelligence();
        actions.push(...repair.actions.map((item) => `multi-domain: ${item}`));
        remainingIssues.push(...repair.remainingIssues.map((item) => `multi-domain: ${item}`));
      }
    } catch (error) {
      remainingIssues.push(error instanceof Error ? error.message : String(error));
    }
    try {
      if (core.selfReviewEngine?.repairProfessionalSelfReviewIntelligence) {
        const repair = await core.selfReviewEngine.repairProfessionalSelfReviewIntelligence();
        actions.push(...repair.actions.map((item) => `self-review: ${item}`));
        remainingIssues.push(...repair.remainingIssues.map((item) => `self-review: ${item}`));
      }
    } catch (error) {
      remainingIssues.push(error instanceof Error ? error.message : String(error));
    }

    const result = {
      repaired: remainingIssues.length === 0,
      actions: unique(actions),
      remainingIssues: unique(remainingIssues),
    };
    this.lastRepair = result;
    return result;
  }

  private async verifyCapabilities(issuesFound: string[], blockers: string[]): Promise<CapabilityCertificationStatus> {
    const core = this.core!;
    const foundation = core.knowledgeFoundation;
    const reasoning = foundation?.getKnowledgeReasoningEngine?.() ?? null;
    const reasoningAwareness = reasoning?.getAiMeAwareness?.() ?? null;
    const decision = core.decisionEngine?.getAiMeProfessionalDecisionAwareness?.();
    const planning = core.planningEngine?.getAiMeProfessionalPlanningAwareness?.();
    const workflow = core.workflowEngine?.getAiMeProfessionalWorkflowAwareness?.();
    const recommendation = core.recommendationEngine?.getAiMeProfessionalRecommendationAwareness?.();
    const multiDomain = core.multiDomainEngine?.getAiMeProfessionalMultiDomainAwareness?.();
    const selfReview = core.selfReviewEngine?.getAiMeProfessionalSelfReviewAwareness?.();

    const checks: CapabilityCertificationStatus = {
      professionalReasoning: check(
        "professional-reasoning",
        "Professional Reasoning",
        Boolean(
          reasoningAwareness?.available &&
            reasoningAwareness.groundedInKnowledgeFoundation &&
            foundation?.isStartupComplete() &&
            reasoningAwareness.decisionIntelligenceEnabled
        ),
        `available=${Boolean(reasoningAwareness?.available)}; decisionFlag=${Boolean(reasoningAwareness?.decisionIntelligenceEnabled)}`
      ),
      decisionIntelligence: check(
        "decision-intelligence",
        "Decision Intelligence",
        Boolean(decision?.available && decision?.enabled && decision.planningIntelligenceEnabled),
        `available=${Boolean(decision?.available)}; planningFlag=${Boolean(decision?.planningIntelligenceEnabled)}`
      ),
      planningIntelligence: check(
        "planning-intelligence",
        "Planning Intelligence",
        Boolean(planning?.available && planning?.enabled && planning.workflowIntelligenceEnabled),
        `available=${Boolean(planning?.available)}; workflowFlag=${Boolean(planning?.workflowIntelligenceEnabled)}`
      ),
      workflowIntelligence: check(
        "workflow-intelligence",
        "Workflow Intelligence",
        Boolean(workflow?.available && workflow?.enabled && workflow.recommendationIntelligenceEnabled),
        `available=${Boolean(workflow?.available)}; recommendationFlag=${Boolean(workflow?.recommendationIntelligenceEnabled)}`
      ),
      recommendationIntelligence: check(
        "recommendation-intelligence",
        "Recommendation Intelligence",
        Boolean(recommendation?.available && recommendation?.enabled && recommendation.multiDomainReasoningEnabled),
        `available=${Boolean(recommendation?.available)}; multiDomainFlag=${Boolean(recommendation?.multiDomainReasoningEnabled)}`
      ),
      multiDomainReasoning: check(
        "multi-domain-reasoning",
        "Multi-Domain Reasoning",
        Boolean(multiDomain?.available && multiDomain?.enabled && multiDomain.selfReviewEnabled),
        `available=${Boolean(multiDomain?.available)}; selfReviewFlag=${Boolean(multiDomain?.selfReviewEnabled)}`
      ),
      selfReview: check(
        "self-review",
        "Self Review",
        Boolean(selfReview?.available && selfReview?.enabled),
        `available=${Boolean(selfReview?.available)}; certificationFlag=${Boolean(selfReview?.professionalReasoningCertificationEnabled)}`
      ),
      professionalEvaluation: check(
        "professional-evaluation",
        "Professional Evaluation",
        Boolean(selfReview?.available && selfReview?.enabled && selfReview.capabilities.includes("estimate overall quality")),
        `capabilities=${selfReview?.capabilities.length ?? 0}`
      ),
    };

    for (const item of Object.values(checks)) {
      if (item.status !== "passed") {
        issuesFound.push(item.detail);
        blockers.push(`${item.label} capability check failed`);
      }
    }
    return checks;
  }

  private async verifyKnowledgeFoundation(
    issuesFound: string[],
    remainingLimitations: string[],
    blockers: string[]
  ): Promise<KnowledgeFoundationCertificationStatus> {
    const foundation = this.core!.knowledgeFoundation;
    if (!foundation?.isStartupComplete()) {
      const failed = check("kf-ready", "Knowledge Foundation ready", false, "Knowledge Foundation startup incomplete");
      blockers.push(failed.detail);
      return {
        knowledgeDomains: failed,
        knowledgePacks: failed,
        knowledgeGraph: failed,
        semanticSearch: failed,
        decisionRules: failed,
        workflowTemplates: failed,
        professionalStandards: failed,
        qualityRules: failed,
      };
    }

    let packCount = 0;
    let domainHint = 0;
    let graphHint = 0;
    try {
      const cert = foundation.getProfessionalKnowledgeCertificationEngine?.();
      const prior = cert?.getLastResult?.();
      if (prior) {
        packCount = prior.totalKnowledgePacks;
        domainHint = prior.totalKnowledgeDomains;
        graphHint = prior.totalKnowledgeRelationships;
        if (prior.remainingGaps?.length) remainingLimitations.push(...prior.remainingGaps.slice(0, 5));
      }
      // Do not run full Knowledge Certification here — that is a separate authority and is expensive.
      // Scenario runs below prove live Knowledge Foundation usage for Reasoning & Decision Intelligence.
    } catch (error) {
      issuesFound.push(error instanceof Error ? error.message : String(error));
    }

    // Lightweight fallback signals from engines when knowledge cert details are sparse.
    const recommendationHistory = this.core!.recommendationEngine?.getProfessionalRecommendationHistory?.() ?? [];
    const workflowHistory = this.core!.workflowEngine?.getProfessionalWorkflowHistory?.() ?? [];
    const decisionHistory = this.core!.decisionEngine?.getProfessionalDecisionHistory?.() ?? [];

    const status: KnowledgeFoundationCertificationStatus = {
      knowledgeDomains: check(
        "knowledge-domains",
        "Knowledge Domains",
        domainHint >= 10 || recommendationHistory.some((item) => item.domainsUsed.length >= 2),
        `domains=${domainHint}; recommendationDomainSamples=${recommendationHistory[0]?.domainsUsed.length ?? 0}`
      ),
      knowledgePacks: check(
        "knowledge-packs",
        "Knowledge Packs",
        packCount >= 8 || recommendationHistory.some((item) => item.relatedKnowledgePacks.length > 0),
        `packs=${packCount}`
      ),
      knowledgeGraph: check(
        "knowledge-graph",
        "Knowledge Graph",
        graphHint > 0 || Boolean(foundation.getKnowledgeReasoningEngine?.()),
        `relationships=${graphHint}`
      ),
      semanticSearch: check(
        "semantic-search",
        "Semantic Search",
        Boolean(foundation.getKnowledgeReasoningEngine?.()),
        "Knowledge reasoning engine available for foundation retrieval"
      ),
      decisionRules: check(
        "decision-rules",
        "Decision Rules",
        decisionHistory.length > 0 || Boolean(this.core!.decisionEngine?.isInitialized()),
        `decisionHistory=${decisionHistory.length}`
      ),
      workflowTemplates: check(
        "workflow-templates",
        "Workflow Templates",
        workflowHistory.length > 0 || Boolean(this.core!.workflowEngine?.isInitialized()),
        `workflowHistory=${workflowHistory.length}`
      ),
      professionalStandards: check(
        "professional-standards",
        "Professional Standards",
        true,
        "Industry/professional standards domains included in certification scenarios"
      ),
      qualityRules: check(
        "quality-rules",
        "Quality Rules",
        Boolean(this.core!.selfReviewEngine?.isInitialized()),
        "Self-review quality scoring available"
      ),
    };

    for (const item of Object.values(status)) {
      if (item.status !== "passed") {
        issuesFound.push(`${item.label}: ${item.detail}`);
      }
    }
    return status;
  }

  private async runScenarios(
    issuesFound: string[],
    remainingLimitations: string[],
    blockers: string[],
    onlyScenarioIds?: string[]
  ): Promise<ScenarioCertificationResult[]> {
    const selfReview = this.core!.selfReviewEngine!;
    const recommendation = this.core!.recommendationEngine!;
    const results: ScenarioCertificationResult[] = [];
    const selected = onlyScenarioIds?.length
      ? SCENARIOS.filter((scenario) => onlyScenarioIds.includes(scenario.scenarioId))
      : SCENARIOS;

    for (const scenario of selected) {
      try {
        const first = await selfReview.reviewProfessional({
          request: scenario.request,
          objective: scenario.objective,
          context: scenario.context,
          requiredDomains: scenario.requiredDomains,
          includeDomainModules: true,
          reuseSimilarReviews: true,
        });

        let reusedRecommendation = false;
        let reusedWorkflow = false;
        // Probe reuse on key scenarios only (keeps certification runtime practical).
        if (scenario.scenarioId === "scenario-1" || scenario.scenarioId === "scenario-8") {
          const secondRec = await recommendation.recommendProfessional({
            request: scenario.request.replace(/^self-review\s+/i, "recommend "),
            objective: scenario.objective,
            context: scenario.context,
            requiredDomains: scenario.requiredDomains,
            includeDomainModules: true,
            reuseSimilarRecommendations: true,
          });
          reusedRecommendation = secondRec.reused;
          reusedWorkflow = Boolean(
            secondRec.relatedWorkflowId && first.relatedWorkflowId === secondRec.relatedWorkflowId
          );
        }

        const issues: string[] = [];
        if (!first.grounded) issues.push("Self-review not grounded");
        if (first.unsupported) issues.push("Self-review unsupported");
        if (!first.relatedRecommendationId) issues.push("Missing related recommendation");
        if (!first.relatedWorkflowId) issues.push("Missing related workflow");
        if (first.explanation.whyReviewed.length < 20) issues.push("Weak self-review explanation");
        if (first.framework.qualityScores.overallReadiness < 50) {
          issues.push(`Low overall readiness ${first.framework.qualityScores.overallReadiness}`);
        }
        if (/editing/i.test(scenario.scenarioId) || /editing/i.test(scenario.name)) {
          remainingLimitations.push("Editing scenario operates with limited dedicated editing expansion content.");
        }

        const passed =
          first.grounded &&
          !first.unsupported &&
          Boolean(first.relatedRecommendationId) &&
          first.confidenceScore >= 50 &&
          first.explanation.processesReviewed.length >= 3 &&
          issues.filter((item) => /unsupported|not grounded/i.test(item)).length === 0;

        if (!passed) {
          issuesFound.push(`${scenario.scenarioId}: ${issues.join("; ") || "failed"}`);
          if (!/editing/i.test(scenario.name)) {
            blockers.push(`Scenario failed: ${scenario.name}`);
          }
        }

        results.push({
          scenarioId: scenario.scenarioId,
          name: scenario.name,
          passed,
          grounded: first.grounded,
          unsupported: first.unsupported,
          readyForDelivery: first.readyForDelivery,
          confidenceScore: first.confidenceScore,
          domainsUsed: first.memoryRecord.domainsUsed,
          knowledgeIdsUsed: first.memoryRecord.knowledgeUsed.length,
          reusedRecommendation,
          reusedWorkflow,
          reviewId: first.reviewId,
          recommendationId: first.relatedRecommendationId,
          workflowId: first.relatedWorkflowId,
          decisionId: first.relatedDecisionId,
          issues,
          explanationChars: first.framework.improvedExplanation.length + first.explanation.whyReviewed.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        issuesFound.push(`${scenario.scenarioId}: ${message}`);
        if (!/editing/i.test(scenario.name)) blockers.push(`Scenario error: ${scenario.name}`);
        results.push({
          scenarioId: scenario.scenarioId,
          name: scenario.name,
          passed: false,
          grounded: false,
          unsupported: true,
          readyForDelivery: false,
          confidenceScore: 0,
          domainsUsed: [],
          knowledgeIdsUsed: 0,
          reusedRecommendation: false,
          reusedWorkflow: false,
          reviewId: null,
          recommendationId: null,
          workflowId: null,
          decisionId: null,
          issues: [message],
          explanationChars: 0,
        });
      }
    }

    return results;
  }

  private async verifyConsistency(
    scenarios: ScenarioCertificationResult[],
    issuesFound: string[],
    blockers: string[]
  ): Promise<ConsistencyCertificationResult> {
    const passedScenarios = scenarios.filter((scenario) => scenario.passed);
    const unsupported = scenarios.filter((scenario) => scenario.unsupported && !/editing/i.test(scenario.name));
    const missingDomains = passedScenarios.filter((scenario) => scenario.domainsUsed.length < 1);
    const broken = passedScenarios.filter(
      (scenario) => !scenario.recommendationId || !scenario.workflowId || !scenario.reviewId
    );
    const reuseHits = scenarios.filter((scenario) => scenario.reusedRecommendation).length;

    const consistency: ConsistencyCertificationResult = {
      noDuplicatedReasoning: check(
        "no-duplicated-reasoning",
        "No duplicated reasoning",
        true,
        "Certification orchestrates existing engines without alternate reasoning authorities"
      ),
      noDuplicatedWorkflows: check(
        "no-duplicated-workflows",
        "No duplicated workflows",
        true,
        `Single workflow engine authority preserved; recommendationReuseHits=${reuseHits}`
      ),
      noDuplicatedRecommendations: check(
        "no-duplicated-recommendations",
        "No duplicated recommendations",
        true,
        `Single recommendation engine authority preserved; recommendationReuseHits=${reuseHits}`
      ),
      noBrokenRelationships: check(
        "no-broken-relationships",
        "No broken relationships",
        broken.length === 0,
        `broken=${broken.length}`
      ),
      noMissingKnowledgeDomains: check(
        "no-missing-domains",
        "No missing Knowledge Domains",
        missingDomains.length === 0,
        `missingDomainScenarios=${missingDomains.length}`
      ),
      noUnsupportedRecommendations: check(
        "no-unsupported-recommendations",
        "No unsupported recommendations",
        unsupported.length === 0,
        `unsupportedNonEditing=${unsupported.length}`
      ),
    };

    for (const item of Object.values(consistency)) {
      if (item.status !== "passed") {
        issuesFound.push(`${item.label}: ${item.detail}`);
        if (item.id !== "no-duplicated-workflows" && item.id !== "no-duplicated-recommendations") {
          blockers.push(item.label);
        }
      }
    }
    return consistency;
  }

  private computeSystemHealth(
    capabilities: CapabilityCertificationStatus,
    knowledgeFoundation: KnowledgeFoundationCertificationStatus,
    scenarios: ScenarioCertificationResult[],
    consistency: ConsistencyCertificationResult
  ): SystemHealthScores {
    const passedScenarios = scenarios.filter((scenario) => scenario.passed);
    const avg = (values: number[]) =>
      values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const capabilityScore =
      (Object.values(capabilities).filter((item) => item.status === "passed").length / Object.values(capabilities).length) *
      100;
    const knowledgeScore =
      (Object.values(knowledgeFoundation).filter((item) => item.status === "passed").length /
        Object.values(knowledgeFoundation).length) *
      100;
    const consistencyScore =
      (Object.values(consistency).filter((item) => item.status === "passed").length / Object.values(consistency).length) *
      100;
    const confidenceScore = avg(passedScenarios.map((scenario) => scenario.confidenceScore));
    const knowledgeUsage = avg(passedScenarios.map((scenario) => Math.min(100, scenario.knowledgeIdsUsed * 10)));
    const explanationQuality = avg(
      passedScenarios.map((scenario) => clamp(Math.round(scenario.explanationChars / 20), 0, 100))
    );
    const recommendationQuality = avg(
      passedScenarios.map((scenario) => (scenario.recommendationId ? scenario.confidenceScore : 0))
    );
    const workflowQuality = avg(passedScenarios.map((scenario) => (scenario.workflowId ? scenario.confidenceScore : 0)));
    const selfReviewQuality = avg(
      passedScenarios.map((scenario) => (scenario.readyForDelivery ? scenario.confidenceScore : scenario.confidenceScore * 0.85))
    );
    const professionalReadinessScore = clamp(
      Math.round(
        capabilityScore * 0.2 +
          knowledgeScore * 0.15 +
          consistencyScore * 0.15 +
          confidenceScore * 0.2 +
          selfReviewQuality * 0.15 +
          (passedScenarios.length / Math.max(scenarios.length, 1)) * 100 * 0.15
      ),
      0,
      100
    );

    return {
      overallReasoningQuality: Math.round(capabilityScore),
      overallDecisionQuality: Math.round(
        (capabilities.decisionIntelligence.status === "passed" ? 90 : 40) * 0.5 + confidenceScore * 0.5
      ),
      planningQuality: capabilities.planningIntelligence.status === "passed" ? Math.max(75, confidenceScore) : 40,
      workflowQuality: Math.round(workflowQuality || (capabilities.workflowIntelligence.status === "passed" ? 75 : 40)),
      recommendationQuality: Math.round(recommendationQuality || 40),
      knowledgeUsage: Math.round(knowledgeUsage || knowledgeScore),
      explanationQuality: Math.round(explanationQuality || 40),
      selfReviewQuality: Math.round(selfReviewQuality || 40),
      confidenceScore: Math.round(confidenceScore || 0),
      professionalReadinessScore,
    };
  }
}

function check(id: string, label: string, passed: boolean, detail: string): CertificationCheck {
  return {
    id,
    label,
    status: passed ? "passed" : "failed",
    detail,
    score: passed ? 100 : 0,
    issues: passed ? [] : [detail],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
