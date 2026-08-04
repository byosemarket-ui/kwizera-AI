import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeRecordStatus, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import type {
  KnowledgeAcquisitionImportResult,
  KnowledgeAcquisitionPreview,
  KnowledgeAcquisitionRequest,
  KnowledgeAcquisitionSource,
  KnowledgeAcquisitionSourceType,
} from "./types.js";

const MIN_RELIABILITY = 60;
const MIN_CONFIDENCE = 65;
/** Shared baseline trust-per-type, reused by the Knowledge Source Manager for verification scoring. */
export const DEFAULT_RELIABILITY: Record<KnowledgeAcquisitionSourceType, number> = {
  "local-documentation": 80,
  "local-project-file": 75,
  "user-document": 70,
  pdf: 70,
  word: 70,
  markdown: 75,
  json: 80,
  html: 65,
  "official-documentation": 95,
  "official-api-documentation": 93,
  "technical-manual": 88,
  "technical-standard": 92,
  "white-paper": 78,
  "user-manual": 72,
  book: 78,
  "research-paper": 90,
  "approved-website": 75,
  "knowledge-foundation": 85,
};

/** Builds structured, approval-gated knowledge proposals without retaining source text. */
export class AiKnowledgeAcquisitionEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private previewDirectory = "";
  private initialized = false;
  private startupComplete = false;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.previewDirectory = path.join(storageRoot, "knowledge", "acquisition", "previews");
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.previewDirectory, { recursive: true });
    this.startupComplete = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  async prepare(request: KnowledgeAcquisitionRequest): Promise<KnowledgeAcquisitionPreview> {
    this.ensureStarted();
    const topic = request.topic.trim();
    if (!topic) throw new Error("A knowledge acquisition topic is required");
    const knowledgeType = request.knowledgeType ?? inferKnowledgeType(topic);

    const sources = (request.sources ?? []).filter((source) => this.isUsableSource(source));
    const existing = await this.foundation!.getRetrievalEngine().search({
      text: topic,
      limit: 10,
      requesterId: request.requesterId ?? "knowledge-acquisition-engine",
    });
    const extracted = extractStructuredKnowledge(sources, topic);
    const reliability = sources.length
      ? Math.round(sources.reduce((total, source) => total + this.sourceReliability(source), 0) / sources.length)
      : 0;
    const duplicateKnowledgeIds = existing.results
      .filter((result) => result.ranking.compositeScore >= 80)
      .map((result) => result.knowledgeId);
    const conflicts = detectConflicts(extracted.rules);
    const coverage = Math.min(100, extracted.rules.length * 8 + extracted.techniques.length * 6 + extracted.workflows.length * 8);
    const confidenceScore = Math.round(reliability * 0.6 + coverage * 0.4 - conflicts.length * 10);
    const qualityScore = Math.round(reliability * 0.55 + coverage * 0.45 - duplicateKnowledgeIds.length * 8);
    const rejectionReasons: string[] = [];
    if (sources.length === 0) rejectionReasons.push("No approved or local source content was supplied.");
    if (reliability < MIN_RELIABILITY) rejectionReasons.push("Source reliability is below the minimum threshold.");
    if (confidenceScore < MIN_CONFIDENCE) rejectionReasons.push("The extracted knowledge lacks sufficient confidence.");
    if (conflicts.length > 0) rejectionReasons.push("Conflicting rules require resolution before import.");
    if (duplicateKnowledgeIds.length > 0) rejectionReasons.push("Equivalent knowledge already exists in the Knowledge Foundation.");

    const preview: KnowledgeAcquisitionPreview = {
      requestId: crypto.randomUUID(),
      topic,
      knowledgeType,
      status: rejectionReasons.length ? "rejected" : "pending-approval",
      sources: sources.map((source) => ({ name: source.name, type: source.type, reference: source.reference, reliability: this.sourceReliability(source) })),
      ...extracted,
      conflicts,
      duplicateKnowledgeIds,
      confidenceScore: Math.max(0, confidenceScore),
      qualityScore: Math.max(0, qualityScore),
      rejectionReasons,
      createdAt: new Date().toISOString(),
    };
    await this.writePreview(preview);
    return preview;
  }

  async approve(requestId: string, knowledgeType?: KnowledgeStorageType): Promise<KnowledgeAcquisitionImportResult> {
    this.ensureStarted();
    const preview = await this.readPreview(requestId);
    if (!preview) return { imported: false, requestId, reason: "Knowledge preview was not found." };
    if (preview.status !== "pending-approval") return { imported: false, requestId, reason: preview.rejectionReasons.join(" ") || "Knowledge preview is not eligible for import." };
    const storageType = knowledgeType ?? preview.knowledgeType ?? inferKnowledgeType(preview.topic);

    const structured = this.foundation!.getKnowledgeProcessingEngine().process(preview, storageType);
    const write = await this.foundation!.getStorageEngine().storeRecord({
      knowledgeType: storageType,
      category: structured.category,
      title: structured.title,
      description: structured.description,
      summary: [structured.bestPractices[0], structured.professionalTechniques[0], structured.workflowSteps[0]].filter(Boolean).join(" "),
      tags: uniqueWords(preview.topic),
      keywords: structured.terminology.slice(0, 20),
      source: "knowledge-acquisition-engine",
      sourceReliability: Math.round(preview.sources.reduce((total, source) => total + source.reliability, 0) / preview.sources.length),
      confidenceScore: preview.confidenceScore,
      qualityScore: preview.qualityScore,
      verificationStatus: KnowledgeVerificationStatus.Pending,
      status: KnowledgeRecordStatus.Pending,
      relatedKnowledge: structured.relatedKnowledge,
      payload: structured,
    }, "knowledge-acquisition-engine");
    if (!write.success || !write.record) return { imported: false, requestId, reason: write.validation?.message ?? "Structured knowledge could not be stored." };
    const validation = await this.foundation!.getKnowledgeValidationEngine().validateKnowledge(write.record.knowledgeId);
    if (!validation.valid) return { imported: false, requestId, reason: validation.issues.join(" ") || "Imported knowledge did not pass validation." };
    return { imported: true, requestId, knowledgeId: write.record.knowledgeId };
  }

  private isUsableSource(source: KnowledgeAcquisitionSource): boolean {
    return Boolean(source.name.trim() && source.content.trim() && (source.type !== "approved-website" || source.approved));
  }

  private sourceReliability(source: KnowledgeAcquisitionSource): number {
    return Math.max(0, Math.min(100, source.reliability ?? DEFAULT_RELIABILITY[source.type]));
  }

  private async writePreview(preview: KnowledgeAcquisitionPreview): Promise<void> {
    await fs.writeFile(path.join(this.previewDirectory, `${preview.requestId}.json`), `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  }

  private async readPreview(requestId: string): Promise<KnowledgeAcquisitionPreview | null> {
    try {
      return JSON.parse(await fs.readFile(path.join(this.previewDirectory, `${requestId}.json`), "utf8")) as KnowledgeAcquisitionPreview;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private ensureReady(): void {
    if (!this.foundation || !this.initialized) throw new Error("Knowledge Acquisition Engine is not initialized");
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) throw new Error("Knowledge Acquisition Engine startup is incomplete");
  }
}

function extractStructuredKnowledge(sources: KnowledgeAcquisitionSource[], topic: string): Pick<KnowledgeAcquisitionPreview, "rules" | "techniques" | "bestPractices" | "commonMistakes" | "workflows" | "examples"> {
  const lines = sources.flatMap((source) => source.content.split(/\r?\n|(?<=[.!?])\s+/).map((line) => line.trim()).filter((line) => line.length >= 20));
  const pick = (terms: string[]) => unique(lines.filter((line) => terms.some((term) => line.toLowerCase().includes(term))).slice(0, 8));
  const fallback = lines.filter((line) => line.toLowerCase().includes(topic.toLowerCase())).slice(0, 3);
  return {
    rules: pick(["must", "never", "always", "rule"]).concat(fallback).slice(0, 8),
    techniques: pick(["technique", "use ", "adjust", "compose", "lighting", "edit"]),
    bestPractices: pick(["best practice", "recommend", "ensure", "should"]),
    commonMistakes: pick(["mistake", "avoid", "do not", "don't"]),
    workflows: pick(["step", "workflow", "process", "first", "then"]),
    examples: pick(["example", "for example", "such as"]),
  };
}

function detectConflicts(rules: string[]): string[] {
  return rules.flatMap((rule, index) => rules.slice(index + 1).some((candidate) => /\b(always|must)\b/i.test(rule) && /\b(never|do not|don't)\b/i.test(candidate) && sharedWords(rule, candidate) >= 2) ? [`Conflicting guidance: "${rule}" / "${rules.slice(index + 1).find((candidate) => sharedWords(rule, candidate) >= 2)}"`] : []);
}

function sharedWords(first: string, second: string): number {
  const words = new Set(uniqueWords(first));
  return uniqueWords(second).filter((word) => words.has(word)).length;
}

function uniqueWords(value: string): string[] {
  return unique(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function inferKnowledgeType(topic: string): KnowledgeStorageType {
  const lower = topic.toLowerCase();
  if (/camera|cinema|video|story|storyboard|motion|animation|transition|editing|render|export|audio|music|voice|sound|subtitle|commercial|reels|shorts|tiktok/.test(lower)) return KnowledgeStorageType.Video;
  if (/photograph|lighting|composition|framing|color|grading|visual effect|fashion/.test(lower)) return KnowledgeStorageType.Image;
  if (/marketing|brand|facebook ad|instagram|customer psychology|luxury/.test(lower)) return KnowledgeStorageType.Marketing;
  return KnowledgeStorageType.Technical;
}