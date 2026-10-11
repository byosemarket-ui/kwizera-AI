/**
 * Phase 19 / 38B — ForexKnowledgeService
 * Filesystem JSON store under KWIZERA_STORAGE_ROOT/forex-knowledge.
 * Publish → chunk → keyword index. Retrieval returns only PUBLISHED + INDEXED knowledge.
 * PDF ingest: text extraction via unpdf (no OCR / no vector DB).
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chunkDocument } from "../knowledge-processing-engine/knowledge-chunker.js";
import { extractPdfText } from "../knowledge-processing-engine/pdf-text.js";
import { tokenize } from "../knowledge-retrieval-engine/hybrid-knowledge-index.js";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../storage/safe-json.js";
import {
  DEFAULT_FOREX_CATEGORIES,
  FOREX_INDEXING_STATUSES,
  FOREX_INGESTION_STATES,
  FOREX_KNOWLEDGE_STATUSES,
  FOREX_KNOWLEDGE_TYPES,
  FOREX_SOURCE_TYPES,
  type ForexIndexingStatus,
  type ForexIngestionState,
  type ForexKnowledgeCategory,
  type ForexKnowledgeChunk,
  type ForexKnowledgeCreateInput,
  type ForexKnowledgeDocument,
  type ForexKnowledgeListQuery,
  type ForexKnowledgeListResult,
  type ForexKnowledgeOverview,
  type ForexKnowledgeRetrievalHit,
  type ForexKnowledgeRetrievalQuery,
  type ForexKnowledgeStatus,
  type ForexKnowledgeTopic,
  type ForexKnowledgeType,
  type ForexKnowledgeUpdateInput,
  type ForexSourceType,
} from "./types.js";

interface ForexKnowledgeStoreFile {
  version: 1;
  categories: ForexKnowledgeCategory[];
  topics: ForexKnowledgeTopic[];
  documents: ForexKnowledgeDocument[];
  chunks: ForexKnowledgeChunk[];
}

export interface ForexPdfIngestInput {
  bytes: Uint8Array | Buffer;
  fileName: string;
  title?: string;
  categoryId?: string | null;
  topicId?: string | null;
  tags?: string[];
  publish?: boolean;
  mimeType?: string;
}

const EMPTY_STORE: ForexKnowledgeStoreFile = {
  version: 1,
  categories: [],
  topics: [],
  documents: [],
  chunks: [],
};

/** Forex PDF upload limit (raw bytes). General knowledge engine allows 40MB; Forex uses 15MB. */
export const FOREX_PDF_MAX_BYTES = 15 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 500_000;

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(input: string): string {
  const base = String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `doc-${randomUUID().slice(0, 8)}`;
}

function assertStatus(value: string): ForexKnowledgeStatus {
  if (!(FOREX_KNOWLEDGE_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid knowledge status: ${value}`);
  }
  return value as ForexKnowledgeStatus;
}

function assertKnowledgeType(value: string): ForexKnowledgeType {
  if (!(FOREX_KNOWLEDGE_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Invalid knowledge type: ${value}`);
  }
  return value as ForexKnowledgeType;
}

function assertSourceType(value: string): ForexSourceType {
  if (!(FOREX_SOURCE_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Invalid source type: ${value}`);
  }
  return value as ForexSourceType;
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const cleaned = String(tag ?? "").trim().toLowerCase().slice(0, 48);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out.slice(0, 40);
}

function scoreChunk(queryTokens: string[], text: string, title: string): number {
  if (queryTokens.length === 0) return 0;
  const hay = tokenize(`${title}\n${text}`);
  if (hay.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const token of hay) freq.set(token, (freq.get(token) ?? 0) + 1);
  let score = 0;
  for (const token of queryTokens) {
    const tf = freq.get(token) ?? 0;
    if (tf > 0) score += 1 + Math.log(1 + tf);
    if (tokenize(title.toLowerCase()).includes(token)) score += 1.5;
  }
  return score / Math.sqrt(queryTokens.length);
}

function pageNumberFromChunkText(text: string): number | null {
  const m = /(?:^|\n)##\s*Page\s+(\d+)\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function ingestionStateOf(doc: ForexKnowledgeDocument): ForexIngestionState | null {
  const raw = doc.metadata?.ingestionState;
  if (typeof raw === "string" && (FOREX_INGESTION_STATES as readonly string[]).includes(raw)) {
    return raw as ForexIngestionState;
  }
  return null;
}

export class ForexKnowledgeService {
  private readonly rootDir: string;
  private readonly storePath: string;
  private readonly uploadsDir: string;
  private ready = false;
  /** Serializes mutating operations (ingest, CRUD, index). */
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(storageRoot = resolveStorageRoot()) {
    this.rootDir = path.join(storageRoot, "forex-knowledge");
    this.storePath = path.join(this.rootDir, "store.json");
    this.uploadsDir = path.join(this.rootDir, "uploads");
  }

  private async withMutex<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeChain.then(fn, fn);
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    fs.mkdirSync(this.rootDir, { recursive: true });
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    const store = this.readStore();
    if (store.categories.length === 0) {
      const stamped = nowIso();
      store.categories = DEFAULT_FOREX_CATEGORIES.map((item) => ({
        id: randomUUID(),
        name: item.name,
        slug: item.slug,
        description: item.description,
        createdAt: stamped,
        updatedAt: stamped,
      }));
      await this.writeStore(store);
    }
    this.ready = true;
  }

  private readStore(): ForexKnowledgeStoreFile {
    const { value } = readJsonSafeSync<ForexKnowledgeStoreFile>(this.storePath, EMPTY_STORE);
    return {
      version: 1,
      categories: Array.isArray(value.categories) ? value.categories : [],
      topics: Array.isArray(value.topics) ? value.topics : [],
      documents: Array.isArray(value.documents) ? value.documents : [],
      chunks: Array.isArray(value.chunks) ? value.chunks : [],
    };
  }

  private async writeStore(store: ForexKnowledgeStoreFile): Promise<void> {
    await writeJsonAtomic(this.storePath, store);
  }

  async getOverview(): Promise<ForexKnowledgeOverview> {
    await this.ensureReady();
    const store = this.readStore();
    const docs = store.documents;
    const count = (status: ForexIndexingStatus) => docs.filter((d) => d.indexingStatus === status).length;
    const failedIngestion = docs.filter(
      (d) => ingestionStateOf(d) === "FAILED" || d.indexingStatus === "FAILED",
    ).length;
    let lastIndexingAt: string | null = null;
    for (const d of docs) {
      if (!d.indexedAt) continue;
      if (!lastIndexingAt || d.indexedAt > lastIndexingAt) lastIndexingAt = d.indexedAt;
    }
    return {
      documents: docs.length,
      drafts: docs.filter((d) => d.status === "DRAFT").length,
      published: docs.filter((d) => d.status === "PUBLISHED").length,
      archived: docs.filter((d) => d.status === "ARCHIVED").length,
      indexed: count("INDEXED"),
      indexing: count("INDEXING"),
      stale: count("STALE"),
      failed: count("FAILED"),
      notIndexed: count("NOT_INDEXED"),
      categories: store.categories.length,
      topics: store.topics.length,
      chunks: store.chunks.length,
      failedIngestion,
      lastIndexingAt,
      recentUpdates: [...docs]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 8)
        .map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          indexingStatus: d.indexingStatus,
          updatedAt: d.updatedAt,
        })),
    };
  }

  async listCategories(): Promise<ForexKnowledgeCategory[]> {
    await this.ensureReady();
    return this.readStore().categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCategory(input: { name: string; description?: string }): Promise<ForexKnowledgeCategory> {
    return this.withMutex(async () => {
      await this.ensureReady();
      const name = String(input.name ?? "").trim();
      if (name.length < 2) throw new Error("Category name is required.");
      const store = this.readStore();
      const slug = slugify(name);
      if (store.categories.some((c) => c.slug === slug)) {
        throw new Error(`Category slug already exists: ${slug}`);
      }
      const stamped = nowIso();
      const category: ForexKnowledgeCategory = {
        id: randomUUID(),
        name,
        slug,
        description: String(input.description ?? "").trim(),
        createdAt: stamped,
        updatedAt: stamped,
      };
      store.categories.push(category);
      await this.writeStore(store);
      return category;
    });
  }

  async listTopics(categoryId?: string): Promise<ForexKnowledgeTopic[]> {
    await this.ensureReady();
    const store = this.readStore();
    return store.topics
      .filter((t) => !categoryId || t.categoryId === categoryId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createTopic(input: { categoryId: string; name: string; description?: string }): Promise<ForexKnowledgeTopic> {
    return this.withMutex(async () => {
      await this.ensureReady();
      const name = String(input.name ?? "").trim();
      const categoryId = String(input.categoryId ?? "").trim();
      if (name.length < 2) throw new Error("Topic name is required.");
      const store = this.readStore();
      if (!store.categories.some((c) => c.id === categoryId)) {
        throw new Error("Category not found for topic.");
      }
      const slug = slugify(name);
      if (store.topics.some((t) => t.categoryId === categoryId && t.slug === slug)) {
        throw new Error(`Topic slug already exists in category: ${slug}`);
      }
      const stamped = nowIso();
      const topic: ForexKnowledgeTopic = {
        id: randomUUID(),
        categoryId,
        name,
        slug,
        description: String(input.description ?? "").trim(),
        createdAt: stamped,
        updatedAt: stamped,
      };
      store.topics.push(topic);
      await this.writeStore(store);
      return topic;
    });
  }

  private uniqueSlug(store: ForexKnowledgeStoreFile, title: string, excludeId?: string): string {
    let slug = slugify(title);
    let n = 2;
    while (store.documents.some((d) => d.slug === slug && d.id !== excludeId)) {
      slug = `${slugify(title)}-${n}`;
      n += 1;
      if (n > 1000) throw new Error("Unable to allocate unique slug.");
    }
    return slug;
  }

  async createDocument(input: ForexKnowledgeCreateInput): Promise<ForexKnowledgeDocument> {
    return this.withMutex(() => this.createDocumentUnlocked(input));
  }

  private async createDocumentUnlocked(input: ForexKnowledgeCreateInput): Promise<ForexKnowledgeDocument> {
    await this.ensureReady();
    const title = String(input.title ?? "").trim();
    const content = String(input.content ?? "").trim();
    if (title.length < 2) throw new Error("Title is required.");
    if (content.length < 1) throw new Error("Content is required.");
    const store = this.readStore();
    const status = assertStatus(input.status ?? "DRAFT");
    const stamped = nowIso();
    const doc: ForexKnowledgeDocument = {
      id: randomUUID(),
      title,
      slug: this.uniqueSlug(store, title),
      summary: String(input.summary ?? "").trim(),
      content,
      categoryId: input.categoryId ?? null,
      topicId: input.topicId ?? null,
      tags: normalizeTags(input.tags),
      knowledgeType: assertKnowledgeType(input.knowledgeType ?? "CONCEPT"),
      status,
      sourceType: assertSourceType(input.sourceType ?? "MANUAL"),
      sourceName: String(input.sourceName ?? "").trim(),
      sourceReference: String(input.sourceReference ?? "").trim(),
      sourceUrl: String(input.sourceUrl ?? "").trim(),
      language: (String(input.language ?? "en").trim() || "en").slice(0, 12),
      version: 1,
      author: String(input.author ?? "forex-admin").trim() || "forex-admin",
      createdAt: stamped,
      updatedAt: stamped,
      publishedAt: status === "PUBLISHED" ? stamped : null,
      indexedAt: null,
      indexingStatus: "NOT_INDEXED",
      indexingError: null,
      metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {},
    };
    this.validateRefs(store, doc);
    store.documents.push(doc);
    await this.writeStore(store);
    if (doc.status === "PUBLISHED") {
      return this.reindexDocumentUnlocked(doc.id);
    }
    return doc;
  }

  async updateDocument(id: string, input: ForexKnowledgeUpdateInput): Promise<ForexKnowledgeDocument> {
    return this.withMutex(async () => {
      await this.ensureReady();
      const store = this.readStore();
      const idx = store.documents.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error("Knowledge document not found.");
      const current = store.documents[idx]!;
      const next: ForexKnowledgeDocument = {
        ...current,
        title: input.title !== undefined ? String(input.title).trim() : current.title,
        summary: input.summary !== undefined ? String(input.summary).trim() : current.summary,
        content: input.content !== undefined ? String(input.content).trim() : current.content,
        categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
        topicId: input.topicId !== undefined ? input.topicId : current.topicId,
        tags: input.tags !== undefined ? normalizeTags(input.tags) : current.tags,
        knowledgeType: input.knowledgeType !== undefined
          ? assertKnowledgeType(input.knowledgeType)
          : current.knowledgeType,
        sourceType: input.sourceType !== undefined ? assertSourceType(input.sourceType) : current.sourceType,
        sourceName: input.sourceName !== undefined ? String(input.sourceName).trim() : current.sourceName,
        sourceReference: input.sourceReference !== undefined
          ? String(input.sourceReference).trim()
          : current.sourceReference,
        sourceUrl: input.sourceUrl !== undefined ? String(input.sourceUrl).trim() : current.sourceUrl,
        language: input.language !== undefined
          ? (String(input.language).trim() || "en").slice(0, 12)
          : current.language,
        author: input.author !== undefined
          ? (String(input.author).trim() || current.author)
          : current.author,
        metadata: input.metadata !== undefined && typeof input.metadata === "object"
          ? { ...current.metadata, ...input.metadata }
          : current.metadata,
        version: current.version + 1,
        updatedAt: nowIso(),
      };
      if (next.title.length < 2) throw new Error("Title is required.");
      if (next.content.length < 1) throw new Error("Content is required.");
      if (next.title !== current.title) {
        next.slug = this.uniqueSlug(store, next.title, current.id);
      }
      this.validateRefs(store, next);
      if (current.status === "PUBLISHED") {
        next.indexingStatus = "STALE";
        next.indexingError = null;
      }
      store.documents[idx] = next;
      await this.writeStore(store);
      return next;
    });
  }

  private validateRefs(store: ForexKnowledgeStoreFile, doc: ForexKnowledgeDocument): void {
    if (doc.categoryId && !store.categories.some((c) => c.id === doc.categoryId)) {
      throw new Error("Category not found.");
    }
    if (doc.topicId) {
      const topic = store.topics.find((t) => t.id === doc.topicId);
      if (!topic) throw new Error("Topic not found.");
      if (doc.categoryId && topic.categoryId !== doc.categoryId) {
        throw new Error("Topic does not belong to the selected category.");
      }
    }
  }

  async getDocument(id: string): Promise<ForexKnowledgeDocument | null> {
    await this.ensureReady();
    return this.readStore().documents.find((d) => d.id === id) ?? null;
  }

  async listDocuments(query: ForexKnowledgeListQuery = {}): Promise<ForexKnowledgeListResult> {
    await this.ensureReady();
    const store = this.readStore();
    const q = String(query.q ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const sort = query.sort ?? "updatedAt";
    const order = query.order === "asc" ? 1 : -1;

    let items = store.documents.filter((doc) => {
      if (query.categoryId && doc.categoryId !== query.categoryId) return false;
      if (query.topicId && doc.topicId !== query.topicId) return false;
      if (query.knowledgeType && doc.knowledgeType !== query.knowledgeType) return false;
      if (query.status && doc.status !== query.status) return false;
      if (query.indexingStatus && doc.indexingStatus !== query.indexingStatus) return false;
      if (query.language && doc.language !== query.language) return false;
      if (query.tag && !doc.tags.includes(query.tag.toLowerCase())) return false;
      if (q) {
        const hay = `${doc.title}\n${doc.summary}\n${doc.content}\n${doc.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    items = items.sort((a, b) => {
      const av = sort === "title" ? a.title.toLowerCase() : a[sort];
      const bv = sort === "title" ? b.title.toLowerCase() : b[sort];
      if (av < bv) return -1 * order;
      if (av > bv) return 1 * order;
      return 0;
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    };
  }

  async deleteDocument(id: string): Promise<{ deleted: true; id: string }> {
    return this.withMutex(async () => {
      await this.ensureReady();
      const store = this.readStore();
      const idx = store.documents.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error("Knowledge document not found.");
      store.documents.splice(idx, 1);
      store.chunks = store.chunks.filter((c) => c.documentId !== id);
      await this.writeStore(store);
      return { deleted: true as const, id };
    });
  }

  async publishDocument(id: string): Promise<ForexKnowledgeDocument> {
    return this.withMutex(async () => {
      await this.ensureReady();
      const store = this.readStore();
      const idx = store.documents.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error("Knowledge document not found.");
      const doc = store.documents[idx]!;
      if (doc.status === "ARCHIVED") {
        throw new Error("Archived knowledge cannot be published. Restore via edit workflow first.");
      }
      doc.status = "PUBLISHED";
      doc.publishedAt = doc.publishedAt ?? nowIso();
      doc.updatedAt = nowIso();
      doc.version += 1;
      doc.indexingStatus = "STALE";
      store.documents[idx] = doc;
      await this.writeStore(store);
      return this.reindexDocumentUnlocked(id);
    });
  }

  async unpublishDocument(id: string): Promise<ForexKnowledgeDocument> {
    return this.withMutex(async () => {
      await this.ensureReady();
      const store = this.readStore();
      const idx = store.documents.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error("Knowledge document not found.");
      const doc = store.documents[idx]!;
      doc.status = "DRAFT";
      doc.updatedAt = nowIso();
      doc.version += 1;
      doc.indexingStatus = "NOT_INDEXED";
      doc.indexedAt = null;
      store.chunks = store.chunks.filter((c) => c.documentId !== id);
      store.documents[idx] = doc;
      await this.writeStore(store);
      return doc;
    });
  }

  async archiveDocument(id: string): Promise<ForexKnowledgeDocument> {
    return this.withMutex(async () => {
      await this.ensureReady();
      const store = this.readStore();
      const idx = store.documents.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error("Knowledge document not found.");
      const doc = store.documents[idx]!;
      doc.status = "ARCHIVED";
      doc.updatedAt = nowIso();
      doc.version += 1;
      doc.indexingStatus = "NOT_INDEXED";
      doc.indexedAt = null;
      store.chunks = store.chunks.filter((c) => c.documentId !== id);
      store.documents[idx] = doc;
      await this.writeStore(store);
      return doc;
    });
  }

  async reindexDocument(id: string): Promise<ForexKnowledgeDocument> {
    return this.withMutex(() => this.reindexDocumentUnlocked(id));
  }

  private buildChunksForDocument(doc: ForexKnowledgeDocument, stamped: string): ForexKnowledgeChunk[] {
    const body = `${doc.summary ? `${doc.summary}\n\n` : ""}${doc.content}`;
    const chunks = chunkDocument(body, { targetChars: 900, maxChars: 1400, minChars: 120 });
    const contentHash = typeof doc.metadata?.contentHash === "string"
      ? String(doc.metadata.contentHash)
      : undefined;
    return chunks.map((chunk, chunkIndex) => {
      const pageNumber = pageNumberFromChunkText(chunk.text);
      return {
        id: createHash("sha1").update(`${doc.id}:${doc.version}:${chunkIndex}:${chunk.text}`).digest("hex").slice(0, 24),
        documentId: doc.id,
        version: doc.version,
        chunkIndex: chunk.index ?? chunkIndex,
        title: doc.title,
        text: chunk.text,
        categoryId: doc.categoryId,
        topicId: doc.topicId,
        tags: doc.tags,
        knowledgeType: doc.knowledgeType,
        status: "PUBLISHED" as const,
        createdAt: stamped,
        sourceName: doc.sourceName || undefined,
        documentTitle: doc.title,
        pageNumber,
        contentHash,
        locationHint: pageNumber != null ? `page:${pageNumber}` : undefined,
      };
    });
  }

  private async reindexDocumentUnlocked(id: string): Promise<ForexKnowledgeDocument> {
    await this.ensureReady();
    const store = this.readStore();
    const idx = store.documents.findIndex((d) => d.id === id);
    if (idx < 0) throw new Error("Knowledge document not found.");
    const doc = store.documents[idx]!;
    if (doc.status !== "PUBLISHED") {
      throw new Error("Only published knowledge can be indexed for AI retrieval.");
    }
    doc.indexingStatus = "INDEXING";
    doc.indexingError = null;
    store.documents[idx] = doc;
    await this.writeStore(store);

    try {
      const stamped = nowIso();
      const nextChunks = this.buildChunksForDocument(doc, stamped);
      const refreshed = this.readStore();
      const di = refreshed.documents.findIndex((d) => d.id === id);
      if (di < 0) throw new Error("Knowledge document not found during index.");
      refreshed.chunks = refreshed.chunks.filter((c) => c.documentId !== id).concat(nextChunks);
      refreshed.documents[di] = {
        ...refreshed.documents[di]!,
        indexingStatus: "INDEXED",
        indexedAt: stamped,
        indexingError: null,
        updatedAt: stamped,
        metadata: {
          ...refreshed.documents[di]!.metadata,
          ingestionState: refreshed.documents[di]!.metadata?.ingestionState === "FAILED"
            ? "FAILED"
            : "INDEXED",
        },
      };
      await this.writeStore(refreshed);
      return refreshed.documents[di]!;
    } catch (error) {
      const failed = this.readStore();
      const di = failed.documents.findIndex((d) => d.id === id);
      if (di >= 0) {
        failed.documents[di] = {
          ...failed.documents[di]!,
          indexingStatus: "FAILED",
          indexingError: error instanceof Error ? error.message : String(error),
          updatedAt: nowIso(),
        };
        await this.writeStore(failed);
        return failed.documents[di]!;
      }
      throw error;
    }
  }

  /**
   * Ingest a PDF: hash → dedup → store bytes → extract text → chunk.
   * Alias: ingestPdfFromBundle (same implementation).
   */
  async ingestPdf(input: ForexPdfIngestInput): Promise<ForexKnowledgeDocument> {
    return this.withMutex(() => this.ingestPdfUnlocked(input));
  }

  /** @see ingestPdf */
  async ingestPdfFromBundle(input: ForexPdfIngestInput): Promise<ForexKnowledgeDocument> {
    return this.ingestPdf(input);
  }

  private async ingestPdfUnlocked(input: ForexPdfIngestInput): Promise<ForexKnowledgeDocument> {
    await this.ensureReady();
    const fileName = String(input.fileName ?? "").trim();
    if (!fileName || !/\.pdf$/i.test(fileName)) {
      throw new Error("Invalid PDF filename: expected a .pdf file.");
    }
    const mime = String(input.mimeType ?? "application/pdf").trim().toLowerCase();
    if (mime && mime !== "application/pdf" && mime !== "application/x-pdf") {
      throw new Error("Invalid mime type: expected application/pdf.");
    }
    const bytes = input.bytes instanceof Uint8Array
      ? input.bytes
      : new Uint8Array(input.bytes);
    if (bytes.byteLength > FOREX_PDF_MAX_BYTES) {
      throw new Error(`PDF exceeds Forex upload limit of ${FOREX_PDF_MAX_BYTES} bytes (15 MB).`);
    }
    if (bytes.byteLength < 5) {
      throw new Error("PDF file is empty or too small.");
    }
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
      throw new Error("File is not a valid PDF document.");
    }

    const contentHash = sha256Hex(bytes);
    const store = this.readStore();
    const existing = store.documents.find(
      (d) => typeof d.metadata?.contentHash === "string" && d.metadata.contentHash === contentHash,
    );
    if (existing) {
      return existing;
    }

    const uploadPath = path.join(this.uploadsDir, `${contentHash}.pdf`);
    if (!fs.existsSync(uploadPath)) {
      fs.writeFileSync(uploadPath, bytes);
    }

    const title = String(input.title ?? "").trim()
      || fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim()
      || "Uploaded PDF";
    const stamped = nowIso();
    const doc: ForexKnowledgeDocument = {
      id: randomUUID(),
      title,
      slug: this.uniqueSlug(store, title),
      summary: "",
      content: "",
      categoryId: input.categoryId ?? null,
      topicId: input.topicId ?? null,
      tags: normalizeTags(input.tags),
      knowledgeType: "CONCEPT",
      status: "DRAFT",
      sourceType: "PDF",
      sourceName: fileName,
      sourceReference: `uploads/${contentHash}.pdf`,
      sourceUrl: "",
      language: "en",
      version: 1,
      author: "forex-admin",
      createdAt: stamped,
      updatedAt: stamped,
      publishedAt: null,
      indexedAt: null,
      indexingStatus: "NOT_INDEXED",
      indexingError: null,
      metadata: {
        contentHash,
        fileName,
        mimeType: "application/pdf",
        byteLength: bytes.byteLength,
        uploadPath: `uploads/${contentHash}.pdf`,
        ingestionState: "UPLOADED" satisfies ForexIngestionState,
      },
    };
    this.validateRefs(store, doc);
    store.documents.push(doc);
    await this.writeStore(store);

    // PROCESSING
    {
      const mid = this.readStore();
      const di = mid.documents.findIndex((d) => d.id === doc.id);
      if (di >= 0) {
        mid.documents[di] = {
          ...mid.documents[di]!,
          metadata: { ...mid.documents[di]!.metadata, ingestionState: "PROCESSING" },
          updatedAt: nowIso(),
        };
        await this.writeStore(mid);
      }
    }

    const extracted = await extractPdfText(bytes);
    if (!extracted.ok) {
      const failed = this.readStore();
      const di = failed.documents.findIndex((d) => d.id === doc.id);
      if (di < 0) throw new Error("Knowledge document not found after PDF extract.");
      const errMsg = extracted.message || extracted.errorCode || "PDF extraction failed.";
      failed.documents[di] = {
        ...failed.documents[di]!,
        indexingStatus: "FAILED",
        indexingError: errMsg,
        content: "",
        metadata: {
          ...failed.documents[di]!.metadata,
          ingestionState: "FAILED",
          pdfErrorCode: extracted.errorCode ?? null,
          pageCount: extracted.pageCount,
          pagesWithText: extracted.pagesWithText,
        },
        updatedAt: nowIso(),
      };
      await this.writeStore(failed);
      return failed.documents[di]!;
    }

    let markdown = extracted.markdown;
    if (markdown.length > MAX_EXTRACTED_CHARS) {
      markdown = markdown.slice(0, MAX_EXTRACTED_CHARS);
    }

    {
      const mid = this.readStore();
      const di = mid.documents.findIndex((d) => d.id === doc.id);
      if (di < 0) throw new Error("Knowledge document not found after PDF extract.");
      mid.documents[di] = {
        ...mid.documents[di]!,
        content: markdown,
        summary: markdown.slice(0, 280).replace(/\s+/g, " ").trim(),
        indexingStatus: "NOT_INDEXED",
        indexingError: null,
        metadata: {
          ...mid.documents[di]!.metadata,
          ingestionState: "INDEXED",
          pageCount: extracted.pageCount,
          pagesWithText: extracted.pagesWithText,
          extractedChars: extracted.chars,
        },
        updatedAt: nowIso(),
      };
      await this.writeStore(mid);

      if (input.publish) {
        const pub = this.readStore();
        const pi = pub.documents.findIndex((d) => d.id === doc.id);
        if (pi >= 0) {
          pub.documents[pi] = {
            ...pub.documents[pi]!,
            status: "PUBLISHED",
            publishedAt: nowIso(),
            indexingStatus: "STALE",
            version: pub.documents[pi]!.version + 1,
            updatedAt: nowIso(),
          };
          await this.writeStore(pub);
          return this.reindexDocumentUnlocked(doc.id);
        }
      }
      return mid.documents[di]!;
    }
  }

  async listChunks(documentId: string): Promise<ForexKnowledgeChunk[]> {
    await this.ensureReady();
    return this.readStore().chunks
      .filter((c) => c.documentId === documentId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  /**
   * Retrieval contract for future Forex AI / RAG.
   * Only PUBLISHED documents with INDEXED chunks are returned.
   */
  async retrieveRelevantForexKnowledge(
    query: ForexKnowledgeRetrievalQuery,
  ): Promise<ForexKnowledgeRetrievalHit[]> {
    await this.ensureReady();
    const store = this.readStore();
    const q = String(query.query ?? "").trim();
    if (!q) return [];
    const tokens = tokenize(q);
    const limit = Math.min(25, Math.max(1, Number(query.limit) || 8));
    const published = new Map(
      store.documents
        .filter((d) => d.status === "PUBLISHED" && d.indexingStatus === "INDEXED")
        .map((d) => [d.id, d]),
    );
    const hits: ForexKnowledgeRetrievalHit[] = [];
    for (const chunk of store.chunks) {
      const doc = published.get(chunk.documentId);
      if (!doc) continue;
      if (query.categoryId && doc.categoryId !== query.categoryId) continue;
      if (query.topicId && doc.topicId !== query.topicId) continue;
      if (query.knowledgeType && doc.knowledgeType !== query.knowledgeType) continue;
      if (query.tags?.length && !query.tags.every((tag) => doc.tags.includes(tag.toLowerCase()))) continue;
      const relevanceScore = scoreChunk(tokens, chunk.text, chunk.title);
      if (relevanceScore <= 0) continue;
      const contentHash = chunk.contentHash
        ?? (typeof doc.metadata?.contentHash === "string" ? String(doc.metadata.contentHash) : undefined);
      hits.push({
        documentId: doc.id,
        chunkId: chunk.id,
        title: doc.title,
        content: chunk.text,
        relevanceScore,
        categoryId: doc.categoryId,
        topicId: doc.topicId,
        tags: doc.tags,
        knowledgeType: doc.knowledgeType,
        sourceName: chunk.sourceName ?? doc.sourceName,
        version: doc.version,
        documentTitle: chunk.documentTitle ?? doc.title,
        pageNumber: chunk.pageNumber ?? null,
        contentHash,
      });
    }
    return hits.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  }
}

let singleton: ForexKnowledgeService | null = null;

export function getForexKnowledgeService(): ForexKnowledgeService {
  singleton ??= new ForexKnowledgeService();
  return singleton;
}

export function createForexKnowledgeService(storageRoot?: string): ForexKnowledgeService {
  return new ForexKnowledgeService(storageRoot ?? resolveStorageRoot());
}

export function isForexIndexingStatus(value: string): value is ForexIndexingStatus {
  return (FOREX_INDEXING_STATUSES as readonly string[]).includes(value);
}
