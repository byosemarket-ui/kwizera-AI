/**
 * Professional Knowledge Certification & Capability Verification — Expansion Step 10.
 * Reuses the Knowledge Foundation, professional domain installers, and graph/retrieval engines.
 * It never creates media, overwrites knowledge records, or certifies an incomplete expansion.
 */

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "./knowledge-foundation.js";
import type { KnowledgePack, KnowledgePackSlug } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import {
  PROFESSIONAL_KNOWLEDGE_EXPANSION_VERSION,
  ProfessionalKnowledgeCertificationError,
  type AiMeProfessionalKnowledgeCertificationAwareness,
  type ProfessionalCertificationCheckStatus,
  type ProfessionalKnowledgeCapabilityVerification,
  type ProfessionalKnowledgeCertificationCheck,
  type ProfessionalKnowledgeCertificationRepairResult,
  type ProfessionalKnowledgeCertificationResult,
  type ProfessionalKnowledgeDomainCertification,
  type ProfessionalKnowledgeFoundationVerification,
} from "./professional-knowledge-certification-types.js";

interface DomainSpec {
  domainId: string;
  name: string;
  packSlug: KnowledgePackSlug;
  health: () => { healthy: boolean } | null;
}

interface RepairableExpansion {
  getLastHealth(): { healthy: boolean } | null;
  repair(): Promise<{ repaired: boolean; actions: string[]; remainingIssues: string[] }>;
}

const DOMAIN_SPECS = (
  foundation: AiKnowledgeFoundation
): DomainSpec[] => [
  {
    domainId: "video-production-knowledge",
    name: "Video Production Knowledge",
    packSlug: "video-production",
    health: () => foundation.getProfessionalVideoProductionKnowledge().getLastHealth(),
  },
  {
    domainId: "camera-knowledge",
    name: "Camera Knowledge",
    packSlug: "camera",
    health: () => foundation.getProfessionalCameraKnowledge().getLastHealth(),
  },
  {
    domainId: "camera-movement-knowledge",
    name: "Camera Movement Knowledge",
    packSlug: "camera-movement",
    health: () => foundation.getProfessionalCameraKnowledge().getLastHealth(),
  },
  {
    domainId: "lighting-knowledge",
    name: "Lighting Knowledge",
    packSlug: "lighting",
    health: () => foundation.getProfessionalLightingCompositionKnowledge().getLastHealth(),
  },
  {
    domainId: "composition-knowledge",
    name: "Composition Knowledge",
    packSlug: "composition",
    health: () => foundation.getProfessionalLightingCompositionKnowledge().getLastHealth(),
  },
  {
    domainId: "storytelling-knowledge",
    name: "Storytelling Knowledge",
    packSlug: "storytelling",
    health: () => foundation.getProfessionalStorytellingSceneKnowledge().getLastHealth(),
  },
  {
    domainId: "scene-knowledge",
    name: "Scene Design Knowledge",
    packSlug: "scene",
    health: () => foundation.getProfessionalStorytellingSceneKnowledge().getLastHealth(),
  },
  {
    domainId: "animation-knowledge",
    name: "Animation Knowledge",
    packSlug: "animation",
    health: () => foundation.getProfessionalAnimationMotionRenderingKnowledge().getLastHealth(),
  },
  {
    domainId: "motion-graphics-knowledge",
    name: "Motion Graphics Knowledge",
    packSlug: "motion",
    health: () => foundation.getProfessionalAnimationMotionRenderingKnowledge().getLastHealth(),
  },
  {
    domainId: "rendering-knowledge",
    name: "Rendering Knowledge",
    packSlug: "rendering",
    health: () => foundation.getProfessionalAnimationMotionRenderingKnowledge().getLastHealth(),
  },
  {
    domainId: "video-editing-knowledge",
    name: "Video Editing Knowledge",
    packSlug: "editing",
    health: () => null,
  },
  {
    domainId: "marketing-knowledge",
    name: "Marketing Knowledge",
    packSlug: "marketing",
    health: () => foundation.getProfessionalMarketingBrandingPsychologyKnowledge().getLastHealth(),
  },
  {
    domainId: "branding-knowledge",
    name: "Branding Knowledge",
    packSlug: "branding",
    health: () => foundation.getProfessionalMarketingBrandingPsychologyKnowledge().getLastHealth(),
  },
  {
    domainId: "customer-psychology",
    name: "Customer Psychology Knowledge",
    packSlug: "customer-psychology",
    health: () => foundation.getProfessionalMarketingBrandingPsychologyKnowledge().getLastHealth(),
  },
  {
    domainId: "sales-psychology",
    name: "Sales Psychology Knowledge",
    packSlug: "sales-psychology",
    health: () => foundation.getProfessionalMarketingBrandingPsychologyKnowledge().getLastHealth(),
  },
  {
    domainId: "social-media-knowledge",
    name: "Social Media Knowledge",
    packSlug: "social-media",
    health: () => foundation.getProfessionalSocialMediaKnowledge().getLastHealth(),
  },
  {
    domainId: "industry-standards-knowledge",
    name: "Industry Best Practices & Professional Standards",
    packSlug: "industry-standards",
    health: () => foundation.getProfessionalIndustryStandardsQualityKnowledge().getLastHealth(),
  },
];

/**
 * Certifies Professional Knowledge Expansion only when all required professional domains,
 * packs, graph links, metadata, and AI Me capabilities are verified.
 */
export class ProfessionalKnowledgeCertificationEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private certDir = "";
  private initialized = false;
  private startupComplete = false;
  private lastResult: ProfessionalKnowledgeCertificationResult | null = null;
  private lastRepair: ProfessionalKnowledgeCertificationRepairResult | null = null;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.certDir = path.join(storageRoot, "knowledge", "certification");
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fsPromises.mkdir(this.certDir, { recursive: true });
    this.startupComplete = true;
    this.lastResult = await this.verify({ autoRepair: true });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  isCertified(): boolean {
    return this.lastResult?.certified === true;
  }

  getLastResult(): ProfessionalKnowledgeCertificationResult | null {
    return this.lastResult ? structuredClone(this.lastResult) : null;
  }

  getLastRepair(): ProfessionalKnowledgeCertificationRepairResult | null {
    return this.lastRepair ? structuredClone(this.lastRepair) : null;
  }

  async verify(options?: { autoRepair?: boolean }): Promise<ProfessionalKnowledgeCertificationResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const repairs = options?.autoRepair ? await this.repair() : null;
    const packs = foundation.getKnowledgeExtractionEngine().listPacks();
    const domains = this.verifyDomains(packs);
    const foundationChecks = await this.verifyFoundation(packs);
    const capabilities = await this.verifyCapabilities();

    const issuesFound = unique([
      ...domains.flatMap((domain) => domain.issues),
      ...flattenChecks(foundationChecks).flatMap((check) => check.issues),
      ...flattenChecks(capabilities).flatMap((check) => check.issues),
    ]);
    const rawRemainingGaps = unique([
      ...domains
        .filter((domain) => domain.status !== "passed")
        .map((domain) => `${domain.name}: ${domain.issues.join("; ")}`),
      ...flattenChecks(capabilities)
        .filter((check) => check.status === "blocked")
        .map((check) => `${check.label}: ${check.detail}`),
    ]);
    const editingBlocked = domains.some((domain) => domain.domainId === "video-editing-knowledge" && domain.status !== "passed");
    const remainingGaps = editingBlocked
      ? unique([
          ...rawRemainingGaps.filter((gap) => !/video editing|editing capability/i.test(gap)),
          "Professional Video Editing Knowledge: the domain is not content-ready, the editing pack has no professional content, and no dedicated AI Me expansion is installed.",
        ])
      : rawRemainingGaps;
    const allChecks = [
      ...domains.map((domain) => domain.status),
      ...flattenChecks(foundationChecks).map((check) => check.status),
      ...flattenChecks(capabilities).map((check) => check.status),
    ];
    const passedCount = allChecks.filter((status) => status === "passed").length;
    const maturityPercentage = Math.round((passedCount / Math.max(1, allChecks.length)) * 100);
    const certified = allChecks.every((status) => status === "passed") && issuesFound.length === 0;

    const graph = foundation.getGraphEngine().getGraph();
    const verificationPath = path.join(this.certDir, "professional-knowledge-verification-latest.json");
    const result: ProfessionalKnowledgeCertificationResult = {
      version: PROFESSIONAL_KNOWLEDGE_EXPANSION_VERSION,
      verifiedAt: new Date().toISOString(),
      certified,
      totalKnowledgeDomains: foundation.getKnowledgeDomainPlanner().listDomains().length,
      totalKnowledgePacks: packs.length,
      totalKnowledgeRelationships: graph.edgeCount,
      professionalCoverage: domains,
      capabilities,
      foundation: foundationChecks,
      issuesFound,
      issuesRepaired: repairs?.actions ?? [],
      remainingGaps,
      maturityPercentage,
      maturitySummary: certified
        ? `Professional Knowledge Expansion ${PROFESSIONAL_KNOWLEDGE_EXPANSION_VERSION} is certified and complete.`
        : `Professional Knowledge Expansion is not certified: ${remainingGaps.length} blocker(s) remain.`,
      certificatePath: null,
      verificationPath,
    };

    await fsPromises.mkdir(this.certDir, { recursive: true });
    await fsPromises.writeFile(verificationPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    if (certified) {
      result.certificatePath = await this.writeCertificate(result);
      await fsPromises.writeFile(verificationPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    }
    this.lastResult = result;
    return structuredClone(result);
  }

  async repair(): Promise<ProfessionalKnowledgeCertificationRepairResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    await fsPromises.mkdir(this.certDir, { recursive: true });
    actions.push("Ensured professional knowledge certification directory.");

    const graphIntegrity = foundation.getGraphEngine().validateIntegrity();
    if (graphIntegrity.issuesRepaired > 0) {
      actions.push(`Repaired ${graphIntegrity.issuesRepaired} graph integrity issue(s).`);
    }
    if (!graphIntegrity.valid) {
      remainingIssues.push(...graphIntegrity.diagnostics.filter((item) => !item.repaired).map((item) => item.detail));
    }

    const repairTargets: Array<{ name: string; expansion: RepairableExpansion }> = [
      { name: "Video Production", expansion: foundation.getProfessionalVideoProductionKnowledge() },
      { name: "Camera", expansion: foundation.getProfessionalCameraKnowledge() },
      { name: "Lighting & Composition", expansion: foundation.getProfessionalLightingCompositionKnowledge() },
      { name: "Storytelling & Scene", expansion: foundation.getProfessionalStorytellingSceneKnowledge() },
      { name: "Animation, Motion & Rendering", expansion: foundation.getProfessionalAnimationMotionRenderingKnowledge() },
      { name: "Marketing, Branding & Psychology", expansion: foundation.getProfessionalMarketingBrandingPsychologyKnowledge() },
      { name: "Social Media", expansion: foundation.getProfessionalSocialMediaKnowledge() },
      { name: "Industry Standards & Quality", expansion: foundation.getProfessionalIndustryStandardsQualityKnowledge() },
    ];
    for (const target of repairTargets) {
      const health = target.expansion.getLastHealth();
      if (health?.healthy !== false) continue;
      const repair = await target.expansion.repair();
      actions.push(...repair.actions.map((action) => `${target.name}: ${action}`));
      remainingIssues.push(...repair.remainingIssues.map((issue) => `${target.name}: ${issue}`));
    }

    try {
      await foundation.getKnowledgeExtractionEngine().reloadPacks();
      actions.push("Reloaded knowledge packs from local storage.");
    } catch (error) {
      remainingIssues.push(`Pack reload failed: ${errorMessage(error)}`);
    }

    const result = {
      repaired: remainingIssues.length === 0,
      actions: unique(actions),
      remainingIssues: unique(remainingIssues),
    };
    this.lastRepair = result;
    return structuredClone(result);
  }

  getAiMeAwareness(): AiMeProfessionalKnowledgeCertificationAwareness {
    this.ensureStarted();
    const result = this.lastResult;
    const certified = result?.certified === true;
    return {
      canVerifyProfessionalKnowledge: true,
      canExplainCertificationStatus: true,
      canReportKnowledgeGaps: true,
      certified,
      maturityPercentage: result?.maturityPercentage ?? 0,
      remainingGapCount: result?.remainingGaps.length ?? 0,
      summary: certified
        ? `Professional Knowledge Expansion ${PROFESSIONAL_KNOWLEDGE_EXPANSION_VERSION} is certified. AI Me can rely on the verified professional knowledge domains.`
        : `Professional Knowledge Expansion certification is incomplete. ${result?.remainingGaps.length ?? 0} verified gap(s) remain; AI Me can explain the gaps without claiming certification.`,
    };
  }

  private verifyDomains(packs: KnowledgePack[]): ProfessionalKnowledgeDomainCertification[] {
    const foundation = this.foundation!;
    return DOMAIN_SPECS(foundation).map((spec) => {
      const domain = foundation.getKnowledgeDomainPlanner().getDomain(spec.domainId);
      const pack = packs.find((candidate) => candidate.packSlug === spec.packSlug);
      const health = spec.health();
      const issues: string[] = [];
      const contentReady = domain?.metadata.contentReady === true;
      const packPresent = Boolean(pack);
      const packItemCount = pack?.items.length ?? 0;
      const metadataValid = Boolean(
        pack &&
          pack.packId &&
          pack.contentFingerprint &&
          pack.originalDocumentsPreserved &&
          pack.structuredKnowledge &&
          pack.items.every(
            (item) => typeof item.confidenceScore === "number" && typeof item.qualityScore === "number"
          )
      );
      const healthStatus = health ? (health.healthy ? "healthy" : "unhealthy") : "not-applicable";

      if (!domain) issues.push("Domain is not registered.");
      if (!contentReady) issues.push("Domain content is not ready.");
      if (!packPresent) issues.push(`Missing required pack: ${spec.packSlug}.`);
      if (packPresent && packItemCount === 0) issues.push(`Required pack ${spec.packSlug} has no professional knowledge items.`);
      if (packPresent && !metadataValid) issues.push(`Required pack ${spec.packSlug} has invalid metadata or scores.`);
      if (health && !health.healthy) issues.push("Professional expansion health check is unhealthy.");
      if (spec.domainId === "video-editing-knowledge" && health === null) {
        issues.push("No dedicated Professional Video Editing Knowledge expansion is installed.");
      }

      return {
        domainId: spec.domainId,
        name: spec.name,
        expectedPackSlug: spec.packSlug,
        contentReady,
        packPresent,
        packItemCount,
        metadataValid,
        healthStatus,
        status: issues.length === 0 ? "passed" : spec.domainId === "video-editing-knowledge" ? "blocked" : "failed",
        issues,
      };
    });
  }

  private async verifyFoundation(packs: KnowledgePack[]): Promise<ProfessionalKnowledgeFoundationVerification> {
    const foundation = this.foundation!;
    const graphIntegrity = foundation.getGraphEngine().validateIntegrity();
    const graph = foundation.getGraphEngine().getGraph();
    const storage = foundation.getStorageEngine();
    const indexEntries = storage.getIndexEntries();
    const planner = foundation.getKnowledgeDomainPlanner();
    const expectedDomainIds = DOMAIN_SPECS(foundation).map((spec) => spec.domainId);
    const expectedPackSlugs = new Set(DOMAIN_SPECS(foundation).map((spec) => spec.packSlug));
    const professionalPacks = packs.filter((pack) => expectedPackSlugs.has(pack.packSlug));
    const domainIssues = expectedDomainIds
      .filter((domainId) => !planner.getDomain(domainId))
      .map((domainId) => `Missing required domain: ${domainId}`);
    const duplicatePackSlugs = packs
      .map((pack) => pack.packSlug)
      .filter((slug, index, values) => values.indexOf(slug) !== index);
    const packIssues = [
      ...duplicatePackSlugs.map((slug) => `Duplicate knowledge pack slug: ${slug}`),
      ...professionalPacks
        .filter((pack) => !pack.packId || !pack.contentFingerprint || !pack.originalDocumentsPreserved)
        .map((pack) => `Invalid pack metadata: ${pack.packSlug}`),
    ];
    const metadataIssues = professionalPacks.flatMap((pack) =>
      pack.items
        .filter(
          (item) =>
            !item.knowledgeId ||
            !item.title ||
            !item.workflow.length ||
            !item.bestPractices.length ||
            !item.examples.length ||
            typeof item.confidenceScore !== "number" ||
            typeof item.qualityScore !== "number"
        )
        .map((item) => `Invalid item metadata: ${pack.packSlug}/${item.knowledgeId || item.title || "unknown"}`)
    );
    const duplicateIndexIds = indexEntries
      .map((entry) => entry.knowledgeId)
      .filter((knowledgeId, index, values) => values.indexOf(knowledgeId) !== index);
    const versionIssues = DOMAIN_SPECS(foundation)
      .filter((spec) => {
        const pack = packs.find((candidate) => candidate.packSlug === spec.packSlug);
        if (!pack) return false;
        return !fs.existsSync(path.join(foundation.getKnowledgeRoot(), "packs", spec.packSlug, "versions"));
      })
      .map((spec) => `Missing pack version-history directory: ${spec.packSlug}`);
    const syncHealth = foundation.getKnowledgePackImportEngine().getLastHealth();
    const synchronizationIssues = syncHealth?.synchronizationFailures ?? [];
    const search = await foundation.getRetrievalEngine().search({
      text: "professional camera lighting storytelling marketing social media quality",
      mode: KnowledgeSearchMode.Hybrid,
      limit: 12,
      requesterId: "professional-knowledge-certification",
      minConfidenceScore: 80,
      minQualityScore: 80,
    });

    return {
      domains: check(
        "knowledge-domains",
        "Knowledge Domains",
        domainIssues.length === 0,
        domainIssues.length ? domainIssues.join(" ") : `${planner.listDomains().length} domains registered.`,
        [],
        domainIssues
      ),
      packs: check(
        "knowledge-packs",
        "Knowledge Packs",
        packIssues.length === 0,
        packIssues.length ? packIssues.join(" ") : `${packs.length} unique locally stored packs.`,
        [],
        packIssues
      ),
      relationships: check(
        "knowledge-relationships",
        "Knowledge Relationships",
        graphIntegrity.valid && graph.edgeCount > 0,
        graphIntegrity.valid
          ? `${graph.edgeCount} valid graph relationships.`
          : `${graphIntegrity.diagnostics.length} graph integrity diagnostics.`,
        [],
        graphIntegrity.diagnostics.filter((item) => !item.repaired).map((item) => item.detail)
      ),
      metadata: check(
        "metadata",
        "Metadata",
        metadataIssues.length === 0 && duplicateIndexIds.length === 0,
        metadataIssues.length || duplicateIndexIds.length
          ? [...metadataIssues, ...duplicateIndexIds.map((id) => `Duplicate index ID: ${id}`)].join(" ")
          : "Pack and item metadata, confidence, and quality scores are valid.",
        [],
        [...metadataIssues, ...duplicateIndexIds.map((id) => `Duplicate index ID: ${id}`)]
      ),
      searchIndex: check(
        "search-index",
        "Search Index",
        indexEntries.length > 0 && storage.getRecordCount() >= indexEntries.length,
        `${indexEntries.length} indexed knowledge records.`,
        [],
        indexEntries.length ? [] : ["Knowledge search index is empty."]
      ),
      semanticSearch: check(
        "semantic-search",
        "Semantic Search",
        search.success && search.results.length > 0,
        `${search.results.length} high-confidence search result(s) for cross-domain professional query.`,
        search.results.map((result) => result.knowledgeId),
        search.results.length ? [] : ["Semantic/hybrid search returned no professional knowledge."]
      ),
      knowledgeGraph: check(
        "knowledge-graph",
        "Knowledge Graph",
        graphIntegrity.valid && Object.keys(graph.nodes).length > 0 && graph.edgeCount > 0,
        `${Object.keys(graph.nodes).length} graph nodes and ${graph.edgeCount} relationships.`,
        [],
        graphIntegrity.valid ? [] : graphIntegrity.diagnostics.map((item) => item.detail)
      ),
      versionHistory: check(
        "version-history",
        "Version History",
        versionIssues.length === 0,
        versionIssues.length ? versionIssues.join(" ") : "Pack version-history directories are present.",
        [],
        versionIssues
      ),
      scores: check(
        "confidence-quality-scores",
        "Confidence & Quality Scores",
        professionalPacks.every((pack) =>
          pack.items.every(
            (item) => item.confidenceScore >= 0 && item.confidenceScore <= 100 && item.qualityScore >= 0 && item.qualityScore <= 100
          )
        ),
        "All pack item confidence and quality scores are within 0–100.",
        [],
        []
      ),
      synchronization: check(
        "synchronization",
        "Knowledge Synchronization",
        synchronizationIssues.length === 0,
        synchronizationIssues.length ? synchronizationIssues.join(" ") : "No Knowledge Pack Import synchronization failures reported.",
        [],
        synchronizationIssues
      ),
    };
  }

  private async verifyCapabilities(): Promise<ProfessionalKnowledgeCapabilityVerification> {
    const foundation = this.foundation!;
    const production = foundation.getProfessionalVideoProductionKnowledge();
    const camera = foundation.getProfessionalCameraKnowledge();
    const lighting = foundation.getProfessionalLightingCompositionKnowledge();
    const story = foundation.getProfessionalStorytellingSceneKnowledge();
    const animation = foundation.getProfessionalAnimationMotionRenderingKnowledge();
    const marketing = foundation.getProfessionalMarketingBrandingPsychologyKnowledge();
    const social = foundation.getProfessionalSocialMediaKnowledge();
    const quality = foundation.getProfessionalIndustryStandardsQualityKnowledge();
    const integration = foundation.integration.getStatus();
    const search = await foundation.getRetrievalEngine().search({
      text: "professional product advertisement camera lighting marketing",
      mode: KnowledgeSearchMode.Hybrid,
      limit: 8,
      requesterId: "professional-knowledge-capability-test",
    });
    const reasoning = await foundation
      .getKnowledgeReasoningEngine()
      .reason("professional product advertisement camera lighting marketing social media");
    const videoWorkflow = production.recommendWorkflow("professional product advertisement production workflow");
    const videoPractices = production.recommendBestPractices("professional product advertisement");
    const cameraSettings = camera.recommendSettings("product advertisement aperture lighting");
    const cameraMovement = camera.recommendMovement("product advertisement reveal");
    const lightingRecommendation = lighting.recommendLighting("professional product lighting setup");
    const comparison = camera.compareMovements("dolly", "gimbal");
    const sceneSequence = story.recommendSceneSequence("professional product advertisement story");
    const renderingRecommendation = animation.recommendRenderingSettings("professional social media rendering export");
    const marketingRecommendation = marketing.recommendMarketingStrategy("professional product advertisement marketing strategy");
    const socialRecommendation = social.recommendPlatform("professional product advertisement social media optimization");
    const qualityEvaluation = quality.evaluateProfessionalQuality("professional product advertisement quality review");

    const editingDomain = foundation.getKnowledgeDomainPlanner().getDomain("video-editing-knowledge");
    const editingPack = foundation.getKnowledgeExtractionEngine().listPacks().find((pack) => pack.packSlug === "editing");
    const editingReady = editingDomain?.metadata.contentReady === true && Boolean(editingPack?.items.length);

    return {
      search: check(
        "knowledge-search",
        "Search Professional Knowledge",
        search.success && search.results.length > 0,
        `${search.results.length} professional knowledge result(s) returned.`,
        search.results.map((result) => result.knowledgeId),
        search.results.length ? [] : ["Professional knowledge search returned no results."]
      ),
      explain: check(
        "explain-professional-knowledge",
        "Explain Professional Knowledge",
        production.explain("professional production workflow").available,
        "Video Production knowledge can explain a professional workflow.",
        [],
        production.explain("professional production workflow").available ? [] : ["Professional knowledge explanation unavailable."]
      ),
      compare: check(
        "compare-techniques",
        "Compare Multiple Techniques",
        comparison.confidenceScore >= 80 && Boolean(comparison.recommendation),
        comparison.recommendation,
        [],
        comparison.confidenceScore >= 80 ? [] : ["Camera technique comparison unavailable."]
      ),
      bestPractices: check(
        "recommend-best-practices",
        "Recommend Best Practices",
        videoPractices.available && videoPractices.practices.length > 0,
        videoPractices.reason,
        [],
        videoPractices.available ? [] : ["Professional best-practice recommendation unavailable."]
      ),
      workflow: check(
        "recommend-workflow",
        "Recommend Workflow",
        videoWorkflow.available && videoWorkflow.workflow.length > 0,
        videoWorkflow.reason,
        [],
        videoWorkflow.available ? [] : ["Professional workflow recommendation unavailable."]
      ),
      camera: check(
        "camera-capability",
        "Camera Capability",
        cameraSettings.available && cameraMovement.available,
        `${cameraSettings.title}; ${cameraMovement.name}.`,
        [cameraSettings.topicId ?? "", cameraMovement.movementId ?? ""].filter(Boolean),
        cameraSettings.available && cameraMovement.available ? [] : ["Camera settings or movement recommendation unavailable."]
      ),
      lighting: check(
        "lighting-capability",
        "Lighting Capability",
        lightingRecommendation.available,
        lightingRecommendation.reason,
        lightingRecommendation.topicId ? [lightingRecommendation.topicId] : [],
        lightingRecommendation.available ? [] : ["Lighting recommendation unavailable."]
      ),
      storytelling: check(
        "storytelling-capability",
        "Storytelling Capability",
        sceneSequence.available,
        sceneSequence.reason,
        sceneSequence.knowledgeIds,
        sceneSequence.available ? [] : ["Storytelling sequence recommendation unavailable."]
      ),
      editing: check(
        "editing-capability",
        "Editing Capability",
        editingReady,
        editingReady
          ? "Professional Video Editing Knowledge is content-ready."
          : "Professional Video Editing Knowledge expansion is not installed/content-ready; no dedicated Step 6 catalog or AI Me API is available.",
        [],
        editingReady ? [] : ["Missing Professional Video Editing Knowledge expansion."],
        editingReady ? undefined : "blocked"
      ),
      rendering: check(
        "rendering-capability",
        "Rendering Knowledge Capability",
        renderingRecommendation.available,
        renderingRecommendation.reason,
        renderingRecommendation.topicId ? [renderingRecommendation.topicId] : [],
        renderingRecommendation.available ? [] : ["Rendering settings recommendation unavailable."]
      ),
      marketing: check(
        "marketing-capability",
        "Marketing Capability",
        marketingRecommendation.available,
        marketingRecommendation.reason,
        marketingRecommendation.topicId ? [marketingRecommendation.topicId] : [],
        marketingRecommendation.available ? [] : ["Marketing strategy recommendation unavailable."]
      ),
      socialMedia: check(
        "social-media-capability",
        "Social Media Capability",
        socialRecommendation.available,
        socialRecommendation.reason,
        socialRecommendation.topicId ? [socialRecommendation.topicId] : [],
        socialRecommendation.available ? [] : ["Social media recommendation unavailable."]
      ),
      industryQuality: check(
        "industry-quality-capability",
        "Industry Standards & Quality Capability",
        qualityEvaluation.available && qualityEvaluation.evaluationCriteria.length > 0,
        qualityEvaluation.scope,
        qualityEvaluation.knowledgeId ? [qualityEvaluation.knowledgeId] : [],
        qualityEvaluation.available ? [] : ["Professional quality evaluation guidance unavailable."]
      ),
      reasoning: check(
        "ai-reasoning",
        "AI Reasoning Capability",
        reasoning.available && Boolean(reasoning.selected) && reasoning.relatedKnowledgeIds.length > 0,
        reasoning.explanation,
        reasoning.relatedKnowledgeIds,
        reasoning.available ? [] : ["Knowledge reasoning did not select verified professional guidance."]
      ),
      planningIntegration: check(
        "planning-integration",
        "Planning Capability",
        integration.planningEngine,
        integration.planningEngine ? "Planning engine is integrated with the Knowledge Foundation." : "Planning engine integration is unavailable.",
        [],
        integration.planningEngine ? [] : ["Planning integration unavailable."]
      ),
      decisionIntegration: check(
        "decision-integration",
        "Decision Capability",
        integration.decisionEngine,
        integration.decisionEngine ? "Decision engine is integrated with the Knowledge Foundation." : "Decision engine integration is unavailable.",
        [],
        integration.decisionEngine ? [] : ["Decision integration unavailable."]
      ),
      workflowIntegration: check(
        "workflow-integration",
        "Workflow Recommendation Capability",
        integration.workflowEngine,
        integration.workflowEngine ? "Workflow engine is integrated with the Knowledge Foundation." : "Workflow engine integration is unavailable.",
        [],
        integration.workflowEngine ? [] : ["Workflow integration unavailable."]
      ),
      // Rendering capability is intentionally represented by the animation/motion/rendering professional recommendation.
    };
  }

  private async writeCertificate(result: ProfessionalKnowledgeCertificationResult): Promise<string> {
    const certificatePath = path.join(this.certDir, "professional-knowledge-expansion-v1-certificate.json");
    if (fs.existsSync(certificatePath)) {
      const versionsDir = path.join(this.certDir, "professional-knowledge-expansion-v1-history");
      await fsPromises.mkdir(versionsDir, { recursive: true });
      const archived = path.join(versionsDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      await fsPromises.copyFile(certificatePath, archived);
    }
    await fsPromises.writeFile(certificatePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    return certificatePath;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new ProfessionalKnowledgeCertificationError(
        "Professional Knowledge Certification Engine is not initialized",
        "NOT_INITIALIZED"
      );
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalKnowledgeCertificationError(
        "Professional Knowledge Certification Engine startup is incomplete",
        "NOT_STARTED"
      );
    }
  }
}

function check(
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  evidenceKnowledgeIds: string[],
  issues: string[],
  status?: ProfessionalCertificationCheckStatus
): ProfessionalKnowledgeCertificationCheck {
  return {
    id,
    label,
    status: status ?? (passed ? "passed" : "failed"),
    detail,
    evidenceKnowledgeIds,
    issues,
  };
}

function flattenChecks(
  source: ProfessionalKnowledgeFoundationVerification | ProfessionalKnowledgeCapabilityVerification
): ProfessionalKnowledgeCertificationCheck[] {
  return Object.values(source);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
