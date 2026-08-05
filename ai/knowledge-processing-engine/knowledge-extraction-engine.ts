/**
 * Knowledge Extraction Engine — Step 5 orchestrator.
 * Transforms understood documents into Knowledge Packs without modifying originals
 * and without running Knowledge Validation (Step 6).
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRecordStatus, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { DocumentUnderstandingResult } from "./document-understanding-types.js";
import {
  KnowledgeExtractionError,
  type AiMeKnowledgePackAwareness,
  type KnowledgeExtractionRepairResult,
  type KnowledgeExtractionReportData,
  type KnowledgeExtractionResult,
  type KnowledgeItem,
  type KnowledgePack,
  type KnowledgePackSlug,
} from "./knowledge-extraction-types.js";
import { KnowledgePackStore, mergeStructuredKnowledge } from "./knowledge-pack-store.js";
import { AiKnowledgeProcessingEngine } from "./knowledge-processing-engine.js";
import { ProfessionalKnowledgeExtractor } from "./professional-knowledge-extractor.js";

export class KnowledgeExtractionEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly extractor = new ProfessionalKnowledgeExtractor();
  private readonly processor = new AiKnowledgeProcessingEngine();
  private readonly packStore = new KnowledgePackStore();
  private readonly extractions = new Map<string, KnowledgeExtractionResult>();
  private packsCache: KnowledgePack[] = [];
  private lastRepair: KnowledgeExtractionRepairResult | null = null;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "workspace", "metadata", "knowledge-extraction");
    this.packStore.initialize(storageRoot);
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.metaRoot, { recursive: true });
    await this.packStore.ensureLayout();
    await this.loadState();
    this.lastRepair = await this.repair();
    this.startupComplete = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLastRepair(): KnowledgeExtractionRepairResult | null {
    return this.lastRepair;
  }

  listPacks(): KnowledgePack[] {
    this.ensureStarted();
    return this.packsCache.map((pack) => structuredClone(pack));
  }

  async reloadPacks(): Promise<void> {
    this.ensureStarted();
    this.packsCache = await this.packStore.listPacks();
  }

  async getPack(slug: KnowledgePackSlug): Promise<KnowledgePack | null> {
    this.ensureStarted();
    const pack = await this.packStore.readPack(slug);
    return pack ? structuredClone(pack) : null;
  }

  listExtractions(): KnowledgeExtractionResult[] {
    this.ensureStarted();
    return [...this.extractions.values()].map((result) => structuredClone(result));
  }

  async extractFromUnderstanding(document: DocumentUnderstandingResult): Promise<KnowledgeExtractionResult> {
    this.ensureStarted();
    if (document.status === "failed") {
      return this.failedExtraction(document, ["Document understanding failed; extraction skipped."]);
    }

    const existing = [...this.extractions.values()].find(
      (result) => result.understandingId === document.understandingId && (result.status === "extracted" || result.status === "merged" || result.status === "weak")
    );
    if (existing) {
      return {
        ...structuredClone(existing),
        status: "duplicate",
        issues: [...existing.issues, "Extraction already exists for this understanding id."],
      };
    }

    const draft = this.extractor.extract(document);
    const structured = this.processor.processExtractionDraft(draft);
    const knowledgeId = `ki-${createHash("sha256").update(`${document.understandingId}:${draft.packSlug}`).digest("hex").slice(0, 16)}`;
    const item = this.processor.toKnowledgeItem(draft, structured, knowledgeId, 1);

    const packs = await this.packStore.listPacks();
    const duplicate = this.packStore.findDuplicateItem(packs, item);
    if (duplicate) {
      const result: KnowledgeExtractionResult = {
        extractionId: randomUUID(),
        resourceId: document.resourceId,
        understandingId: document.understandingId,
        packSlug: draft.packSlug,
        packId: duplicate.packId,
        status: "duplicate",
        knowledgeItem: null,
        confidenceScore: draft.confidenceScore,
        qualityScore: draft.qualityScore,
        issues: [`Duplicate knowledge blocked; matches ${duplicate.knowledgeId} in pack ${duplicate.packId}.`, ...draft.issues],
        originalPreserved: true,
      };
      this.extractions.set(result.extractionId, result);
      await this.persist();
      return structuredClone(result);
    }

    const weak = draft.qualityScore < 50 || item.rules.length + item.workflow.length + item.bestPractices.length < 3;
    const now = new Date().toISOString();
    let pack = packs.find((entry) => entry.packSlug === draft.packSlug) ?? null;
    const priorItemCount = pack?.items.length ?? 0;

    if (!pack) {
      pack = {
        packId: randomUUID(),
        packSlug: draft.packSlug,
        domain: draft.domain,
        title: `${titleCase(draft.packSlug)} Knowledge Pack`,
        version: 1,
        status: weak ? "weak" : "generated",
        items: [item],
        structuredKnowledge: structured,
        resourceIds: [document.resourceId],
        understandingIds: [document.understandingId],
        contentFingerprint: "",
        createdAt: now,
        updatedAt: now,
        originalDocumentsPreserved: true,
        issues: [...draft.issues],
      };
    } else {
      const mergedItems = [...pack.items.filter((existingItem) => existingItem.knowledgeId !== item.knowledgeId), item];
      pack = {
        ...pack,
        status: weak ? "weak" : "generated",
        items: mergedItems,
        structuredKnowledge: mergeStructuredKnowledge(mergedItems, structured),
        resourceIds: unique([...pack.resourceIds, document.resourceId]),
        understandingIds: unique([...pack.understandingIds, document.understandingId]),
        issues: unique([...pack.issues, ...draft.issues]),
        updatedAt: now,
        originalDocumentsPreserved: true,
      };
    }

    let saved = await this.packStore.writePack(pack);
    const foundationKnowledgeId = await this.storeFoundationRecord(saved, item);
    if (foundationKnowledgeId) {
      saved.foundationKnowledgeId = foundationKnowledgeId;
      saved = await this.packStore.writePack(saved, { metadataOnly: true });
    }

    await this.markResourceExtracted(document.resourceId);

    const result: KnowledgeExtractionResult = {
      extractionId: randomUUID(),
      resourceId: document.resourceId,
      understandingId: document.understandingId,
      packSlug: draft.packSlug,
      packId: saved.packId,
      status: weak ? "weak" : priorItemCount > 0 ? "merged" : "extracted",
      knowledgeItem: item,
      confidenceScore: draft.confidenceScore,
      qualityScore: draft.qualityScore,
      issues: draft.issues,
      originalPreserved: true,
    };
    this.extractions.set(result.extractionId, result);
    await this.persist();
    return structuredClone(result);
  }

  async extractAllUnderstood(): Promise<KnowledgeExtractionResult[]> {
    this.ensureStarted();
    const understanding = this.foundation?.getDocumentUnderstandingEngine();
    if (!understanding?.isStartupComplete()) return [];
    const documents = understanding
      .listUnderstood()
      .filter((document) => document.status === "understood" || document.status === "partial");
    const outputs: KnowledgeExtractionResult[] = [];
    for (const document of documents) {
      outputs.push(await this.extractFromUnderstanding(document));
    }
    return outputs;
  }

  explainPack(slug: KnowledgePackSlug): string {
    this.ensureStarted();
    const pack = this.packsCache.find((entry) => entry.packSlug === slug);
    if (!pack) return `No knowledge pack found for ${slug}.`;
    return (
      `"${pack.title}" v${pack.version} contains ${pack.items.length} knowledge item(s), ` +
      `${pack.structuredKnowledge.workflowSteps.length} workflow step(s), ` +
      `${pack.structuredKnowledge.bestPractices.length} best practice(s), and ` +
      `${pack.structuredKnowledge.decisionRules.length} decision rule(s).`
    );
  }

  recommendWorkflows(limit = 5): string[] {
    return this.collectField("workflow", limit);
  }

  recommendBestPractices(limit = 5): string[] {
    return this.collectField("bestPractices", limit);
  }

  recommendDecisionRules(limit = 5): string[] {
    return this.collectField("decisionRules", limit);
  }

  getAiMeAwareness(): AiMeKnowledgePackAwareness {
    this.ensureStarted();
    const packs = this.packsCache;
    const items = packs.flatMap((pack) => pack.items);
    const packsByDomain: Record<string, number> = {};
    for (const pack of packs) {
      packsByDomain[pack.packSlug] = pack.items.length;
    }
    const averageConfidence = average(items.map((item) => item.confidenceScore));
    const averageQuality = average(items.map((item) => item.qualityScore));
    const relationships = packs
      .flatMap((pack) =>
        pack.items.flatMap((item) => item.relatedTopics.slice(0, 2).map((topic) => `${pack.packSlug} ↔ ${topic}`))
      )
      .slice(0, 12);
    return {
      totalPacks: packs.length,
      totalItems: items.length,
      packsByDomain,
      averageConfidence,
      averageQuality,
      topWorkflows: this.recommendWorkflows(5),
      topBestPractices: this.recommendBestPractices(5),
      topDecisionRules: this.recommendDecisionRules(5),
      relationships,
      summary:
        `Knowledge packs: ${packs.length} pack(s), ${items.length} item(s), ` +
        `avg confidence ${averageConfidence}, avg quality ${averageQuality}. ` +
        `Original documents preserved. Knowledge Validation (Step 6) not started.`,
    };
  }

  async repair(): Promise<KnowledgeExtractionRepairResult> {
    this.ensureReady();
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    await this.packStore.ensureLayout();
    actions.push("Ensured knowledge/packs domain directories.");
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured knowledge-extraction metadata directory.");

    const packs = await this.packStore.listPacks();
    for (const pack of packs) {
      if (!pack.originalDocumentsPreserved) {
        remainingIssues.push(`Pack ${pack.packSlug} missing originalDocumentsPreserved flag.`);
      }
      if (!pack.items.length) {
        pack.status = "weak";
        pack.issues = unique([...pack.issues, "Empty pack repaired to weak status."]);
        await this.packStore.writePack(pack, { metadataOnly: true });
        actions.push(`Marked empty pack weak: ${pack.packSlug}`);
      } else if (!pack.contentFingerprint) {
        await this.packStore.writePack(pack, { metadataOnly: true });
        actions.push(`Refreshed pack fingerprint: ${pack.packSlug}`);
      }
    }

    this.packsCache = await this.packStore.listPacks();
    await this.persistExtractionsOnly();
    actions.push("Persisted extraction index.");
    const repair = { repaired: remainingIssues.length === 0, actions, remainingIssues };
    this.lastRepair = repair;
    return repair;
  }

  buildReport(issuesFound: string[] = [], issuesRepaired: string[] = []): KnowledgeExtractionReportData {
    this.ensureStarted();
    const packs = this.packsCache;
    const extractions = [...this.extractions.values()];
    const qualities = extractions.map((result) => result.qualityScore);
    const confidences = extractions.map((result) => result.confidenceScore);
    return {
      generatedAt: new Date().toISOString(),
      existingExtractionCapability: [
        "AiKnowledgeProcessingEngine.process(preview) → StructuredKnowledge",
        "AiKnowledgeAcquisitionEngine line heuristics",
        "AiKnowledgeStorageEngine.storeRecord for foundation records",
      ],
      componentsUpgraded: [
        "AiKnowledgeProcessingEngine (processExtractionDraft, toKnowledgeItem, extended StructuredKnowledge)",
        "AiKnowledgeAcquisitionEngine (shared extractKnowledgeLines)",
        "KnowledgeDownloadEngine / ResearchEngine markExtracted handoff",
        "AiKnowledgeFoundation startup ownership for KnowledgeExtractionEngine",
      ],
      componentsCreated: [
        "ProfessionalKnowledgeExtractor",
        "KnowledgePackStore",
        "KnowledgeExtractionEngine",
        "knowledge-extraction-types",
      ],
      knowledgeExtracted: extractions.map((result) => ({
        resourceId: result.resourceId,
        title: result.knowledgeItem?.title ?? result.packSlug,
        packSlug: result.packSlug,
        status: result.status,
      })),
      knowledgePacksGenerated: packs.map((pack) => ({
        packId: pack.packId,
        packSlug: pack.packSlug,
        version: pack.version,
        items: pack.items.length,
      })),
      knowledgeQuality: {
        averageQuality: average(qualities),
        weakPacks: packs.filter((pack) => pack.status === "weak").length,
        duplicatesBlocked: extractions.filter((result) => result.status === "duplicate").length,
      },
      confidenceScores: {
        average: average(confidences),
        min: confidences.length ? Math.min(...confidences) : 0,
        max: confidences.length ? Math.max(...confidences) : 0,
      },
      aiMeIntegration:
        "AI Me understands packs, relationships, workflows, best practices, and decision rules via knowledge-packs intent.",
      issuesFound,
      issuesRepaired,
      remainingWorkBeforeStep6: [
        "Run Knowledge Validation against generated packs and foundation records.",
        "Promote Pending records to Verified after quality gates.",
        "Wire pack relationships into Knowledge Graph more deeply.",
      ],
    };
  }

  private collectField(field: "workflow" | "bestPractices" | "decisionRules", limit: number): string[] {
    const values = this.packsCache.flatMap((pack) => pack.items.flatMap((item) => item[field]));
    return unique(values).slice(0, limit);
  }

  private async storeFoundationRecord(pack: KnowledgePack, item: KnowledgeItem): Promise<string | undefined> {
    const foundation = this.foundation;
    if (!foundation) return undefined;
    try {
      const storage = foundation.getStorageEngine();
      if (!storage.isStartupComplete()) return undefined;
      // Store as Pending — do NOT call Knowledge Validation Engine (Step 6).
      const write = await storage.storeRecord(
        {
          knowledgeType: storageTypeForPack(pack.packSlug),
          category: item.category,
          title: `${pack.title}: ${item.title}`,
          description: item.description,
          summary: [item.bestPractices[0], item.professionalTechniques[0], item.workflow[0]].filter(Boolean).join(" "),
          tags: [pack.packSlug, ...item.keywords.slice(0, 8)],
          keywords: item.keywords.slice(0, 20),
          source: "knowledge-extraction-engine",
          sourceReliability: Math.round(
            item.sourceMetadata.reduce((sum, source) => sum + source.reliability, 0) / Math.max(1, item.sourceMetadata.length)
          ),
          confidenceScore: item.confidenceScore,
          qualityScore: item.qualityScore,
          verificationStatus: KnowledgeVerificationStatus.Pending,
          status: KnowledgeRecordStatus.Pending,
          relatedKnowledge: item.relatedTopics.slice(0, 20),
          payload: {
            packId: pack.packId,
            packSlug: pack.packSlug,
            knowledgeItem: item,
            structuredKnowledge: pack.structuredKnowledge,
            step: "knowledge-extraction",
            validationDeferred: true,
          },
        },
        "knowledge-extraction-engine"
      );
      return write.success ? write.record?.knowledgeId : undefined;
    } catch {
      return undefined;
    }
  }

  private async markResourceExtracted(resourceId: string): Promise<void> {
    try {
      const research = this.foundation?.getKnowledgeResearchEngine();
      if (research?.isStartupComplete()) {
        await research.markDownloadExtracted(resourceId);
      }
    } catch {
      // Local understand-only fixtures may not have download records.
    }
  }

  private failedExtraction(document: DocumentUnderstandingResult, issues: string[]): KnowledgeExtractionResult {
    const result: KnowledgeExtractionResult = {
      extractionId: randomUUID(),
      resourceId: document.resourceId,
      understandingId: document.understandingId,
      packSlug: "general",
      packId: null,
      status: "failed",
      knowledgeItem: null,
      confidenceScore: 0,
      qualityScore: 0,
      issues,
      originalPreserved: true,
    };
    this.extractions.set(result.extractionId, result);
    return result;
  }

  private async persist(): Promise<void> {
    this.packsCache = await this.packStore.listPacks();
    await this.persistExtractionsOnly();
  }

  private async persistExtractionsOnly(): Promise<void> {
    await fs.writeFile(
      path.join(this.metaRoot, "extractions.json"),
      `${JSON.stringify({ extractions: [...this.extractions.values()] }, null, 2)}\n`,
      "utf8"
    );
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await fs.readFile(path.join(this.metaRoot, "extractions.json"), "utf8");
      const parsed = JSON.parse(raw) as { extractions?: KnowledgeExtractionResult[] };
      this.extractions.clear();
      for (const result of parsed.extractions ?? []) {
        this.extractions.set(result.extractionId, result);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    this.packsCache = await this.packStore.listPacks();
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new KnowledgeExtractionError("Knowledge Extraction Engine is not initialized", "NOT_INITIALIZED");
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new KnowledgeExtractionError("Knowledge Extraction Engine startup is incomplete", "NOT_STARTED");
    }
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
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
