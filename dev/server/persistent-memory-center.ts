/**
 * Phase 7 Step 2 — Persistent Memory & Local Knowledge Center
 *
 * Reuses AiMemoryStorageEngine + AiKnowledgeStorageEngine file layouts under
 * KWIZERA_STORAGE_ROOT. Does NOT duplicate engines or databases.
 * Boots without full AiCore so desktop mode (persistent=0) still has durable memory.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot, resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { AiMemoryStorageEngine } from "../../ai/memory-storage-engine/memory-storage-engine.js";
import {
  MemoryRecordStatus,
  MemoryStorageType,
  type MemoryRecord,
  type MemoryRecordInput,
  type MemoryRecordUpdate,
} from "../../ai/memory-storage-engine/types.js";
import { MemoryStorageManager } from "../../ai/memory-foundation/memory-storage.js";
import { MemoryFoundationLogger } from "../../ai/memory-foundation/memory-logger.js";
import {
  type MemoryAccessRequest,
  type MemoryAccessResult,
} from "../../ai/memory-foundation/types.js";
import type { AiMemoryFoundation } from "../../ai/memory-foundation/memory-foundation.js";
import { AiKnowledgeStorageEngine } from "../../ai/knowledge-storage-engine/knowledge-storage-engine.js";
import {
  KnowledgeRecordStatus,
  KnowledgeStorageType,
  type KnowledgeRecord,
  type KnowledgeRecordInput,
} from "../../ai/knowledge-storage-engine/types.js";
import { KnowledgeStorageManager } from "../../ai/knowledge-foundation/knowledge-storage.js";
import { KnowledgeFoundationLogger } from "../../ai/knowledge-foundation/knowledge-logger.js";
import {
  KnowledgeAccessOperation,
  KnowledgeVerificationStatus,
  type KnowledgeAccessRequest,
  type KnowledgeAccessResult,
} from "../../ai/knowledge-foundation/types.js";
import type { AiKnowledgeFoundation } from "../../ai/knowledge-foundation/knowledge-foundation.js";

export type StudioMemoryKind =
  | "PROJECT_MEMORY"
  | "PRODUCTION_MEMORY"
  | "USER_PREFERENCE"
  | "AI_DECISION"
  | "AI_CORRECTION"
  | "AI_LEARNING"
  | "WORKFLOW_MEMORY"
  | "CREATIVE_MEMORY"
  | "MARKETING_MEMORY"
  | "SYSTEM_MEMORY"
  | "KNOWLEDGE_REFERENCE";

export type ImportanceLevel = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

const KIND_TO_STORAGE: Record<StudioMemoryKind, MemoryStorageType> = {
  PROJECT_MEMORY: MemoryStorageType.Project,
  PRODUCTION_MEMORY: MemoryStorageType.Workflow,
  USER_PREFERENCE: MemoryStorageType.UserPreference,
  AI_DECISION: MemoryStorageType.Decision,
  AI_CORRECTION: MemoryStorageType.Decision,
  AI_LEARNING: MemoryStorageType.Learning,
  WORKFLOW_MEMORY: MemoryStorageType.Workflow,
  CREATIVE_MEMORY: MemoryStorageType.Project,
  MARKETING_MEMORY: MemoryStorageType.Marketing,
  SYSTEM_MEMORY: MemoryStorageType.System,
  KNOWLEDGE_REFERENCE: MemoryStorageType.Knowledge,
};

function qualityFromImportance(importance?: ImportanceLevel): number {
  switch (importance) {
    case "CRITICAL": return 98;
    case "HIGH": return 88;
    case "LOW": return 45;
    default: return 70;
  }
}

/** Minimal access stub — grants local desktop center access without AiCore. */
function createMemoryAccessStub(memoryRoot: string): AiMemoryFoundation {
  return {
    requestAccess: async (req: MemoryAccessRequest): Promise<MemoryAccessResult> => ({
      granted: true,
      operation: req.operation,
      category: req.category,
      storagePath: memoryRoot,
      durationMs: 0,
      message: "persistent-memory-center",
    }),
    getMemoryRoot: () => memoryRoot,
  } as unknown as AiMemoryFoundation;
}

function createKnowledgeAccessStub(knowledgeRoot: string): AiKnowledgeFoundation {
  return {
    requestAccess: async (req: KnowledgeAccessRequest): Promise<KnowledgeAccessResult> => ({
      granted: true,
      operation: req.operation,
      category: req.category as never,
      storagePath: knowledgeRoot,
      durationMs: 0,
      message: "persistent-memory-center",
    }),
  } as unknown as AiKnowledgeFoundation;
}

export interface SaveMemoryRequest {
  kind: StudioMemoryKind;
  title: string;
  content: string;
  source?: string;
  projectId?: string;
  tags?: string[];
  importance?: ImportanceLevel;
  confidence?: number;
  memoryId?: string;
  payload?: Record<string, unknown>;
  relatedFiles?: string[];
  dedupeKey?: string;
}

export interface SaveKnowledgeRequest {
  title: string;
  topic: string;
  content: string;
  source?: string;
  sourceUrl?: string;
  knowledgeType?: KnowledgeStorageType;
  tags?: string[];
  confidence?: number;
  verificationStatus?: KnowledgeVerificationStatus;
  knowledgeId?: string;
  payload?: Record<string, unknown>;
}

export interface MemoryContextPackage {
  projectId: string | null;
  preferences: MemoryRecord[];
  decisions: MemoryRecord[];
  corrections: MemoryRecord[];
  projectMemory: MemoryRecord[];
  knowledge: KnowledgeRecord[];
  builtAt: string;
}

export interface PersistentMemoryHealth {
  ready: boolean;
  memory: "READY" | "FAILED" | "CHECKING";
  knowledge: "READY" | "FAILED" | "CHECKING";
  database: "READY" | "N/A";
  backup: "AVAILABLE" | "NONE" | "FAILED";
  storageRoot: string;
  memoryRoot: string;
  knowledgeRoot: string;
  memoryCount: number;
  knowledgeCount: number;
  lastBackupId: string | null;
  issues: string[];
  offlineCapable: true;
}

export class PersistentMemoryCenter {
  private ready = false;
  private storageRoot = "";
  private memoryRoot = "";
  private knowledgeRoot = "";
  private memoryEngine = new AiMemoryStorageEngine();
  private knowledgeEngine = new AiKnowledgeStorageEngine();
  private lastBackupId: string | null = null;
  private bootError: string | null = null;

  async boot(storageRootOverride?: string): Promise<void> {
    const target = resolveStorageRoot(storageRootOverride);
    if (this.ready && this.storageRoot === target) return;
    this.ready = false;
    try {
      this.storageRoot = target;
      fs.mkdirSync(this.storageRoot, { recursive: true });

      const memLogger = new MemoryFoundationLogger();
      memLogger.initialize(path.join(this.storageRoot, "logs"));
      const memStorage = new MemoryStorageManager(memLogger);
      this.memoryRoot = memStorage.initialize(this.storageRoot);
      fs.mkdirSync(path.join(this.memoryRoot, "checkpoints"), { recursive: true });

      const knowLogger = new KnowledgeFoundationLogger();
      knowLogger.initialize(path.join(this.storageRoot, "logs"));
      const knowStorage = new KnowledgeStorageManager(knowLogger);
      this.knowledgeRoot = knowStorage.initialize(this.storageRoot);

      const memStub = createMemoryAccessStub(this.memoryRoot);
      this.memoryEngine.initialize(memStub, this.storageRoot, this.memoryRoot);
      await this.memoryEngine.runStartup();

      const knowStub = createKnowledgeAccessStub(this.knowledgeRoot);
      this.knowledgeEngine.initialize(knowStub, this.storageRoot, this.knowledgeRoot);
      await this.knowledgeEngine.runStartup();

      this.refreshLastBackupId();
      this.ready = true;
      this.bootError = null;
      await this.ensureStarterKnowledge();
      console.log(`[KWIZERA] Persistent Memory Center ready at ${this.storageRoot}`);
    } catch (error) {
      this.bootError = error instanceof Error ? error.message : String(error);
      this.ready = false;
      console.error("[KWIZERA] Persistent Memory Center boot failed:", this.bootError);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getBootError(): string | null {
    return this.bootError;
  }

  health(): PersistentMemoryHealth {
    const issues: string[] = [];
    if (!this.ready) issues.push(this.bootError ?? "Center not ready");
    const backupsDir = path.join(resolveStoragePath(this.storageRoot || resolveStorageRoot(), "backups"), "persistent-memory-center");
    let backup: PersistentMemoryHealth["backup"] = "NONE";
    try {
      if (fs.existsSync(backupsDir) && fs.readdirSync(backupsDir).length > 0) backup = "AVAILABLE";
    } catch {
      backup = "FAILED";
      issues.push("Backup directory unreadable");
    }

    // JSON-file architecture (no SQLite). "database" dir is reserved/writable app data.
    let database: PersistentMemoryHealth["database"] = "N/A";
    try {
      const dbDir = resolveStoragePath(this.storageRoot || resolveStorageRoot(), "database");
      fs.mkdirSync(dbDir, { recursive: true });
      fs.accessSync(dbDir, fs.constants.W_OK);
      database = "READY";
    } catch {
      database = "N/A";
      issues.push("Database directory not writable");
    }

    // Spot-check a sample of memory-related file references (report only — never auto-delete)
    if (this.ready) {
      try {
        const sample = this.memoryEngine.getIndexEntries().slice(0, 25);
        for (const entry of sample) {
          const related = (entry as { relatedFiles?: string[] }).relatedFiles ?? [];
          for (const rel of related.slice(0, 3)) {
            if (rel && path.isAbsolute(rel) && !fs.existsSync(rel)) {
              issues.push(`Missing file reference: ${rel}`);
            }
          }
        }
      } catch {
        /* ignore probe errors */
      }
    }

    return {
      ready: this.ready,
      memory: this.ready ? "READY" : "FAILED",
      knowledge: this.ready ? "READY" : "FAILED",
      database,
      backup,
      storageRoot: this.storageRoot || resolveStorageRoot(),
      memoryRoot: this.memoryRoot,
      knowledgeRoot: this.knowledgeRoot,
      memoryCount: this.ready ? this.memoryEngine.getRecordCount() : 0,
      knowledgeCount: this.ready ? this.knowledgeEngine.getRecordCount() : 0,
      lastBackupId: this.lastBackupId,
      issues,
      offlineCapable: true,
    };
  }

  async saveMemory(input: SaveMemoryRequest) {
    this.ensureReady();
    const memoryType = KIND_TO_STORAGE[input.kind] ?? MemoryStorageType.System;
    const dedupeTitle = input.dedupeKey ? `${input.title}::${input.dedupeKey}` : input.title;
    const recordInput: MemoryRecordInput = {
      memoryId: input.memoryId,
      memoryType,
      category: input.kind,
      title: dedupeTitle,
      description: input.content,
      tags: [...(input.tags ?? []), input.kind, input.importance ?? "NORMAL"],
      keywords: [input.kind, input.projectId ?? "", ...(input.tags ?? [])].filter(Boolean),
      source: input.source ?? "studio-desktop",
      relatedProject: input.projectId,
      relatedFiles: input.relatedFiles ?? [],
      qualityScore: qualityFromImportance(input.importance),
      status: MemoryRecordStatus.Active,
      payload: {
        kind: input.kind,
        importance: input.importance ?? "NORMAL",
        confidence: input.confidence ?? null,
        dedupeKey: input.dedupeKey ?? null,
        content: input.content,
        ...(input.payload ?? {}),
      },
    };

    const result = await this.memoryEngine.storeRecord(recordInput, "persistent-memory-center");
    if (!result.success && result.validation?.code === "duplicate-record") {
      const existingId = this.findDuplicateId(result.validation.message ?? "");
      if (existingId) {
        const update: MemoryRecordUpdate = {
          description: input.content,
          tags: recordInput.tags,
          keywords: recordInput.keywords,
          relatedProject: input.projectId,
          relatedFiles: input.relatedFiles,
          qualityScore: recordInput.qualityScore,
          payload: recordInput.payload,
        };
        const updated = await this.memoryEngine.updateRecord(existingId, update, "persistent-memory-center");
        return { ...updated, action: "updated" as const, memoryId: existingId };
      }
    }
    return { ...result, action: result.success ? ("created" as const) : ("failed" as const), memoryId: result.record?.memoryId };
  }

  async getMemory(memoryId: string) {
    this.ensureReady();
    return this.memoryEngine.getRecord(memoryId, "persistent-memory-center");
  }

  async searchMemory(opts: {
    text?: string;
    kind?: StudioMemoryKind;
    projectId?: string;
    limit?: number;
  }): Promise<MemoryRecord[]> {
    this.ensureReady();
    const limit = Math.min(opts.limit ?? 40, 200);
    const entries = this.memoryEngine.getIndexEntries();
    const text = (opts.text ?? "").toLowerCase().trim();
    const filtered = entries.filter((e) => {
      if (opts.kind && e.category !== opts.kind && !e.searchableText.includes(opts.kind.toLowerCase())) return false;
      if (opts.projectId) {
        const projectHit =
          (e as { relatedProject?: string }).relatedProject === opts.projectId
          || e.searchableText.includes(opts.projectId.toLowerCase());
        if (!projectHit) return false;
      }
      if (text && !e.searchableText.includes(text) && !e.title.toLowerCase().includes(text)) return false;
      return true;
    }).slice(0, limit);

    const records: MemoryRecord[] = [];
    for (const entry of filtered) {
      const read = await this.memoryEngine.getRecord(entry.memoryId, "persistent-memory-center");
      if (read.success && read.record) records.push(read.record);
    }
    return records;
  }

  async saveKnowledge(input: SaveKnowledgeRequest) {
    this.ensureReady();
    const knowledgeType = input.knowledgeType ?? KnowledgeStorageType.Creative;
    const recordInput: KnowledgeRecordInput = {
      knowledgeId: input.knowledgeId,
      knowledgeType,
      category: input.topic,
      title: input.title,
      description: input.content,
      summary: input.content.slice(0, 280),
      tags: input.tags ?? [input.topic],
      keywords: [input.topic, ...(input.tags ?? [])],
      source: input.source ?? "local-studio",
      sourceReliability: 70,
      confidenceScore: input.confidence ?? 70,
      qualityScore: input.confidence ?? 70,
      verificationStatus: input.verificationStatus ?? KnowledgeVerificationStatus.Unverified,
      status: KnowledgeRecordStatus.Active,
      payload: {
        topic: input.topic,
        sourceUrl: input.sourceUrl ?? null,
        acquiredAt: new Date().toISOString(),
        ...(input.payload ?? {}),
      },
    };

    const result = await this.knowledgeEngine.storeRecord(recordInput, "persistent-memory-center");
    if (!result.success && result.validation?.code === "duplicate-record") {
      const existingId = this.findDuplicateId(result.validation.message ?? "");
      if (existingId) {
        const updated = await this.knowledgeEngine.updateRecord(
          existingId,
          {
            description: input.content,
            summary: recordInput.summary,
            tags: recordInput.tags,
            keywords: recordInput.keywords,
            confidenceScore: recordInput.confidenceScore,
            payload: recordInput.payload,
          },
          "persistent-memory-center",
        );
        return { ...updated, action: "updated" as const, knowledgeId: existingId };
      }
    }
    return { ...result, action: result.success ? ("created" as const) : ("failed" as const), knowledgeId: result.record?.knowledgeId };
  }

  async searchKnowledge(opts: { text?: string; topic?: string; limit?: number }): Promise<KnowledgeRecord[]> {
    this.ensureReady();
    const limit = Math.min(opts.limit ?? 40, 200);
    const entries = this.knowledgeEngine.getIndexEntries();
    const text = (opts.text ?? "").toLowerCase().trim();
    const topic = (opts.topic ?? "").toLowerCase().trim();
    const filtered = entries.filter((e) => {
      if (topic && !e.category.toLowerCase().includes(topic) && !e.searchableText.includes(topic)) return false;
      if (text && !e.searchableText.includes(text) && !e.title.toLowerCase().includes(text)) return false;
      return true;
    }).slice(0, limit);

    const records: KnowledgeRecord[] = [];
    for (const entry of filtered) {
      const read = await this.knowledgeEngine.getRecord(entry.knowledgeId, "persistent-memory-center");
      if (read.success && read.record) records.push(read.record);
    }
    return records;
  }

  async buildContext(opts: {
    projectId?: string | null;
    task?: string;
    limit?: number;
  }): Promise<MemoryContextPackage> {
    this.ensureReady();
    const projectId = opts.projectId ?? null;
    const limit = opts.limit ?? 12;
    const all = await this.searchMemory({ projectId: projectId ?? undefined, text: opts.task, limit: 80 });
    const knowledge = await this.searchKnowledge({ text: opts.task, limit: 10 });

    const pick = (kind: StudioMemoryKind) =>
      all.filter((r) => r.category === kind || (r.payload as { kind?: string } | undefined)?.kind === kind).slice(0, limit);

    return {
      projectId,
      preferences: pick("USER_PREFERENCE"),
      decisions: pick("AI_DECISION"),
      corrections: pick("AI_CORRECTION"),
      projectMemory: [
        ...pick("PROJECT_MEMORY"),
        ...pick("CREATIVE_MEMORY"),
        ...pick("PRODUCTION_MEMORY"),
      ].slice(0, limit),
      knowledge: knowledge.slice(0, 8),
      builtAt: new Date().toISOString(),
    };
  }

  writeCheckpoint(label: string, data: Record<string, unknown>): { ok: boolean; path: string } {
    this.ensureReady();
    const dir = path.join(this.memoryRoot, "checkpoints");
    fs.mkdirSync(dir, { recursive: true });
    const id = `checkpoint-${label.replace(/[^a-zA-Z0-9_-]+/g, "-")}-${Date.now()}`;
    const filePath = path.join(dir, `${id}.json`);
    const payload = {
      id,
      label,
      createdAt: new Date().toISOString(),
      data,
    };
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
    return { ok: true, path: filePath };
  }

  listCheckpoints(limit = 20): Array<{ id: string; label: string; createdAt: string; path: string }> {
    this.ensureReady();
    const dir = path.join(this.memoryRoot, "checkpoints");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const full = path.join(dir, f);
        try {
          const raw = JSON.parse(fs.readFileSync(full, "utf8")) as { id: string; label: string; createdAt: string };
          return { id: raw.id, label: raw.label, createdAt: raw.createdAt, path: full };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b!.createdAt > a!.createdAt ? 1 : -1))
      .slice(0, limit) as Array<{ id: string; label: string; createdAt: string; path: string }>;
  }

  createBackup(): { ok: boolean; backupId: string; path: string; error?: string } {
    this.ensureReady();
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const backupId = `backup-${stamp}`;
      const dest = path.join(resolveStoragePath(this.storageRoot, "backups"), "persistent-memory-center", backupId);
      fs.mkdirSync(dest, { recursive: true });
      this.copyDirSafe(this.memoryRoot, path.join(dest, "memory"));
      this.copyDirSafe(this.knowledgeRoot, path.join(dest, "knowledge"));
      const configDir = resolveStoragePath(this.storageRoot, "config");
      if (fs.existsSync(configDir)) this.copyDirSafe(configDir, path.join(dest, "config"));
      const manifest = {
        backupId,
        createdAt: new Date().toISOString(),
        storageRoot: this.storageRoot,
        memoryCount: this.memoryEngine.getRecordCount(),
        knowledgeCount: this.knowledgeEngine.getRecordCount(),
        schemaVersion: 1,
      };
      fs.writeFileSync(path.join(dest, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
      this.lastBackupId = backupId;
      return { ok: true, backupId, path: dest };
    } catch (error) {
      return { ok: false, backupId: "", path: "", error: error instanceof Error ? error.message : String(error) };
    }
  }

  restoreBackup(backupId: string, confirm: boolean): { ok: boolean; error?: string; safetyCopy?: string } {
    this.ensureReady();
    if (!confirm) return { ok: false, error: "Restore requires explicit confirm=true" };
    // Prevent path traversal
    if (!/^[a-zA-Z0-9._-]+$/.test(backupId)) {
      return { ok: false, error: "Invalid backup id" };
    }
    const src = path.join(resolveStoragePath(this.storageRoot, "backups"), "persistent-memory-center", backupId);
    const resolved = path.resolve(src);
    const backupsRoot = path.resolve(resolveStoragePath(this.storageRoot, "backups"), "persistent-memory-center");
    if (!resolved.startsWith(backupsRoot + path.sep) && resolved !== backupsRoot) {
      return { ok: false, error: "Invalid backup path" };
    }
    if (!fs.existsSync(path.join(src, "manifest.json"))) {
      return { ok: false, error: `Backup not found: ${backupId}` };
    }
    // Protect current data first
    const safety = this.createBackup();
    if (!safety.ok) return { ok: false, error: `Could not create safety backup before restore: ${safety.error}` };

    this.copyDirSafe(path.join(src, "memory"), this.memoryRoot);
    this.copyDirSafe(path.join(src, "knowledge"), this.knowledgeRoot);
    this.ready = false;
    this.bootError = null;
    return { ok: true, safetyCopy: safety.backupId };
  }

  /** Call after restoreBackup to re-index engines against restored files. */
  async reboundAfterRestore(): Promise<void> {
    this.ready = false;
    await this.boot(this.storageRoot);
  }

  listBackups(): Array<{ backupId: string; createdAt: string; path: string }> {
    const root = path.join(resolveStoragePath(this.storageRoot || resolveStorageRoot(), "backups"), "persistent-memory-center");
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root)
      .map((name) => {
        const full = path.join(root, name);
        const manifestPath = path.join(full, "manifest.json");
        if (!fs.existsSync(manifestPath)) return null;
        try {
          const m = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { backupId: string; createdAt: string };
          return { backupId: m.backupId, createdAt: m.createdAt, path: full };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<{ backupId: string; createdAt: string; path: string }>;
  }

  private async ensureStarterKnowledge(): Promise<void> {
    if (this.knowledgeEngine.getRecordCount() > 0) return;
    const starters = [
      {
        title: "Opening product visibility",
        topic: "Video advertising",
        content: "Short product videos should show the product clearly within the opening seconds.",
        tags: ["video", "advertising", "local-starter"],
      },
      {
        title: "Clear call to action",
        topic: "Marketing",
        content: "End marketing clips with one clear CTA aligned to the audience and platform.",
        tags: ["marketing", "cta", "local-starter"],
      },
      {
        title: "Local-first memory",
        topic: "AI workflow",
        content: "Store confirmed preferences and corrections as durable local memory; do not treat every generation as permanent knowledge.",
        tags: ["workflow", "memory", "local-starter"],
      },
    ];
    for (const item of starters) {
      try {
        await this.saveKnowledge({
          ...item,
          source: "local-starter-pack",
          confidence: 80,
          verificationStatus: KnowledgeVerificationStatus.Verified,
          knowledgeId: undefined,
        });
      } catch {
        /* ignore seed failures */
      }
    }
  }

  private findDuplicateId(message: string): string | null {
    const match = message.match(/existing record:\s*([^\s]+)/i) || message.match(/already exists:\s*([^\s]+)/i);
    return match?.[1] ?? null;
  }

  private copyDirSafe(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    if (!fs.existsSync(src)) return;
    fs.cpSync(src, dest, { recursive: true, force: true });
  }

  private refreshLastBackupId(): void {
    const list = this.listBackups();
    this.lastBackupId = list[0]?.backupId ?? null;
  }

  private ensureReady(): void {
    if (!this.ready) {
      throw new Error(this.bootError ?? "Persistent Memory Center is not ready");
    }
  }
}

export const persistentMemoryCenter = new PersistentMemoryCenter();
