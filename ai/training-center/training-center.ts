/**
 * Phase 18 — AI Training & Teaching Center.
 *
 * Canonical flow: Dataset → records (ingestion + media processing) → validation → immutable Dataset Version →
 * strategy → evaluation (real checks) → activation (Phase 17 Knowledge Base package + optional curated
 * creative patterns) → runtime retrieval by the planners. Previous versions stay stored and INACTIVE; rollback
 * re-enables them. No model is trained: MODEL_TRAINING / FINE_TUNING are reported as unavailable.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { KnowledgePipeline } from "../knowledge-acquisition-engine/knowledge-pipeline.js";
import { extractSourceText } from "../knowledge-processing-engine/knowledge-chunker.js";
import { extractPdfText } from "../knowledge-processing-engine/pdf-text.js";
import type { VerifiedFont } from "../typography/types.js";
import { planCanvasFit } from "../video-production/canvas-fit.js";
import {
  CAPABILITIES, MODE_INFO, MODE_STRATEGY, RECORD_KINDS, SCOPE_INFO, STRATEGIES, TASK_RUNTIME_QUERY, TASK_RUNTIME_SPECS,
  TEACHABLE_GUIDANCE, TRAINING_TARGETS, capabilityById, clampGuidance, publicCatalog,
  type TeachingMode, type TeachingRecordKind, type TrainingScope,
} from "./training-catalog.js";
import { buildTeachingPackage, packageSafetyFlags, neutralizeTeachingText } from "./teaching-package.js";
import { evaluateVersion, summarizeChecks } from "./teaching-evaluation.js";
import { MEDIA_LIMITS, MediaAnalysisError, createTeachingMediaAnalyzer, type TeachingMediaAnalyzer } from "./teaching-media.js";
import { computeRecordHash, redactRecordSecrets, validateDatasetRecords, validateRecord } from "./teaching-validation.js";
import { createDeepMediaAnalyzer, type DeepMediaAnalyzer, type TeachingAi } from "./teaching-deep-media.js";
import { SessionInputError, TeachingSessionService, type UrlFetchResult } from "./teaching-sessions.js";
import type { ActiveCreativePattern, CreativePatternQuery, PatternFamily, PatternSelection } from "../creative-planning/learned-creative-patterns.js";
import type {
  ActivationRecord, CapabilityAvailability, DatasetVersion, EvaluationCase, GuidanceValue, MediaKind, MediaRole, RecordKnowledge, TeachingDataset,
  TeachingEvaluation, TeachingMediaRef, TeachingRecord, TeachingSession, TeachingSource, TrainingJob, TrainingJobKind, TrainingProfile, ValidationState,
} from "./training-types.js";

export class TrainingInputError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "TrainingInputError";
  }
}

export { SessionInputError };

export interface CuratedPatternSink {
  available(): boolean;
  set(ref: string, meta: { datasetKey: string; version: number }, patterns: Array<{ statement: string; category: string; applicability: string[]; projectId?: string | null }>): Promise<number>;
  retire(refPrefix: string): Promise<number>;
}

export interface TrainingCenterOptions {
  dataDir: string;
  pipeline: () => KnowledgePipeline | null;
  analyzer?: TeachingMediaAnalyzer;
  patterns?: CuratedPatternSink | null;
  projectExists?: (projectId: string) => Promise<boolean>;
  resolveProjectImage?: (projectId: string, assetId: string) => Promise<{ filePath: string; mimeType: string; fileName: string } | null>;
  loadFonts?: () => Promise<VerifiedFont[]>;
  now?: () => Date;
  /** Phase 18B: measured frame/pixel analysis (FFmpeg); injectable for tests. */
  deepAnalyzer?: DeepMediaAnalyzer;
  /** Phase 18B: Admin-routed AI (CapabilityRuntime) used only when executable. */
  ai?: () => TeachingAi | null;
  /** Phase 18B: URL learning through the existing safe fetcher (SSRF-pinned, robots.txt) and allowlist. */
  urlPolicy?: (url: string) => { ok: true; url: string } | { ok: false; code: string; message: string };
  fetchUrl?: (url: string) => Promise<UrlFetchResult>;
  /** Phase 18C: capability availability matrix (CapabilityRuntime → Admin feature mapping → adapter → vault). */
  capabilities?: () => CapabilityAvailability[];
}

interface VersionFile {
  datasetId: string;
  version: number;
  records: TeachingRecord[];
  recordCount: number;
  contentHash: string;
  validation: DatasetVersion["validation"];
  guidance: GuidanceValue[];
  strategy: DatasetVersion["strategy"];
  note: string;
  publishedBy: string;
  publishedAt: string;
}

interface VersionMeta {
  evaluationIds: string[];
  latestEvaluation: DatasetVersion["latestEvaluation"];
  activation: DatasetVersion["activation"];
  knowledgeSourceId: string | null;
  patternRef: string | null;
}

interface CenterState {
  schema: "training-center-v1";
  datasets: TeachingDataset[];
  records: TeachingRecord[];
  versionMeta: Record<string, VersionMeta>;
  evaluations: TeachingEvaluation[];
  activations: ActivationRecord[];
  profiles: TrainingProfile[];
  sessions: TeachingSession[];
  sources: TeachingSource[];
  /** Phase 18C — how often each learned creative pattern was applied by the video planner. */
  patternUsage?: Record<string, { count: number; lastUsedAt: string; lastProjectId: string | null }>;
}

const PATTERN_FAMILIES = new Set(["HOOK", "REVEAL", "SHOWCASE", "BENEFIT", "OFFER", "CTA", "PACING", "CAMERA", "TRANSITION", "TYPOGRAPHY_TIMING", "AUDIO_SYNC", "STORYTELLING",
  "MUSIC_TEMPO", "MUSIC_STRUCTURE", "LAYOUT", "TYPOGRAPHY_LAYOUT", "COLOR_CONTRAST", "CREATIVE_PROFILE"]);

const MAX_TEXT = 20_000;
const MAX_DOCUMENT_CHARS = 400_000;
const MAX_RECORDS_PER_DATASET = 2_000;
const KEY_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp",
  "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "video/x-matroska": ".mkv",
  "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/wave": ".wav", "audio/ogg": ".ogg",
  "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/aac": ".aac", "audio/flac": ".flac", "audio/x-flac": ".flac",
  "application/pdf": ".pdf", "text/plain": ".txt", "text/markdown": ".md", "text/x-markdown": ".md",
};

const str = (v: unknown, max = 500): string => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");
const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const strList = (v: unknown, max = 40, len = 300): string[] => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : []);

function mediaKindFor(mimeType: string, fileName: string): MediaKind | null {
  for (const kind of ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"] as MediaKind[]) {
    const limits = MEDIA_LIMITS[kind];
    if (limits.mimes.test(mimeType) || (!mimeType && limits.exts.test(fileName))) return kind;
  }
  if (/\.(pdf|txt|md|markdown)$/i.test(fileName)) return "DOCUMENT";
  return null;
}

export class TrainingCenter {
  private readonly dataDir: string;
  private readonly now: () => Date;
  private readonly analyzer: TeachingMediaAnalyzer;
  private state: CenterState = { schema: "training-center-v1", datasets: [], records: [], versionMeta: {}, evaluations: [], activations: [], profiles: [], sessions: [], sources: [] };
  private jobs = new Map<string, TrainingJob>();
  private tail: Promise<void> = Promise.resolve();
  private readonly jobPromises = new Map<string, Promise<TrainingJob>>();
  private readonly versionCache = new Map<string, VersionFile>();
  private ready = false;
  readonly sessions: TeachingSessionService;

  constructor(private readonly options: TrainingCenterOptions) {
    this.dataDir = options.dataDir;
    this.now = options.now ?? (() => new Date());
    this.analyzer = options.analyzer ?? createTeachingMediaAnalyzer();
    this.sessions = new TeachingSessionService({
      dataDir: this.dataDir,
      iso: () => this.iso(),
      sessions: () => this.state.sessions,
      sources: () => this.state.sources,
      datasets: () => this.state.datasets,
      records: () => this.state.records,
      persist: () => this.persist(),
      persistJobs: () => this.persistJobs(),
      enqueue: (kind, meta, run) => this.enqueue(kind, meta, run),
      mark: (job, status, note, stage) => this.mark(job, status, note, stage),
      pipeline: () => this.options.pipeline(),
      analyzer: this.analyzer,
      deep: options.deepAnalyzer ?? createDeepMediaAnalyzer(),
      ai: () => this.options.ai?.() ?? null,
      urlPolicy: options.urlPolicy,
      fetchUrl: options.fetchUrl,
      projectExists: options.projectExists,
      requireDataset: (id) => this.requireDataset(id),
      createDataset: (input, by) => this.createDataset(input, by),
      addLearnedRecord: (dataset, input, knowledge, by) => this.addLearnedRecord(dataset, input, knowledge, by),
      revalidate: (record, dataset) => this.revalidate(record, dataset),
      versionRecords: () => this.state.datasets.flatMap((d) => d.versions.map((v) => ({ dataset: d, version: v, records: this.readVersionFile(d.datasetId, v)?.records ?? [] }))),
      latestEvaluationId: (datasetId, version) => this.meta(datasetId, version).latestEvaluation?.evaluationId ?? null,
      latestActivationId: (datasetId, version) => [...this.state.activations].reverse().find((a) => a.datasetId === datasetId && a.version === version && a.action !== "DEACTIVATE")?.activationId ?? null,
      capabilities: () => this.options.capabilities?.() ?? [],
    });
  }

  capabilityMatrix(): CapabilityAvailability[] {
    return this.options.capabilities?.() ?? [];
  }

  isReady(): boolean {
    return this.ready;
  }

  // ---------- persistence ----------

  boot(): void {
    for (const dir of ["media", "versions"]) fs.mkdirSync(path.join(this.dataDir, dir), { recursive: true });
    const loaded = this.readJson<Partial<CenterState>>("state.json", {});
    this.state = {
      schema: "training-center-v1",
      datasets: loaded.datasets ?? [],
      records: loaded.records ?? [],
      versionMeta: loaded.versionMeta ?? {},
      evaluations: loaded.evaluations ?? [],
      activations: loaded.activations ?? [],
      profiles: loaded.profiles ?? [],
      sessions: loaded.sessions ?? [],
      sources: loaded.sources ?? [],
      patternUsage: loaded.patternUsage ?? {},
    };
    this.sessions.recoverAfterRestart();
    const at = this.iso();
    for (const record of this.state.records) {
      for (const media of record.media) {
        if (media.status === "PROCESSING" || media.status === "PENDING") {
          media.status = "FAILED";
          media.error = { code: "INTERRUPTED", message: "The server restarted during processing. Re-process the record." };
        }
      }
    }
    for (const job of this.readJson<TrainingJob[]>("jobs.json", [])) {
      if (["QUEUED", "PREPARING", "RUNNING", "EVALUATING"].includes(job.status)) {
        job.status = "FAILED";
        job.error = { code: "INTERRUPTED", message: "The server restarted while this job was running. Start it again." };
        job.updatedAt = at;
      }
      this.jobs.set(job.jobId, job);
    }
    this.persist();
    this.persistJobs();
    this.ready = true;
  }

  private readJson<T>(name: string, fallback: T): T {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.dataDir, name), "utf8")) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson(name: string, value: unknown): void {
    const file = path.join(this.dataDir, name);
    const tmp = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value), "utf8");
    fs.renameSync(tmp, file);
  }

  private persist(): void {
    this.writeJson("state.json", this.state);
  }

  private persistJobs(): void {
    const recent = [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500);
    this.writeJson("jobs.json", recent);
  }

  private iso(): string {
    return this.now().toISOString();
  }

  private versionKey(datasetId: string, version: number): string {
    return `${datasetId}:${version}`;
  }

  private versionFileName(datasetId: string, version: number): string {
    if (!/^[0-9a-f-]{36}$/.test(datasetId) || !Number.isInteger(version)) throw new TrainingInputError("INVALID_VERSION", "Invalid dataset version.");
    return path.join("versions", `${datasetId}-v${version}.json`);
  }

  private readVersionFile(datasetId: string, version: number): VersionFile | null {
    const key = this.versionKey(datasetId, version);
    const cached = this.versionCache.get(key);
    if (cached) return cached;
    const file = this.readJson<VersionFile | null>(this.versionFileName(datasetId, version), null);
    if (file) this.versionCache.set(key, file);
    return file;
  }

  private mediaFile(ref: Pick<TeachingMediaRef, "contentHash" | "mimeType" | "fileName">): string {
    if (!/^[0-9a-f]{64}$/.test(ref.contentHash)) throw new Error("Invalid media hash");
    const ext = EXT_BY_MIME[ref.mimeType] ?? (path.extname(ref.fileName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin");
    return path.join(this.dataDir, "media", `${ref.contentHash}${ext}`);
  }

  // ---------- views ----------

  catalog() {
    return publicCatalog();
  }

  private requireDataset(datasetId: string): TeachingDataset {
    const dataset = this.state.datasets.find((d) => d.datasetId === datasetId);
    if (!dataset) throw new TrainingInputError("DATASET_NOT_FOUND", "Dataset not found.", 404);
    return dataset;
  }

  private draftRecords(dataset: TeachingDataset): TeachingRecord[] {
    const ids = new Set(dataset.draftRecordIds);
    return this.state.records.filter((r) => ids.has(r.recordId));
  }

  private versionView(dataset: TeachingDataset, version: number, includeRecords = false): DatasetVersion | null {
    const file = this.readVersionFile(dataset.datasetId, version);
    if (!file) return null;
    const meta = this.state.versionMeta[this.versionKey(dataset.datasetId, version)] ?? {
      evaluationIds: [], latestEvaluation: null, activation: "NEVER_ACTIVATED", knowledgeSourceId: null, patternRef: null,
    };
    return {
      ...file,
      records: includeRecords ? file.records.map((r) => this.publicRecord(r, true)) : [],
      status: "VALID",
      ...meta,
    };
  }

  publicRecord(record: TeachingRecord, full = false): TeachingRecord {
    return {
      ...record,
      document: record.document
        ? { ...record.document, markdown: full ? record.document.markdown : record.document.markdown.slice(0, 1_500) }
        : null,
      code: record.code ? { ...record.code, code: full ? record.code.code : record.code.code.slice(0, 1_500) } : null,
    };
  }

  private datasetSummary(dataset: TeachingDataset) {
    const records = this.draftRecords(dataset);
    const counts = records.reduce<Record<ValidationState, number>>((acc, r) => ({ ...acc, [r.validation.state]: (acc[r.validation.state] ?? 0) + 1 }), { PENDING: 0, VALID: 0, INVALID: 0, NEEDS_REVIEW: 0 });
    const capability = capabilityById(dataset.capability);
    const active = dataset.activeVersion !== null ? this.versionView(dataset, dataset.activeVersion) : null;
    return {
      ...dataset,
      capabilityLabel: capability?.label ?? dataset.capability,
      strategy: MODE_STRATEGY[dataset.mode][0],
      draft: { records: records.length, counts },
      latestVersion: dataset.versions.length ? Math.max(...dataset.versions) : null,
      activeKnowledgeSourceId: active?.knowledgeSourceId ?? null,
      runtimeWired: capability?.runtimeWired ?? false,
    };
  }

  listDatasets(opts: { includeArchived?: boolean } = {}) {
    return this.state.datasets.filter((d) => opts.includeArchived || !d.archived).map((d) => this.datasetSummary(d)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Hides (or restores) a dataset in the default lists. Nothing is deleted; active teaching cannot be archived. */
  archiveDataset(datasetId: string, archived: boolean) {
    const dataset = this.requireDataset(datasetId);
    if (archived && dataset.activeVersion !== null) throw new TrainingInputError("DATASET_ACTIVE", "Deactivate the dataset before archiving it.", 409);
    dataset.archived = archived;
    dataset.updatedAt = this.iso();
    this.persist();
    return this.datasetSummary(dataset);
  }

  getDataset(datasetId: string) {
    const dataset = this.requireDataset(datasetId);
    return {
      dataset: this.datasetSummary(dataset),
      records: this.draftRecords(dataset).map((r) => this.publicRecord(r)),
      versions: dataset.versions.map((v) => this.versionView(dataset, v)).filter(Boolean),
      activations: this.state.activations.filter((a) => a.datasetId === datasetId).slice(-50).reverse(),
      jobs: this.listJobs(200).filter((j) => j.datasetId === datasetId).slice(0, 30),
    };
  }

  getVersion(datasetId: string, version: number) {
    const dataset = this.requireDataset(datasetId);
    const view = this.versionView(dataset, version, true);
    if (!view) throw new TrainingInputError("VERSION_NOT_FOUND", "Dataset version not found.", 404);
    return { dataset: this.datasetSummary(dataset), version: view, evaluations: this.state.evaluations.filter((e) => e.datasetId === datasetId && e.version === version).reverse() };
  }

  listVersions() {
    return this.state.datasets.flatMap((d) => d.versions.map((v) => {
      const view = this.versionView(d, v)!;
      return view && { ...view, datasetKey: d.key, datasetName: d.name, capability: d.capability, scope: d.scope, projectId: d.projectId };
    }).filter(Boolean)).sort((a, b) => b!.publishedAt.localeCompare(a!.publishedAt));
  }

  listEvaluations(datasetId?: string) {
    return this.state.evaluations.filter((e) => !datasetId || e.datasetId === datasetId).slice(-200).reverse();
  }

  getEvaluation(evaluationId: string) {
    const evaluation = this.state.evaluations.find((e) => e.evaluationId === evaluationId);
    if (!evaluation) throw new TrainingInputError("EVALUATION_NOT_FOUND", "Evaluation not found.", 404);
    return evaluation;
  }

  listActivations() {
    return this.state.activations.slice(-200).reverse();
  }

  listJobs(limit = 100): TrainingJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  getJob(jobId: string): TrainingJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new TrainingInputError("JOB_NOT_FOUND", "Job not found.", 404);
    return job;
  }

  waitForJob(jobId: string): Promise<TrainingJob> {
    return this.jobPromises.get(jobId) ?? Promise.resolve(this.getJob(jobId));
  }

  overview() {
    const count = <T extends string>(values: T[]) => values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});
    const versions = this.listVersions();
    const pipeline = this.options.pipeline();
    return {
      ready: this.ready,
      knowledgeBaseReady: Boolean(pipeline),
      creativePatternsAvailable: Boolean(this.options.patterns?.available()),
      datasets: { total: this.state.datasets.length, byTarget: count(this.state.datasets.map((d) => d.target)), byMode: count(this.state.datasets.map((d) => d.mode)) },
      records: { total: this.state.records.length, byKind: count(this.state.records.map((r) => r.kind)), byValidation: count(this.state.records.map((r) => r.validation.state)) },
      versions: { total: versions.length, active: versions.filter((v) => v!.activation === "ACTIVE").length },
      evaluations: { total: this.state.evaluations.length, byStatus: count(this.state.evaluations.map((e) => e.status)) },
      jobs: { total: this.jobs.size, byStatus: count([...this.jobs.values()].map((j) => j.status)) },
      activeTeaching: this.state.datasets.filter((d) => d.activeVersion !== null).map((d) => ({
        datasetId: d.datasetId, key: d.key, name: d.name, capability: d.capability, version: d.activeVersion, scope: d.scope, projectId: d.projectId,
      })),
      modelTraining: { available: false, reason: STRATEGIES.MODEL_TRAINING.unavailableReason },
      recentActivations: this.listActivations().slice(0, 10),
      sessions: { total: this.state.sessions.length, byStatus: count(this.state.sessions.map((s) => s.status)) },
      sources: { total: this.state.sources.length, retained: this.state.sources.filter((s) => s.retained).length, byKind: count(this.state.sources.map((s) => s.kind)) },
      learnedRecords: this.state.records.filter((r) => r.knowledge).length,
      archivedDatasets: this.state.datasets.filter((d) => d.archived).length,
      analysis: {
        vision: this.options.ai?.()?.visionState() ?? "NOT_CONFIGURED",
        reasoning: this.options.ai?.()?.reasoningState() ?? "NOT_CONFIGURED",
        transcription: "UNAVAILABLE",
        urlLearning: Boolean(this.options.urlPolicy && this.options.fetchUrl),
      },
    };
  }

  // ---------- datasets ----------

  async createDataset(input: Record<string, unknown>, by: string): Promise<TeachingDataset> {
    const key = str(input.key, 64).toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
    if (!KEY_RE.test(key)) throw new TrainingInputError("INVALID_KEY", "Dataset key must be 3–64 characters: letters, digits and underscores (e.g. PRODUCT_VIDEO_DESIGN).");
    const capability = capabilityById(str(input.capability, 60));
    if (!capability) throw new TrainingInputError("UNKNOWN_CAPABILITY", "Choose a supported capability.");
    const target = (str(input.target, 40) || capability.target) as TeachingDataset["target"];
    if (!(TRAINING_TARGETS as readonly string[]).includes(target) || capability.target !== target) {
      throw new TrainingInputError("TARGET_MISMATCH", "The capability does not belong to the selected AI.");
    }
    const mode = str(input.mode, 30) as TeachingMode;
    if (!MODE_INFO[mode]) throw new TrainingInputError("UNKNOWN_MODE", "Choose a teaching type.");
    if (!MODE_INFO[mode].available) throw new TrainingInputError("MODE_UNAVAILABLE", MODE_INFO[mode].unavailableReason ?? "This teaching type is not available.");
    const scope = (str(input.scope, 20) || "ADMIN") as TrainingScope;
    if (!SCOPE_INFO[scope]) throw new TrainingInputError("UNKNOWN_SCOPE", "Unknown scope.");
    if (!SCOPE_INFO[scope].available) throw new TrainingInputError("SCOPE_UNAVAILABLE", SCOPE_INFO[scope].unavailableReason ?? "This scope is not available.");
    let projectId: string | null = null;
    if (scope === "PROJECT") {
      projectId = str(input.projectId, 80);
      if (!projectId) throw new TrainingInputError("PROJECT_REQUIRED", "Project-scoped teaching needs a project.");
      if (this.options.projectExists && !(await this.options.projectExists(projectId))) throw new TrainingInputError("PROJECT_NOT_FOUND", "Project not found.", 404);
    }
    if (this.state.datasets.some((d) => d.key === key && d.scope === scope && d.projectId === projectId)) {
      throw new TrainingInputError("DATASET_EXISTS", `A dataset with key ${key} already exists in this scope.`);
    }
    const now = this.iso();
    const dataset: TeachingDataset = {
      datasetId: randomUUID(), key, name: str(input.name, 120) || key.replace(/_/g, " ").toLowerCase(),
      description: str(input.description, 1_000), target, capability: capability.id, mode, scope, projectId,
      draftRecordIds: [], versions: [], activeVersion: null, createdBy: by, createdAt: now, updatedAt: now,
    };
    this.state.datasets.push(dataset);
    this.persist();
    return dataset;
  }

  // ---------- records ----------

  private normalizeGuidance(raw: unknown): GuidanceValue[] {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 10).map((g) => {
      const entry = (g ?? {}) as Record<string, unknown>;
      const key = str(entry.key, 80);
      const value = num(entry.value);
      if (!TEACHABLE_GUIDANCE[key]) throw new TrainingInputError("UNKNOWN_GUIDANCE", `Unknown guidance key ${key || "(empty)"}.`);
      if (value === undefined) throw new TrainingInputError("INVALID_GUIDANCE", `Guidance ${key} needs a numeric value.`);
      return { key, value, ...(str(entry.note, 200) ? { note: str(entry.note, 200) } : {}) };
    });
  }

  private normalizeEvalCase(raw: unknown): EvaluationCase | null {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    const aspect = (["9:16", "16:9", "1:1", "4:5"].includes(str(c.aspect, 8)) ? str(c.aspect, 8) : "9:16") as "9:16";
    switch (str(c.check, 40)) {
      case "PRODUCT_VISIBILITY": {
        const w = num(c.sourceWidth); const h = num(c.sourceHeight);
        if (!w || !h || w < 16 || h < 16 || w > 20_000 || h > 20_000) throw new TrainingInputError("INVALID_EVAL_CASE", "Source width and height are required.");
        return { check: "PRODUCT_VISIBILITY", sourceWidth: Math.round(w), sourceHeight: Math.round(h), aspect };
      }
      case "AUDIO_COVERAGE": {
        const s = num(c.sourceDurationSec); const t = num(c.targetDurationSec);
        if (!s || !t || s <= 0 || t <= 0 || s > 3_600 || t > 3_600) throw new TrainingInputError("INVALID_EVAL_CASE", "Source and target durations are required.");
        const bpm = num(c.bpm);
        return { check: "AUDIO_COVERAGE", sourceDurationSec: s, targetDurationSec: t, bpm: bpm && bpm >= 40 && bpm <= 240 ? bpm : null, voice: c.voice === true };
      }
      case "TYPOGRAPHY_HIERARCHY": {
        const productName = str(c.productName, 80);
        if (!productName) throw new TrainingInputError("INVALID_EVAL_CASE", "A product name is required.");
        return { check: "TYPOGRAPHY_HIERARCHY", productName, price: str(c.price, 30) || undefined, cta: str(c.cta, 40) || undefined, aspect };
      }
      case "RETRIEVAL": {
        const query = str(c.query, 300);
        if (query.length < 3) throw new TrainingInputError("INVALID_EVAL_CASE", "A query is required.");
        return { check: "RETRIEVAL", query };
      }
      case "TEXT_GROUNDING": {
        const input = str(c.input, 4_000); const output = str(c.output, 4_000);
        if (!input || !output) throw new TrainingInputError("INVALID_EVAL_CASE", "Input and output are required.");
        return { check: "TEXT_GROUNDING", input, output };
      }
      default:
        throw new TrainingInputError("INVALID_EVAL_CASE", "Unknown evaluation check.");
    }
  }

  private storeMediaBytes(bytes: Buffer, fileName: string, mimeType: string, role: MediaRole): TeachingMediaRef {
    const kind = mediaKindFor(mimeType, fileName);
    if (!kind) throw new TrainingInputError("UNSUPPORTED_FORMAT", `${fileName}: unsupported file type ${mimeType || "(unknown)"}.`);
    const limits = MEDIA_LIMITS[kind];
    if (!limits.mimes.test(mimeType) && !limits.exts.test(fileName)) throw new TrainingInputError("UNSUPPORTED_FORMAT", `${fileName}: unsupported ${kind.toLowerCase()} format.`);
    if (!bytes.length) throw new TrainingInputError("EMPTY_FILE", `${fileName} is empty.`);
    if (bytes.length > limits.maxBytes) throw new TrainingInputError("FILE_TOO_LARGE", `${fileName} is larger than ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`, 413);
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const ref: TeachingMediaRef = {
      mediaId: randomUUID(), role, kind, fileName: path.basename(fileName).slice(0, 160) || `upload${EXT_BY_MIME[mimeType] ?? ""}`,
      mimeType: mimeType || "application/octet-stream", sizeBytes: bytes.length, contentHash, storage: "training-store",
      status: "PENDING", analysis: null, error: null,
    };
    const file = this.mediaFile(ref);
    if (!fs.existsSync(file)) fs.writeFileSync(file, bytes);
    return ref;
  }

  private decodeBase64(value: unknown, fileName: string): Buffer {
    const raw = typeof value === "string" ? value.replace(/^data:[^;]+;base64,/, "") : "";
    if (!raw) throw new TrainingInputError("FILE_REQUIRED", `${fileName}: file data is missing.`);
    if (!/^[A-Za-z0-9+/=\s]+$/.test(raw.slice(0, 2_000))) throw new TrainingInputError("INVALID_FILE", `${fileName}: file data must be base64.`);
    return Buffer.from(raw, "base64");
  }

  private buildRecord(dataset: TeachingDataset, input: Record<string, unknown>, by: string): { record: TeachingRecord; pendingProjectAssets: Array<{ ref: TeachingMediaRef; projectId: string; assetId: string }> } {
    const kind = str(input.kind, 30) as TeachingRecordKind;
    if (!RECORD_KINDS.includes(kind)) throw new TrainingInputError("UNKNOWN_KIND", "Unknown teaching material type.");
    const targetCapability = str(input.targetCapability, 60);
    if (targetCapability && targetCapability !== dataset.capability) {
      throw new TrainingInputError("CAPABILITY_MISMATCH", `This record targets ${targetCapability}, but the dataset teaches ${dataset.capability}.`);
    }
    const codeRaw = input.code && typeof input.code === "object" ? input.code as Record<string, unknown> : null;
    const code = codeRaw ? {
      language: str(codeRaw.language, 40), framework: str(codeRaw.framework, 60) || undefined, topic: str(codeRaw.topic, 120) || undefined,
      version: str(codeRaw.version, 40) || undefined, source: str(codeRaw.source, 200) || undefined,
      expectedBehavior: str(codeRaw.expectedBehavior, 2_000) || undefined,
      code: typeof codeRaw.code === "string" ? codeRaw.code.replace(/\u0000/g, "").slice(0, 60_000) : "",
    } : null;
    const declaredRaw = input.declared && typeof input.declared === "object" ? input.declared as Record<string, unknown> : null;
    const declared = declaredRaw ? {
      ...(str(declaredRaw.aspectRatio, 8) ? { aspectRatio: str(declaredRaw.aspectRatio, 8) } : {}),
      ...(num(declaredRaw.durationSec) ? { durationSec: num(declaredRaw.durationSec) } : {}),
      ...(num(declaredRaw.bpm) ? { bpm: num(declaredRaw.bpm) } : {}),
    } : null;

    const media: TeachingMediaRef[] = [];
    const pendingProjectAssets: Array<{ ref: TeachingMediaRef; projectId: string; assetId: string }> = [];
    const mediaInput = Array.isArray(input.media) ? input.media.slice(0, 6) : [];
    for (const item of mediaInput) {
      const m = (item ?? {}) as Record<string, unknown>;
      const role = (str(m.role, 30) || "SOURCE") as MediaRole;
      if (!["SOURCE", "REFERENCE_RESULT", "BEFORE", "AFTER", "AUDIO", "VIDEO", "IMAGE", "DOCUMENT"].includes(role)) throw new TrainingInputError("INVALID_ROLE", "Unknown media role.");
      const assetId = str(m.projectAssetId, 80);
      if (assetId) {
        const assetProject = str(m.projectId, 80) || dataset.projectId || "";
        if (dataset.scope !== "PROJECT" || assetProject !== dataset.projectId) {
          throw new TrainingInputError("PRIVATE_ASSET_SCOPE", "Project assets can only be used in a dataset scoped to that same project; private customer material never becomes global teaching.", 403);
        }
        const ref: TeachingMediaRef = {
          mediaId: randomUUID(), role, kind: "IMAGE", fileName: `project-asset-${assetId.slice(0, 12)}`, mimeType: "image/*", sizeBytes: 0,
          contentHash: "", storage: "project-asset", projectAsset: { projectId: assetProject, assetId }, status: "PENDING", analysis: null, error: null,
        };
        media.push(ref);
        pendingProjectAssets.push({ ref, projectId: assetProject, assetId });
        continue;
      }
      const fileName = str(m.fileName, 200) || "upload";
      media.push(this.storeMediaBytes(this.decodeBase64(m.dataBase64, fileName), fileName, str(m.mimeType, 80).toLowerCase(), role));
    }

    let document: TeachingRecord["document"] = null;
    const docRaw = input.document && typeof input.document === "object" ? input.document as Record<string, unknown> : null;
    if (docRaw) {
      const fileName = str(docRaw.fileName, 200) || "document.txt";
      const mimeType = str(docRaw.mimeType, 80).toLowerCase();
      const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(fileName);
      if (isPdf) {
        media.push(this.storeMediaBytes(this.decodeBase64(docRaw.dataBase64, fileName), fileName, "application/pdf", "DOCUMENT"));
      } else {
        const text = typeof docRaw.text === "string" ? docRaw.text : docRaw.dataBase64 ? this.decodeBase64(docRaw.dataBase64, fileName).toString("utf8") : "";
        if (text.length > MAX_DOCUMENT_CHARS) throw new TrainingInputError("DOCUMENT_TOO_LARGE", "The document is too large.", 413);
        const extracted = extractSourceText({ content: text, mimeType: mimeType || undefined, fileName });
        if (!extracted.ok) throw new TrainingInputError(extracted.errorCode ?? "EXTRACTION_FAILED", extracted.message ?? "No usable text was found.");
        document = {
          fileName: path.basename(fileName), mimeType: mimeType || "text/plain", markdown: extracted.text,
          pages: 0, headings: [...extracted.text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1]!.trim()).slice(0, 200),
          chars: extracted.text.length, format: extracted.format ?? "plain",
        };
      }
    }

    const now = this.iso();
    const record: TeachingRecord = {
      recordId: randomUUID(), datasetId: dataset.datasetId, kind,
      title: str(input.title, 160) || document?.fileName || media[0]?.fileName || "",
      text: str(input.text, MAX_TEXT), instruction: str(input.instruction, 4_000), input: str(input.input, MAX_TEXT),
      expectedOutput: str(input.expectedOutput, MAX_TEXT), explanation: str(input.explanation, 4_000),
      rules: strList(input.rules, 40, 400), code, document, guidance: this.normalizeGuidance(input.guidance),
      media, declared: declared && Object.keys(declared).length ? declared : null, evalCase: this.normalizeEvalCase(input.evalCase),
      tags: strList(input.tags, 10, 40).map((t) => t.toLowerCase()),
      contentHash: "", validation: { state: "PENDING", issues: [], checkedAt: null }, review: null,
      createdBy: by, createdAt: now, updatedAt: now,
    };
    redactRecordSecrets(record);
    return { record, pendingProjectAssets };
  }

  /** Adds a record learned by a teaching session to a dataset draft (same validation as manual records). */
  private addLearnedRecord(dataset: TeachingDataset, input: Record<string, unknown>, knowledge: RecordKnowledge, by: string): TeachingRecord {
    if (dataset.draftRecordIds.length >= MAX_RECORDS_PER_DATASET) throw new TrainingInputError("DATASET_FULL", "The dataset has reached its record limit.");
    const { record } = this.buildRecord(dataset, input, by);
    record.knowledge = knowledge;
    this.revalidate(record, dataset);
    this.state.records.push(record);
    dataset.draftRecordIds.push(record.recordId);
    dataset.updatedAt = this.iso();
    return record;
  }

  private revalidate(record: TeachingRecord, dataset: TeachingDataset): void {
    record.contentHash = computeRecordHash(record);
    const result = validateRecord(record, capabilityById(dataset.capability));
    record.validation = { state: result.state, issues: result.issues, checkedAt: this.iso() };
  }

  async addRecord(datasetId: string, input: Record<string, unknown>, by: string): Promise<{ record: TeachingRecord; job: TrainingJob | null }> {
    const dataset = this.requireDataset(datasetId);
    if (dataset.draftRecordIds.length >= MAX_RECORDS_PER_DATASET) throw new TrainingInputError("DATASET_FULL", "The dataset has reached its record limit.");
    const { record, pendingProjectAssets } = this.buildRecord(dataset, input, by);
    for (const pending of pendingProjectAssets) {
      const resolved = this.options.resolveProjectImage ? await this.options.resolveProjectImage(pending.projectId, pending.assetId) : null;
      if (!resolved) throw new TrainingInputError("ASSET_NOT_FOUND", "The project image was not found.", 404);
      const bytes = fs.readFileSync(resolved.filePath);
      pending.ref.contentHash = createHash("sha256").update(bytes).digest("hex");
      pending.ref.sizeBytes = bytes.length;
      pending.ref.mimeType = resolved.mimeType;
      pending.ref.fileName = path.basename(resolved.fileName).slice(0, 160);
    }
    this.revalidate(record, dataset);
    this.state.records.push(record);
    dataset.draftRecordIds.push(record.recordId);
    dataset.updatedAt = this.iso();
    this.persist();
    const job = record.media.some((m) => m.status === "PENDING")
      ? this.enqueue("PROCESS_MEDIA", { datasetId, recordId: record.recordId, by, total: record.media.length }, (job) => this.runProcessMedia(job, record.recordId))
      : null;
    return { record: this.publicRecord(record), job };
  }

  /** JSON Lines of instructional records: {instruction,input,expectedOutput,domain,targetCapability,...}. */
  async importRecords(datasetId: string, jsonl: string, by: string): Promise<{ imported: number; errors: Array<{ line: number; message: string }> }> {
    const dataset = this.requireDataset(datasetId);
    const lines = String(jsonl ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 500);
    if (!lines.length) throw new TrainingInputError("EMPTY_IMPORT", "Paste at least one JSON line.");
    const errors: Array<{ line: number; message: string }> = [];
    let imported = 0;
    for (const [i, line] of lines.entries()) {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TrainingInputError("INVALID_LINE", "Each line must be a JSON object.");
        if (parsed.media || parsed.document) throw new TrainingInputError("INVALID_LINE", "Files cannot be imported from JSON lines; upload them in the wizard.");
        const kind = str(parsed.kind, 30) || (parsed.expectedOutput && parsed.input ? "EXAMPLE" : parsed.instruction ? "INSTRUCTION" : "TEXT");
        const title = str(parsed.title, 160) || str(parsed.instruction, 80) || str(parsed.text, 80) || `Imported line ${i + 1}`;
        const { record } = this.buildRecord(dataset, { ...parsed, kind, title, tags: [...strList(parsed.tags, 8, 40), ...(str(parsed.domain, 40) ? [str(parsed.domain, 40)] : [])] }, by);
        this.revalidate(record, dataset);
        this.state.records.push(record);
        dataset.draftRecordIds.push(record.recordId);
        imported += 1;
      } catch (err) {
        errors.push({ line: i + 1, message: err instanceof SyntaxError ? "Invalid JSON." : err instanceof Error ? err.message : "Invalid line." });
      }
    }
    dataset.updatedAt = this.iso();
    this.persist();
    return { imported, errors };
  }

  async previewDocument(input: Record<string, unknown>) {
    const fileName = str(input.fileName, 200) || "document";
    const mimeType = str(input.mimeType, 80).toLowerCase();
    if (mimeType === "application/pdf" || /\.pdf$/i.test(fileName)) {
      const result = await extractPdfText(this.decodeBase64(input.dataBase64, fileName));
      return { ok: result.ok, format: "pdf", pages: result.pageCount, pagesWithText: result.pagesWithText, headings: result.headings.slice(0, 50), chars: result.chars, preview: result.markdown.slice(0, 4_000), errorCode: result.errorCode, message: result.message };
    }
    const text = typeof input.text === "string" ? input.text : input.dataBase64 ? this.decodeBase64(input.dataBase64, fileName).toString("utf8") : "";
    const extracted = extractSourceText({ content: text.slice(0, MAX_DOCUMENT_CHARS), mimeType: mimeType || undefined, fileName });
    return {
      ok: extracted.ok, format: extracted.format, pages: 0, pagesWithText: 0,
      headings: [...extracted.text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1]!.trim()).slice(0, 50),
      chars: extracted.text.length, preview: extracted.text.slice(0, 4_000), errorCode: extracted.errorCode, message: extracted.message,
    };
  }

  reviewRecord(datasetId: string, recordId: string, decision: string, note: string, by: string): TeachingRecord {
    const dataset = this.requireDataset(datasetId);
    const record = this.draftRecords(dataset).find((r) => r.recordId === recordId);
    if (!record) throw new TrainingInputError("RECORD_NOT_FOUND", "Record not found in this dataset draft.", 404);
    if (decision !== "APPROVED" && decision !== "REJECTED") throw new TrainingInputError("INVALID_DECISION", "Decision must be APPROVED or REJECTED.");
    if (decision === "APPROVED" && record.validation.issues.some((i) => i.severity === "ERROR" && i.code !== "REJECTED_BY_REVIEWER")) {
      throw new TrainingInputError("RECORD_INVALID", "Records with errors cannot be approved; fix the record instead.");
    }
    record.review = { decision, by, at: this.iso(), note: note.slice(0, 300) };
    record.updatedAt = this.iso();
    this.revalidate(record, dataset);
    this.persist();
    return this.publicRecord(record);
  }

  removeDraftRecord(datasetId: string, recordId: string): void {
    const dataset = this.requireDataset(datasetId);
    if (!dataset.draftRecordIds.includes(recordId)) throw new TrainingInputError("RECORD_NOT_FOUND", "Record not found in this dataset draft.", 404);
    dataset.draftRecordIds = dataset.draftRecordIds.filter((id) => id !== recordId);
    dataset.updatedAt = this.iso();
    this.state.records = this.state.records.filter((r) => r.recordId !== recordId);
    this.persist();
  }

  reprocessRecord(datasetId: string, recordId: string, by: string): TrainingJob {
    const dataset = this.requireDataset(datasetId);
    const record = this.draftRecords(dataset).find((r) => r.recordId === recordId);
    if (!record) throw new TrainingInputError("RECORD_NOT_FOUND", "Record not found in this dataset draft.", 404);
    if (!record.media.length) throw new TrainingInputError("NO_MEDIA", "This record has no media to process.");
    for (const m of record.media) { m.status = "PENDING"; m.error = null; }
    this.persist();
    return this.enqueue("PROCESS_MEDIA", { datasetId, recordId, by, total: record.media.length }, (job) => this.runProcessMedia(job, recordId));
  }

  validateDraft(datasetId: string) {
    const dataset = this.requireDataset(datasetId);
    const records = this.draftRecords(dataset);
    const result = validateDatasetRecords(records, dataset.capability);
    const states = [...result.records.values()].map((r) => r.state);
    const status = result.issues.some((i) => i.severity === "ERROR") || states.includes("INVALID") ? "INVALID" : states.includes("NEEDS_REVIEW") ? "NEEDS_REVIEW" : "VALID";
    return {
      status,
      issues: result.issues,
      guidance: result.guidance,
      records: records.map((r) => ({ recordId: r.recordId, title: r.title, kind: r.kind, ...result.records.get(r.recordId)! })),
    };
  }

  // ---------- jobs ----------

  private enqueue(kind: TrainingJobKind, meta: { datasetId?: string | null; version?: number | null; recordId?: string | null; by: string; total?: number }, run: (job: TrainingJob) => Promise<void>): TrainingJob {
    const now = this.iso();
    const job: TrainingJob = {
      jobId: randomUUID(), kind, datasetId: meta.datasetId ?? null, version: meta.version ?? null, recordId: meta.recordId ?? null,
      status: "QUEUED", stages: [{ stage: "QUEUED", at: now }], counts: { total: meta.total ?? 0, processed: 0, failed: 0 },
      error: null, result: null, requestedBy: meta.by, createdAt: now, updatedAt: now,
    };
    this.jobs.set(job.jobId, job);
    this.persistJobs();
    const promise = this.tail.then(async () => {
      if (job.status === "CANCELLED") return job;
      try {
        await run(job);
        if (!["FAILED", "BLOCKED", "CANCELLED"].includes(job.status)) this.mark(job, "COMPLETED");
      } catch (err) {
        const code = err instanceof TrainingInputError ? err.code : "JOB_ERROR";
        const message = err instanceof Error && !/[\\/]{2}|[A-Za-z]:\\|\/(opt|var|home|root|tmp)\//.test(err.message) ? err.message.slice(0, 300) : "The job failed (details in server log).";
        if (!(err instanceof TrainingInputError)) console.error("[KWIZERA] Training job failed:", kind, err instanceof Error ? err.message : err);
        job.error = { code, message };
        this.mark(job, "FAILED", message);
      }
      return job;
    });
    this.tail = promise.then(() => undefined, () => undefined);
    this.jobPromises.set(job.jobId, promise);
    void promise.finally(() => this.jobPromises.delete(job.jobId));
    return job;
  }

  private mark(job: TrainingJob, status: TrainingJob["status"], note?: string, stage?: string): void {
    job.status = status;
    if (job.progress && (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED")) {
      // 100% is reported only once the job itself has completed.
      if (status === "COMPLETED") { job.progress.completed = job.progress.total; job.progress.percent = 100; }
      if (status !== "COMPLETED" || job.progress.stage !== "READY_FOR_REVIEW") {
        job.progress.stage = status;
        job.progress.stageLabel = status === "COMPLETED" ? "Completed" : status === "FAILED" ? "Failed" : "Cancelled";
      }
      job.progress.currentItem = null;
    }
    job.stages.push({ stage: stage ?? status, at: this.iso(), ...(note ? { note } : {}) });
    job.updatedAt = this.iso();
    this.persistJobs();
  }

  cancelJob(jobId: string): TrainingJob {
    const job = this.getJob(jobId);
    if (job.status !== "QUEUED") throw new TrainingInputError("JOB_NOT_CANCELLABLE", "Only queued jobs can be cancelled; running jobs finish their current stage.");
    this.mark(job, "CANCELLED");
    return job;
  }

  requestModelTraining(datasetId: string, version: number | null, by: string): TrainingJob {
    this.requireDataset(datasetId);
    const now = this.iso();
    const job: TrainingJob = {
      jobId: randomUUID(), kind: "MODEL_TRAINING", datasetId, version, recordId: null, status: "BLOCKED",
      stages: [{ stage: "BLOCKED", at: now, note: "No training infrastructure." }], counts: { total: 0, processed: 0, failed: 0 },
      error: { code: "MODEL_TRAINING_UNAVAILABLE", message: STRATEGIES.MODEL_TRAINING.unavailableReason! },
      result: { modelWeightsChanged: false }, requestedBy: by, createdAt: now, updatedAt: now,
    };
    this.jobs.set(job.jobId, job);
    this.persistJobs();
    return job;
  }

  private async runProcessMedia(job: TrainingJob, recordId: string): Promise<void> {
    const record = this.state.records.find((r) => r.recordId === recordId);
    if (!record) throw new TrainingInputError("RECORD_NOT_FOUND", "The record was removed.");
    const dataset = this.requireDataset(record.datasetId);
    this.mark(job, "PREPARING", `${record.media.length} file(s)`);
    this.mark(job, "RUNNING");
    for (const media of record.media) {
      if (media.status === "READY") { job.counts.processed += 1; continue; }
      media.status = "PROCESSING";
      this.persist();
      try {
        let filePath: string;
        if (media.storage === "project-asset" && media.projectAsset) {
          const resolved = await this.options.resolveProjectImage?.(media.projectAsset.projectId, media.projectAsset.assetId);
          if (!resolved) throw new MediaAnalysisError("ASSET_NOT_FOUND", "The project image is no longer available.");
          filePath = resolved.filePath;
        } else filePath = this.mediaFile(media);
        if (media.kind === "DOCUMENT") {
          const pdf = await extractPdfText(fs.readFileSync(filePath));
          if (!pdf.ok) throw new MediaAnalysisError(pdf.errorCode ?? "PDF_INVALID", pdf.message ?? "The PDF could not be read.");
          record.document = { fileName: media.fileName, mimeType: "application/pdf", markdown: pdf.markdown.slice(0, MAX_DOCUMENT_CHARS), pages: pdf.pageCount, headings: pdf.headings, chars: pdf.chars, format: "pdf" };
          redactRecordSecrets(record);
          media.analysis = { kind: "DOCUMENT", document: { pages: pdf.pageCount, pagesWithText: pdf.pagesWithText, headings: pdf.headings.slice(0, 50), chars: pdf.chars, format: "pdf" }, notes: pdf.pagesWithText < pdf.pageCount ? [`${pdf.pageCount - pdf.pagesWithText} page(s) contain no extractable text.`] : [] };
        } else {
          media.analysis = await this.analyzer.analyze(media.kind, filePath, media.mimeType);
        }
        media.status = "READY";
        media.error = null;
        job.counts.processed += 1;
      } catch (err) {
        media.status = "FAILED";
        media.error = err instanceof MediaAnalysisError
          ? { code: err.code, message: err.message }
          : { code: "PROCESSING_FAILED", message: "The file could not be processed." };
        if (!(err instanceof MediaAnalysisError)) console.error("[KWIZERA] Teaching media processing failed:", err instanceof Error ? err.message : err);
        job.counts.failed += 1;
      }
      record.updatedAt = this.iso();
      this.persistJobs();
    }
    this.revalidate(record, dataset);
    this.persist();
    job.result = { recordId, validation: record.validation.state, media: record.media.map((m) => ({ fileName: m.fileName, status: m.status, error: m.error })) };
    if (job.counts.failed) {
      job.error = { code: "MEDIA_FAILED", message: `${job.counts.failed} of ${record.media.length} file(s) could not be processed.` };
      this.mark(job, "FAILED");
    }
  }

  // ---------- publish (immutable versions) ----------

  publish(datasetId: string, note: string, by: string): TrainingJob {
    const dataset = this.requireDataset(datasetId);
    return this.enqueue("PUBLISH", { datasetId, by, total: dataset.draftRecordIds.length }, async (job) => {
      this.mark(job, "PREPARING", "Snapshot draft records");
      const records = this.draftRecords(dataset);
      for (const record of records) this.revalidate(record, dataset);
      this.mark(job, "RUNNING", "Validate dataset");
      const report = validateDatasetRecords(records, dataset.capability);
      job.counts.processed = records.length;
      const states = [...report.records.values()];
      const counts = states.reduce<Record<ValidationState, number>>((acc, r) => ({ ...acc, [r.state]: acc[r.state] + 1 }), { PENDING: 0, VALID: 0, INVALID: 0, NEEDS_REVIEW: 0 });
      job.counts.failed = counts.INVALID + counts.NEEDS_REVIEW;
      const blocking = report.issues.filter((i) => i.severity === "ERROR");
      if (blocking.length || counts.INVALID || counts.NEEDS_REVIEW) {
        job.result = {
          status: counts.INVALID || blocking.length ? "INVALID" : "NEEDS_REVIEW", counts, issues: report.issues,
          records: records.filter((r) => report.records.get(r.recordId)!.state !== "VALID").map((r) => ({ recordId: r.recordId, title: r.title, ...report.records.get(r.recordId)! })),
        };
        job.error = { code: counts.INVALID || blocking.length ? "DATASET_INVALID" : "DATASET_NEEDS_REVIEW", message: counts.INVALID || blocking.length ? "The dataset has invalid records; no version was published." : "Some records need review before publishing." };
        this.mark(job, "FAILED");
        return;
      }
      const version = (dataset.versions.length ? Math.max(...dataset.versions) : 0) + 1;
      const frozen: TeachingRecord[] = JSON.parse(JSON.stringify(records));
      const contentHash = createHash("sha256").update(frozen.map((r) => r.contentHash).sort().join("|")).digest("hex");
      const previous = dataset.versions.length ? this.readVersionFile(dataset.datasetId, Math.max(...dataset.versions)) : null;
      if (previous && previous.contentHash === contentHash) {
        job.result = { status: "UNCHANGED", version: previous.version };
        job.error = { code: "UNCHANGED", message: `The draft is identical to version ${previous.version}; no new version was created.` };
        this.mark(job, "FAILED");
        return;
      }
      const file: VersionFile = {
        datasetId: dataset.datasetId, version, records: frozen, recordCount: frozen.length, contentHash,
        validation: { issues: report.issues, counts }, guidance: report.guidance, strategy: MODE_STRATEGY[dataset.mode][0],
        note: note.slice(0, 500), publishedBy: by, publishedAt: this.iso(),
      };
      const fileName = this.versionFileName(dataset.datasetId, version);
      if (fs.existsSync(path.join(this.dataDir, fileName))) throw new TrainingInputError("VERSION_EXISTS", "This version already exists and cannot be overwritten.");
      this.writeJson(fileName, file);
      this.versionCache.set(this.versionKey(dataset.datasetId, version), file);
      this.state.versionMeta[this.versionKey(dataset.datasetId, version)] = { evaluationIds: [], latestEvaluation: null, activation: "NEVER_ACTIVATED", knowledgeSourceId: null, patternRef: null };
      dataset.versions.push(version);
      dataset.updatedAt = this.iso();
      this.persist();
      job.version = version;
      job.result = { status: "VALID", version, records: frozen.length, contentHash, guidance: report.guidance };
    });
  }

  private requireVersion(dataset: TeachingDataset, version: number): VersionFile {
    const file = dataset.versions.includes(version) ? this.readVersionFile(dataset.datasetId, version) : null;
    if (!file) throw new TrainingInputError("VERSION_NOT_FOUND", "Dataset version not found.", 404);
    return file;
  }

  private meta(datasetId: string, version: number): VersionMeta {
    const key = this.versionKey(datasetId, version);
    this.state.versionMeta[key] ??= { evaluationIds: [], latestEvaluation: null, activation: "NEVER_ACTIVATED", knowledgeSourceId: null, patternRef: null };
    return this.state.versionMeta[key]!;
  }

  /** Every knowledge source ever created for this dataset (all versions). */
  private datasetSourceIds(dataset: TeachingDataset): string[] {
    return dataset.versions.map((v) => this.meta(dataset.datasetId, v).knowledgeSourceId).filter((id): id is string => Boolean(id));
  }

  /** Core KWIZERA guides whose guidance keys this version overrides, plus the dataset's other versions. */
  private supersedesFor(dataset: TeachingDataset, file: VersionFile): string[] {
    const pipeline = this.options.pipeline();
    const keys = new Set(file.guidance.map((g) => g.key));
    const core = keys.size && pipeline
      ? pipeline.listSources({ includeScoped: true })
        .filter((s) => s.sourceType === "INTERNAL_DOCUMENT" && s.publisher === "KWIZERA AI STUDIO"
          && Object.values(s.guidanceBySection).some((list) => list.some((g) => keys.has(g.key))))
        .map((s) => s.sourceId)
      : [];
    const own = this.datasetSourceIds(dataset).filter((id) => id !== this.meta(dataset.datasetId, file.version).knowledgeSourceId);
    // Project teaching is retrieved only for its own project, so overriding broader teaching cannot leak elsewhere.
    const task = capabilityById(dataset.capability)?.task;
    const broader = keys.size && dataset.scope === "PROJECT"
      ? this.state.datasets
        .filter((d) => d.datasetId !== dataset.datasetId && d.scope !== "PROJECT" && capabilityById(d.capability)?.task === task
          && d.versions.some((v) => this.readVersionFile(d.datasetId, v)?.guidance.some((g) => keys.has(g.key))))
        .flatMap((d) => this.datasetSourceIds(d))
      : [];
    return [...new Set([...core, ...own, ...broader])];
  }

  // ---------- evaluation ----------

  evaluate(datasetId: string, version: number, by: string): TrainingJob {
    const dataset = this.requireDataset(datasetId);
    const file = this.requireVersion(dataset, version);
    return this.enqueue("EVALUATE", { datasetId, version, by, total: file.recordCount }, async (job) => {
      this.mark(job, "PREPARING", "Build knowledge package");
      const pkg = buildTeachingPackage(dataset, file);
      const flags = packageSafetyFlags(pkg);
      if (flags.length) throw new TrainingInputError("PACKAGE_UNSAFE", `Instruction-like text remains after neutralisation (${flags.join(", ")}).`);
      const pipeline = this.options.pipeline();
      const own = new Set(this.datasetSourceIds(dataset));
      const liveDocs = pipeline ? pipeline.index.all().filter((d) => d.active && !own.has(d.sourceId)) : [];
      this.mark(job, "EVALUATING", `${pkg.sections.length} sections against ${liveDocs.length} live knowledge items`);
      const checks = await evaluateVersion({
        dataset, version: { ...this.versionView(dataset, version)!, records: file.records }, pkg, liveDocs,
        supersedes: this.supersedesFor(dataset, file), loadFonts: this.options.loadFonts ?? (async () => []), now: this.now(),
      });
      const { status, summary } = summarizeChecks(checks);
      job.counts.processed = file.recordCount;
      const evaluation: TeachingEvaluation = {
        evaluationId: randomUUID(), datasetId, version, capability: dataset.capability, status, checks, summary,
        configuration: { strategy: file.strategy, contentHash: file.contentHash, guidance: file.guidance, liveKnowledgeItems: liveDocs.length, knowledgeBaseReady: Boolean(pipeline) },
        evaluatedBy: by, createdAt: this.iso(),
      };
      this.state.evaluations.push(evaluation);
      if (this.state.evaluations.length > 1_000) this.state.evaluations = this.state.evaluations.slice(-1_000);
      const meta = this.meta(datasetId, version);
      meta.evaluationIds.push(evaluation.evaluationId);
      meta.latestEvaluation = { evaluationId: evaluation.evaluationId, status, at: evaluation.createdAt };
      this.persist();
      job.result = { evaluationId: evaluation.evaluationId, status, summary };
    });
  }

  // ---------- activation / rollback ----------

  private assertActivatable(dataset: TeachingDataset, version: number): VersionFile {
    const file = this.requireVersion(dataset, version);
    const meta = this.meta(dataset.datasetId, version);
    if (!meta.latestEvaluation) throw new TrainingInputError("EVALUATION_REQUIRED", "Evaluate this version before activating it.");
    if (meta.latestEvaluation.status !== "PASSED") throw new TrainingInputError("EVALUATION_FAILED", "The latest evaluation of this version failed; it cannot be activated.");
    return file;
  }

  activate(datasetId: string, version: number, by: string): TrainingJob {
    const dataset = this.requireDataset(datasetId);
    this.assertActivatable(dataset, version);
    return this.enqueue("ACTIVATE", { datasetId, version, by, total: 1 }, (job) => this.runActivation(job, dataset, version, "ACTIVATE", by));
  }

  rollback(datasetId: string, toVersion: number | null, by: string): TrainingJob {
    const dataset = this.requireDataset(datasetId);
    const current = dataset.activeVersion;
    const candidates = dataset.versions
      .filter((v) => v !== current && this.meta(datasetId, v).latestEvaluation?.status === "PASSED")
      .sort((a, b) => b - a);
    const target = toVersion ?? candidates.find((v) => current === null || v < current) ?? candidates[0];
    if (!target) throw new TrainingInputError("NO_ROLLBACK_TARGET", "There is no other evaluated version to roll back to.");
    if (target === current) throw new TrainingInputError("ALREADY_ACTIVE", `Version ${target} is already active.`);
    this.assertActivatable(dataset, target);
    return this.enqueue("ROLLBACK", { datasetId, version: target, by, total: 1 }, (job) => this.runActivation(job, dataset, target, "ROLLBACK", by));
  }

  deactivate(datasetId: string, by: string): TrainingJob {
    const dataset = this.requireDataset(datasetId);
    if (dataset.activeVersion === null) throw new TrainingInputError("NOT_ACTIVE", "This dataset has no active version.");
    return this.enqueue("DEACTIVATE", { datasetId, version: dataset.activeVersion, by, total: 1 }, async (job) => {
      const pipeline = this.requirePipeline();
      const version = dataset.activeVersion!;
      const meta = this.meta(datasetId, version);
      this.mark(job, "RUNNING", `Disable version ${version}`);
      if (meta.knowledgeSourceId && pipeline.getSource(meta.knowledgeSourceId)) await pipeline.setSourceStatus(meta.knowledgeSourceId, "DISABLED");
      const retired = this.options.patterns?.available() ? await this.options.patterns.retire(`${datasetId}:`) : 0;
      meta.activation = "INACTIVE";
      dataset.activeVersion = null;
      dataset.updatedAt = this.iso();
      this.recordActivation(dataset, version, "DEACTIVATE", version, null, [
        { channel: "KNOWLEDGE_BASE", ref: meta.knowledgeSourceId, detail: "Knowledge package disabled (kept for rollback)." },
        ...(retired ? [{ channel: "CREATIVE_PATTERNS" as const, ref: null, detail: `${retired} curated pattern(s) retired.` }] : []),
      ], by);
      this.persist();
      job.counts.processed = 1;
      job.result = { deactivatedVersion: version };
    });
  }

  private requirePipeline(): KnowledgePipeline {
    const pipeline = this.options.pipeline();
    if (!pipeline) throw new TrainingInputError("KNOWLEDGE_NOT_READY", "The Knowledge Base is not ready; activation needs it.", 503);
    return pipeline;
  }

  private stylePatterns(dataset: TeachingDataset, file: VersionFile) {
    if (dataset.mode !== "STYLE" && dataset.capability !== "CREATIVE_PLANNING") return [];
    const statements: string[] = [];
    for (const record of file.records) {
      if (record.kind === "EVALUATION_CASE") continue;
      for (const rule of record.rules) statements.push(rule);
      const first = (record.text || record.instruction).split(/(?<=[.!?])\s+/)[0] ?? "";
      if (first.length >= 12) statements.push(first);
    }
    return [...new Set(statements.map((s) => neutralizeTeachingText(s).replace(/\s+/g, " ").trim()).filter((s) => s.length >= 12 && !s.includes("[instruction-like text removed]")))]
      .slice(0, 12)
      .map((statement) => ({
        statement: statement.slice(0, 200),
        category: `teaching-${dataset.capability.toLowerCase()}`,
        applicability: [dataset.capability.toLowerCase(), dataset.key.toLowerCase()],
        projectId: dataset.scope === "PROJECT" ? dataset.projectId : null,
      }));
  }

  private async runActivation(job: TrainingJob, dataset: TeachingDataset, version: number, action: "ACTIVATE" | "ROLLBACK", by: string): Promise<void> {
    const pipeline = this.requirePipeline();
    const file = this.assertActivatable(dataset, version);
    if (dataset.scope === "PROJECT" && this.options.projectExists && !(await this.options.projectExists(dataset.projectId!))) {
      throw new TrainingInputError("PROJECT_NOT_FOUND", "The dataset's project no longer exists.", 404);
    }
    const meta = this.meta(dataset.datasetId, version);
    const previous = dataset.activeVersion;
    this.mark(job, "PREPARING", "Build knowledge package");
    const pkg = buildTeachingPackage(dataset, file);
    const flags = packageSafetyFlags(pkg);
    if (flags.length) throw new TrainingInputError("PACKAGE_UNSAFE", `Instruction-like text remains after neutralisation (${flags.join(", ")}).`);

    this.mark(job, "RUNNING", meta.knowledgeSourceId ? "Re-enable stored package" : "Index package in the Knowledge Base");
    let sourceId = meta.knowledgeSourceId && pipeline.getSource(meta.knowledgeSourceId) ? meta.knowledgeSourceId : null;
    let knowledgeJob: { status: string; result: unknown } | null = null;
    if (sourceId) {
      await pipeline.setSourceStatus(sourceId, "ACTIVE");
    } else {
      const source = pipeline.registerSource({
        sourceType: "INTERNAL_DOCUMENT",
        title: pkg.title,
        publisher: "KWIZERA AI STUDIO — Training Center",
        author: by,
        license: "internal",
        domain: pkg.domain,
        topics: pkg.topics,
        projectId: dataset.scope === "PROJECT" ? dataset.projectId : null,
        supersedes: this.supersedesFor(dataset, file),
        guidanceBySection: pkg.guidanceBySection,
        isolateChunks: true,
        guidanceTasks: [capabilityById(dataset.capability)?.task ?? "GENERAL"],
      });
      sourceId = source.sourceId;
      meta.knowledgeSourceId = sourceId;
      this.persist();
      const ingest = pipeline.ingest(sourceId, { content: pkg.markdown, mimeType: "text/markdown", fileName: `${dataset.key}-v${version}.md` });
      const done = await pipeline.waitForJob(ingest.jobId);
      knowledgeJob = { status: done.status, result: done.result };
      if (done.status === "FAILED") {
        await pipeline.setSourceStatus(sourceId, "DISABLED").catch(() => undefined);
        throw new TrainingInputError("INDEXING_FAILED", done.error?.message ?? "The knowledge package could not be indexed.");
      }
    }
    const source = pipeline.getSource(sourceId)!;
    if (source.trust !== "TRUSTED" && source.trust !== "VERIFIED") {
      await pipeline.setSourceStatus(sourceId, "DISABLED");
      throw new TrainingInputError("PACKAGE_LOW_TRUST", `The package was indexed with trust ${source.trust}; it was disabled instead of activated.`);
    }

    const delivery: ActivationRecord["delivery"] = [{ channel: "KNOWLEDGE_BASE", ref: sourceId, detail: `${source.stats.stored} knowledge items for ${capabilityById(dataset.capability)?.task ?? dataset.capability} retrieval.` }];
    if (previous !== null && previous !== version) {
      const prevMeta = this.meta(dataset.datasetId, previous);
      if (prevMeta.knowledgeSourceId && pipeline.getSource(prevMeta.knowledgeSourceId)) await pipeline.setSourceStatus(prevMeta.knowledgeSourceId, "DISABLED");
      prevMeta.activation = "INACTIVE";
      delivery.push({ channel: "KNOWLEDGE_BASE", ref: prevMeta.knowledgeSourceId, detail: `Version ${previous} disabled and kept for rollback.` });
    }

    const patterns = this.stylePatterns(dataset, file);
    const sink = this.options.patterns;
    if (sink?.available()) {
      await sink.retire(`${dataset.datasetId}:`);
      if (patterns.length) {
        const ref = `${dataset.datasetId}:v${version}`;
        const count = await sink.set(ref, { datasetKey: dataset.key, version }, patterns);
        meta.patternRef = ref;
        delivery.push({ channel: "CREATIVE_PATTERNS", ref, detail: `${count} abstract style pattern(s) for the creative director.` });
      }
    } else if (patterns.length) {
      delivery.push({ channel: "CREATIVE_PATTERNS", ref: null, detail: "Creative pattern memory is not available on this server; delivered through the Knowledge Base only." });
    }

    meta.activation = "ACTIVE";
    dataset.activeVersion = version;
    dataset.updatedAt = this.iso();
    const learnedPatterns = file.records.filter((r) => this.patternFromRecord(r)).length;
    if (learnedPatterns) {
      delivery.push({ channel: "LEARNED_CREATIVE_PATTERNS", ref: `${dataset.datasetId}:v${version}`, detail: `${learnedPatterns} structured creative pattern(s) available to the video planner and Creative Director.` });
      // Sources are deleted only after the runtime pattern channel really serves this version.
      this.mark(job, "RUNNING", "Verify runtime retrieval");
      const task = (capabilityById(dataset.capability)?.task ?? "PRODUCT_SLIDESHOW") as CreativePatternQuery["task"];
      const retrieved = this.activeCreativePatterns({ task, projectId: dataset.scope === "PROJECT" ? dataset.projectId : null, context: [], datasetId: dataset.datasetId })
        .filter((p) => p.provenance.datasetId === dataset.datasetId && p.provenance.version === version).length;
      if (retrieved < learnedPatterns) {
        meta.activation = "INACTIVE";
        dataset.activeVersion = previous;
        if (previous !== null && previous !== version) {
          const prevMeta = this.meta(dataset.datasetId, previous);
          prevMeta.activation = "ACTIVE";
          if (prevMeta.knowledgeSourceId && pipeline.getSource(prevMeta.knowledgeSourceId)) await pipeline.setSourceStatus(prevMeta.knowledgeSourceId, "ACTIVE").catch(() => undefined);
        }
        await pipeline.setSourceStatus(sourceId, "DISABLED").catch(() => undefined);
        this.persist();
        throw new TrainingInputError("RUNTIME_VERIFICATION_FAILED", `Only ${retrieved} of ${learnedPatterns} learned pattern(s) were served by the runtime channel; the version was not activated and no source was deleted.`);
      }
      delivery.push({ channel: "RUNTIME_VERIFICATION", ref: null, detail: `${retrieved} of ${learnedPatterns} learned pattern(s) served by the runtime pattern channel before any source deletion.` });
    }
    const deleted = this.sessions.applyDeferredRetention(file.records, `${dataset.key} v${version}`);
    if (deleted.length) delivery.push({ channel: "SOURCE_RETENTION", ref: null, detail: `${deleted.length} source file(s) deleted after learning (fingerprints and provenance kept).` });
    const activation = this.recordActivation(dataset, version, action, previous, meta.latestEvaluation?.evaluationId ?? null, delivery, by);
    this.persist();
    job.counts.processed = 1;
    job.result = { activationId: activation.activationId, version, previousVersion: previous, knowledgeSourceId: sourceId, knowledgeJob, delivery, modelWeightsChanged: false };
  }

  private recordActivation(dataset: TeachingDataset, version: number, action: ActivationRecord["action"], previous: number | null, evaluationId: string | null, delivery: ActivationRecord["delivery"], by: string): ActivationRecord {
    const file = this.readVersionFile(dataset.datasetId, version);
    const activation: ActivationRecord = {
      activationId: randomUUID(), datasetId: dataset.datasetId, version, action, previousVersion: previous,
      strategy: MODE_STRATEGY[dataset.mode][0], target: dataset.target, capability: dataset.capability, scope: dataset.scope, projectId: dataset.projectId,
      evaluationId, delivery,
      configuration: { contentHash: file?.contentHash ?? null, guidance: file?.guidance ?? [], mode: dataset.mode },
      by, at: this.iso(), modelWeightsChanged: false,
    };
    this.state.activations.push(activation);
    if (this.state.activations.length > 2_000) this.state.activations = this.state.activations.slice(-2_000);
    return activation;
  }

  // ---------- Phase 18C: learned creative patterns (runtime channel) ----------

  /** Validates the stored pattern shape (stored data is still treated as untrusted). */
  private patternFromRecord(r: TeachingRecord): Omit<ActiveCreativePattern, "patternId" | "provenance" | "usageCount"> | null {
    const raw = r.knowledge?.structuredData?.creativePattern as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== "object" || !PATTERN_FAMILIES.has(String(raw.family))) return null;
    const clean = (v: unknown, n = 200) => neutralizeTeachingText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, n);
    const parameters: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries((raw.parameters ?? {}) as Record<string, unknown>).slice(0, 16)) {
      if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(k)) continue;
      if (typeof v === "number" && Number.isFinite(v)) parameters[k] = v;
      else if (typeof v === "boolean" || v === null) parameters[k] = v;
      else if (typeof v === "string") parameters[k] = clean(v, 80);
    }
    const list = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => clean(x, 120)).filter(Boolean) : []);
    const confidence = typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.5;
    return {
      family: raw.family as PatternFamily, name: clean(raw.name, 140), description: clean(raw.description, 400), parameters,
      compatibleContexts: list(raw.compatibleContexts, 12), variationOptions: list(raw.variationOptions, 8),
      scenes: Array.isArray(raw.scenes) ? raw.scenes.filter((x): x is number => typeof x === "number").slice(0, 40) : [],
      confidence, evidence: list(raw.evidence, 6),
    };
  }

  /**
   * Structured creative patterns from ACTIVE dataset versions only, matching the planner's task and scope
   * (project-scoped datasets serve only their own project). Deactivated, archived, rejected or superseded versions
   * are never returned; rollback changes the active version and therefore the patterns.
   */
  activeCreativePatterns(query: CreativePatternQuery): ActiveCreativePattern[] {
    const out: ActiveCreativePattern[] = [];
    const sources = new Map(this.state.sources.map((s) => [s.sourceId, s]));
    const tasks = new Set<string>([query.task, ...(query.alsoTasks ?? [])]);
    const families = query.families?.length ? new Set<string>(query.families) : null;
    for (const d of this.state.datasets) {
      if (d.activeVersion === null || d.archived) continue;
      if (query.datasetId && d.datasetId !== query.datasetId) continue;
      if (!tasks.has(capabilityById(d.capability)?.task ?? "")) continue;
      if (d.scope === "PROJECT" ? d.projectId !== query.projectId : d.scope !== "ADMIN" && d.scope !== "SYSTEM") continue;
      if (this.meta(d.datasetId, d.activeVersion).activation !== "ACTIVE") continue;
      for (const r of this.readVersionFile(d.datasetId, d.activeVersion)?.records ?? []) {
        const p = this.patternFromRecord(r);
        if (!p || (families && !families.has(p.family))) continue;
        const bySource = new Map<string, string[]>();
        for (const l of r.knowledge!.sourceLocations) bySource.set(l.sourceId, [...(bySource.get(l.sourceId) ?? []), l.label].slice(0, 6));
        out.push({
          ...p, patternId: r.recordId, usageCount: this.state.patternUsage?.[r.recordId]?.count ?? 0,
          provenance: {
            datasetId: d.datasetId, datasetKey: d.key, version: d.activeVersion, recordId: r.recordId,
            sources: [...bySource.entries()].map(([sourceId, locations]) => ({ sourceId, title: sources.get(sourceId)?.title ?? "(source)", locations })),
          },
        });
      }
    }
    return out.slice(0, 600);
  }

  /**
   * Phase 19 — per dataset: creative patterns EXTRACTED into the latest version, ACTIVATED (in the active version) and
   * CONSUMED (used by a real plan, with the last use), so extraction is never mistaken for runtime use.
   */
  knowledgeFlow() {
    return this.state.datasets.filter((d) => !d.archived).map((d) => {
      const latest = d.versions.length ? Math.max(...d.versions) : null;
      const patternsOf = (v: number | null) => (v === null ? [] : (this.readVersionFile(d.datasetId, v)?.records ?? []).filter((r) => this.patternFromRecord(r)));
      const extracted = patternsOf(latest);
      const active = d.activeVersion !== null && this.meta(d.datasetId, d.activeVersion).activation === "ACTIVE" ? patternsOf(d.activeVersion) : [];
      const usage = this.state.patternUsage ?? {};
      const consumed = active.filter((r) => (usage[r.recordId]?.count ?? 0) > 0);
      return {
        datasetId: d.datasetId, key: d.key, capability: d.capability, activeVersion: d.activeVersion, latestVersion: latest,
        extracted: extracted.length, activated: active.length, consumed: consumed.length,
        patterns: active.slice(0, 40).map((r) => {
          const p = this.patternFromRecord(r)!;
          return { recordId: r.recordId, family: p.family, name: p.name, confidence: p.confidence, uses: usage[r.recordId]?.count ?? 0, lastUsedAt: usage[r.recordId]?.lastUsedAt ?? null };
        }),
      };
    });
  }

  recordPatternUsage(patternIds: string[], projectId: string | null): void {
    const usage = (this.state.patternUsage ??= {});
    const at = this.iso();
    for (const id of patternIds.slice(0, 40)) usage[id] = { count: (usage[id]?.count ?? 0) + 1, lastUsedAt: at, lastProjectId: projectId };
    this.persist();
  }

  // ---------- runtime verification ----------

  /** Runs the capability's real runtime retrieval against the live Knowledge Base and reports what the planner receives. */
  async runtimeTest(datasetId: string, input: { query?: string; projectId?: string | null }) {
    const dataset = this.requireDataset(datasetId);
    const capability = capabilityById(dataset.capability)!;
    const pipeline = this.requirePipeline();
    const projectId = dataset.scope === "PROJECT" ? dataset.projectId : input.projectId || null;
    const task = capability.task;
    const query = (input.query || TASK_RUNTIME_QUERY[task]).slice(0, 480);
    const specs = (TASK_RUNTIME_SPECS[task] ?? []).map((s) => ({ key: s.key, min: s.min, max: s.max, default: s.default }));
    const context = await pipeline.retrieve({ task, query, projectId, guidanceSpecs: specs, caller: "training-center.runtime-test" });
    const activeSource = dataset.activeVersion !== null ? this.meta(datasetId, dataset.activeVersion).knowledgeSourceId : null;
    const activeItems = new Set(activeSource ? pipeline.listSourceItems(activeSource, 400).filter((i) => i.active).map((i) => i.itemId) : []);
    const minSafe = context.guidance.find((g) => g.key === "composition.minSafeCoverage");
    const canvas = minSafe
      ? planCanvasFit({ sceneId: "runtime-test", assetId: "runtime-test", sourceWidth: 1080, sourceHeight: 1080, frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16", framing: null, minSafeCoverage: minSafe.basis === "KNOWLEDGE" ? Number(minSafe.value) : null })
      : null;
    const consumption = await this.runtimeConsumption(task, projectId, context, activeItems, input.query, dataset.datasetId);
    return {
      task, query, projectId, activeVersion: dataset.activeVersion, activeKnowledgeSourceId: activeSource,
      runtimeConsumers: capability.runtimeConsumers, runtimeWired: capability.runtimeWired, runtimeNote: capability.runtimeNote,
      items: context.items.map((i) => ({ id: i.id, title: i.title, section: i.citation.section ?? null, trust: i.trust, relevance: i.relevance, fromActiveTeaching: activeItems.has(i.id) })),
      guidance: context.guidance.map((g) => ({ ...g, fromActiveTeaching: g.sourceItemIds.some((id) => activeItems.has(id)) })),
      teachingItemsRetrieved: context.items.filter((i) => activeItems.has(i.id)).length,
      canvasPlanWithRuntimeGuidance: canvas && { strategy: canvas.strategy, sourceCoverage: canvas.sourceCoverage, reason: canvas.reason },
      consumption,
    };
  }

  /**
   * What the real runtime consumers do with the retrieved teaching: the Creative Director prompt section is built with
   * the production request and formatter; audio and typography planners run with the resolved guidance.
   */
  private async runtimeConsumption(task: string, projectId: string | null, context: Awaited<ReturnType<KnowledgePipeline["retrieve"]>>, activeItems: Set<string>, topic?: string, datasetId?: string) {
    const pipeline = this.requirePipeline();
    const out: Array<{ consumer: string; usesTeaching: boolean; detail: string; excerpts?: string[]; measured?: Record<string, unknown> }> = [];
    if (task === "PRODUCT_SLIDESHOW" || task === "CINEMATIC_VIDEO") {
      const lp = await import("../creative-planning/learned-creative-patterns.js");
      const plannerContext = lp.buildCrossModalCreativeContext({ task: "PRODUCT_VIDEO_CREATION", projectId, cinematic: task === "CINEMATIC_VIDEO", aspectRatio: "9:16", durationSec: 11.5, seed: `runtime-test:${projectId ?? "global"}`, source: (q) => this.activeCreativePatterns(q) });
      const selections: PatternSelection[] = plannerContext.selections;
      const base = runtimeTestTimeline();
      const applied = lp.applyLearnedPatternsToTimeline(base, selections);
      const own = applied.decisions.filter((d) => d.provenance.datasetId === datasetId);
      const changed = own.filter((d) => d.applied);
      out.push({
        consumer: "Video Planner (learned creative direction)", usesTeaching: changed.length > 0,
        detail: selections.length
          ? `${selections.length} selected pattern(s) from the cross-modal context (${own.length} decision(s) from this dataset); ${changed.length} changed the plan: ${changed.map((d) => `${d.family.toLowerCase()} → ${d.change}`).join("; ") || "none"}.${own.filter((d) => !d.applied).map((d) => ` ${d.family.toLowerCase()}: ${d.reason}`).join("")}`
          : "No active creative patterns for this task and scope.",
        measured: {
          before: base.map(clipLabel),
          after: applied.clips.map(clipLabel),
          decisions: applied.decisions.map((d) => ({ family: d.family, pattern: d.name, applied: d.applied, change: d.change, reason: d.reason, dataset: `${d.provenance.datasetKey} v${d.provenance.version}`, sources: d.provenance.sources.map((s) => s.title) })),
        },
      });
      const { creativeDirectorKnowledgeRequest } = await import("../creative-planning/creative-director-knowledge.js");
      const { formatKnowledgeForPrompt } = await import("../knowledge-retrieval-engine/knowledge-context-builder.js");
      const request = creativeDirectorKnowledgeRequest({ category: topic?.slice(0, 120) || null, platform: null, tone: null, cinematic: task === "CINEMATIC_VIDEO", projectId });
      const ctx = await pipeline.retrieve({ ...request, caller: "training-center.runtime-test.creative-director" });
      const prompt = formatKnowledgeForPrompt(ctx);
      const teaching = ctx.items.filter((i) => activeItems.has(i.id));
      const excerpts = teaching.map((i) => i.excerpt).filter((e) => prompt.includes(JSON.stringify(e).slice(1, -1).slice(0, 60))).map((e) => e.slice(0, 240));
      out.push({
        consumer: "Creative Director prompt (retrievedKnowledge)", usesTeaching: excerpts.length > 0,
        detail: `${teaching.length} of ${ctx.items.length} knowledge items in the Creative Director prompt come from this dataset's active version (${prompt.length} characters).`,
        excerpts, measured: { query: request.query, promptItems: ctx.items.length, teachingItems: teaching.length },
      });
    }
    if (task === "AUDIO_PLAN") {
      const { planAudioFit } = await import("../video-production/audio-fit.js");
      const fade = context.guidance.find((g) => g.key === "audio.fadeOutSec");
      const xf = context.guidance.find((g) => g.key === "audio.loopCrossfadeSec");
      const guidance = {
        ...(fade?.basis === "KNOWLEDGE" ? { fadeOutSec: Number(fade.value) } : {}),
        ...(xf?.basis === "KNOWLEDGE" ? { loopCrossfadeSec: Number(xf.value) } : {}),
        sourceItemIds: [...(fade?.sourceItemIds ?? []), ...(xf?.sourceItemIds ?? [])],
      };
      const trim = planAudioFit({ sourceDurationSec: 90, targetDurationSec: 30, guidance });
      const loop = planAudioFit({ sourceDurationSec: 20, targetDurationSec: 45, analysis: { bpm: 120 }, guidance });
      const used = [fade, xf].some((g) => g?.sourceItemIds.some((id) => activeItems.has(id)));
      out.push({
        consumer: "Audio fit / render timeline (video-production.audio)", usesTeaching: used,
        detail: `Trim plan fades out over ${trim.fadeOutSec}s; loop plan crossfades ${loop.crossfadeSec}s on a ${loop.boundaryBasis} boundary${used ? " using this dataset's guidance" : ""}.`,
        measured: { fadeOutSec: trim.fadeOutSec, crossfadeSec: loop.crossfadeSec, strategy: loop.strategy },
      });
    }
    if (task === "CODE_ASSIST") {
      const teaching = context.items.filter((i) => activeItems.has(i.id));
      out.push({
        consumer: "CODE_AI (knowledge retrieval only)", usesTeaching: false,
        detail: `${teaching.length} of ${context.items.length} retrieved CODE_ASSIST item(s) come from this dataset, but no code-planning runtime consumes CODE_ASSIST knowledge yet, so it does not change any output.`,
        measured: { retrieved: context.items.length, fromThisDataset: teaching.length, runtimeConsumer: null },
      });
    }
    if (task === "TYPOGRAPHY_PLAN") {
      const fonts = await (this.options.loadFonts ?? (async () => []))().catch(() => []);
      const maxItems = context.guidance.find((g) => g.key === "typography.maxItemsPerScene");
      const used = Boolean(maxItems?.sourceItemIds.some((id) => activeItems.has(id)));
      if (!fonts.length) {
        out.push({ consumer: "Typography plan (video-production.typography)", usesTeaching: used, detail: `Resolved maxItemsPerScene=${maxItems?.value ?? "default"} (${maxItems?.basis ?? "no guidance"}); no verified fonts are installed, so the planner was not run.` });
      } else {
        const { composeTypographyDecision } = await import("../typography/typography-engine.js");
        const decision = await composeTypographyDecision({
          projectId: "runtime-test", productName: "Aurora Earbuds", width: 1080, height: 1920, aspectRatio: "9:16", platform: "tiktok",
          guidance: { maxItemsPerScene: maxItems?.basis === "KNOWLEDGE" ? Number(maxItems.value) : undefined },
          scenes: [{ sceneId: "hook", purpose: "hook", texts: [{ role: "headline", text: "Aurora Earbuds" }, { role: "subtitle", text: "All-day comfort" }, { role: "benefit", text: "Clear calls" }, { role: "supporting", text: "Water resistant" }] }],
        }, fonts);
        const items = decision.scenes[0]?.items.length ?? 0;
        const scopeNote = used ? "" : " The planner applies only the numeric text-items-per-scene limit; this version does not set it, so its rules do not change the layout.";
        out.push({ consumer: "Typography plan (video-production.typography)", usesTeaching: used, detail: `Hook scene placed ${items} text item(s) (limit ${maxItems?.value ?? 3}, ${maxItems?.basis ?? "default"}).${scopeNote}`, measured: { items, limit: maxItems?.value ?? null } });
      }
    }
    if (datasetId) out.push(...await this.multimodalConsumption(projectId, datasetId));
    return out;
  }

  /**
   * Phase 18D — the beat-sync planner, typography placement and audio plan run with and without this dataset's
   * active audio/layout patterns on a fixed synthetic track and scene, so the difference is measured, not asserted.
   */
  private async multimodalConsumption(projectId: string | null, datasetId: string) {
    const lp = await import("../creative-planning/learned-creative-patterns.js");
    const out: Array<{ consumer: string; usesTeaching: boolean; detail: string; measured?: Record<string, unknown> }> = [];
    const ctx = ["product-video", "9:16", "vertical", "short-form"];
    const own = (q: Omit<CreativePatternQuery, "projectId" | "context">) =>
      this.activeCreativePatterns({ ...q, projectId, context: ctx, datasetId });
    const select = (patterns: ActiveCreativePattern[]) => lp.selectCreativePatterns(patterns, { seed: `runtime-test:${projectId ?? "global"}`, context: ctx });
    out.push(...await this.crossModalPlanProof(projectId, datasetId));

    const audioOwn = own(lp.RUNTIME_PATTERN_QUERIES.beatSync());
    const alignment = lp.learnedBeatAlignment(select(audioOwn));
    if (alignment) {
      const { applyBeatSyncTiming } = await import("../video-production/beat-sync-timing.js");
      const { intelligence, clips } = await syntheticBeatFixture();
      const base = applyBeatSyncTiming({ clips, mode: "SMART", intelligence });
      const learned = applyBeatSyncTiming({ clips, mode: "SMART", intelligence, learned: { alignTo: alignment.value, patternId: alignment.patternId, name: alignment.name, dataset: alignment.provenance.datasetKey } });
      const boundaries = (plan: typeof base.plan) => plan.scenes.map((s) => `${s.sceneId}@${(s.endMs / 1000).toFixed(2)}s:${s.alignmentType}`);
      const changed = JSON.stringify(boundaries(base.plan)) !== JSON.stringify(boundaries(learned.plan));
      out.push({
        consumer: "Beat-sync timing (learned alignment)", usesTeaching: changed,
        detail: `${alignment.reason} ${learned.plan.learned?.note ?? ""}${changed ? "" : " Scene boundaries are identical with and without it on the test track."}`.trim(),
        measured: { alignTo: alignment.value, pattern: alignment.name, before: boundaries(base.plan), after: boundaries(learned.plan) },
      });
    }

    const layoutOwn = own(lp.RUNTIME_PATTERN_QUERIES.typography());
    const layout = lp.learnedTypographyLayout(select(layoutOwn));
    if (layout) {
      const { choosePlacement } = await import("../typography/placement.js");
      const scene = { productCentered: true, productOccupiedRegion: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } };
      const roles = ["headline", "benefit", "cta"] as const;
      const place = (learnedSides: boolean) => roles.map((role, i) => `${role}:${choosePlacement({
        role, hierarchy: i + 1, ...scene,
        preferredTextSides: learnedSides && layout.value.textSides.length ? layout.value.textSides : undefined,
        ctaPlacement: learnedSides ? layout.value.ctaPlacement : null,
      })}`);
      const before = place(false);
      const after = place(true);
      const changed = JSON.stringify(before) !== JSON.stringify(after);
      out.push({
        consumer: "Typography placement (learned layout)", usesTeaching: changed,
        detail: `${layout.reason}${changed ? "" : " Placement is identical to the default for a centred product."}`,
        measured: { pattern: layout.name, textSides: layout.value.textSides, ctaPlacement: layout.value.ctaPlacement, before, after },
      });
    }

    const music = lp.learnedMusicGuidance(select(audioOwn));
    if (music) {
      out.push({
        consumer: "Audio plan (learned music guidance)", usesTeaching: true,
        detail: `${music.reason} Used as reference when choosing a track (tempo ${music.value.bpmRange ? `${music.value.bpmRange[0]}–${music.value.bpmRange[1]} BPM` : "not learned"}, energy ${music.value.energyLevel ?? "not learned"}, structure ${music.value.structure ?? "not learned"}). Music generation is UNAVAILABLE, so no music is generated from it.`,
        measured: { ...music.value, musicGeneration: "UNAVAILABLE" },
      });
    }
    return out;
  }

  /**
   * Phase 19 — the real planning path with the full cross-modal context (every active creative dataset), once with
   * and once without this dataset: the deterministic Creative Director storyboard step, the Video Planner timing and
   * direction phases (on a measured 120 BPM test track), typography placement and the Creative Director prompt view.
   */
  private async crossModalPlanProof(projectId: string | null, datasetId: string) {
    const lp = await import("../creative-planning/learned-creative-patterns.js");
    const { intelligence } = await syntheticBeatFixture();
    const tempoMeasured = intelligence.tempo.status === "available";
    const audio = { bpm: intelligence.bpm, tempoMeasured, energyLevel: lp.musicEnergyFromTempo({ bpm: intelligence.bpm, tempoMeasured }) };
    const request = {
      task: "PRODUCT_VIDEO_CREATION" as const, projectId, aspectRatio: "9:16", durationSec: 11.5, audio, seed: `runtime-test:${projectId ?? "global"}`,
      source: (q: CreativePatternQuery) => this.activeCreativePatterns(q),
    };
    const plan = (exclude: boolean) => {
      const ctx = lp.buildCrossModalCreativeContext({ ...request, excludeDatasetId: exclude ? datasetId : undefined });
      const storyboard = lp.applyLearnedStoryToScenes(runtimeTestTimeline().map((c) => ({ id: c.sceneId, purpose: c.purpose, camera: c.camera })), ctx.selections);
      const timed = lp.applyLearnedPatternsToTimeline(runtimeTestTimeline(), ctx.selections, { phase: "timing", musicEnergy: audio.energyLevel });
      const directed = lp.applyLearnedPatternsToTimeline(timed.clips, ctx.selections, { phase: "direction", musicEnergy: audio.energyLevel });
      const layout = lp.learnedTypographyLayout(ctx.selections);
      return { ctx, storyboard, clips: directed.clips, decisions: [...timed.decisions, ...directed.decisions], layout };
    };
    const withIt = plan(false);
    const without = plan(true);
    const { choosePlacement } = await import("../typography/placement.js");
    const placement = (layout: ReturnType<typeof lp.learnedTypographyLayout>) => (["headline", "cta"] as const).map((role, i) => `${role}:${choosePlacement({
      role, hierarchy: i + 1, productCentered: true, productOccupiedRegion: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      preferredTextSides: layout?.value.textSides.length ? layout.value.textSides : undefined, ctaPlacement: layout?.value.ctaPlacement ?? null,
    })}`);
    const summary = (p: typeof withIt) => ({
      storySequence: p.clips.map((c) => lp.storyRole(c.storyRole ?? c.purpose)),
      timeline: p.clips.map(clipLabel),
      storyboard: p.storyboard.scenes.map((s) => `${s.id}:${s.purpose}/${s.camera}`),
      typography: placement(p.layout),
    });
    const a = summary(withIt);
    const b = summary(without);
    const own = withIt.decisions.filter((d) => d.provenance.datasetId === datasetId);
    const inContext = withIt.ctx.provenance.filter((p) => p.datasetId === datasetId);
    const changed = JSON.stringify(a) !== JSON.stringify(b);
    const promptView = lp.crossModalPromptView(withIt.ctx);
    return [{
      consumer: "Cross-modal creative plan (Creative Director + Video Planner)",
      usesTeaching: changed && inContext.length > 0,
      detail: inContext.length
        ? `${inContext.length} pattern(s) from this dataset are in the ${withIt.ctx.selections.length}-pattern cross-modal context; ${changed ? `the plan differs without them (story ${b.storySequence.join(" → ")} → ${a.storySequence.join(" → ")}; text ${b.typography.join(", ")} → ${a.typography.join(", ")})` : "the plan is identical without them"}.`
        : "No pattern from this dataset is in the cross-modal context (inactive, excluded or not a creative pattern).",
      measured: {
        with: a, without: b, musicEnergy: audio.energyLevel, bpm: audio.bpm,
        decisions: own.map((d) => ({ family: d.family, pattern: d.name, applied: d.applied, change: d.change, reason: d.reason, dataset: `${d.provenance.datasetKey} v${d.provenance.version}`, sources: d.provenance.sources.map((s) => s.title) })),
        contextGroups: Object.fromEntries((["videoPatterns", "audioPatterns", "imagePatterns", "typographyPatterns", "storytellingPatterns", "compositionPatterns", "synchronizationPatterns", "productPatterns"] as const).map((k) => [k, withIt.ctx[k].map((e) => e.name)])),
        excluded: withIt.ctx.excluded.map((e) => ({ name: e.name, reason: e.reason })),
        unavailable: withIt.ctx.unavailable,
        creativeDirectorPrompt: JSON.stringify(promptView).slice(0, 1_500),
        storyboardNotes: withIt.storyboard.applied,
      },
    }];
  }

  // ---------- Phase 18B: teaching sessions ----------

  addSource(input: Record<string, unknown>, by: string) { return this.sessions.addSource(input, by); }
  listSources(opts: { includeArchived?: boolean } = {}) { return this.sessions.listSources(opts); }
  deleteSource(sourceId: string) { return this.sessions.deleteSource(sourceId, "EXPLICIT"); }
  createSession(input: Record<string, unknown>, by: string) { return this.sessions.createSession(input, by).then((s) => this.sessions.view(s)); }
  listSessions() { return this.sessions.listSessions(); }
  getSession(sessionId: string) { return this.sessions.getSession(sessionId); }
  decideKnowledge(sessionId: string, decisions: Array<{ id: string; decision: string }>, by: string) { this.sessions.decide(sessionId, decisions, by); return this.sessions.getSession(sessionId); }
  commitSession(sessionId: string, input: Record<string, unknown>, by: string) { return this.sessions.commit(sessionId, input, by); }
  rerunSession(sessionId: string, by: string) { return this.sessions.rerun(sessionId, by).then((s) => this.sessions.view(s)); }
  listKnowledge(filters: Record<string, string | undefined>) { return this.sessions.listKnowledge(filters); }

  // ---------- profiles ----------

  createProfile(input: Record<string, unknown>, by: string): TrainingProfile {
    const capability = capabilityById(str(input.capability, 60));
    if (!capability) throw new TrainingInputError("UNKNOWN_CAPABILITY", "Choose a supported capability.");
    const entries = (Array.isArray(input.entries) ? input.entries : []).slice(0, 20).map((e) => {
      const entry = (e ?? {}) as Record<string, unknown>;
      const dataset = this.requireDataset(str(entry.datasetId, 40));
      const version = num(entry.version);
      if (!version || !dataset.versions.includes(version)) throw new TrainingInputError("VERSION_NOT_FOUND", `Version ${entry.version} of ${dataset.key} does not exist.`);
      if (dataset.capability !== capability.id) throw new TrainingInputError("CAPABILITY_MISMATCH", `${dataset.key} teaches ${dataset.capability}, not ${capability.id}.`);
      return { datasetId: dataset.datasetId, version };
    });
    if (!entries.length) throw new TrainingInputError("ENTRIES_REQUIRED", "Add at least one dataset version.");
    if (new Set(entries.map((e) => e.datasetId)).size !== entries.length) throw new TrainingInputError("DUPLICATE_DATASET", "A profile can reference each dataset once.");
    const now = this.iso();
    const profile: TrainingProfile = {
      profileId: randomUUID(), name: str(input.name, 120) || `${capability.label} profile`, description: str(input.description, 500),
      capability: capability.id, entries, createdBy: by, createdAt: now, updatedAt: now,
    };
    this.state.profiles.push(profile);
    this.persist();
    return profile;
  }

  listProfiles() {
    return this.state.profiles.map((p) => ({
      ...p,
      entries: p.entries.map((e) => {
        const dataset = this.state.datasets.find((d) => d.datasetId === e.datasetId);
        const meta = this.meta(e.datasetId, e.version);
        return { ...e, datasetKey: dataset?.key ?? null, active: dataset?.activeVersion === e.version, evaluation: meta.latestEvaluation?.status ?? null };
      }),
    })).reverse();
  }

  activateProfile(profileId: string, by: string): TrainingJob[] {
    const profile = this.state.profiles.find((p) => p.profileId === profileId);
    if (!profile) throw new TrainingInputError("PROFILE_NOT_FOUND", "Profile not found.", 404);
    for (const e of profile.entries) this.assertActivatable(this.requireDataset(e.datasetId), e.version);
    return profile.entries
      .filter((e) => this.requireDataset(e.datasetId).activeVersion !== e.version)
      .map((e) => this.activate(e.datasetId, e.version, by));
  }

  /** For tests and diagnostics: lists capability ids exposed by the catalog. */
  static capabilityIds(): string[] {
    return CAPABILITIES.map((c) => c.id);
  }
}

/** Four-scene runtime-test timeline (hook, product reveal, feature, call to action). */
function runtimeTestTimeline() {
  const clip = (order: number, purpose: string, durationMs: number, motion: string) => ({
    sceneId: `scene-${order}`, order, purpose, durationMs, motion, camera: "medium", storyRole: undefined as string | undefined,
    transitionIn: "cut" as "cut" | "fade", transitionOut: "cut" as "cut" | "fade",
  });
  return [clip(1, "HOOK", 2500, "slow-zoom"), clip(2, "PRODUCT_REVEAL", 3000, "hold"), clip(3, "FEATURE", 3000, "hold"), clip(4, "CTA", 3000, "hold")];
}

function clipLabel(c: { sceneId: string; motion: string; transitionOut: string; durationMs: number; camera?: string; storyRole?: string; purpose: string }): string {
  return `${c.sceneId}:${c.storyRole ?? c.purpose}/${c.camera ?? "-"}/${c.motion}/${(c.durationMs / 1000).toFixed(1)}s/${c.transitionOut}`;
}

/** Fixed 16 s, 120 BPM test track (downbeat every bar) and a four-scene storyboard for runtime verification. */
async function syntheticBeatFixture() {
  const { AUDIO_INTELLIGENCE_VERSION } = await import("../audio-intelligence/types.js");
  type Intel = import("../audio-intelligence/types.js").AudioTimingIntelligence;
  type Clip = import("../video-production/types.js").VideoTimelineClip;
  const beats: Intel["beats"] = [];
  for (let i = 1; i <= 31; i++) {
    const down = i % 4 === 0;
    beats.push({ time: i * 0.5, strength: down ? 0.92 : i % 2 === 0 ? 0.8 : 0.55, strengthClass: down || i % 2 === 0 ? "strong" : "normal", confidence: 0.85, type: down ? "downbeat" : "beat" });
  }
  const intelligence: Intel = {
    audioAssetId: "runtime-test", contentHash: "runtime-test", analysisVersion: AUDIO_INTELLIGENCE_VERSION, status: "READY",
    analyzedAt: new Date(0).toISOString(), analysisDurationMs: 0,
    technical: { durationSec: 16, sampleRate: 22050, channels: 1, codec: "pcm", bitrate: null, format: "raw", silent: false, insufficientDuration: false },
    tempo: { bpm: 120, primaryBpm: 120, alternativeBpm: 60, confidence: 0.8, method: "synthetic", status: "available" },
    duration: 16, bpm: 120, bpmConfidence: 0.8, beats,
    strongBeats: beats.filter((b) => b.strength >= 0.8), downbeats: beats.filter((b) => b.type === "downbeat"),
    energyTimeline: [{ start: 0, end: 16, energy: 0.6, trend: "high" }], energyTransitions: [],
    sections: [{ label: "SECTION_1", start: 0, end: 16, energy: 0.6, beatDensity: 2, confidence: 0.6 }],
    beatDensity: [{ start: 0, end: 16, beatsPerSecond: 2, density: "normal" }], meanEnergy: 0.6,
  };
  const clip = (order: number, purpose: string, durationMs: number): Clip => ({
    id: `clip-${order}`, sceneId: `scene-${order}`, order, purpose, assetId: "runtime-test", startMs: 0, durationMs, layer: "video",
    camera: "medium", motion: "hold", lighting: "natural", background: "clean", transitionIn: "cut", transitionOut: "cut", text: [], audioDirection: "bed",
  });
  return { intelligence, clips: [clip(1, "FEATURE", 2300), clip(2, "FEATURE", 2300), clip(3, "BENEFIT", 2300), clip(4, "CTA", 2300)] };
}
