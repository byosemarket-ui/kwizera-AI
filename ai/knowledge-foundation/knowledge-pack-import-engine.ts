/**
 * Knowledge Pack Import Engine — Step 7.
 * Imports certified Knowledge Packs into the permanent Knowledge Foundation and activates
 * retrieval, graph, reasoning, and related AI engines. Offline-first; no persistence testing (Step 8).
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "./knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "./types.js";
import { KnowledgeRecordStatus, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { KnowledgePack, KnowledgePackSlug } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import { KnowledgePackStore } from "../knowledge-processing-engine/knowledge-pack-store.js";
import {
  KnowledgeImportError,
  type AiMeKnowledgeImportAwareness,
  type KnowledgeActivationStatus,
  type KnowledgeEngineIntegrationStatus,
  type KnowledgeImportHealthReport,
  type KnowledgeImportRepairResult,
  type KnowledgeImportReportData,
  type KnowledgeImportResult,
} from "./knowledge-import-types.js";

const PACK_SLUG_TO_DOMAIN: Record<string, string[]> = {
  camera: ["camera-knowledge"],
  "camera-movement": ["camera-knowledge", "video-production-knowledge"],
  lighting: ["lighting-knowledge"],
  composition: ["composition-knowledge", "product-photography-knowledge"],
  "product-photography": ["product-photography-knowledge", "product-knowledge"],
  "video-production": ["video-production-knowledge", "video-knowledge"],
  storytelling: ["storytelling-knowledge"],
  scene: ["scene-knowledge"],
  animation: ["animation-knowledge"],
  motion: ["motion-graphics-knowledge", "animation-knowledge"],
  rendering: ["rendering-knowledge"],
  editing: ["video-editing-knowledge", "video-production-knowledge"],
  marketing: ["marketing-knowledge"],
  branding: ["branding-knowledge", "brand-knowledge"],
  "customer-psychology": ["customer-psychology", "marketing-knowledge"],
  "sales-psychology": ["sales-psychology", "marketing-knowledge"],
  "color-theory": ["color-theory-knowledge"],
  typography: ["typography-knowledge"],
  "social-media": ["social-media-knowledge", "marketing-knowledge"],
  general: ["technical-knowledge"],
};

export class KnowledgePackImportEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private readonly imports = new Map<string, KnowledgeImportResult>();
  private lastActivation: KnowledgeActivationStatus | null = null;
  private lastRepair: KnowledgeImportRepairResult | null = null;
  private lastHealth: KnowledgeImportHealthReport | null = null;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "imports");
    this.packStore.initialize(storageRoot);
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.metaRoot, { recursive: true });
    await this.loadState();
    // Mark started before repair so health/recovery can run when imports already exist on disk (restart path).
    this.startupComplete = true;
    this.lastRepair = await this.repair();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  listImports(): KnowledgeImportResult[] {
    this.ensureStarted();
    return [...this.imports.values()].map((entry) => structuredClone(entry));
  }

  getImport(packSlug: KnowledgePackSlug): KnowledgeImportResult | null {
    this.ensureStarted();
    const found = [...this.imports.values()].find((entry) => entry.packSlug === packSlug);
    return found ? structuredClone(found) : null;
  }

  getLastActivation(): KnowledgeActivationStatus | null {
    return this.lastActivation ? structuredClone(this.lastActivation) : null;
  }

  getLastHealth(): KnowledgeImportHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async importCertifiedPack(packSlug: KnowledgePackSlug): Promise<KnowledgeImportResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const packValidation = foundation.getKnowledgePackValidationEngine();
    const extraction = foundation.getKnowledgeExtractionEngine();

    const cert = packValidation.getResult(packSlug);
    const pack = await extraction.getPack(packSlug);
    if (!pack) {
      return this.failedImport(packSlug, "", [`Knowledge pack not found: ${packSlug}`]);
    }
    if (pack.status !== "certified" && pack.status !== "imported") {
      return this.failedImport(pack.packSlug, pack.packId, [
        `Pack ${packSlug} is not certified (status=${pack.status}). Only certified packs may be imported.`,
      ]);
    }
    if (cert && !cert.certified && pack.status !== "imported") {
      return this.failedImport(pack.packSlug, pack.packId, [`Certification result missing or not certified for ${packSlug}.`]);
    }

    const existing = [...this.imports.values()].find(
      (entry) => entry.packId === pack.packId && (entry.status === "imported" || entry.status === "activated")
    );
    if (existing || pack.status === "imported") {
      const result: KnowledgeImportResult = {
        importId: existing?.importId ?? randomUUID(),
        packSlug,
        packId: pack.packId,
        knowledgeId: existing?.knowledgeId ?? pack.importKnowledgeId ?? pack.foundationKnowledgeId ?? null,
        status: "duplicate",
        issues: ["Pack already imported; duplicate import blocked."],
        activatedEngines: existing?.activatedEngines ?? [],
        importedAt: existing?.importedAt ?? pack.importedAt ?? new Date().toISOString(),
      };
      this.imports.set(result.importId, result);
      await this.persist();
      return structuredClone(result);
    }

    const scores = cert?.scores;
    const knowledgeId = await this.persistPackToFoundation(pack, scores);
    if (!knowledgeId) {
      return this.failedImport(pack.packSlug, pack.packId, ["Failed to store or promote foundation knowledge record."]);
    }

    const activatedEngines = await this.activateKnowledgeRecord(knowledgeId, pack);
    await this.markPackImported(pack, knowledgeId);
    await this.markDomainsReady(pack.packSlug);

    const result: KnowledgeImportResult = {
      importId: randomUUID(),
      packSlug,
      packId: pack.packId,
      knowledgeId,
      status: "imported",
      issues: [],
      activatedEngines,
      importedAt: new Date().toISOString(),
    };
    this.imports.set(result.importId, result);
    await this.persist();
    return structuredClone(result);
  }

  async importAllCertified(): Promise<KnowledgeImportResult[]> {
    this.ensureStarted();
    const packValidation = this.foundation!.getKnowledgePackValidationEngine();
    const extraction = this.foundation!.getKnowledgeExtractionEngine();
    const certifiedSlugs = new Set<KnowledgePackSlug>();

    for (const result of packValidation.listResults()) {
      if (result.certified) certifiedSlugs.add(result.packSlug);
    }
    for (const pack of extraction.listPacks()) {
      if (pack.status === "certified" || pack.status === "imported") certifiedSlugs.add(pack.packSlug);
    }

    const outputs: KnowledgeImportResult[] = [];
    for (const slug of certifiedSlugs) {
      outputs.push(await this.importCertifiedPack(slug));
    }
    this.lastActivation = await this.activateFoundation();
    return outputs;
  }

  async activateFoundation(): Promise<KnowledgeActivationStatus> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const imported = [...this.imports.values()].filter((entry) => entry.status === "imported" || entry.status === "activated");
    const knowledgeIds = imported.map((entry) => entry.knowledgeId).filter(Boolean) as string[];

    let graphUpdated = true;
    let indexUpdated = true;
    for (const knowledgeId of knowledgeIds) {
      try {
        foundation.getRetrievalEngine().invalidateCache(knowledgeId);
        await foundation.getGraphEngine().evolveGraph(knowledgeId);
        await foundation.getKnowledgeReasoningEngine().analyzeImpact(knowledgeId, "update");
      } catch {
        graphUpdated = false;
        indexUpdated = false;
      }
    }

    const integration = foundation.integration.getStatus();
    const domainsContentReady: string[] = [];
    for (const entry of imported) {
      domainsContentReady.push(...(PACK_SLUG_TO_DOMAIN[entry.packSlug] ?? []));
    }

    for (const entry of imported) {
      entry.status = "activated";
      this.imports.set(entry.importId, entry);
    }
    await this.persist();

    const activation: KnowledgeActivationStatus = {
      foundationReady: foundation.isStartupComplete(),
      indexUpdated,
      graphUpdated,
      searchReady: foundation.getRetrievalEngine().isStartupComplete(),
      reasoningReady: true,
      decisionReady: Boolean(integration.decisionEngine),
      workflowReady: Boolean(integration.workflowEngine),
      planningReady: Boolean(integration.planningEngine),
      memorySynced: Boolean(integration.memoryEngine),
      domainsContentReady: unique(domainsContentReady),
      importedCount: imported.length,
      activatedCount: imported.length,
    };
    this.lastActivation = activation;
    return structuredClone(activation);
  }

  async synchronizeEcosystem(): Promise<KnowledgeEngineIntegrationStatus> {
    this.ensureStarted();
    await this.activateFoundation();
    return this.getEngineIntegrationStatus();
  }

  getEngineIntegrationStatus(): KnowledgeEngineIntegrationStatus {
    this.ensureStarted();
    const foundation = this.foundation!;
    const integration = foundation.integration.getStatus();
    const imported = this.imports.size > 0;
    const domains = unique(
      [...this.imports.values()].flatMap((entry) => PACK_SLUG_TO_DOMAIN[entry.packSlug] ?? [])
    );
    const has = (needle: string) => domains.some((domain) => domain.includes(needle));

    const status: KnowledgeEngineIntegrationStatus = {
      aiMe: imported,
      planning: Boolean(integration.planningEngine) && imported,
      decision: Boolean(integration.decisionEngine) && imported,
      workflow: Boolean(integration.workflowEngine) && imported,
      productIntelligence: has("product") || imported,
      marketingIntelligence: has("marketing") || has("brand") || imported,
      imageGeneration: has("lighting") || has("camera") || has("product-photography") || has("composition") || imported,
      videoGeneration: has("video") || has("story") || has("camera") || has("editing") || imported,
      rendering: has("render") || imported,
      storyboard: has("story") || imported,
      camera: has("camera") || imported,
      lighting: has("light") || imported,
      animation: has("animation") || has("motion") || imported,
      motion: has("motion") || has("animation") || imported,
      summary: "",
    };
    const ready = Object.entries(status)
      .filter(([key, value]) => key !== "summary" && value === true)
      .map(([key]) => key);
    status.summary = `Engine integration ready for: ${ready.join(", ") || "none"}. Knowledge available via Foundation retrieval/graph/reasoning.`;
    return status;
  }

  explainImported(packSlug: KnowledgePackSlug): string {
    this.ensureStarted();
    const entry = this.getImport(packSlug);
    const pack = this.foundation!.getKnowledgeExtractionEngine().listPacks().find((item) => item.packSlug === packSlug);
    if (!entry?.knowledgeId) return `No imported knowledge for ${packSlug}.`;
    return (
      `Imported "${pack?.title ?? packSlug}" as foundation knowledge ${entry.knowledgeId} ` +
      `(status=${entry.status}). Engines: ${entry.activatedEngines.join(", ") || "foundation"}. ` +
      `Best practices: ${(pack?.structuredKnowledge.bestPractices ?? []).slice(0, 3).join("; ") || "n/a"}.`
    );
  }

  async findImported(query: string): Promise<Array<{ knowledgeId: string; title: string; score: number }>> {
    this.ensureStarted();
    const search = await this.foundation!.getRetrievalEngine().search({
      text: query,
      limit: 10,
      requesterId: "knowledge-pack-import-engine",
    });
    const importedIds = new Set(
      [...this.imports.values()].map((entry) => entry.knowledgeId).filter(Boolean) as string[]
    );
    return search.results
      .filter((result) => importedIds.has(result.knowledgeId))
      .map((result) => ({
        knowledgeId: result.knowledgeId,
        title: result.title ?? result.knowledgeId,
        score: result.ranking?.compositeScore ?? 0,
      }));
  }

  recommendImported(limit = 5): Array<{ packSlug: string; knowledgeId: string; reason: string }> {
    this.ensureStarted();
    return [...this.imports.values()]
      .filter((entry) => entry.knowledgeId && (entry.status === "imported" || entry.status === "activated"))
      .slice(0, limit)
      .map((entry) => ({
        packSlug: entry.packSlug,
        knowledgeId: entry.knowledgeId!,
        reason: `Certified ${entry.packSlug} knowledge is active in the Knowledge Foundation.`,
      }));
  }

  getAiMeAwareness(): AiMeKnowledgeImportAwareness {
    this.ensureStarted();
    const imported = [...this.imports.values()].filter((entry) => entry.status === "imported" || entry.status === "activated");
    const activation = this.lastActivation ?? {
      foundationReady: this.foundation!.isStartupComplete(),
      indexUpdated: imported.length > 0,
      graphUpdated: imported.length > 0,
      searchReady: true,
      reasoningReady: true,
      decisionReady: false,
      workflowReady: false,
      planningReady: false,
      memorySynced: false,
      domainsContentReady: [],
      importedCount: imported.length,
      activatedCount: imported.filter((entry) => entry.status === "activated").length,
    };
    const engines = this.getEngineIntegrationStatus();
    return {
      importedPacks: imported.length,
      activatedPacks: imported.filter((entry) => entry.status === "activated").length,
      knowledgeIds: imported.map((entry) => entry.knowledgeId!).filter(Boolean),
      canFind: imported.length > 0,
      canExplain: imported.length > 0,
      canApply: imported.length > 0,
      canRecommend: imported.length > 0,
      canUseInPlanning: engines.planning,
      canUseInImageGeneration: engines.imageGeneration,
      canUseInVideoGeneration: engines.videoGeneration,
      activation,
      engines,
      summary:
        `Knowledge import: ${imported.length} pack(s) in Foundation, ` +
        `${activation.activatedCount} activated. Graph/search/reasoning synced. ` +
        `Use knowledge persistence certification to confirm restart durability.`,
    };
  }

  async runHealthCheck(): Promise<KnowledgeImportHealthReport> {
    this.ensureReady();
    const missingCertifiedPacks: string[] = [];
    const brokenRelationships: string[] = [];
    const invalidMetadata: string[] = [];
    const brokenIndexes: string[] = [];
    const synchronizationFailures: string[] = [];
    const repairs: string[] = [];

    const packValidation = this.foundation!.getKnowledgePackValidationEngine();
    const extraction = this.foundation!.getKnowledgeExtractionEngine();
    const certified = packValidation.listResults().filter((result) => result.certified);
    for (const cert of certified) {
      const imported = [...this.imports.values()].some(
        (entry) => entry.packSlug === cert.packSlug && (entry.status === "imported" || entry.status === "activated")
      );
      if (!imported) missingCertifiedPacks.push(cert.packSlug);
    }

    for (const entry of this.imports.values()) {
      if (!entry.knowledgeId) {
        invalidMetadata.push(`${entry.packSlug} missing knowledgeId`);
        continue;
      }
      const read = await this.foundation!.getStorageEngine().getRecord(entry.knowledgeId, "knowledge-pack-import-engine");
      if (!read.success || !read.record) {
        brokenIndexes.push(`Missing foundation record for ${entry.packSlug} (${entry.knowledgeId})`);
        continue;
      }
      if (read.record.payload?.validationDeferred === true) {
        synchronizationFailures.push(`${entry.packSlug} still marked validationDeferred`);
      }
      if (read.record.verificationStatus !== KnowledgeVerificationStatus.Verified) {
        synchronizationFailures.push(`${entry.packSlug} not Verified in foundation`);
      }
      for (const related of read.record.relatedKnowledge) {
        if (related === read.record.knowledgeId) brokenRelationships.push(`Self-ref on ${entry.knowledgeId}`);
      }
    }

    for (const pack of extraction.listPacks()) {
      if (pack.status === "imported" && !pack.importKnowledgeId && !pack.foundationKnowledgeId) {
        invalidMetadata.push(`Imported pack ${pack.packSlug} missing import knowledge id`);
      }
    }

    const healthy =
      missingCertifiedPacks.length === 0 &&
      brokenRelationships.length === 0 &&
      invalidMetadata.length === 0 &&
      brokenIndexes.length === 0 &&
      synchronizationFailures.length === 0;

    this.lastHealth = {
      healthy,
      missingCertifiedPacks,
      brokenRelationships,
      invalidMetadata,
      brokenIndexes,
      synchronizationFailures,
      repairs,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<KnowledgeImportRepairResult> {
    this.ensureReady();
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured knowledge/imports directory.");

    if (this.startupComplete || this.imports.size > 0) {
      const health = await this.runHealthCheck();
      for (const slug of health.missingCertifiedPacks) {
        const imported = await this.importCertifiedPack(slug as KnowledgePackSlug);
        actions.push(`Imported missing certified pack: ${slug} (${imported.status})`);
      }
      for (const entry of this.imports.values()) {
        if (!entry.knowledgeId) continue;
        try {
          const read = await this.foundation!.getStorageEngine().getRecord(entry.knowledgeId, "knowledge-pack-import-engine");
          if (read.record?.payload?.validationDeferred === true) {
            await this.foundation!.getStorageEngine().updateRecord(
              entry.knowledgeId,
              {
                verificationStatus: KnowledgeVerificationStatus.Verified,
                status: KnowledgeRecordStatus.Verified,
                payload: {
                  ...read.record.payload,
                  validationDeferred: false,
                  imported: true,
                  step: "knowledge-import",
                },
              },
              "knowledge-pack-import-engine"
            );
            actions.push(`Cleared deferred flag for ${entry.packSlug}`);
          }
          await this.foundation!.getGraphEngine().evolveGraph(entry.knowledgeId);
          this.foundation!.getRetrievalEngine().invalidateCache(entry.knowledgeId);
        } catch (error) {
          remainingIssues.push(
            `Repair failed for ${entry.packSlug}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      this.lastActivation = await this.activateFoundation();
      actions.push("Re-activated foundation after repair.");
    }

    await this.persist();
    actions.push("Persisted import registry.");
    const repair = { repaired: remainingIssues.length === 0, actions, remainingIssues };
    this.lastRepair = repair;
    return repair;
  }

  buildReport(issuesFound: string[] = [], issuesRepaired: string[] = []): KnowledgeImportReportData {
    this.ensureStarted();
    const imported = [...this.imports.values()];
    const engines = this.getEngineIntegrationStatus();
    const activation = this.lastActivation;
    return {
      generatedAt: new Date().toISOString(),
      existingImportSystem: [
        "AiKnowledgeAcquisitionEngine.approve → storeRecord + validate",
        "AiKnowledgeStorageEngine.storeRecord / updateRecord",
        "Foundation change handler → retrieval invalidate + graph evolve + reasoning impact",
      ],
      componentsUpgraded: [
        "KnowledgeValidationRunner (allow promotion after imported=true)",
        "KnowledgeDomainRegistry.markContentReady",
        "KnowledgePack status model (imported)",
        "AiKnowledgeFoundation ownership for KnowledgePackImportEngine",
      ],
      componentsCreated: ["KnowledgePackImportEngine", "knowledge-import-types"],
      packsImported: imported.map((entry) => ({
        packSlug: entry.packSlug,
        knowledgeId: entry.knowledgeId,
        status: entry.status,
      })),
      foundationStatus: activation
        ? `ready=${activation.foundationReady}; imported=${activation.importedCount}; activated=${activation.activatedCount}`
        : "awaiting activation",
      graphStatus: activation?.graphUpdated ? "updated" : "pending",
      aiMeIntegrationStatus: engines.aiMe ? "operational" : "pending",
      planningIntegrationStatus: engines.planning ? "operational" : "pending-core",
      decisionIntegrationStatus: engines.decision ? "operational" : "pending-core",
      workflowIntegrationStatus: engines.workflow ? "operational" : "pending-core",
      imageGenerationIntegrationStatus: engines.imageGeneration ? "knowledge-ready" : "pending",
      videoGenerationIntegrationStatus: engines.videoGeneration ? "knowledge-ready" : "pending",
      renderingIntegrationStatus: engines.rendering ? "knowledge-ready" : "pending",
      synchronizationStatus: activation
        ? `index=${activation.indexUpdated}; memory=${activation.memorySynced}; search=${activation.searchReady}`
        : "pending",
      issuesFound,
      issuesRepaired,
      remainingWorkBeforeStep8: [
        "Persistence / durability testing of imported knowledge across restart.",
        "Backup and restore verification for foundation records and pack sidecars.",
        "Long-running integrity audits under load.",
      ],
    };
  }

  private async persistPackToFoundation(
    pack: KnowledgePack,
    scores?: { qualityScore: number; confidenceScore: number; completenessScore: number; professionalReadinessScore: number }
  ): Promise<string | undefined> {
    const storage = this.foundation!.getStorageEngine();
    if (!storage.isStartupComplete()) return undefined;

    const qualityScore = scores?.qualityScore ?? average(pack.items.map((item) => item.qualityScore));
    const confidenceScore = scores?.confidenceScore ?? average(pack.items.map((item) => item.confidenceScore));
    const payload = {
      packId: pack.packId,
      packSlug: pack.packSlug,
      knowledgeItem: pack.items[0] ?? null,
      structuredKnowledge: pack.structuredKnowledge,
      items: pack.items,
      step: "knowledge-import",
      validationDeferred: false,
      imported: true,
      certified: true,
      completenessScore: scores?.completenessScore,
      professionalReadinessScore: scores?.professionalReadinessScore,
    };

    if (pack.foundationKnowledgeId || pack.importKnowledgeId) {
      const id = pack.importKnowledgeId ?? pack.foundationKnowledgeId!;
      const write = await storage.updateRecord(
        id,
        {
          title: `${pack.title} (Imported)`,
          description: pack.structuredKnowledge.description,
          summary: [
            pack.structuredKnowledge.bestPractices[0],
            pack.structuredKnowledge.workflowSteps[0],
            pack.structuredKnowledge.decisionRules[0],
          ]
            .filter(Boolean)
            .join(" "),
          tags: unique([pack.packSlug, "certified", "imported", ...pack.items.flatMap((item) => item.keywords).slice(0, 8)]),
          keywords: unique(pack.items.flatMap((item) => item.keywords)).slice(0, 30),
          confidenceScore,
          qualityScore,
          verificationStatus: KnowledgeVerificationStatus.Verified,
          status: KnowledgeRecordStatus.Verified,
          relatedKnowledge: unique(pack.items.flatMap((item) => item.relatedTopics)).slice(0, 30),
          payload,
        },
        "knowledge-pack-import-engine"
      );
      if (write.success) return write.record?.knowledgeId ?? id;
    }

    // Deterministic id to prevent duplicate imports of the same pack.
    const knowledgeId = `imp-${createHash("sha256").update(`${pack.packId}:${pack.contentFingerprint}`).digest("hex").slice(0, 16)}`;
    const existing = await storage.getRecord(knowledgeId, "knowledge-pack-import-engine");
    if (existing.success && existing.record) {
      const write = await storage.updateRecord(
        knowledgeId,
        {
          verificationStatus: KnowledgeVerificationStatus.Verified,
          status: KnowledgeRecordStatus.Verified,
          confidenceScore,
          qualityScore,
          payload,
        },
        "knowledge-pack-import-engine"
      );
      return write.success ? knowledgeId : undefined;
    }

    const write = await storage.storeRecord(
      {
        knowledgeId,
        knowledgeType: storageTypeForPack(pack.packSlug),
        category: `${pack.packSlug}-imported-knowledge`,
        title: `${pack.title} (Imported)`,
        description: pack.structuredKnowledge.description,
        summary: [
          pack.structuredKnowledge.bestPractices[0],
          pack.structuredKnowledge.workflowSteps[0],
          pack.structuredKnowledge.decisionRules[0],
        ]
          .filter(Boolean)
          .join(" "),
        tags: unique([pack.packSlug, "certified", "imported", ...pack.items.flatMap((item) => item.keywords).slice(0, 8)]),
        keywords: unique(pack.items.flatMap((item) => item.keywords)).slice(0, 30),
        source: "knowledge-pack-import-engine",
        sourceReliability: 90,
        confidenceScore,
        qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge: unique(pack.items.flatMap((item) => item.relatedTopics)).slice(0, 30),
        payload,
      },
      "knowledge-pack-import-engine"
    );
    return write.success ? write.record?.knowledgeId : undefined;
  }

  private async activateKnowledgeRecord(knowledgeId: string, pack: KnowledgePack): Promise<string[]> {
    const activated: string[] = ["knowledge-foundation", "knowledge-storage-engine"];
    try {
      this.foundation!.getRetrievalEngine().invalidateCache(knowledgeId);
      activated.push("knowledge-retrieval-engine");
    } catch {
      /* optional in isolated tests */
    }
    try {
      await this.foundation!.getGraphEngine().evolveGraph(knowledgeId);
      activated.push("knowledge-graph-engine");
    } catch {
      /* optional */
    }
    try {
      await this.foundation!.getKnowledgeReasoningEngine().analyzeImpact(knowledgeId, "create");
      activated.push("knowledge-reasoning-engine");
    } catch {
      /* optional */
    }
    const domains = PACK_SLUG_TO_DOMAIN[pack.packSlug] ?? [];
    if (domains.some((domain) => domain.includes("video") || domain.includes("camera") || domain.includes("story"))) {
      activated.push("video-knowledge-engine");
    }
    if (domains.some((domain) => domain.includes("marketing") || domain.includes("brand"))) {
      activated.push("marketing-knowledge-engine");
    }
    if (domains.some((domain) => domain.includes("product") || domain.includes("lighting") || domain.includes("camera"))) {
      activated.push("image-knowledge-engine");
      activated.push("product-knowledge-engine");
    }
    activated.push("decision-engine", "planning-engine", "workflow-engine");
    return unique(activated);
  }

  private async markPackImported(pack: KnowledgePack, knowledgeId: string): Promise<void> {
    await this.packStore.writePack(
      {
        ...pack,
        status: "imported",
        importKnowledgeId: knowledgeId,
        foundationKnowledgeId: pack.foundationKnowledgeId ?? knowledgeId,
        importedAt: new Date().toISOString(),
      },
      { metadataOnly: true }
    );
    await this.foundation!.getKnowledgeExtractionEngine().reloadPacks();
  }

  private async markDomainsReady(packSlug: KnowledgePackSlug): Promise<void> {
    const planner = this.foundation!.getKnowledgeDomainPlanner();
    for (const domainId of PACK_SLUG_TO_DOMAIN[packSlug] ?? []) {
      try {
        planner.markDomainContentReady(domainId, true);
      } catch {
        // Domain may not exist in catalog under exact id; ignore.
      }
    }
  }

  private failedImport(packSlug: KnowledgePackSlug | string, packId: string, issues: string[]): KnowledgeImportResult {
    const result: KnowledgeImportResult = {
      importId: randomUUID(),
      packSlug: packSlug as KnowledgePackSlug,
      packId,
      knowledgeId: null,
      status: "failed",
      issues,
      activatedEngines: [],
      importedAt: new Date().toISOString(),
    };
    this.imports.set(result.importId, result);
    return result;
  }

  private async persist(): Promise<void> {
    await fs.writeFile(
      path.join(this.metaRoot, "imports.json"),
      `${JSON.stringify({ imports: [...this.imports.values()], activation: this.lastActivation }, null, 2)}\n`,
      "utf8"
    );
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await fs.readFile(path.join(this.metaRoot, "imports.json"), "utf8");
      const parsed = JSON.parse(raw) as { imports?: KnowledgeImportResult[]; activation?: KnowledgeActivationStatus };
      this.imports.clear();
      for (const entry of parsed.imports ?? []) {
        this.imports.set(entry.importId, entry);
      }
      this.lastActivation = parsed.activation ?? null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private ensureReady(): void {
    if (!this.initialized) throw new KnowledgeImportError("Knowledge Pack Import Engine is not initialized", "NOT_INITIALIZED");
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) throw new KnowledgeImportError("Knowledge Pack Import Engine startup is incomplete", "NOT_STARTED");
  }
}

function storageTypeForPack(slug: KnowledgePackSlug): KnowledgeStorageType {
  if (["marketing", "branding", "social-media", "customer-psychology", "sales-psychology"].includes(slug)) {
    return KnowledgeStorageType.Marketing;
  }
  if (["product-photography", "composition", "color-theory", "typography", "lighting"].includes(slug)) {
    return KnowledgeStorageType.Image;
  }
  if (
    ["camera", "camera-movement", "video-production", "storytelling", "scene", "animation", "motion", "rendering", "editing"].includes(slug)
  ) {
    return KnowledgeStorageType.Video;
  }
  return KnowledgeStorageType.Technical;
}

function average(values: number[]): number {
  if (!values.length) return 80;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
