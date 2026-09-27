/**
 * Phase 18B — teaching sessions: SOURCE → INGESTION → EXTRACTION → MULTIMODAL ANALYSIS → KNOWLEDGE EXTRACTION →
 * NOVELTY/DEDUP → VALIDATION → review → dataset records. Publishing, evaluation, activation and rollback are the
 * existing Training Center flow; this service never writes to the Knowledge Base directly and never trains a model.
 * Runs inside the Training Center job queue and state; sources live in the same training store.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { KnowledgePipeline } from "../knowledge-acquisition-engine/knowledge-pipeline.js";
import { capabilityById, TRAINING_TARGETS, SCOPE_INFO, type TeachingMode, type TrainingScope, type TrainingTarget } from "./training-catalog.js";
import { documentFormat, DocumentExtractionError, extractDocument, type TextUnit } from "./teaching-documents.js";
import { MEDIA_LIMITS, MediaAnalysisError, type TeachingMediaAnalyzer } from "./teaching-media.js";
import type { DeepMediaAnalyzer, TeachingAi, VideoDeepAnalysis } from "./teaching-deep-media.js";
import {
  aiAssistedExtraction, codeLanguage, correlateSources, extractFromAudio, extractFromCode, extractFromImage, extractFromUnits,
  extractFromVideo, parseInstructions, type ExtractionContext,
} from "./knowledge-extraction.js";
import { assessNovelty, type ComparisonItem } from "./knowledge-novelty.js";
import { detectServerPaths } from "./teaching-validation.js";
import type {
  KnowledgeRecord, MediaAnalysis, RecordKnowledge, RetentionPolicy, SessionProgress, SessionStage, SourceKind, TeachingDataset,
  TeachingRecord, TeachingSession, TeachingSource, TeachingType, TrainingJob, TrainingJobKind,
} from "./training-types.js";

export class SessionInputError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "SessionInputError";
  }
}

export interface UrlFetchResult { ok: boolean; status: number; contentType: string; body: string; finalUrl: string; errorCode?: string; message?: string }

export interface SessionHost {
  dataDir: string;
  iso(): string;
  sessions(): TeachingSession[];
  sources(): TeachingSource[];
  datasets(): TeachingDataset[];
  records(): TeachingRecord[];
  persist(): void;
  persistJobs(): void;
  enqueue(kind: TrainingJobKind, meta: { datasetId?: string | null; by: string; total?: number }, run: (job: TrainingJob) => Promise<void>): TrainingJob;
  mark(job: TrainingJob, status: TrainingJob["status"], note?: string, stage?: string): void;
  pipeline(): KnowledgePipeline | null;
  analyzer: TeachingMediaAnalyzer;
  deep: DeepMediaAnalyzer;
  ai(): TeachingAi | null;
  urlPolicy?: (url: string) => { ok: true; url: string } | { ok: false; code: string; message: string };
  fetchUrl?: (url: string) => Promise<UrlFetchResult>;
  projectExists?: (projectId: string) => Promise<boolean>;
  requireDataset(datasetId: string): TeachingDataset;
  createDataset(input: Record<string, unknown>, by: string): Promise<TeachingDataset>;
  addLearnedRecord(dataset: TeachingDataset, input: Record<string, unknown>, knowledge: RecordKnowledge, by: string): TeachingRecord;
  revalidate(record: TeachingRecord, dataset: TeachingDataset): void;
  /** Records of every published version (frozen) with their dataset. */
  versionRecords(): Array<{ dataset: TeachingDataset; version: number; records: TeachingRecord[] }>;
  latestEvaluationId(datasetId: string, version: number): string | null;
  latestActivationId(datasetId: string, version: number): string | null;
}

const TEACHING_TYPES: TeachingType[] = ["KNOWLEDGE", "EXAMPLE", "STYLE", "INSTRUCTION", "WORKFLOW", "BEST_PRACTICE", "PATTERN", "MULTIMODAL_EXAMPLE"];
const RETENTION: RetentionPolicy[] = ["KEEP_SOURCE", "DELETE_AFTER_SUCCESSFUL_EXTRACTION", "ARCHIVE_SOURCE"];
const MODE_FOR_TYPE: Record<TeachingType, TeachingMode> = {
  KNOWLEDGE: "KNOWLEDGE", EXAMPLE: "EXAMPLE", STYLE: "STYLE", INSTRUCTION: "INSTRUCTION", WORKFLOW: "INSTRUCTION",
  BEST_PRACTICE: "KNOWLEDGE", PATTERN: "STYLE", MULTIMODAL_EXAMPLE: "EXAMPLE",
};
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|cs|cpp|c|h|swift|sql|sh|css|scss|html|json|ya?ml)$/i;
const DOC_LIMIT = 40 * 1024 * 1024;
const TEXT_LIMIT = 10 * 1024 * 1024;
const CODE_LIMIT = 2 * 1024 * 1024;
const MAX_CANDIDATES = 300;
const MAX_SOURCES_PER_SESSION = 12;

export const STAGE_LABELS: Record<SessionStage, string> = {
  QUEUED: "Queued", UPLOADED: "Uploaded", VALIDATING_SOURCE: "Validating source", EXTRACTING_METADATA: "Reading metadata",
  EXTRACTING_TEXT: "Extracting text", SAMPLING_FRAMES: "Sampling frames", DETECTING_SCENES: "Detecting scenes", EXTRACTING_AUDIO: "Extracting audio",
  TRANSCRIBING: "Transcribing", ANALYZING_VISUALS: "Analyzing visuals", ANALYZING_AUDIO: "Analyzing audio", ANALYZING_SYNC: "Analyzing audio/video sync",
  EXTRACTING_KNOWLEDGE: "Extracting knowledge", CHECKING_NOVELTY: "Checking what is new", DEDUPLICATING: "Removing duplicates", VALIDATING: "Validating knowledge",
  READY_FOR_REVIEW: "Ready for review", CREATING_DATASET_VERSION: "Creating dataset version", EVALUATING: "Evaluating", READY_TO_ACTIVATE: "Ready to activate",
  ACTIVATING: "Activating", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled",
};

const STEPS_PER_KIND: Record<SourceKind, number> = { TEXT: 3, DOCUMENT: 3, BOOK: 3, CODE: 3, URL: 3, IMAGE: 3, AUDIO: 3, VIDEO: 6 };

const str = (v: unknown, max = 500): string => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");

export function safeFileName(name: string, fallback: string): string {
  const base = path.basename(String(name ?? "").replace(/\\/g, "/"))
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_").replace(/^\.+/, "").trim().slice(0, 160);
  return base || fallback;
}

function emptyProgress(): SessionProgress {
  return {
    stage: "QUEUED", stageLabel: STAGE_LABELS.QUEUED, completed: 0, total: 0, unit: "steps", percent: null, currentSource: null, currentItem: null,
    startedAt: null, elapsedSec: 0, etaSec: null,
    counts: { extracted: 0, new: 0, partiallyNew: 0, known: 0, duplicate: 0, contradictory: 0, lowConfidence: 0, requiresReview: 0 },
  };
}

function sourceKindFor(fileName: string, mimeType: string, requested: string): SourceKind | null {
  if (MEDIA_LIMITS.IMAGE.mimes.test(mimeType) || MEDIA_LIMITS.IMAGE.exts.test(fileName)) return "IMAGE";
  if (MEDIA_LIMITS.VIDEO.mimes.test(mimeType) || MEDIA_LIMITS.VIDEO.exts.test(fileName)) return "VIDEO";
  if (MEDIA_LIMITS.AUDIO.mimes.test(mimeType) || MEDIA_LIMITS.AUDIO.exts.test(fileName)) return "AUDIO";
  const doc = documentFormat(fileName, mimeType);
  if (requested === "CODE" || (CODE_EXT.test(fileName) && !/\.html?$/i.test(fileName))) return "CODE";
  if (doc) return requested === "BOOK" ? "BOOK" : doc === "txt" || doc === "md" ? (requested === "DOCUMENT" ? "DOCUMENT" : "TEXT") : "DOCUMENT";
  return null;
}

function magicOk(kind: SourceKind, format: string, bytes: Buffer): boolean {
  if (format === "pdf") return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  if (format === "docx" || format === "epub") return bytes.readUInt32LE(0) === 0x04034b50;
  if (kind === "TEXT" || kind === "CODE" || format === "csv" || format === "md" || format === "txt" || format === "html") return !bytes.subarray(0, 8_192).includes(0);
  return true;
}

export class TeachingSessionService {
  private readonly candidates = new Map<string, KnowledgeRecord[]>();

  constructor(private readonly host: SessionHost) {}

  // ---------- storage ----------

  private sourceDir(sub = ""): string {
    const dir = path.join(this.host.dataDir, "sources", sub);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private sourceFile(source: Pick<TeachingSource, "contentHash" | "fileName">, archived = false): string {
    if (!/^[0-9a-f]{64}$/.test(source.contentHash)) throw new Error("Invalid source hash");
    const ext = path.extname(source.fileName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10) || ".bin";
    return path.join(this.sourceDir(archived ? "archive" : ""), `${source.contentHash}${ext}`);
  }

  private candidateFile(sessionId: string): string {
    if (!/^[0-9a-f-]{36}$/.test(sessionId)) throw new Error("Invalid session id");
    fs.mkdirSync(path.join(this.host.dataDir, "sessions"), { recursive: true });
    return path.join(this.host.dataDir, "sessions", `${sessionId}.json`);
  }

  private saveCandidates(sessionId: string, list: KnowledgeRecord[]): void {
    this.candidates.set(sessionId, list);
    const file = this.candidateFile(sessionId);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list), "utf8");
    fs.renameSync(tmp, file);
  }

  loadCandidates(sessionId: string): KnowledgeRecord[] {
    const cached = this.candidates.get(sessionId);
    if (cached) return cached;
    try {
      const list = JSON.parse(fs.readFileSync(this.candidateFile(sessionId), "utf8")) as KnowledgeRecord[];
      this.candidates.set(sessionId, list);
      return list;
    } catch {
      return [];
    }
  }

  // ---------- sources ----------

  private async resolveScope(input: Record<string, unknown>): Promise<{ target: TrainingTarget; capability: string; scope: TrainingScope; projectId: string | null }> {
    const capability = capabilityById(str(input.capability, 60));
    if (!capability) throw new SessionInputError("UNKNOWN_CAPABILITY", "Choose a supported capability.");
    const target = (str(input.target ?? input.targetAI, 40) || capability.target) as TrainingTarget;
    if (!(TRAINING_TARGETS as readonly string[]).includes(target) || capability.target !== target) throw new SessionInputError("TARGET_MISMATCH", "The capability does not belong to the selected AI.");
    const scope = (str(input.scope, 20) || "ADMIN") as TrainingScope;
    if (!SCOPE_INFO[scope]?.available) throw new SessionInputError("SCOPE_UNAVAILABLE", SCOPE_INFO[scope]?.unavailableReason ?? "Unknown scope.");
    let projectId: string | null = null;
    if (scope === "PROJECT") {
      projectId = str(input.projectId, 80);
      if (!projectId) throw new SessionInputError("PROJECT_REQUIRED", "Project-scoped teaching needs a project.");
      if (this.host.projectExists && !(await this.host.projectExists(projectId))) throw new SessionInputError("PROJECT_NOT_FOUND", "Project not found.", 404);
    }
    return { target, capability: capability.id, scope, projectId };
  }

  async addSource(input: Record<string, unknown>, by: string): Promise<{ source: TeachingSource; reused: boolean }> {
    const scope = await this.resolveScope(input);
    const retention = (str(input.retention, 40) || "KEEP_SOURCE") as RetentionPolicy;
    if (!RETENTION.includes(retention)) throw new SessionInputError("INVALID_RETENTION", "Unknown retention policy.");
    const requested = str(input.kind, 20).toUpperCase();
    const now = this.host.iso();
    const base = {
      sourceId: randomUUID(), title: "", description: str(input.description, 1_000), target: scope.target, capability: scope.capability,
      scope: scope.scope, projectId: scope.projectId, retention, retained: true, status: "STORED" as const, measured: {}, knowledgeExtracted: 0,
      sessionIds: [], error: null, createdBy: by, createdAt: now, updatedAt: now, deletedAt: null,
    };
    const rawUrl = str(input.url, 2_000);
    if (rawUrl) {
      if (!this.host.urlPolicy || !this.host.fetchUrl) throw new SessionInputError("URL_RETRIEVAL_UNAVAILABLE", "Online retrieval is not configured on this server.");
      const policy = this.host.urlPolicy(rawUrl);
      if (!policy.ok) throw new SessionInputError(policy.code, policy.message);
      const source: TeachingSource = {
        ...base, kind: "URL", title: str(input.title, 160) || new URL(policy.url).hostname, fileName: safeFileName(new URL(policy.url).hostname, "page") + ".html",
        mimeType: "text/html", format: "html", sizeBytes: 0, contentHash: createHash("sha256").update(policy.url).digest("hex"), storage: "url", url: policy.url,
      };
      this.host.sources().push(source);
      this.host.persist();
      return { source, reused: false };
    }
    let bytes: Buffer;
    let fileName: string;
    let mimeType = str(input.mimeType, 100).toLowerCase();
    if (typeof input.text === "string") {
      const text = input.text.replace(/\u0000/g, "");
      if (text.trim().length < 20) throw new SessionInputError("TEXT_TOO_SHORT", "Paste at least a sentence of material.");
      bytes = Buffer.from(text, "utf8");
      fileName = safeFileName(str(input.fileName, 200), requested === "CODE" ? "snippet.txt" : "pasted-text.md");
      mimeType = mimeType || (requested === "CODE" ? "text/plain" : "text/markdown");
    } else {
      const raw = typeof input.dataBase64 === "string" ? input.dataBase64.replace(/^data:[^;]+;base64,/, "") : "";
      if (!raw) throw new SessionInputError("FILE_REQUIRED", "File data is missing.");
      if (!/^[A-Za-z0-9+/=\s]+$/.test(raw.slice(0, 2_000))) throw new SessionInputError("INVALID_FILE", "File data must be base64.");
      bytes = Buffer.from(raw, "base64");
      fileName = safeFileName(str(input.fileName, 200), "upload.bin");
    }
    if (!bytes.length) throw new SessionInputError("EMPTY_FILE", `${fileName} is empty.`);
    const kind = sourceKindFor(fileName, mimeType, requested);
    if (!kind) throw new SessionInputError("UNSUPPORTED_FORMAT", `${fileName}: unsupported file type ${mimeType || "(unknown)"}.`);
    const format = kind === "IMAGE" || kind === "VIDEO" || kind === "AUDIO" ? path.extname(fileName).slice(1).toLowerCase() || mimeType.split("/")[1] || kind.toLowerCase()
      : kind === "CODE" ? "code" : documentFormat(fileName, mimeType) ?? "txt";
    const limit = kind === "IMAGE" || kind === "VIDEO" || kind === "AUDIO" ? MEDIA_LIMITS[kind].maxBytes : kind === "CODE" ? CODE_LIMIT : ["pdf", "docx", "epub"].includes(format) ? DOC_LIMIT : TEXT_LIMIT;
    if (bytes.length > limit) throw new SessionInputError("FILE_TOO_LARGE", `${fileName} is larger than ${Math.round(limit / 1024 / 1024)} MB.`, 413);
    if (!magicOk(kind, format, bytes)) throw new SessionInputError("INVALID_FILE", `${fileName} does not look like a valid ${format.toUpperCase()} file.`);
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const existing = this.host.sources().find((s) => s.contentHash === contentHash && s.retained && s.status !== "ARCHIVED"
      && s.scope === scope.scope && s.projectId === scope.projectId && s.capability === scope.capability);
    if (existing) return { source: existing, reused: true };
    const source: TeachingSource = {
      ...base, kind, title: str(input.title, 160) || fileName, fileName, mimeType: mimeType || "application/octet-stream", format, sizeBytes: bytes.length,
      contentHash, storage: "training-store", url: null,
    };
    const file = this.sourceFile(source);
    if (!fs.existsSync(file)) fs.writeFileSync(file, bytes);
    this.host.sources().push(source);
    this.host.persist();
    return { source, reused: false };
  }

  private publicSource(s: TeachingSource) {
    return { ...s, url: s.url ? s.url.replace(/[?#].*$/, "") : null };
  }

  listSources(opts: { includeArchived?: boolean } = {}) {
    return this.host.sources()
      .filter((s) => opts.includeArchived || s.status !== "ARCHIVED")
      .map((s) => this.publicSource(s))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private requireSource(sourceId: string): TeachingSource {
    const source = this.host.sources().find((s) => s.sourceId === sourceId);
    if (!source) throw new SessionInputError("SOURCE_NOT_FOUND", "Source not found.", 404);
    return source;
  }

  private fileStillReferenced(source: TeachingSource): boolean {
    return this.host.sources().some((s) => s !== source && s.contentHash === source.contentHash && s.retained && s.status !== "ARCHIVED" && s.storage === "training-store");
  }

  /** Removes the stored bytes; knowledge and provenance stay, marked "source not retained", with the fingerprint kept. */
  deleteSource(sourceId: string, reason: "EXPLICIT" | "RETENTION"): TeachingSource {
    const source = this.requireSource(sourceId);
    if (reason === "EXPLICIT" && this.host.sessions().some((s) => s.sourceAssetIds.includes(sourceId) && (s.status === "QUEUED" || s.status === "ANALYZING"))) {
      throw new SessionInputError("SOURCE_IN_USE", "The source is being analysed; delete it after the session finishes.", 409);
    }
    if (source.storage === "training-store" && source.retained && !this.fileStillReferenced(source)) {
      for (const archived of [false, true]) fs.rmSync(this.sourceFile(source, archived), { force: true });
    }
    source.retained = false;
    source.status = "DELETED";
    source.deletedAt = this.host.iso();
    source.updatedAt = source.deletedAt;
    this.host.persist();
    return source;
  }

  private archiveSource(source: TeachingSource): void {
    if (source.storage === "training-store" && source.retained) {
      const from = this.sourceFile(source);
      const to = this.sourceFile(source, true);
      if (fs.existsSync(from)) {
        if (this.fileStillReferenced(source)) fs.copyFileSync(from, to);
        else fs.renameSync(from, to);
      }
    }
    source.status = "ARCHIVED";
    source.updatedAt = this.host.iso();
  }

  private readSourceBytes(source: TeachingSource): Buffer {
    if (!source.retained || source.storage !== "training-store") throw new SessionInputError("SOURCE_NOT_RETAINED", "The source file is no longer stored.");
    const file = this.sourceFile(source);
    if (!fs.existsSync(file)) throw new SessionInputError("SOURCE_MISSING", "The source file is missing from the training store.");
    return fs.readFileSync(file);
  }

  // ---------- sessions ----------

  async createSession(input: Record<string, unknown>, by: string): Promise<TeachingSession> {
    const scope = await this.resolveScope(input);
    const teachingType = (str(input.teachingType, 30) || "KNOWLEDGE") as TeachingType;
    if (!TEACHING_TYPES.includes(teachingType)) throw new SessionInputError("UNKNOWN_TEACHING_TYPE", "Choose a teaching type.");
    const ids = Array.isArray(input.sourceIds) ? [...new Set(input.sourceIds.map((x) => str(x, 40)).filter(Boolean))] : [];
    if (!ids.length) throw new SessionInputError("SOURCES_REQUIRED", "Add at least one source.");
    if (ids.length > MAX_SOURCES_PER_SESSION) throw new SessionInputError("TOO_MANY_SOURCES", `A session can analyse up to ${MAX_SOURCES_PER_SESSION} sources.`);
    const sources = ids.map((id) => this.requireSource(id));
    for (const s of sources) {
      if (s.scope !== scope.scope || s.projectId !== scope.projectId) {
        throw new SessionInputError("SOURCE_SCOPE_MISMATCH", `${s.title} belongs to a different scope; private material never crosses into other projects or global teaching.`, 403);
      }
      if (!s.retained || s.status === "ARCHIVED") throw new SessionInputError("SOURCE_NOT_RETAINED", `${s.title} is no longer stored; upload it again.`);
    }
    const instructions = str(input.instructions, 4_000);
    const kinds = [...new Set(sources.map((s) => s.kind))];
    const now = this.host.iso();
    const session: TeachingSession = {
      sessionId: randomUUID(), targetAI: scope.target, capability: scope.capability, teachingType,
      sourceType: kinds.length === 1 ? kinds[0]! : "MULTIPLE", sourceAssetIds: ids,
      sourceReferences: sources.map((s) => ({ sourceId: s.sourceId, kind: s.kind, title: s.title, fileName: s.fileName })),
      instructions, requestedKnowledgeScope: parseInstructions(instructions, teachingType), scope: scope.scope, projectId: scope.projectId,
      status: "QUEUED", progress: emptyProgress(), analysis: { ai: { vision: "UNKNOWN", reasoning: "UNKNOWN", transcription: "UNAVAILABLE" }, notes: [], perSource: [] },
      jobId: null, datasetId: null, datasetVersionId: null, evaluationId: null, activationId: null, error: null,
      createdBy: by, createdAt: now, updatedAt: now, startedAt: null, completedAt: null,
    };
    session.progress.total = sources.reduce((a, s) => a + STEPS_PER_KIND[s.kind], 0) + 2;
    this.host.sessions().push(session);
    for (const s of sources) if (!s.sessionIds.includes(session.sessionId)) s.sessionIds.push(session.sessionId);
    const job = this.host.enqueue("TEACHING_SESSION", { by, total: session.progress.total }, (j) => this.runSession(j, session).catch((err: unknown) => {
      session.status = "FAILED";
      session.error = { code: err instanceof SessionInputError ? err.code : "SESSION_FAILED", message: err instanceof SessionInputError ? err.message : "The analysis failed (details in server log)." };
      session.completedAt = this.host.iso();
      this.host.persist();
      throw err;
    }));
    session.jobId = job.jobId;
    job.progress = session.progress;
    this.host.persist();
    return session;
  }

  private stage(job: TrainingJob, session: TeachingSession, stage: SessionStage, item: string | null = null, advance = 0): void {
    const p = session.progress;
    p.stage = stage;
    p.stageLabel = STAGE_LABELS[stage];
    p.currentItem = item;
    p.completed = Math.min(p.total, p.completed + advance);
    const started = p.startedAt ? Date.parse(p.startedAt) : Date.now();
    p.elapsedSec = Math.max(0, Math.round((Date.parse(this.host.iso()) - started) / 1000));
    p.percent = p.total ? Math.min(99, Math.floor((p.completed / p.total) * 100)) : null;
    session.updatedAt = this.host.iso();
    job.progress = p;
    job.counts.processed = p.completed;
    job.stages.push({ stage, at: this.host.iso(), ...(item ? { note: item.slice(0, 160) } : {}) });
    if (job.stages.length > 200) job.stages.splice(1, job.stages.length - 200);
    job.updatedAt = session.updatedAt;
    this.host.persistJobs();
  }

  private async runSession(job: TrainingJob, session: TeachingSession): Promise<void> {
    const p = session.progress;
    p.startedAt = this.host.iso();
    session.startedAt = p.startedAt;
    session.status = "ANALYZING";
    this.host.mark(job, "RUNNING", `${session.sourceAssetIds.length} source(s)`);
    const ai = this.host.ai();
    const visionState = ai?.visionState() ?? "NOT_CONFIGURED";
    const reasoningState = ai?.reasoningState() ?? "NOT_CONFIGURED";
    session.analysis.ai = { vision: visionState, reasoning: reasoningState, transcription: "UNAVAILABLE" };
    const visionAi = ai && visionState === "READY" ? ai : null;
    const reasonAi = ai && reasoningState === "READY" ? ai : null;
    if (!visionAi) session.analysis.notes.push(`Vision analysis unavailable (${visionState.toLowerCase().replace(/_/g, " ")}): on-screen text, typography and layout semantics are not assessed.`);
    if (!reasonAi) session.analysis.notes.push(`AI-assisted text extraction unavailable (${reasoningState.toLowerCase().replace(/_/g, " ")}): rule-based extraction was used.`);
    session.analysis.notes.push("Speech transcription unavailable: no speech-to-text runtime is configured on this server.");

    const ctx: ExtractionContext = {
      sessionId: session.sessionId, target: session.targetAI, capability: session.capability, teachingType: session.teachingType,
      scope: session.requestedKnowledgeScope, now: this.host.iso(),
    };
    const all: KnowledgeRecord[] = [];
    const analysed: Array<{ source: TeachingSource; analysis: MediaAnalysis | null }> = [];
    const kindDurations = new Map<SourceKind, number[]>();
    const sources = session.sourceAssetIds.map((id) => this.requireSource(id));
    for (const [index, source] of sources.entries()) {
      if (job.status === "CANCELLED") return;
      const started = Date.now();
      const before = p.completed;
      p.currentSource = source.title;
      const remainingSameKind = sources.slice(index).filter((s) => s.kind === source.kind).length;
      const history = kindDurations.get(source.kind) ?? [];
      p.etaSec = history.length && sources.slice(index).every((s) => s.kind === source.kind)
        ? Math.round((history.reduce((a, b) => a + b, 0) / history.length) * remainingSameKind) : null;
      source.status = "PROCESSING";
      this.host.persist();
      const notes: string[] = [];
      const unavailable: string[] = [];
      let summary: Record<string, unknown> = {};
      try {
        const out = await this.analyzeSource(job, session, source, ctx, { visionAi, reasonAi, notes, unavailable });
        all.push(...out.records);
        summary = out.summary;
        analysed.push({ source, analysis: out.analysis });
        source.status = "PROCESSED";
        source.error = null;
        session.analysis.perSource.push({ sourceId: source.sourceId, title: source.title, status: "PROCESSED", notes, unavailable, summary });
      } catch (err) {
        const code = err instanceof SessionInputError || err instanceof MediaAnalysisError || err instanceof DocumentExtractionError ? err.code : "ANALYSIS_FAILED";
        const raw = err instanceof Error ? err.message : "The source could not be analysed.";
        const message = detectServerPaths(raw) || /[\\/]{2}|[A-Za-z]:\\/.test(raw) ? "The source could not be analysed." : raw.slice(0, 240);
        if (!(err instanceof SessionInputError || err instanceof MediaAnalysisError || err instanceof DocumentExtractionError)) console.error("[KWIZERA] Teaching source analysis failed:", raw);
        source.status = "FAILED";
        source.error = { code, message };
        session.analysis.perSource.push({ sourceId: source.sourceId, title: source.title, status: "FAILED", notes: [...notes, message], unavailable, summary });
        job.counts.failed += 1;
      }
      p.completed = before + STEPS_PER_KIND[source.kind];
      kindDurations.set(source.kind, [...history, (Date.now() - started) / 1000]);
      p.counts.extracted = all.length;
      source.updatedAt = this.host.iso();
      this.stage(job, session, p.stage, null, 0);
      this.host.persist();
    }
    p.etaSec = null;
    p.currentSource = null;
    if (!analysed.length) {
      session.status = "FAILED";
      session.error = { code: "ALL_SOURCES_FAILED", message: "No source could be analysed; nothing was learned." };
      job.error = session.error;
      this.stage(job, session, "FAILED");
      this.host.mark(job, "FAILED", session.error.message);
      session.completedAt = this.host.iso();
      this.host.persist();
      return;
    }
    all.push(...correlateSources(all, analysed, ctx));

    this.stage(job, session, "CHECKING_NOVELTY", `${all.length} candidate(s)`);
    const assessed = await this.assess(all, session);
    this.stage(job, session, "DEDUPLICATING", null, 1);
    this.stage(job, session, "VALIDATING", null, 0);
    const counts = p.counts;
    for (const r of assessed) {
      const c = r.novelty.class;
      if (c === "NEW") counts.new += 1; else if (c === "PARTIALLY_NEW") counts.partiallyNew += 1; else if (c === "KNOWN") counts.known += 1;
      else if (c === "DUPLICATE") counts.duplicate += 1; else if (c === "CONTRADICTORY") counts.contradictory += 1;
      else if (c === "LOW_CONFIDENCE") counts.lowConfidence += 1; else counts.requiresReview += 1;
    }
    counts.extracted = assessed.length;
    this.saveCandidates(session.sessionId, assessed);
    for (const { source } of analysed) this.applyRetention(source, session);
    p.completed = p.total;
    session.status = "READY_FOR_REVIEW";
    session.completedAt = this.host.iso();
    this.stage(job, session, "READY_FOR_REVIEW", `${assessed.filter((r) => r.recommended).length} recommended`);
    job.result = { sessionId: session.sessionId, candidates: assessed.length, recommended: assessed.filter((r) => r.recommended).length, counts: { ...counts }, failedSources: job.counts.failed };
    if (job.counts.failed) session.analysis.notes.push(`${job.counts.failed} source(s) failed; knowledge from the other sources is ready for review.`);
    this.host.persist();
  }

  private applyRetention(source: TeachingSource, session: TeachingSession): void {
    if (source.status !== "PROCESSED" || session.status === "FAILED") return;
    if (source.retention === "DELETE_AFTER_SUCCESSFUL_EXTRACTION") this.deleteSource(source.sourceId, "RETENTION");
    else if (source.retention === "ARCHIVE_SOURCE") this.archiveSource(source);
  }

  private async analyzeSource(job: TrainingJob, session: TeachingSession, source: TeachingSource, ctx: ExtractionContext,
    opts: { visionAi: TeachingAi | null; reasonAi: TeachingAi | null; notes: string[]; unavailable: string[] }): Promise<{ records: KnowledgeRecord[]; analysis: MediaAnalysis | null; summary: Record<string, unknown> }> {
    const { notes, unavailable } = opts;
    this.stage(job, session, "VALIDATING_SOURCE", source.title);
    const textual = async (units: TextUnit[], label: string) => {
      this.stage(job, session, "EXTRACTING_KNOWLEDGE", `${label}: ${units.length} passages`, 1);
      const records = extractFromUnits(source, units, ctx, { maxPerChapter: source.kind === "BOOK" ? 12 : 40 });
      if (opts.reasonAi) {
        const ai = await aiAssistedExtraction(source, units, ctx, opts.reasonAi, session.instructions);
        records.push(...ai.records);
        notes.push(ai.failed ? `AI-assisted extraction stopped: ${ai.failed.slice(0, 80)}.` : `AI-assisted extraction added ${ai.records.length} grounded statement(s)${ai.ungrounded ? `; ${ai.ungrounded} ungrounded statement(s) were discarded` : ""}.`);
      }
      return records;
    };

    if (source.kind === "URL") {
      this.stage(job, session, "EXTRACTING_TEXT", source.url, 1);
      const fetched = await this.host.fetchUrl!(source.url!);
      if (!fetched.ok) throw new SessionInputError(fetched.errorCode ?? "RETRIEVAL_FAILED", fetched.message ?? `The page returned HTTP ${fetched.status}.`);
      if (!/html|text|markdown/.test(fetched.contentType)) throw new SessionInputError("UNSUPPORTED_CONTENT", "Only HTML and text pages can be learned from.");
      const doc = await extractDocument(Buffer.from(fetched.body, "utf8"), /html/.test(fetched.contentType) ? "page.html" : "page.txt", fetched.contentType.split(";")[0]!.trim());
      source.sizeBytes = Buffer.byteLength(fetched.body);
      source.contentHash = createHash("sha256").update(fetched.body).digest("hex");
      source.measured = { sections: doc.sections };
      notes.push(`Retrieved ${fetched.finalUrl.replace(/[?#].*$/, "")} with robots.txt and private-network checks.`, ...doc.notes);
      return { records: await textual(doc.units, "Page"), analysis: null, summary: { format: doc.format, chars: doc.chars, sections: doc.sections } };
    }

    const bytes = this.readSourceBytes(source);
    if (source.kind === "TEXT" || source.kind === "DOCUMENT" || source.kind === "BOOK") {
      this.stage(job, session, "EXTRACTING_TEXT", source.fileName, 1);
      const doc = await extractDocument(bytes, source.fileName, source.mimeType, { book: source.kind === "BOOK" });
      source.measured = { pages: doc.pages || undefined, chapters: doc.chapters.length || undefined, sections: doc.sections || undefined };
      notes.push(...doc.notes);
      if (source.kind === "BOOK") notes.push(`Book analysed chapter by chapter (${doc.chapters.length} chapter(s)); only extracted statements are kept — the book text itself is not added to the Knowledge Base.`);
      const records = await textual(doc.units, doc.pages ? `${doc.pages} pages` : doc.format.toUpperCase());
      return { records, analysis: null, summary: { format: doc.format, pages: doc.pages, chapters: doc.chapters.slice(0, 50), sections: doc.sections, chars: doc.chars } };
    }

    if (source.kind === "CODE") {
      this.stage(job, session, "EXTRACTING_TEXT", source.fileName, 1);
      const code = bytes.toString("utf8");
      source.measured = { lines: code.split(/\r?\n/).length };
      notes.push("Code was inspected as text only; it was never executed.");
      this.stage(job, session, "EXTRACTING_KNOWLEDGE", source.fileName, 1);
      const records = extractFromCode(source, code, ctx);
      return { records, analysis: null, summary: { language: codeLanguage(source.fileName), lines: source.measured.lines } };
    }

    const file = this.sourceFile(source);
    if (source.kind === "IMAGE") {
      this.stage(job, session, "EXTRACTING_METADATA", source.fileName);
      const base = await this.host.analyzer.analyze("IMAGE", file, source.mimeType);
      source.measured = { width: base.width, height: base.height };
      this.stage(job, session, "ANALYZING_VISUALS", `${base.width}×${base.height}`, 1);
      const deep = await this.host.deep.image(file, { ai: opts.visionAi });
      unavailable.push(...deep.unavailable);
      notes.push(...deep.notes);
      this.stage(job, session, "EXTRACTING_KNOWLEDGE", source.fileName, 1);
      return { records: extractFromImage(source, deep, ctx), analysis: base, summary: { width: base.width, height: base.height, subjectCoverage: deep.subject.coverage, dominantColors: deep.dominantColors.slice(0, 3) } };
    }

    if (source.kind === "AUDIO") {
      this.stage(job, session, "ANALYZING_AUDIO", source.fileName);
      const base = await this.host.analyzer.analyze("AUDIO", file, source.mimeType);
      source.measured = { durationSec: base.durationSec };
      notes.push(...base.notes);
      unavailable.push("Speech transcription — no speech-to-text runtime is available on this server.");
      this.stage(job, session, "EXTRACTING_KNOWLEDGE", source.fileName, 2);
      return { records: extractFromAudio(source, base, ctx), analysis: base, summary: { durationSec: base.durationSec, bpm: base.audio?.bpm ?? null, tempoStatus: base.audio?.tempoStatus ?? null, sections: base.audio?.sections.length ?? 0 } };
    }

    // VIDEO
    this.stage(job, session, "EXTRACTING_METADATA", source.fileName);
    this.stage(job, session, "DETECTING_SCENES", source.fileName, 1);
    const base = await this.host.analyzer.analyze("VIDEO", file, source.mimeType);
    source.measured = { durationSec: base.durationSec, width: base.width, height: base.height };
    notes.push(...base.notes.filter((n) => !/^No transcript/.test(n)));
    this.stage(job, session, base.hasAudioStream ? "EXTRACTING_AUDIO" : "SAMPLING_FRAMES", `${base.sceneCount ?? 0} scene(s)`, 1);
    this.stage(job, session, "TRANSCRIBING", "Unavailable — no speech-to-text runtime", 0);
    let deep: VideoDeepAnalysis | null = null;
    try {
      deep = await this.host.deep.video(file, base, {
        ai: opts.visionAi,
        onProgress: (stage, detail) => this.stage(job, session, (stage in STAGE_LABELS ? stage : "ANALYZING_VISUALS") as SessionStage, detail, stage === "ANALYZING_VISUALS" || stage === "ANALYZING_SYNC" ? 1 : 0),
      });
      unavailable.push(...deep.unavailable);
      notes.push(...deep.notes);
    } catch (err) {
      const reason = err instanceof Error ? err.message.replace(/\S*[\\/]\S*/g, "<path>").slice(0, 120) : "unknown error";
      notes.push(`Frame analysis failed (${reason}); only duration, scenes and audio were measured.`);
      unavailable.push("Per-scene motion, framing and transitions — frame analysis failed.");
    }
    this.stage(job, session, "EXTRACTING_KNOWLEDGE", source.fileName, 1);
    const { records, unavailableFocus } = extractFromVideo(source, base, deep, ctx);
    for (const f of unavailableFocus) unavailable.push(`Requested focus "${f}" — not measurable from this video on this server.`);
    return {
      records, analysis: base,
      summary: { durationSec: base.durationSec, width: base.width, height: base.height, scenes: deep?.scenes.length ?? base.sceneCount ?? 0, bpm: base.audio?.bpm ?? null, transitions: deep?.transitions ?? null, framesAnalysed: deep?.frames ?? 0, sync: deep?.sync ?? null },
    };
  }

  private comparisonPool(session: TeachingSession): ComparisonItem[] {
    const task = capabilityById(session.capability)?.task;
    const visible = (d: TeachingDataset) => capabilityById(d.capability)?.task === task && (d.scope !== "PROJECT" || (session.scope === "PROJECT" && d.projectId === session.projectId));
    const pool: ComparisonItem[] = [];
    const drafts = new Set(this.host.datasets().filter(visible).flatMap((d) => d.draftRecordIds));
    for (const r of this.host.records()) {
      if (!drafts.has(r.recordId)) continue;
      pool.push({ id: r.recordId, title: r.title, text: [r.text, r.instruction, ...r.rules, r.knowledge?.statement ?? ""].filter(Boolean).join(" ").slice(0, 2_000), kind: "DATASET", guidance: r.guidance });
    }
    for (const v of this.host.versionRecords()) {
      if (!visible(v.dataset) || v.dataset.activeVersion !== v.version) continue;
      for (const r of v.records) if (!drafts.has(r.recordId)) pool.push({ id: r.recordId, title: r.title, text: [r.text, r.instruction, ...r.rules].filter(Boolean).join(" ").slice(0, 2_000), kind: "DATASET", guidance: r.guidance });
    }
    return pool;
  }

  private async assess(list: KnowledgeRecord[], session: TeachingSession): Promise<KnowledgeRecord[]> {
    const pipeline = this.host.pipeline();
    const task = capabilityById(session.capability)?.task ?? "GENERAL";
    const projectId = session.scope === "PROJECT" ? session.projectId : null;
    const base = this.comparisonPool(session);
    const ordered = [...list].sort((a, b) => Number(b.inScope) - Number(a.inScope) || b.confidence - a.confidence).slice(0, MAX_CANDIDATES);
    const accepted: KnowledgeRecord[] = [];
    for (const record of ordered) {
      const kb: ComparisonItem[] = [];
      if (pipeline) {
        const result = await pipeline.index.search({ query: `${record.title} ${record.statement}`.slice(0, 480), task, projectId, tenantId: null, limit: 6 }).catch(() => null);
        for (const hit of result?.hits ?? []) {
          if (!hit.doc.active) continue;
          kb.push({ id: hit.doc.id, title: hit.doc.title, text: hit.doc.text.slice(0, 1_500), kind: "KNOWLEDGE_BASE", guidance: (hit.doc.guidance ?? []).filter((g) => typeof g.value === "number").map((g) => ({ key: g.key, value: g.value as number })) });
        }
      }
      const sessionPool: ComparisonItem[] = accepted.filter((a) => a.novelty.class !== "DUPLICATE").map((a) => ({ id: a.id, title: a.title, text: a.statement, kind: "SESSION", guidance: a.suggestedGuidance }));
      record.novelty = assessNovelty(record, [...sessionPool, ...base, ...kb]);
      const m = record.novelty.matched;
      if (m) {
        const type = record.novelty.class === "CONTRADICTORY" ? "CONTRADICTS" : record.novelty.class === "DUPLICATE" ? "DUPLICATES" : record.novelty.class === "KNOWN" ? "SUPPORTS" : record.novelty.class === "PARTIALLY_NEW" ? "EXTENDS" : null;
        if (type) record.relationships.push({ type, targetId: m.id, targetTitle: m.title, targetKind: m.kind, similarity: record.novelty.similarity });
      }
      if (record.novelty.class === "DUPLICATE" && m?.kind === "SESSION") {
        const twin = accepted.find((a) => a.id === m.id);
        if (twin) {
          for (const loc of record.sourceLocations) if (!twin.sourceLocations.some((l) => l.label === loc.label && l.sourceId === loc.sourceId)) twin.sourceLocations.push(loc);
          twin.sourceIds = [...new Set([...twin.sourceIds, ...record.sourceIds])];
          twin.evidence = [...twin.evidence, ...record.evidence].slice(0, 12);
          twin.confidence = Number(Math.min(0.97, twin.confidence + 0.03).toFixed(2));
        }
      }
      record.recommended = record.inScope && (record.novelty.class === "NEW" || record.novelty.class === "PARTIALLY_NEW");
      accepted.push(record);
    }
    return accepted;
  }

  // ---------- review & commit ----------

  requireSession(sessionId: string): TeachingSession {
    const session = this.host.sessions().find((s) => s.sessionId === sessionId);
    if (!session) throw new SessionInputError("SESSION_NOT_FOUND", "Teaching session not found.", 404);
    return session;
  }

  decide(sessionId: string, decisions: Array<{ id: string; decision: string }>, by: string): KnowledgeRecord[] {
    const session = this.requireSession(sessionId);
    if (session.status !== "READY_FOR_REVIEW" && session.status !== "COMMITTED") throw new SessionInputError("SESSION_NOT_READY", "The session has no knowledge to review yet.", 409);
    const list = this.loadCandidates(sessionId);
    const at = this.host.iso();
    for (const d of decisions.slice(0, 500)) {
      const record = list.find((r) => r.id === d.id);
      if (!record) throw new SessionInputError("KNOWLEDGE_NOT_FOUND", "Knowledge item not found in this session.", 404);
      if (record.committedRecordId) continue;
      if (d.decision !== "ACCEPTED" && d.decision !== "REJECTED" && d.decision !== "PENDING") throw new SessionInputError("INVALID_DECISION", "Decision must be ACCEPTED, REJECTED or PENDING.");
      record.decision = d.decision;
      record.decisionBy = d.decision === "PENDING" ? null : by;
      record.decisionAt = d.decision === "PENDING" ? null : at;
      record.updatedAt = at;
    }
    this.saveCandidates(sessionId, list);
    session.updatedAt = at;
    this.host.persist();
    return list;
  }

  async commit(sessionId: string, input: Record<string, unknown>, by: string) {
    const session = this.requireSession(sessionId);
    if (session.status !== "READY_FOR_REVIEW" && session.status !== "COMMITTED") throw new SessionInputError("SESSION_NOT_READY", "Analyse the material before adding knowledge to a dataset.", 409);
    const list = this.loadCandidates(sessionId);
    const requested = Array.isArray(input.accept) ? new Set(input.accept.map((x) => str(x, 40))) : null;
    const selected = list.filter((r) => !r.committedRecordId && r.decision !== "REJECTED" && (requested ? requested.has(r.id) : r.decision === "ACCEPTED" || r.recommended));
    if (!selected.length) throw new SessionInputError("NOTHING_TO_ADD", "No knowledge is selected: accept items (contradictions and items needing review are never added automatically).", 409);
    let dataset: TeachingDataset;
    const datasetId = str(input.datasetId, 40);
    if (datasetId) {
      dataset = this.host.requireDataset(datasetId);
      if (dataset.capability !== session.capability) throw new SessionInputError("CAPABILITY_MISMATCH", `The dataset teaches ${dataset.capability}, not ${session.capability}.`);
      if (dataset.scope !== session.scope || dataset.projectId !== session.projectId) throw new SessionInputError("SCOPE_MISMATCH", "The dataset has a different scope; private material never crosses scopes.", 403);
    } else {
      const raw = (input.dataset ?? {}) as Record<string, unknown>;
      dataset = await this.host.createDataset({
        key: str(raw.key, 64) || `LEARNED_${session.capability}_${session.sessionId.slice(0, 6).toUpperCase()}`,
        name: str(raw.name, 120) || `Learned: ${session.sourceReferences.map((s) => s.title).join(", ").slice(0, 90)}`,
        description: str(raw.description, 1_000) || `Knowledge learned from ${session.sourceReferences.length} source(s) in teaching session ${session.sessionId.slice(0, 8)}.`,
        target: session.targetAI, capability: session.capability, mode: MODE_FOR_TYPE[session.teachingType], scope: session.scope, projectId: session.projectId,
      }, by);
    }
    const created: string[] = [];
    const merged: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const guidanceOwner = new Map<string, KnowledgeRecord>();
    for (const r of [...selected].sort((a, b) => b.confidence - a.confidence)) {
      for (const g of r.suggestedGuidance) if (!guidanceOwner.has(g.key)) guidanceOwner.set(g.key, r);
    }
    const draftIds = new Set(dataset.draftRecordIds);
    const at = this.host.iso();
    for (const r of selected) {
      if (r.novelty.class === "DUPLICATE" && r.novelty.matched?.kind === "SESSION") { skipped.push({ id: r.id, reason: "Duplicate; its provenance was merged into the matching item." }); continue; }
      const existing = r.novelty.matched?.kind === "DATASET" && (r.novelty.class === "KNOWN" || r.novelty.class === "DUPLICATE") && draftIds.has(r.novelty.matched.id)
        ? this.host.records().find((x) => x.recordId === r.novelty.matched!.id) : undefined;
      if (existing) {
        if (existing.knowledge) {
          for (const loc of r.sourceLocations) if (!existing.knowledge.sourceLocations.some((l) => l.label === loc.label && l.sourceId === loc.sourceId)) existing.knowledge.sourceLocations.push(loc);
          existing.knowledge.sourceIds = [...new Set([...existing.knowledge.sourceIds, ...r.sourceIds])];
          existing.knowledge.revisions.push({ at, by, action: "MERGED_PROVENANCE", note: `Supported by "${r.title}" (session ${sessionId.slice(0, 8)})` });
          existing.updatedAt = at;
          this.host.revalidate(existing, dataset);
        }
        r.committedRecordId = existing.recordId;
        r.decision = "ACCEPTED";
        merged.push(existing.recordId);
        continue;
      }
      const conflictAccepted = r.novelty.class === "CONTRADICTORY" || r.novelty.class === "REQUIRES_REVIEW";
      const guidance = r.suggestedGuidance.filter((g) => guidanceOwner.get(g.key) === r);
      const evidenceLine = r.evidence.slice(0, 3).map((e) => `${e.location ? `${e.location}: ` : ""}${e.text}`).join(" | ");
      const provenance = r.sourceLocations.slice(0, 4).map((l) => `${l.sourceTitle} — ${l.label}`).join("; ");
      const isWorkflow = r.knowledgeType === "workflow" && Array.isArray(r.structuredData.steps);
      const recordInput: Record<string, unknown> = isWorkflow
        ? { kind: "INSTRUCTION", title: r.title, instruction: r.statement, rules: (r.structuredData.steps as string[]).slice(0, 20), explanation: `Source: ${provenance}. Evidence: ${evidenceLine}`.slice(0, 3_900), guidance, tags: [r.knowledgeType, ...r.tags].slice(0, 10) }
        : {
          kind: "TEXT", title: r.title, text: `${r.statement}\nSource: ${provenance}.`,
          rules: r.knowledgeType === "rule" || r.knowledgeType === "constraint" ? [r.statement.slice(0, 400)] : [],
          explanation: `Learned ${r.knowledgeType.replace("_", " ")} (${r.method.toLowerCase().replace("_", " ")}, confidence ${r.confidence.toFixed(2)}). Evidence: ${evidenceLine}`.slice(0, 3_900),
          guidance, tags: [r.knowledgeType.replace("_", "-"), ...r.tags].slice(0, 10),
        };
      const knowledge: RecordKnowledge = {
        sessionId, knowledgeId: r.id, knowledgeType: r.knowledgeType, statement: r.statement, structuredData: r.structuredData, sourceIds: r.sourceIds,
        sourceLocations: r.sourceLocations, evidence: r.evidence, confidence: r.confidence, method: r.method, novelty: r.novelty, relationships: r.relationships,
        conflictAccepted, revisions: [{ at, by, action: conflictAccepted ? "CONFLICT_ACCEPTED" : "CREATED", note: conflictAccepted ? r.novelty.reason : `From session ${sessionId.slice(0, 8)}` }],
      };
      try {
        const record = this.host.addLearnedRecord(dataset, recordInput, knowledge, by);
        r.committedRecordId = record.recordId;
        r.decision = "ACCEPTED";
        r.decisionBy = by;
        r.decisionAt = at;
        created.push(record.recordId);
      } catch (err) {
        skipped.push({ id: r.id, reason: err instanceof Error ? err.message.slice(0, 200) : "Could not be added." });
      }
    }
    for (const id of session.sourceAssetIds) {
      const s = this.host.sources().find((x) => x.sourceId === id);
      if (s) s.knowledgeExtracted = list.filter((r) => r.committedRecordId && r.sourceIds.includes(id)).length;
    }
    session.datasetId = dataset.datasetId;
    session.status = "COMMITTED";
    session.updatedAt = at;
    this.saveCandidates(sessionId, list);
    this.host.persist();
    return { datasetId: dataset.datasetId, datasetKey: dataset.key, created: created.length, merged: merged.length, skipped, recordIds: created };
  }

  // ---------- views ----------

  private links(session: TeachingSession): Pick<TeachingSession, "datasetVersionId" | "evaluationId" | "activationId"> {
    if (!session.datasetId) return { datasetVersionId: null, evaluationId: null, activationId: null };
    const versions = this.host.versionRecords().filter((v) => v.dataset.datasetId === session.datasetId && v.records.some((r) => r.knowledge?.sessionId === session.sessionId));
    const latest = versions.sort((a, b) => b.version - a.version)[0];
    if (!latest) return { datasetVersionId: null, evaluationId: null, activationId: null };
    return {
      datasetVersionId: `${latest.dataset.datasetId}:v${latest.version}`,
      evaluationId: this.host.latestEvaluationId(latest.dataset.datasetId, latest.version),
      activationId: this.host.latestActivationId(latest.dataset.datasetId, latest.version),
    };
  }

  view(session: TeachingSession, withCandidates = false) {
    const list = this.loadCandidates(session.sessionId);
    const links = this.links(session);
    const sources = new Map(this.host.sources().map((s) => [s.sourceId, s]));
    return {
      ...session, ...links,
      sources: session.sourceAssetIds.map((id) => { const s = sources.get(id); return s ? { sourceId: id, title: s.title, kind: s.kind, status: s.status, retained: s.retained, retention: s.retention, measured: s.measured } : null; }).filter(Boolean),
      summary: { candidates: list.length, recommended: list.filter((r) => r.recommended && !r.committedRecordId).length, accepted: list.filter((r) => r.decision === "ACCEPTED").length, rejected: list.filter((r) => r.decision === "REJECTED").length, committed: list.filter((r) => r.committedRecordId).length },
      ...(withCandidates ? { knowledge: list.map((r) => ({ ...r, sourceLocations: r.sourceLocations.map((l) => ({ ...l, sourceRetained: sources.get(l.sourceId)?.retained ?? false })) })) } : {}),
    };
  }

  listSessions() {
    return this.host.sessions().map((s) => this.view(s)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getSession(sessionId: string) {
    return this.view(this.requireSession(sessionId), true);
  }

  /** Every learned knowledge unit with its lifecycle status. Archived datasets are excluded unless requested. */
  listKnowledge(filters: Record<string, string | undefined>) {
    const sources = new Map(this.host.sources().map((s) => [s.sourceId, s]));
    const datasets = new Map(this.host.datasets().map((d) => [d.datasetId, d]));
    type Item = { id: string; knowledgeId: string; status: "ACTIVE" | "PUBLISHED" | "DRAFT" | "CANDIDATE" | "REJECTED"; version: number | null; datasetId: string | null; datasetKey: string | null; archived: boolean; record: { title: string; statement: string; knowledgeType: string; targetAI: string; capability: string; confidence: number; novelty: string; method: string; sourceIds: string[]; sourceLocations: KnowledgeRecord["sourceLocations"]; evidence: KnowledgeRecord["evidence"]; relationships: KnowledgeRecord["relationships"]; createdAt: string; sessionId: string; scope: string; projectId: string | null } };
    const rank = { ACTIVE: 5, PUBLISHED: 4, DRAFT: 3, CANDIDATE: 2, REJECTED: 1 } as const;
    const best = new Map<string, Item>();
    const put = (item: Item) => { const prev = best.get(item.knowledgeId); if (!prev || rank[item.status] > rank[prev.status] || (item.status === prev.status && (item.version ?? 0) > (prev.version ?? 0))) best.set(item.knowledgeId, item); };
    const fromRecord = (r: TeachingRecord, d: TeachingDataset) => ({
      title: r.title, statement: r.knowledge!.statement, knowledgeType: r.knowledge!.knowledgeType, targetAI: d.target, capability: d.capability, confidence: r.knowledge!.confidence,
      novelty: r.knowledge!.novelty.class, method: r.knowledge!.method, sourceIds: r.knowledge!.sourceIds, sourceLocations: r.knowledge!.sourceLocations, evidence: r.knowledge!.evidence,
      relationships: r.knowledge!.relationships, createdAt: r.createdAt, sessionId: r.knowledge!.sessionId, scope: d.scope, projectId: d.projectId,
    });
    for (const v of this.host.versionRecords()) {
      for (const r of v.records) if (r.knowledge) put({ id: `${r.recordId}:v${v.version}`, knowledgeId: r.knowledge.knowledgeId, status: v.dataset.activeVersion === v.version ? "ACTIVE" : "PUBLISHED", version: v.version, datasetId: v.dataset.datasetId, datasetKey: v.dataset.key, archived: Boolean(v.dataset.archived), record: fromRecord(r, v.dataset) });
    }
    for (const d of this.host.datasets()) {
      const ids = new Set(d.draftRecordIds);
      for (const r of this.host.records()) if (ids.has(r.recordId) && r.knowledge) put({ id: r.recordId, knowledgeId: r.knowledge.knowledgeId, status: "DRAFT", version: null, datasetId: d.datasetId, datasetKey: d.key, archived: Boolean(d.archived), record: fromRecord(r, d) });
    }
    for (const s of this.host.sessions()) {
      for (const r of this.loadCandidates(s.sessionId)) {
        if (r.committedRecordId) continue;
        put({ id: r.id, knowledgeId: r.id, status: r.decision === "REJECTED" ? "REJECTED" : "CANDIDATE", version: null, datasetId: null, datasetKey: null, archived: false,
          record: { title: r.title, statement: r.statement, knowledgeType: r.knowledgeType, targetAI: r.targetAI, capability: r.capability, confidence: r.confidence, novelty: r.novelty.class, method: r.method, sourceIds: r.sourceIds, sourceLocations: r.sourceLocations, evidence: r.evidence, relationships: r.relationships, createdAt: r.createdAt, sessionId: r.sessionId, scope: s.scope, projectId: s.projectId } });
      }
    }
    const f = filters;
    const minConfidence = f.minConfidence ? Number(f.minConfidence) : null;
    const q = (f.q ?? "").toLowerCase();
    const items = [...best.values()].filter((i) => {
      const r = i.record;
      if (i.archived && f.includeArchived !== "1") return false;
      if (f.target && r.targetAI !== f.target) return false;
      if (f.capability && r.capability !== f.capability) return false;
      if (f.type && r.knowledgeType !== f.type) return false;
      if (f.status && i.status !== f.status) return false;
      if (f.novelty && r.novelty !== f.novelty) return false;
      if (f.active === "1" && i.status !== "ACTIVE") return false;
      if (f.active === "0" && i.status === "ACTIVE") return false;
      if (f.version && String(i.version ?? "") !== f.version) return false;
      if (minConfidence !== null && Number.isFinite(minConfidence) && r.confidence < minConfidence) return false;
      if (f.sourceKind && !r.sourceIds.some((id) => sources.get(id)?.kind === f.sourceKind)) return false;
      if (f.sourceId && !r.sourceIds.includes(f.sourceId)) return false;
      if (f.from && r.createdAt < f.from) return false;
      if (f.to && r.createdAt > `${f.to}~`) return false;
      if (f.projectId && r.projectId !== f.projectId) return false;
      if (q && !`${r.title} ${r.statement}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt)).slice(0, 500);
    return items.map((i) => ({
      ...i, datasetName: i.datasetId ? datasets.get(i.datasetId)?.name ?? null : null,
      record: { ...i.record, sourceLocations: i.record.sourceLocations.map((l) => ({ ...l, sourceRetained: sources.get(l.sourceId)?.retained ?? false })) },
      sources: i.record.sourceIds.map((id) => { const s = sources.get(id); return s ? { sourceId: id, title: s.title, kind: s.kind, retained: s.retained, fingerprint: s.contentHash.slice(0, 16) } : null; }).filter(Boolean),
    }));
  }

  /** On boot: sessions interrupted by a restart become FAILED; their sources return to STORED. */
  recoverAfterRestart(): void {
    for (const s of this.host.sessions()) {
      if (s.status === "QUEUED" || s.status === "ANALYZING") {
        s.status = "FAILED";
        s.error = { code: "INTERRUPTED", message: "The server restarted during analysis. Start the session again." };
        s.progress.stage = "FAILED";
        s.progress.stageLabel = STAGE_LABELS.FAILED;
        s.progress.percent = s.progress.total ? Math.min(99, Math.floor((s.progress.completed / s.progress.total) * 100)) : null;
      }
    }
    for (const src of this.host.sources()) if (src.status === "PROCESSING") src.status = src.retained ? "STORED" : "DELETED";
  }

  /** Re-run a failed or reviewed session on its retained sources (new session, same settings). */
  async rerun(sessionId: string, by: string): Promise<TeachingSession> {
    const s = this.requireSession(sessionId);
    return this.createSession({ target: s.targetAI, capability: s.capability, teachingType: s.teachingType, sourceIds: s.sourceAssetIds, instructions: s.instructions, scope: s.scope, projectId: s.projectId }, by);
  }
}
