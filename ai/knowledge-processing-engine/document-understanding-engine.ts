/**
 * Document Understanding Engine — reads collected learning resources, analyzes content,
 * and builds searchable indexes. Does not create Knowledge Packs or modify originals.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { CollectedKnowledgeResource } from "../knowledge-research-engine/types.js";
import { DocumentContentAnalyzer } from "./document-content-analyzer.js";
import { DocumentIndexer } from "./document-indexer.js";
import { DocumentReader } from "./document-reader.js";
import { DocumentStructureParser } from "./document-structure-parser.js";
import {
  DocumentUnderstandingError,
  type AiMeDocumentAwareness,
  type DocumentUnderstandingIndexes,
  type DocumentUnderstandingRepairResult,
  type DocumentUnderstandingReportData,
  type DocumentUnderstandingResult,
  type SupportedDocumentFormat,
} from "./document-understanding-types.js";

const EXPECTED_TOPICS = [
  "camera",
  "lighting",
  "marketing",
  "rendering",
  "animation",
  "storytelling",
  "editing",
  "product photography",
];

export class DocumentUnderstandingEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private root = "";
  private initialized = false;
  private startupComplete = false;
  private readonly results = new Map<string, DocumentUnderstandingResult>();
  private indexes: DocumentUnderstandingIndexes = emptyIndexes();
  private readonly reader = new DocumentReader();
  private readonly structureParser = new DocumentStructureParser();
  private readonly contentAnalyzer = new DocumentContentAnalyzer();
  private readonly indexer = new DocumentIndexer();
  private lastRepair: DocumentUnderstandingRepairResult | null = null;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.root = path.join(storageRoot, "knowledge", "workspace", "metadata", "document-understanding");
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.root, { recursive: true });
    await this.restore();
    this.indexes = this.indexer.build([...this.results.values()]);
    this.lastRepair = await this.repair();
    this.startupComplete = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLastRepair(): DocumentUnderstandingRepairResult | null {
    return this.lastRepair;
  }

  listUnderstood(): DocumentUnderstandingResult[] {
    this.ensureStarted();
    return [...this.results.values()].map((result) => structuredClone(result));
  }

  getByResourceId(resourceId: string): DocumentUnderstandingResult | null {
    this.ensureStarted();
    const found = [...this.results.values()].find((result) => result.resourceId === resourceId);
    return found ? structuredClone(found) : null;
  }

  getIndexes(): DocumentUnderstandingIndexes {
    this.ensureStarted();
    return structuredClone(this.indexes);
  }

  async understandCollectedResource(resource: CollectedKnowledgeResource): Promise<DocumentUnderstandingResult> {
    this.ensureStarted();
    if (!resource.filePath) {
      throw new DocumentUnderstandingError("Collected resource has no local file path.", "MISSING_PATH");
    }

    const existing = this.getByResourceId(resource.id);
    if (existing && (existing.status === "understood" || existing.status === "partial")) {
      return {
        ...structuredClone(existing),
        status: "duplicate",
        issues: [...existing.issues, "Document already understood; original left unmodified."],
      };
    }

    const fingerprint = resource.checksumSha256 ?? resource.metadataFingerprint;
    if (fingerprint) {
      const sameContent = [...this.results.values()].find(
        (result) =>
          result.resourceId !== resource.id &&
          (result.metadata.checksumSha256 === fingerprint || result.understandingId.endsWith(fingerprint.slice(0, 12)))
      );
      if (sameContent) {
        const duplicate: DocumentUnderstandingResult = {
          ...structuredClone(sameContent),
          understandingId: randomUUID(),
          resourceId: resource.id,
          status: "duplicate",
          issues: [`Duplicate of already indexed document ${sameContent.resourceId}; not re-indexed.`],
          originalPreserved: true,
        };
        return duplicate;
      }
    }

    try {
      await fs.access(resource.filePath);
    } catch {
      const failed = this.failedResult(resource, ["Collected file missing from disk."]);
      this.results.set(failed.understandingId, failed);
      await this.persist();
      return structuredClone(failed);
    }

    const read = await this.reader.read(resource.filePath, resource.resourceType, undefined);
    const structure = this.structureParser.parse(read.text, read.format, resource.title ?? resource.fileName);
    const analysis = this.contentAnalyzer.analyze(
      read.text,
      structure.sections.map((section) => section.title)
    );
    const summary = buildSummary(structure, analysis, read.format);
    const searchableText = [
      structure.title,
      structure.chapters.join(" "),
      structure.headings.map((heading) => heading.text).join(" "),
      analysis.keywords.join(" "),
      analysis.learningTopics.join(" "),
      analysis.importantConcepts.join(" "),
      read.text.slice(0, 20_000),
    ].join("\n");

    const result: DocumentUnderstandingResult = {
      understandingId: randomUUID(),
      resourceId: resource.id,
      status: read.issues.length || !read.text.trim() ? "partial" : "understood",
      metadata: {
        resourceId: resource.id,
        fileName: resource.fileName,
        filePath: resource.filePath,
        format: enrichFormat(read.format, resource),
        language: resource.language ?? "en",
        domainId: resource.domainId,
        sourceId: resource.sourceId,
        sourceTitle: resource.sourceName,
        fileSizeBytes: read.fileSizeBytes,
        checksumSha256: resource.checksumSha256,
        originalCollectionDate: resource.collectionDate ?? resource.completedAt,
        analyzedAt: new Date().toISOString(),
        encoding: read.encoding,
        pageOrChunkEstimate: Math.max(1, Math.ceil(read.text.length / 3000)),
      },
      structure,
      analysis,
      summary,
      searchableText,
      issues: read.issues,
      originalPreserved: true,
    };

    this.results.set(result.understandingId, result);
    this.indexes = this.indexer.build([...this.results.values()]);
    await this.persist();

    // Mark collection resource as understood without extracting knowledge packs.
    if (this.foundation?.getKnowledgeResearchEngine().isStartupComplete()) {
      try {
        await this.foundation.getKnowledgeResearchEngine().markDownloadProcessed(resource.id);
      } catch {
        // Resource may not be in download engine when testing in isolation.
      }
    }

    return structuredClone(result);
  }

  async understandLocalFile(input: {
    resourceId: string;
    filePath: string;
    fileName: string;
    title?: string;
    domainId?: string;
    sourceId?: string;
    sourceName?: string;
    language?: string;
    resourceType?: string;
    checksumSha256?: string;
  }): Promise<DocumentUnderstandingResult> {
    this.ensureStarted();
    const resource: CollectedKnowledgeResource = {
      id: input.resourceId,
      topic: input.domainId ?? "general",
      sourceId: input.sourceId ?? "local",
      resourceType: (input.resourceType as CollectedKnowledgeResource["resourceType"]) ?? "markdown",
      url: `local://${input.filePath}`,
      fileName: input.fileName,
      filePath: input.filePath,
      status: "completed",
      userApproved: true,
      processingStatus: "queued-for-acquisition",
      checksumSha256: input.checksumSha256 ?? null,
      fileSizeBytes: null,
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      domainId: input.domainId,
      title: input.title ?? input.fileName,
      sourceName: input.sourceName,
      language: input.language ?? "en",
      localStoragePath: input.filePath,
    };
    return this.understandCollectedResource(resource);
  }

  async understandAllCollected(): Promise<DocumentUnderstandingResult[]> {
    this.ensureStarted();
    const research = this.foundation?.getKnowledgeResearchEngine();
    if (!research?.isStartupComplete()) return [];
    const collected = research
      .listCollectedResources()
      .filter((resource) => resource.status === "completed" && resource.filePath);
    const outputs: DocumentUnderstandingResult[] = [];
    for (const resource of collected) {
      outputs.push(await this.understandCollectedResource(resource));
    }
    return outputs;
  }

  searchDocuments(query: string): DocumentUnderstandingResult[] {
    this.ensureStarted();
    return this.indexer.search([...this.results.values()], this.indexes, query).map((result) => structuredClone(result));
  }

  explainDocument(resourceId: string): string {
    const result = this.getByResourceId(resourceId);
    if (!result) return `No understood document found for resource ${resourceId}.`;
    return (
      `"${result.structure.title}" (${result.metadata.format}) is a ${result.analysis.difficultyLevel} learning resource. ` +
      `It contains ${result.structure.chapters.length} chapter(s), ${result.structure.sections.length} section(s), ` +
      `${result.structure.tables.length} table(s), ${result.structure.images.length} image(s), and ${result.structure.references.length} reference(s). ` +
      `Key topics: ${result.analysis.learningTopics.slice(0, 8).join(", ") || "n/a"}. ` +
      `Summary: ${result.summary} Original file preserved at ${result.metadata.filePath}.`
    );
  }

  summarizeDocument(resourceId: string): string {
    return this.getByResourceId(resourceId)?.summary ?? `No summary available for ${resourceId}.`;
  }

  recommendDocuments(limit = 5): Array<{ resourceId: string; title: string; reason: string }> {
    this.ensureStarted();
    return [...this.results.values()]
      .filter((result) => result.status === "understood" || result.status === "partial")
      .sort((a, b) => b.analysis.learningTopics.length - a.analysis.learningTopics.length)
      .slice(0, limit)
      .map((result) => ({
        resourceId: result.resourceId,
        title: result.structure.title,
        reason: `Covers ${result.analysis.difficultyLevel} topics: ${result.analysis.learningTopics.slice(0, 4).join(", ") || "general knowledge"}.`,
      }));
  }

  identifyMissingTopics(): string[] {
    this.ensureStarted();
    const present = new Set(
      [...this.results.values()].flatMap((result) =>
        result.analysis.domainConcepts.map((concept) => concept.category.replace(/-/g, " "))
      )
    );
    return EXPECTED_TOPICS.filter((topic) => ![...present].some((item) => item.includes(topic) || topic.includes(item)));
  }

  getAiMeAwareness(): AiMeDocumentAwareness {
    this.ensureStarted();
    const all = [...this.results.values()];
    const formats: Record<string, number> = {};
    for (const result of all) {
      formats[result.metadata.format] = (formats[result.metadata.format] ?? 0) + 1;
    }
    const topTopics = this.indexes.topicIndex.slice(0, 10).map((entry) => entry.topic);
    const missingTopics = this.identifyMissingTopics();
    return {
      totalUnderstood: all.filter((result) => result.status === "understood").length,
      partial: all.filter((result) => result.status === "partial").length,
      failed: all.filter((result) => result.status === "failed").length,
      formats,
      topTopics,
      missingTopics,
      recommendations: this.recommendDocuments(5),
      summary:
        `Document understanding: ${all.filter((result) => result.status === "understood").length} understood, ` +
        `${all.filter((result) => result.status === "partial").length} partial, ` +
        `${this.indexes.topicIndex.length} topics indexed, ${missingTopics.length} expected topic gap(s). ` +
        `No Knowledge Packs were built.`,
    };
  }

  async repair(): Promise<DocumentUnderstandingRepairResult> {
    this.ensureReady();
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    await fs.mkdir(this.root, { recursive: true });
    actions.push("Ensured document-understanding metadata directory.");

    for (const result of this.results.values()) {
      try {
        await fs.access(result.metadata.filePath);
      } catch {
        if (result.status !== "failed") {
          result.status = "failed";
          result.issues = [...result.issues, "Original collected file missing during repair."];
          actions.push(`Marked understanding failed for missing file: ${result.resourceId}`);
        }
      }
      if (!result.originalPreserved) {
        remainingIssues.push(`Integrity flag originalPreserved missing for ${result.resourceId}`);
      }
    }

    this.indexes = this.indexer.build([...this.results.values()]);
    actions.push("Rebuilt document indexes.");
    await this.persist();
    actions.push("Persisted understanding index.");

    const repair = { repaired: remainingIssues.length === 0, actions, remainingIssues };
    this.lastRepair = repair;
    return repair;
  }

  buildReport(issuesFound: string[] = [], issuesRepaired: string[] = []): DocumentUnderstandingReportData {
    this.ensureStarted();
    const all = [...this.results.values()];
    const complete = all.filter((result) => result.structure.title && result.analysis.keywords.length && result.metadata.format).length;
    const metadataScore = all.length ? Math.round((complete / all.length) * 100) : 100;
    const indexScore = Math.min(
      100,
      this.indexes.topicIndex.length * 5 +
        this.indexes.keywordIndex.length +
        this.indexes.domainIndex.length * 10 +
        this.indexes.technicalIndex.length * 2
    );

    return {
      generatedAt: new Date().toISOString(),
      existingDocumentReaders: [
        "None specialized — acquisition previously required pre-extracted text only",
        "KnowledgeProcessingEngine.process(preview) for StructuredKnowledge packs (unchanged)",
      ],
      componentsUpgraded: [
        "AiKnowledgeProcessingEngine module surface (exports + foundation startup for understanding)",
        "Download processing handoff via markDownloadProcessed after understanding",
      ],
      componentsCreated: [
        "DocumentReader",
        "DocumentStructureParser",
        "DocumentContentAnalyzer",
        "DocumentIndexer",
        "DocumentUnderstandingEngine",
      ],
      supportedDocumentFormats: [
        "pdf",
        "docx",
        "txt",
        "markdown",
        "html",
        "json",
        "xml",
        "csv",
        "technical-manual",
        "api-documentation",
        "research-paper",
        "user-guide",
        "company-documentation",
      ],
      documentsAnalyzed: all.map((result) => ({
        resourceId: result.resourceId,
        title: result.structure.title,
        format: result.metadata.format,
        status: result.status,
      })),
      topicsIdentified: this.indexes.topicIndex.map((entry) => entry.topic),
      metadataQuality: { complete, partial: all.length - complete, score: metadataScore },
      indexQuality: {
        topics: this.indexes.topicIndex.length,
        keywords: this.indexes.keywordIndex.length,
        domains: this.indexes.domainIndex.length,
        technicalTerms: this.indexes.technicalIndex.length,
        relationships: this.indexes.relationshipIndex.length,
        score: indexScore,
      },
      aiMeIntegration:
        "AI Me can explain, search, recommend, summarize understood documents and identify missing topics via knowledge-documents intent.",
      issuesFound,
      issuesRepaired,
      remainingWorkBeforeStep5: [
        "Extract structured Knowledge Packs from understood documents (without re-reading blindly).",
        "Optionally add dedicated PDF/DOCX parser packages for richer layout fidelity.",
        "Feed verified concepts into Knowledge Foundation records after user approval.",
      ],
    };
  }

  private failedResult(resource: CollectedKnowledgeResource, issues: string[]): DocumentUnderstandingResult {
    return {
      understandingId: randomUUID(),
      resourceId: resource.id,
      status: "failed",
      metadata: {
        resourceId: resource.id,
        fileName: resource.fileName,
        filePath: resource.filePath ?? "",
        format: "unknown",
        language: resource.language ?? "en",
        domainId: resource.domainId,
        sourceId: resource.sourceId,
        sourceTitle: resource.sourceName,
        fileSizeBytes: resource.fileSizeBytes ?? 0,
        checksumSha256: resource.checksumSha256,
        originalCollectionDate: resource.collectionDate,
        analyzedAt: new Date().toISOString(),
        encoding: "n/a",
        pageOrChunkEstimate: 0,
      },
      structure: {
        title: resource.title ?? resource.fileName,
        chapters: [],
        sections: [],
        headings: [],
        subHeadings: [],
        tables: [],
        images: [],
        diagrams: [],
        references: [],
      },
      analysis: {
        difficultyLevel: "beginner",
        beginnerSignals: [],
        intermediateSignals: [],
        advancedSignals: [],
        professionalSignals: [],
        domainConcepts: [],
        technicalTerminology: [],
        keywords: [],
        importantConcepts: [],
        learningTopics: [],
      },
      summary: "Document understanding failed.",
      searchableText: resource.title ?? resource.fileName,
      issues,
      originalPreserved: true,
    };
  }

  private async restore(): Promise<void> {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(this.root, "understanding-index.json"), "utf8")) as {
        results?: DocumentUnderstandingResult[];
        indexes?: DocumentUnderstandingIndexes;
      };
      for (const result of saved.results ?? []) this.results.set(result.understandingId, result);
      if (saved.indexes) this.indexes = saved.indexes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "understanding-index.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    const payload = {
      updatedAt: new Date().toISOString(),
      results: [...this.results.values()],
      indexes: this.indexes,
    };
    await fs.writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.foundation || !this.initialized) {
      throw new DocumentUnderstandingError("Document Understanding Engine is not initialized", "NOT_INITIALIZED");
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new DocumentUnderstandingError("Document Understanding Engine startup is incomplete", "NOT_STARTED");
    }
  }
}

function emptyIndexes(): DocumentUnderstandingIndexes {
  return {
    topicIndex: [],
    keywordIndex: [],
    domainIndex: [],
    technicalIndex: [],
    relationshipIndex: [],
    updatedAt: new Date().toISOString(),
  };
}

function buildSummary(
  structure: DocumentUnderstandingResult["structure"],
  analysis: DocumentUnderstandingResult["analysis"],
  format: SupportedDocumentFormat
): string {
  const concepts = analysis.domainConcepts.map((entry) => entry.category).slice(0, 5).join(", ");
  return (
    `${structure.title} is a ${format} document at ${analysis.difficultyLevel} level ` +
    `with ${structure.sections.length} section(s)` +
    `${concepts ? ` covering ${concepts}` : ""}. ` +
    `Keywords: ${analysis.keywords.slice(0, 8).join(", ") || "n/a"}.`
  );
}

function enrichFormat(format: SupportedDocumentFormat, resource: CollectedKnowledgeResource): SupportedDocumentFormat {
  if (format !== "unknown" && format !== "txt" && format !== "markdown" && format !== "html") return format;
  if (resource.resourceType === "api-specification") return "api-documentation";
  return format;
}

/** Stable hash helper for tests/tools */
export function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
