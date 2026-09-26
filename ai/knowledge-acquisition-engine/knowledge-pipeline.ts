/**
 * Phase 17 — Canonical knowledge acquisition pipeline.
 *
 * Source → retrieval → extraction → validation → chunking → dedup → storage (AiKnowledgeStorageEngine) → index.
 * Chunks are ordinary KnowledgeRecords (payload.kb) so the existing store, versioning, backups and the
 * persistent-knowledge APIs keep working. Sources, jobs, feedback and retrieval logs are sidecar JSON files.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { chunkDocument, extractSourceText, sourceContentHash, type KnowledgeChunk } from "../knowledge-processing-engine/knowledge-chunker.js";
import {
  HybridKnowledgeIndex,
  type KnowledgeEmbedder,
  type KnowledgeIndexDoc,
  type KnowledgeSearchRequest,
} from "../knowledge-retrieval-engine/hybrid-knowledge-index.js";
import {
  buildTaskKnowledgeContext,
  type TaskKnowledgeContext,
} from "../knowledge-retrieval-engine/knowledge-context-builder.js";
import {
  KNOWLEDGE_BASE_SCHEMA,
  computeFreshness,
  initialSourceTrust,
  isKnownDomain,
  normalizeDomain,
  profileForTask,
  type KnowledgeFreshness,
  type KnowledgeSourceType,
  type KnowledgeTask,
  type SourceTrust,
  KNOWLEDGE_SOURCE_TYPES,
} from "../knowledge-retrieval-engine/knowledge-taxonomy.js";
import {
  KnowledgeRecordStatus,
  KnowledgeStorageType,
  type KnowledgeRecord,
  type KnowledgeRecordInput,
  type KnowledgeRecordUpdate,
} from "../knowledge-storage-engine/types.js";
import {
  detectInstructionLikeText,
  validateKnowledgeChunk,
  type GuidanceSpec,
  type KnowledgeGuidance,
  type KnowledgeValidationEvidence,
} from "../knowledge-validation-engine/knowledge-evidence.js";

export interface KnowledgeRecordStoreAdapter {
  store(input: KnowledgeRecordInput): Promise<{ ok: boolean; id?: string; error?: string }>;
  update(id: string, update: KnowledgeRecordUpdate): Promise<boolean>;
  get(id: string): Promise<KnowledgeRecord | null>;
  listIds(): string[];
}

interface StorageEngineLike {
  storeRecord(input: KnowledgeRecordInput, requesterId?: string): Promise<{ success: boolean; record?: KnowledgeRecord; validation?: { message?: string } }>;
  updateRecord(id: string, update: KnowledgeRecordUpdate, requesterId?: string): Promise<{ success: boolean }>;
  getRecord(id: string, requesterId?: string, options?: { skipAudit?: boolean }): Promise<{ success: boolean; record?: KnowledgeRecord }>;
  getIndexEntries(): Array<{ knowledgeId: string }>;
}

export function adaptKnowledgeStorageEngine(engine: StorageEngineLike, requesterId = "knowledge-pipeline"): KnowledgeRecordStoreAdapter {
  return {
    async store(input) {
      const result = await engine.storeRecord(input, requesterId);
      return result.success && result.record
        ? { ok: true, id: result.record.knowledgeId }
        : { ok: false, error: result.validation?.message ?? "store failed" };
    },
    async update(id, update) {
      return (await engine.updateRecord(id, update, requesterId)).success;
    },
    async get(id) {
      const read = await engine.getRecord(id, requesterId, { skipAudit: true });
      return read.success && read.record ? read.record : null;
    },
    listIds() {
      return engine.getIndexEntries().map((entry) => entry.knowledgeId);
    },
  };
}

export interface KnowledgeFetchResult {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  finalUrl: string;
  errorCode?: string;
  message?: string;
}

export type KnowledgeFetcher = (url: string) => Promise<KnowledgeFetchResult>;

export type KnowledgeSourceStatus = "ACTIVE" | "DISABLED" | "REJECTED";

export interface KnowledgeSourceVersion {
  version: number;
  contentHash: string;
  retrievedAt: string;
  chunkIds: string[];
  linkedChunkIds: string[];
  chunkCount: number;
}

export interface KnowledgeSourceRecord {
  sourceId: string;
  sourceType: KnowledgeSourceType;
  title: string;
  url: string | null;
  author: string | null;
  publisher: string | null;
  publicationDate: string | null;
  license: string | null;
  /** REFERENCE_EXCERPTS keeps a bounded number of chunks; FULL_TEXT only for owner/internal documents. */
  retention: "REFERENCE_EXCERPTS" | "FULL_TEXT";
  language: string;
  domain: string;
  topics: string[];
  tenantId: string | null;
  projectId: string | null;
  trust: SourceTrust;
  trustBasis: string[];
  status: KnowledgeSourceStatus;
  supersedes: string[];
  guidanceBySection: Record<string, KnowledgeGuidance[]>;
  versions: KnowledgeSourceVersion[];
  currentVersion: number;
  lastRetrievedAt: string | null;
  lastError: { code: string; message: string; at: string } | null;
  stats: { stored: number; linked: number; rejected: number; needsReview: number };
  createdAt: string;
  updatedAt: string;
}

export interface RegisterKnowledgeSourceInput {
  sourceType: KnowledgeSourceType;
  title: string;
  url?: string | null;
  author?: string | null;
  publisher?: string | null;
  publicationDate?: string | null;
  license?: string | null;
  language?: string;
  domain: string;
  topics?: string[];
  tenantId?: string | null;
  projectId?: string | null;
  supersedes?: string[];
  officialHost?: boolean;
  /** Guidance attached to chunks under a heading (internal curated documents only). */
  guidanceBySection?: Record<string, KnowledgeGuidance[]>;
}

export type KnowledgeJobStage =
  | "RESEARCH_REQUEST" | "SOURCE_DISCOVERY" | "SOURCE_RETRIEVAL" | "CONTENT_EXTRACTION" | "SOURCE_VALIDATION"
  | "KNOWLEDGE_PROCESSING" | "DEDUPLICATION" | "INDEXING" | "READY" | "FAILED";

export const KNOWLEDGE_JOB_STAGES: KnowledgeJobStage[] = [
  "RESEARCH_REQUEST", "SOURCE_DISCOVERY", "SOURCE_RETRIEVAL", "CONTENT_EXTRACTION", "SOURCE_VALIDATION",
  "KNOWLEDGE_PROCESSING", "DEDUPLICATION", "INDEXING", "READY",
];

export interface KnowledgeJob {
  jobId: string;
  sourceId: string;
  kind: "INGEST" | "REFRESH";
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "UNCHANGED" | "FAILED";
  stage: KnowledgeJobStage;
  history: Array<{ stage: KnowledgeJobStage; at: string; note?: string }>;
  attempts: number;
  force: boolean;
  error: { code: string; message: string } | null;
  result: { version: number; stored: number; linked: number; rejected: number; needsReview: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRetrievalLogEntry {
  at: string;
  task: string;
  caller: string;
  query: string;
  mode: string;
  itemIds: string[];
  sourceTypes: string[];
  domains: string[];
  relevance: number[];
  freshness: KnowledgeFreshness[];
  contextChars: number;
  durationMs: number;
  consideredCount: number;
  scoped: { tenant: boolean; project: boolean };
  externalRetrieval: false;
}

export type KnowledgeFeedbackKind = "USEFUL" | "NOT_USEFUL" | "OUTDATED" | "INCORRECT" | "IRRELEVANT";

const RETENTION_CHUNK_LIMIT: Record<KnowledgeSourceRecord["retention"], number> = {
  REFERENCE_EXCERPTS: 40,
  FULL_TEXT: 400,
};

const MAX_SOURCE_CHARS = 600_000;

function storageTypeForDomain(domain: string): KnowledgeStorageType {
  switch (normalizeDomain(domain)) {
    case "VIDEO": case "MOTION_DESIGN": case "STORYTELLING": return KnowledgeStorageType.Video;
    case "PHOTOGRAPHY": case "IMAGE_PROCESSING": case "COLOR": return KnowledgeStorageType.Image;
    case "MARKETING": case "ADVERTISING": case "SOCIAL_MEDIA": case "COPYWRITING": return KnowledgeStorageType.Marketing;
    case "PROGRAMMING": case "SOFTWARE_ENGINEERING": case "AI_ML": return KnowledgeStorageType.Technical;
    case "BUSINESS": return KnowledgeStorageType.Business;
    case "PRODUCT_CREATIVE": return KnowledgeStorageType.Product;
    default: return KnowledgeStorageType.Creative;
  }
}

function legacyDomainFor(record: KnowledgeRecord): string {
  const blob = `${record.category} ${record.tags.join(" ")} ${record.knowledgeType}`.toLowerCase();
  if (/typograph|font/.test(blob)) return "TYPOGRAPHY";
  if (/audio|music|sound/.test(blob)) return "AUDIO";
  if (/video/.test(blob)) return "VIDEO";
  if (/marketing|cta|advert/.test(blob)) return "MARKETING";
  if (/image|photo/.test(blob)) return "PHOTOGRAPHY";
  if (/technical|software|code/.test(blob)) return "PROGRAMMING";
  if (/workflow|memory/.test(blob)) return "AI_ML";
  return "GENERAL";
}

function scopeKey(tenantId: string | null, projectId: string | null): string {
  return `${tenantId ?? "*"}|${projectId ?? "*"}`;
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export interface KnowledgePipelineOptions {
  store: KnowledgeRecordStoreAdapter;
  dataDir: string;
  fetcher?: KnowledgeFetcher | null;
  embedder?: KnowledgeEmbedder | null;
  now?: () => Date;
}

export class KnowledgePipeline {
  private readonly store: KnowledgeRecordStoreAdapter;
  private readonly dataDir: string;
  private fetcher: KnowledgeFetcher | null;
  private readonly now: () => Date;
  readonly index: HybridKnowledgeIndex;
  private sources = new Map<string, KnowledgeSourceRecord>();
  private jobs = new Map<string, KnowledgeJob>();
  private hashes = new Map<string, { itemId: string; sourceId: string; scope: string }>();
  private retrievalLog: KnowledgeRetrievalLogEntry[] = [];
  private feedback: Array<{ at: string; itemId: string; kind: KnowledgeFeedbackKind; note?: string }> = [];
  private tail: Promise<void> = Promise.resolve();
  private readonly jobPromises = new Map<string, Promise<KnowledgeJob>>();
  private ready = false;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(options: KnowledgePipelineOptions) {
    this.store = options.store;
    this.dataDir = options.dataDir;
    this.fetcher = options.fetcher ?? null;
    this.now = options.now ?? (() => new Date());
    this.index = new HybridKnowledgeIndex(options.embedder ?? null, this.now);
  }

  isReady(): boolean {
    return this.ready;
  }

  setFetcher(fetcher: KnowledgeFetcher | null): void {
    this.fetcher = fetcher;
  }

  async boot(): Promise<void> {
    fs.mkdirSync(path.join(this.dataDir, "staging"), { recursive: true });
    for (const source of this.readJson<KnowledgeSourceRecord[]>("sources.json", [])) this.sources.set(source.sourceId, source);
    for (const job of this.readJson<KnowledgeJob[]>("jobs.json", [])) {
      if (job.status === "RUNNING" || job.status === "QUEUED") {
        job.status = "FAILED";
        job.stage = "FAILED";
        job.error = { code: "INTERRUPTED", message: "The server restarted during ingestion. Retry the job to resume." };
        job.updatedAt = this.now().toISOString();
      }
      this.jobs.set(job.jobId, job);
    }
    this.feedback = this.readJson("feedback.json", []);
    this.retrievalLog = this.readJson<KnowledgeRetrievalLogEntry[]>("retrieval-log.json", []).slice(-500);
    this.persistJobs();
    await this.reindex();
    this.ready = true;
  }

  // ---------- persistence ----------

  private readJson<T>(name: string, fallback: T): T {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.dataDir, name), "utf8")) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson(name: string, value: unknown): void {
    const file = path.join(this.dataDir, name);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
    fs.renameSync(tmp, file);
  }

  private persistSources(): void {
    this.writeJson("sources.json", [...this.sources.values()]);
  }

  private persistJobs(): void {
    const recent = [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300);
    this.writeJson("jobs.json", recent);
  }

  private stagingPath(sourceId: string): string {
    if (!/^[a-zA-Z0-9-]+$/.test(sourceId)) throw new Error("Invalid source id");
    return path.join(this.dataDir, "staging", `${sourceId}.txt`);
  }

  // ---------- sources ----------

  registerSource(input: RegisterKnowledgeSourceInput): KnowledgeSourceRecord {
    if (!KNOWLEDGE_SOURCE_TYPES.includes(input.sourceType)) throw new KnowledgeInputError("INVALID_SOURCE_TYPE", "Unknown source type.");
    const title = String(input.title ?? "").trim().slice(0, 200);
    if (title.length < 3) throw new KnowledgeInputError("INVALID_SOURCE", "A source title is required.");
    let url: string | null = null;
    if (input.url) {
      try {
        const parsed = new URL(input.url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
        if (parsed.username || parsed.password) throw new Error("credentials");
        url = parsed.toString();
      } catch {
        throw new KnowledgeInputError("INVALID_URL", "Only public http(s) URLs without credentials are supported.");
      }
    }
    if (input.sourceType === "USER_DOCUMENT" && !input.projectId && !input.tenantId) {
      throw new KnowledgeInputError("SCOPE_REQUIRED", "Customer documents must belong to a project or tenant.");
    }
    const domain = normalizeDomain(input.domain);
    if (!isKnownDomain(domain)) throw new KnowledgeInputError("UNKNOWN_DOMAIN", `Unknown knowledge domain: ${domain}`);
    const { trust, basis } = initialSourceTrust({ sourceType: input.sourceType, officialHost: input.officialHost });
    const now = this.now().toISOString();
    const owned = input.sourceType === "USER_DOCUMENT" || input.sourceType === "INTERNAL_DOCUMENT" || input.sourceType === "SYSTEM_GENERATED_KNOWLEDGE";
    const source: KnowledgeSourceRecord = {
      sourceId: randomUUID(),
      sourceType: input.sourceType,
      title,
      url,
      author: input.author?.trim() || null,
      publisher: input.publisher?.trim() || null,
      publicationDate: isoDate(input.publicationDate),
      license: input.license?.trim() || null,
      retention: owned ? "FULL_TEXT" : "REFERENCE_EXCERPTS",
      language: input.language?.trim() || "en",
      domain,
      topics: (input.topics ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12),
      tenantId: input.tenantId ?? null,
      projectId: input.projectId ?? null,
      trust,
      trustBasis: basis,
      status: "ACTIVE",
      supersedes: input.supersedes ?? [],
      guidanceBySection: input.sourceType === "INTERNAL_DOCUMENT" ? input.guidanceBySection ?? {} : {},
      versions: [],
      currentVersion: 0,
      lastRetrievedAt: null,
      lastError: null,
      stats: { stored: 0, linked: 0, rejected: 0, needsReview: 0 },
      createdAt: now,
      updatedAt: now,
    };
    this.sources.set(source.sourceId, source);
    this.persistSources();
    return source;
  }

  getSource(sourceId: string): KnowledgeSourceRecord | null {
    return this.sources.get(sourceId) ?? null;
  }

  listSources(filter: { tenantId?: string | null; projectId?: string | null; includeScoped?: boolean } = {}): KnowledgeSourceRecord[] {
    return [...this.sources.values()]
      .filter((s) => filter.includeScoped || ((!s.tenantId || s.tenantId === filter.tenantId) && (!s.projectId || s.projectId === filter.projectId)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  findSourceByTitle(title: string, sourceType?: KnowledgeSourceType): KnowledgeSourceRecord | null {
    return [...this.sources.values()].find((s) => s.title === title && (!sourceType || s.sourceType === sourceType)) ?? null;
  }

  // ---------- jobs ----------

  /** Queues ingestion. Supplied content is staged on disk so a failed job can be retried after a restart. */
  ingest(sourceId: string, options: { content?: string; mimeType?: string; fileName?: string; force?: boolean } = {}): KnowledgeJob {
    const source = this.requireSource(sourceId);
    if (options.content !== undefined) {
      if (options.content.length > MAX_SOURCE_CHARS) throw new KnowledgeInputError("SOURCE_TOO_LARGE", "The document is too large to ingest.");
      const extracted = extractSourceText({ content: options.content, mimeType: options.mimeType, fileName: options.fileName });
      if (!extracted.ok) throw new KnowledgeInputError(extracted.errorCode ?? "EXTRACTION_FAILED", extracted.message ?? "No text could be extracted.");
      fs.writeFileSync(this.stagingPath(source.sourceId), extracted.text, "utf8");
    } else if (!source.url && !fs.existsSync(this.stagingPath(source.sourceId))) {
      throw new KnowledgeInputError("CONTENT_REQUIRED", "Provide document content or a URL.");
    }
    return this.enqueue(source, source.versions.length ? "REFRESH" : "INGEST", Boolean(options.force));
  }

  refreshSource(sourceId: string, force = false): KnowledgeJob {
    const source = this.requireSource(sourceId);
    if (source.status !== "ACTIVE") throw new KnowledgeInputError("SOURCE_INACTIVE", "Enable the source before refreshing it.");
    return this.enqueue(source, "REFRESH", force);
  }

  retryJob(jobId: string): KnowledgeJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new KnowledgeInputError("JOB_NOT_FOUND", "Job not found.");
    if (job.status !== "FAILED") throw new KnowledgeInputError("JOB_NOT_FAILED", "Only failed jobs can be retried.");
    return this.enqueue(this.requireSource(job.sourceId), job.kind, job.force, job);
  }

  waitForJob(jobId: string): Promise<KnowledgeJob> {
    return this.jobPromises.get(jobId) ?? Promise.resolve(this.jobs.get(jobId)!);
  }

  getJob(jobId: string): KnowledgeJob | null {
    return this.jobs.get(jobId) ?? null;
  }

  listJobs(limit = 50): KnowledgeJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  private enqueue(source: KnowledgeSourceRecord, kind: KnowledgeJob["kind"], force: boolean, existing?: KnowledgeJob): KnowledgeJob {
    const now = this.now().toISOString();
    const job: KnowledgeJob = existing
      ? { ...existing, status: "QUEUED", stage: "RESEARCH_REQUEST", error: null, attempts: existing.attempts, updatedAt: now }
      : {
          jobId: randomUUID(), sourceId: source.sourceId, kind, status: "QUEUED", stage: "RESEARCH_REQUEST",
          history: [], attempts: 0, force, error: null, result: null, createdAt: now, updatedAt: now,
        };
    this.jobs.set(job.jobId, job);
    this.persistJobs();
    const run = this.tail.then(() => this.runJob(job.jobId));
    this.tail = run.then(() => undefined, () => undefined);
    this.jobPromises.set(job.jobId, run);
    void run.finally(() => this.jobPromises.delete(job.jobId));
    return job;
  }

  private mark(job: KnowledgeJob, stage: KnowledgeJobStage, note?: string): void {
    job.stage = stage;
    job.history.push({ stage, at: this.now().toISOString(), note });
    job.updatedAt = this.now().toISOString();
    this.persistJobs();
  }

  private fail(job: KnowledgeJob, source: KnowledgeSourceRecord, code: string, message: string): KnowledgeJob {
    job.status = "FAILED";
    job.error = { code, message };
    this.mark(job, "FAILED", code);
    source.lastError = { code, message, at: this.now().toISOString() };
    source.updatedAt = this.now().toISOString();
    this.persistSources();
    return job;
  }

  private async runJob(jobId: string): Promise<KnowledgeJob> {
    const job = this.jobs.get(jobId)!;
    const source = this.sources.get(job.sourceId);
    job.status = "RUNNING";
    job.attempts += 1;
    job.history = [];
    if (!source) {
      job.status = "FAILED";
      job.error = { code: "SOURCE_NOT_FOUND", message: "Source was removed." };
      this.mark(job, "FAILED");
      return job;
    }
    try {
      this.mark(job, "RESEARCH_REQUEST", `${job.kind} ${source.sourceType}`);
      const staged = fs.existsSync(this.stagingPath(source.sourceId));
      const useUrl = Boolean(source.url) && (job.kind === "REFRESH" || !staged);
      this.mark(job, "SOURCE_DISCOVERY", useUrl ? "Fetch the registered URL." : "Use the supplied document.");

      let rawText: string;
      let retrievedTitle: string | undefined;
      if (useUrl) {
        if (!this.fetcher) return this.fail(job, source, "RETRIEVAL_UNAVAILABLE", "Online retrieval is not configured on this server.");
        const fetched = await this.fetcher(source.url!);
        if (!fetched.ok) return this.fail(job, source, fetched.errorCode ?? "RETRIEVAL_FAILED", fetched.message ?? `Source returned HTTP ${fetched.status}.`);
        this.mark(job, "SOURCE_RETRIEVAL", `HTTP ${fetched.status}`);
        const extracted = extractSourceText({ content: fetched.body, mimeType: fetched.contentType, fileName: fetched.finalUrl });
        if (!extracted.ok) return this.fail(job, source, extracted.errorCode ?? "EXTRACTION_FAILED", extracted.message ?? "No usable text.");
        rawText = extracted.text;
        retrievedTitle = extracted.title;
      } else {
        rawText = fs.readFileSync(this.stagingPath(source.sourceId), "utf8");
        this.mark(job, "SOURCE_RETRIEVAL", "Supplied document read from staging.");
      }
      this.mark(job, "CONTENT_EXTRACTION", `${rawText.length} characters of text${retrievedTitle ? ` · page title "${retrievedTitle.slice(0, 80)}"` : ""}`);

      const flags = detectInstructionLikeText(rawText);
      if (flags.length && source.trust !== "REJECTED" && source.trust !== "LOW_CONFIDENCE") {
        source.trust = "LOW_CONFIDENCE";
        source.trustBasis = [...source.trustBasis, `Instruction-like text found (${flags.join(", ")}); lowered to LOW_CONFIDENCE.`];
      }
      const contentHash = sourceContentHash(rawText);
      const current = source.versions[source.versions.length - 1];
      this.mark(job, "SOURCE_VALIDATION", flags.length ? `instruction-like text: ${flags.join(", ")}` : "No instruction-like text.");
      if (current && current.contentHash === contentHash && !job.force) {
        source.lastRetrievedAt = this.now().toISOString();
        source.lastError = null;
        source.updatedAt = this.now().toISOString();
        this.persistSources();
        job.status = "UNCHANGED";
        job.result = { version: current.version, stored: 0, linked: 0, rejected: 0, needsReview: 0 };
        this.mark(job, "READY", "Source content unchanged; existing version kept.");
        return job;
      }

      let chunks = chunkDocument(rawText);
      const limit = RETENTION_CHUNK_LIMIT[source.retention];
      const truncated = chunks.length > limit;
      chunks = chunks.slice(0, limit);
      this.mark(job, "KNOWLEDGE_PROCESSING", `${chunks.length} chunks${truncated ? ` (retention limit ${limit} reached)` : ""}`);

      const version = (current?.version ?? 0) + 1;
      const retrievedAt = this.now().toISOString();
      const scope = scopeKey(source.tenantId, source.projectId);
      const reused: string[] = [];
      const linked: string[] = [];
      const fresh: Array<{ chunk: KnowledgeChunk; evidence: KnowledgeValidationEvidence }> = [];
      for (const chunk of chunks) {
        const known = this.hashes.get(chunk.hash);
        if (known && known.scope === scope && this.index.has(known.itemId)) {
          if (known.sourceId === source.sourceId) reused.push(known.itemId);
          else linked.push(known.itemId);
          continue;
        }
        const evidence = validateKnowledgeChunk({
          text: chunk.text,
          provenance: { sourceId: source.sourceId, title: source.title, url: source.url, retrievedAt, sourceType: source.sourceType },
          now: this.now(),
        });
        fresh.push({ chunk, evidence });
      }
      this.mark(job, "DEDUPLICATION", `${reused.length} unchanged, ${linked.length} linked to other sources, ${fresh.length} new`);

      const storedIds: string[] = [];
      let rejected = 0;
      let needsReview = 0;
      for (const { chunk, evidence } of fresh) {
        if (evidence.status === "REJECTED") { rejected += 1; continue; }
        if (evidence.status === "NEEDS_REVIEW") needsReview += 1;
        const id = await this.storeChunk(source, chunk, evidence, version, retrievedAt);
        if (id) storedIds.push(id);
      }
      for (const itemId of linked) await this.linkChunk(itemId, source.sourceId);

      const keep = new Set([...reused, ...storedIds]);
      for (const previous of source.versions) {
        for (const itemId of previous.chunkIds) {
          if (!keep.has(itemId) && this.index.has(itemId)) await this.archiveChunk(itemId, version);
        }
      }
      source.versions.push({ version, contentHash, retrievedAt, chunkIds: [...reused, ...storedIds], linkedChunkIds: linked, chunkCount: chunks.length });
      source.versions = source.versions.slice(-20);
      source.currentVersion = version;
      source.lastRetrievedAt = retrievedAt;
      source.lastError = null;
      source.stats = { stored: reused.length + storedIds.length, linked: linked.length, rejected, needsReview };
      source.updatedAt = retrievedAt;
      this.persistSources();
      this.mark(job, "INDEXING", `${this.index.size} items in the index`);
      job.status = "COMPLETED";
      job.result = { version, stored: storedIds.length, linked: linked.length, rejected, needsReview };
      this.mark(job, "READY");
      return job;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.fail(job, source, "INGESTION_ERROR", /[\\/]/.test(message) ? "Ingestion failed (details in server log)." : message.slice(0, 200));
    }
  }

  private guidanceFor(source: KnowledgeSourceRecord, chunk: KnowledgeChunk): KnowledgeGuidance[] {
    const out: KnowledgeGuidance[] = [];
    for (const heading of chunk.headingPath) out.push(...(source.guidanceBySection[heading] ?? []));
    return out;
  }

  private async storeChunk(source: KnowledgeSourceRecord, chunk: KnowledgeChunk, evidence: KnowledgeValidationEvidence, version: number, retrievedAt: string): Promise<string | null> {
    const trusted = (source.trust === "TRUSTED" || source.trust === "VERIFIED") && evidence.status === "VALIDATED";
    const section = chunk.section || "Overview";
    const guidance = this.guidanceFor(source, chunk);
    const kb = {
      schema: KNOWLEDGE_BASE_SCHEMA,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      domain: source.domain,
      topics: source.topics,
      trust: source.trust,
      validation: evidence,
      tenantId: source.tenantId,
      projectId: source.projectId,
      headingPath: chunk.headingPath,
      position: { index: chunk.index, paragraphStart: chunk.paragraphStart, paragraphEnd: chunk.paragraphEnd, charStart: chunk.charStart, charEnd: chunk.charEnd },
      chunkHash: chunk.hash,
      sourceVersion: version,
      url: source.url,
      author: source.author,
      publisher: source.publisher,
      publicationDate: source.publicationDate,
      retrievedAt,
      license: source.license,
      language: source.language,
      guidance,
      supersedes: source.supersedes,
      alsoFoundIn: [] as string[],
      active: true,
    };
    const result = await this.store.store({
      knowledgeType: storageTypeForDomain(source.domain),
      category: source.domain,
      title: `${source.title} › ${section} (v${version} · part ${chunk.index + 1})`.slice(0, 480),
      description: chunk.text,
      summary: chunk.text.slice(0, 280),
      tags: ["kb", `kb-source-${source.sourceId}`, `domain-${source.domain.toLowerCase()}`, source.projectId ? "scope-project" : "scope-permanent", ...(source.projectId ? [`project-${source.projectId}`] : [])],
      keywords: [source.domain, ...source.topics],
      source: `kb:${source.sourceId}`,
      sourceReliability: trusted ? 85 : 55,
      confidenceScore: trusted ? 80 : 60,
      qualityScore: evidence.checks.extractionQuality === "OK" ? 80 : 50,
      verificationStatus: trusted ? KnowledgeVerificationStatus.Verified : KnowledgeVerificationStatus.Pending,
      status: KnowledgeRecordStatus.Active,
      payload: { kb, scope: source.projectId ? "project" : "permanent", projectId: source.projectId },
    });
    if (!result.ok || !result.id) return null;
    this.index.upsert(this.docFromKb(result.id, source.title, chunk.text, kb));
    this.hashes.set(chunk.hash, { itemId: result.id, sourceId: source.sourceId, scope: scopeKey(source.tenantId, source.projectId) });
    return result.id;
  }

  private async mutateKb(itemId: string, change: (kb: Record<string, unknown>) => void, status?: KnowledgeRecordStatus): Promise<void> {
    const record = await this.store.get(itemId);
    const payload = (record?.payload ?? {}) as Record<string, unknown>;
    const kb = payload.kb as Record<string, unknown> | undefined;
    if (!record || !kb) return;
    change(kb);
    await this.store.update(itemId, { payload: { ...payload, kb }, ...(status ? { status } : {}) });
    const doc = this.index.get(itemId);
    if (doc) this.index.upsert(this.docFromKb(itemId, String(kb.sourceTitle ?? doc.citation.title), record.description, kb));
  }

  private async linkChunk(itemId: string, sourceId: string): Promise<void> {
    await this.mutateKb(itemId, (kb) => {
      const list = Array.isArray(kb.alsoFoundIn) ? kb.alsoFoundIn as string[] : [];
      if (!list.includes(sourceId)) kb.alsoFoundIn = [...list, sourceId];
    });
  }

  private async archiveChunk(itemId: string, supersededByVersion: number): Promise<void> {
    await this.mutateKb(itemId, (kb) => {
      kb.active = false;
      kb.supersededByVersion = supersededByVersion;
    }, KnowledgeRecordStatus.Archived);
    const doc = this.index.get(itemId);
    if (doc) this.index.upsert({ ...doc, active: false });
  }

  private docFromKb(id: string, sourceTitle: string, text: string, kb: Record<string, unknown>): KnowledgeIndexDoc {
    const source = this.sources.get(String(kb.sourceId));
    const position = (kb.position ?? {}) as { paragraphStart?: number; paragraphEnd?: number };
    const headingPath = Array.isArray(kb.headingPath) ? kb.headingPath as string[] : [];
    const validation = kb.validation as KnowledgeValidationEvidence | undefined;
    const trust = (source?.trust ?? kb.trust ?? "UNVERIFIED") as SourceTrust;
    return {
      id,
      sourceId: String(kb.sourceId),
      title: source?.title ?? sourceTitle,
      text,
      domain: String(kb.domain ?? "GENERAL"),
      topics: Array.isArray(kb.topics) ? kb.topics as string[] : [],
      sourceType: (kb.sourceType ?? "PUBLIC_WEB") as KnowledgeSourceType,
      trust,
      validationStatus: validation?.status ?? "NEEDS_REVIEW",
      tenantId: (kb.tenantId as string | null) ?? null,
      projectId: (kb.projectId as string | null) ?? null,
      observedAt: (kb.publicationDate as string | null) ?? (kb.retrievedAt as string | null) ?? null,
      headingPath,
      citation: {
        sourceId: String(kb.sourceId),
        title: source?.title ?? sourceTitle,
        url: (kb.url as string | null) ?? null,
        section: headingPath[headingPath.length - 1],
        paragraphStart: position.paragraphStart,
        paragraphEnd: position.paragraphEnd,
        publisher: (kb.publisher as string | null) ?? null,
        sourceVersion: Number(kb.sourceVersion ?? 1),
      },
      guidance: Array.isArray(kb.guidance) ? kb.guidance as KnowledgeGuidance[] : [],
      supersedes: Array.isArray(kb.supersedes) ? kb.supersedes as string[] : [],
      active: kb.active !== false && (source ? source.status === "ACTIVE" : true),
    };
  }

  private docFromLegacy(record: KnowledgeRecord): KnowledgeIndexDoc {
    const payload = (record.payload ?? {}) as Record<string, unknown>;
    const projectId = typeof payload.projectId === "string" && payload.projectId ? payload.projectId : null;
    const sourceUrl = typeof payload.sourceUrl === "string" ? payload.sourceUrl : null;
    const verified = record.verificationStatus === KnowledgeVerificationStatus.Verified;
    return {
      id: record.knowledgeId,
      sourceId: `legacy:${record.source}`,
      title: record.title,
      text: record.description,
      domain: legacyDomainFor(record),
      topics: record.keywords.slice(0, 8),
      sourceType: sourceUrl ? "PUBLIC_WEB" : "SYSTEM_GENERATED_KNOWLEDGE",
      trust: verified ? "VERIFIED" : "UNVERIFIED",
      validationStatus: "VALIDATED",
      tenantId: null,
      projectId,
      observedAt: record.lastUpdated,
      headingPath: [],
      citation: { sourceId: `legacy:${record.source}`, title: record.title, url: sourceUrl },
      active: record.status !== KnowledgeRecordStatus.Archived && record.status !== KnowledgeRecordStatus.Rejected
        && record.status !== KnowledgeRecordStatus.Deleted,
      legacy: true,
    };
  }

  /** Rebuilds the index from the canonical store (legacy records included, read-only). */
  async reindex(): Promise<{ indexed: number; legacy: number; durationMs: number }> {
    const started = Date.now();
    this.index.clear();
    this.hashes.clear();
    let legacy = 0;
    for (const id of this.store.listIds()) {
      const record = await this.store.get(id);
      if (!record) continue;
      const kb = (record.payload as Record<string, unknown> | undefined)?.kb as Record<string, unknown> | undefined;
      if (kb && kb.schema === KNOWLEDGE_BASE_SCHEMA) {
        const doc = this.docFromKb(id, record.title, record.description, kb);
        this.index.upsert(doc);
        if (doc.active && typeof kb.chunkHash === "string") {
          this.hashes.set(kb.chunkHash, { itemId: id, sourceId: doc.sourceId, scope: scopeKey(doc.tenantId, doc.projectId) });
        }
      } else if (record.description && record.description.length >= 12) {
        this.index.upsert(this.docFromLegacy(record));
        legacy += 1;
      }
    }
    return { indexed: this.index.size, legacy, durationMs: Date.now() - started };
  }

  // ---------- admin actions ----------

  async setSourceTrust(sourceId: string, trust: SourceTrust, note: string): Promise<KnowledgeSourceRecord> {
    const source = this.requireSource(sourceId);
    source.trust = trust;
    source.status = trust === "REJECTED" ? "REJECTED" : source.status === "REJECTED" ? "ACTIVE" : source.status;
    source.trustBasis = [...source.trustBasis, `${note} (${this.now().toISOString()})`].slice(-10);
    source.updatedAt = this.now().toISOString();
    this.persistSources();
    await this.refreshSourceDocs(source);
    return source;
  }

  async setSourceStatus(sourceId: string, status: "ACTIVE" | "DISABLED"): Promise<KnowledgeSourceRecord> {
    const source = this.requireSource(sourceId);
    if (source.status === "REJECTED" && status === "ACTIVE") throw new KnowledgeInputError("SOURCE_REJECTED", "Approve a rejected source before enabling it.");
    source.status = status;
    source.updatedAt = this.now().toISOString();
    this.persistSources();
    await this.refreshSourceDocs(source);
    return source;
  }

  private async refreshSourceDocs(source: KnowledgeSourceRecord): Promise<void> {
    const verified = source.trust === "TRUSTED" || source.trust === "VERIFIED";
    for (const doc of this.index.all().filter((d) => d.sourceId === source.sourceId)) {
      const record = await this.store.get(doc.id);
      const payload = (record?.payload ?? {}) as Record<string, unknown>;
      const kb = payload.kb as Record<string, unknown> | undefined;
      if (!record || !kb) continue;
      const stillCurrent = kb.active !== false;
      kb.trust = source.trust;
      await this.store.update(doc.id, {
        payload: { ...payload, kb },
        verificationStatus: source.trust === "REJECTED"
          ? KnowledgeVerificationStatus.Rejected
          : verified && record.qualityScore >= 75 ? KnowledgeVerificationStatus.Verified : KnowledgeVerificationStatus.Pending,
        ...(source.trust === "REJECTED" ? { status: KnowledgeRecordStatus.Rejected } : stillCurrent ? { status: KnowledgeRecordStatus.Active } : {}),
      });
      this.index.upsert(this.docFromKb(doc.id, source.title, record.description, kb));
    }
  }

  /** Refreshes URL sources whose freshness is AGING/STALE; supplied documents are only refreshed on request. */
  refreshStale(): KnowledgeJob[] {
    const jobs: KnowledgeJob[] = [];
    for (const source of this.sources.values()) {
      if (source.status !== "ACTIVE" || !source.url) continue;
      const freshness = computeFreshness(source.domain, source.lastRetrievedAt, this.now());
      if (freshness === "AGING" || freshness === "STALE" || freshness === "UNKNOWN") jobs.push(this.refreshSource(source.sourceId));
    }
    return jobs;
  }

  startScheduledRefresh(intervalHours: number): void {
    this.stopScheduledRefresh();
    if (!(intervalHours > 0)) return;
    this.refreshTimer = setInterval(() => {
      try { this.refreshStale(); } catch { /* logged via job state */ }
    }, intervalHours * 3_600_000);
    this.refreshTimer.unref?.();
  }

  stopScheduledRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  recordFeedback(itemId: string, kind: KnowledgeFeedbackKind, note?: string): { recorded: true; flaggedForReview: boolean } {
    if (!this.index.has(itemId)) throw new KnowledgeInputError("ITEM_NOT_FOUND", "Knowledge item not found.");
    this.feedback.push({ at: this.now().toISOString(), itemId, kind, note: note?.slice(0, 300) });
    this.feedback = this.feedback.slice(-2_000);
    this.writeJson("feedback.json", this.feedback);
    const negative = this.feedback.filter((f) => f.itemId === itemId && (f.kind === "INCORRECT" || f.kind === "OUTDATED")).length;
    return { recorded: true, flaggedForReview: negative >= 3 };
  }

  // ---------- retrieval ----------

  async retrieve(request: {
    task: KnowledgeTask | string;
    query: string;
    tenantId?: string | null;
    projectId?: string | null;
    guidanceSpecs?: GuidanceSpec[];
    limit?: number;
    caller?: string;
    filters?: Pick<KnowledgeSearchRequest, "domains" | "sourceTypes" | "minTrust" | "excludeStale">;
  }): Promise<TaskKnowledgeContext> {
    const profile = profileForTask(request.task);
    const query = String(request.query ?? "").slice(0, 500);
    const result = await this.index.search({
      query,
      task: profile.task,
      tenantId: request.tenantId ?? null,
      projectId: request.projectId ?? null,
      limit: request.limit,
      ...(request.filters ?? {}),
    });
    const context = buildTaskKnowledgeContext({ task: profile.task, query, result, guidanceSpecs: request.guidanceSpecs, now: this.now() });
    this.logRetrieval({
      at: context.retrievedAt,
      task: profile.task,
      caller: request.caller ?? "unknown",
      query: query.slice(0, 200),
      mode: result.mode,
      itemIds: context.items.map((i) => i.id),
      sourceTypes: [...new Set(context.items.map((i) => i.sourceType))],
      domains: [...new Set(context.items.map((i) => i.domain))],
      relevance: context.items.map((i) => i.relevance),
      freshness: context.items.map((i) => i.freshness),
      contextChars: context.contextChars,
      durationMs: result.durationMs,
      consideredCount: result.consideredCount,
      scoped: { tenant: Boolean(request.tenantId), project: Boolean(request.projectId) },
      externalRetrieval: false,
    });
    return context;
  }

  private logRetrieval(entry: KnowledgeRetrievalLogEntry): void {
    this.retrievalLog.push(entry);
    if (this.retrievalLog.length > 500) this.retrievalLog = this.retrievalLog.slice(-500);
    try { this.writeJson("retrieval-log.json", this.retrievalLog); } catch { /* diagnostics only */ }
  }

  /** Indexed items of one source (admin inspection): neutralized preview, no storage paths. */
  listSourceItems(sourceId: string, limit = 100) {
    return this.index.all()
      .filter((d) => d.sourceId === sourceId)
      .slice(0, limit)
      .map((d) => ({
        itemId: d.id,
        section: d.headingPath.join(" › ") || null,
        validationStatus: d.validationStatus,
        trust: d.trust,
        active: d.active,
        freshness: computeFreshness(d.domain, d.observedAt, this.now()),
        preview: d.text.replace(/\s+/g, " ").slice(0, 240),
        guidance: d.guidance ?? [],
      }));
  }

  listRetrievals(limit = 50): KnowledgeRetrievalLogEntry[] {
    return this.retrievalLog.slice(-limit).reverse();
  }

  overview() {
    const sources = [...this.sources.values()];
    const docs = this.index.all();
    const active = docs.filter((d) => d.active);
    const count = <T extends string>(values: T[]) => values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});
    const jobs = [...this.jobs.values()];
    const recent = this.retrievalLog.slice(-100);
    return {
      ready: this.ready,
      retrievalMode: this.index.semanticAvailable ? "HYBRID_SEMANTIC" : "KEYWORD",
      semanticNote: this.index.semanticAvailable ? "Embeddings are used for semantic similarity." : "No embedding capability is configured; retrieval uses BM25 keyword relevance with metadata, trust and freshness filters.",
      onlineRetrieval: Boolean(this.fetcher),
      index: {
        items: docs.length,
        active: active.length,
        legacy: docs.filter((d) => d.legacy).length,
        byDomain: count(active.map((d) => d.domain)),
        bySourceType: count(active.map((d) => d.sourceType)),
        byTrust: count(active.map((d) => d.trust)),
        byFreshness: count(active.map((d) => computeFreshness(d.domain, d.observedAt, this.now()))),
        needsReview: active.filter((d) => d.validationStatus === "NEEDS_REVIEW").length,
      },
      sources: {
        total: sources.length,
        byStatus: count(sources.map((s) => s.status)),
        byTrust: count(sources.map((s) => s.trust)),
        rejected: sources.filter((s) => s.status === "REJECTED").length,
        failing: sources.filter((s) => s.lastError).length,
      },
      jobs: { total: jobs.length, byStatus: count(jobs.map((j) => j.status)) },
      retrieval: {
        recentCount: recent.length,
        averageDurationMs: recent.length ? Math.round(recent.reduce((n, r) => n + r.durationMs, 0) / recent.length) : 0,
        byTask: count(recent.map((r) => r.task)),
      },
      feedback: count(this.feedback.map((f) => f.kind)),
    };
  }

  private requireSource(sourceId: string): KnowledgeSourceRecord {
    const source = this.sources.get(sourceId);
    if (!source) throw new KnowledgeInputError("SOURCE_NOT_FOUND", "Knowledge source not found.");
    return source;
  }
}

export class KnowledgeInputError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "KnowledgeInputError";
  }
}

/** Admin/customer-safe source view: no filesystem paths. */
export function publicSourceView(source: KnowledgeSourceRecord) {
  return {
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    title: source.title,
    url: source.url,
    author: source.author,
    publisher: source.publisher,
    publicationDate: source.publicationDate,
    license: source.license,
    retention: source.retention,
    language: source.language,
    domain: source.domain,
    topics: source.topics,
    scope: source.projectId ? "PROJECT" : source.tenantId ? "TENANT" : "GLOBAL",
    projectId: source.projectId,
    trust: source.trust,
    trustBasis: source.trustBasis,
    status: source.status,
    supersedes: source.supersedes,
    currentVersion: source.currentVersion,
    versions: source.versions.map((v) => ({ version: v.version, retrievedAt: v.retrievedAt, chunkCount: v.chunkCount, stored: v.chunkIds.length, linked: v.linkedChunkIds.length })),
    lastRetrievedAt: source.lastRetrievedAt,
    freshness: computeFreshness(source.domain, source.lastRetrievedAt ?? source.createdAt),
    lastError: source.lastError,
    stats: source.stats,
    hasGuidance: Object.keys(source.guidanceBySection).length > 0,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}
