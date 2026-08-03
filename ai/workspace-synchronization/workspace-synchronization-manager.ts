import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  WorkspaceBackupResult,
  WorkspaceCloudConfiguration,
  WorkspaceSyncConflict,
  WorkspaceSyncEntry,
  WorkspaceSyncQueueItem,
  WorkspaceSyncScope,
  WorkspaceSynchronizationDependencies,
  WorkspaceSynchronizationStatus,
} from "./types.js";

interface WorkspaceSynchronizationStore {
  version: 1;
  cloud: WorkspaceCloudConfiguration;
  baseline: Record<string, WorkspaceSyncEntry>;
  queue: WorkspaceSyncQueueItem[];
  conflicts: WorkspaceSyncConflict[];
  workspaceBackups: Record<string, string[]>;
  lastInventoryAt: string | null;
  lastBackupAt: string | null;
}

const DEFAULT_STORE: WorkspaceSynchronizationStore = {
  version: 1,
  cloud: { enabled: false, connectorId: null },
  baseline: {},
  queue: [],
  conflicts: [],
  workspaceBackups: {},
  lastInventoryAt: null,
  lastBackupAt: null,
};

const SCOPES: Array<{ directory: string; scope: WorkspaceSyncScope }> = [
  { directory: "creative-workspace", scope: "creative-workspace" },
  { directory: "config", scope: "config" },
  { directory: "database", scope: "database" },
  { directory: "projects", scope: "projects" },
  { directory: "exports", scope: "exports" },
  { directory: "media", scope: "media" },
  { directory: "memory", scope: "memory" },
  { directory: "knowledge", scope: "knowledge" },
  { directory: "product-intelligence", scope: "intelligence" },
  { directory: "image-intelligence", scope: "intelligence" },
  { directory: "video-intelligence", scope: "intelligence" },
  { directory: "state", scope: "state" },
  { directory: "learning", scope: "learning" },
];

const DESKTOP_PERMISSIONS = ["filesystem.read", "filesystem.write", "project.access"];

/** Coordinates local workspace revisions; cloud transport remains explicitly opt-in. */
export class WorkspaceSynchronizationManager {
  private root = "";
  private statePath = "";
  private initialized = false;
  private store: WorkspaceSynchronizationStore = structuredClone(DEFAULT_STORE);

  constructor(private readonly dependencies: WorkspaceSynchronizationDependencies = {}) {}

  async initialize(storageRoot: string): Promise<void> {
    this.root = path.resolve(storageRoot);
    const syncRoot = path.join(this.root, "workspace-synchronization");
    await fs.mkdir(syncRoot, { recursive: true });
    this.statePath = path.join(syncRoot, "state.json");
    this.store = await this.readStore();
    this.initialized = true;
    await this.persist();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getStatus(): WorkspaceSynchronizationStatus {
    this.ensureReady();
    const cloudState = !this.store.cloud.enabled
      ? "disabled"
      : !this.store.cloud.connectorId
        ? "not-configured"
        : "provider-adapter-required";
    return {
      initialized: true,
      localSourceOfTruth: true,
      cloud: { ...this.store.cloud, state: cloudState },
      trackedFiles: Object.keys(this.store.baseline).length,
      queuedChanges: this.store.queue.length,
      unresolvedConflicts: this.store.conflicts.length,
      lastInventoryAt: this.store.lastInventoryAt,
      lastBackupAt: this.store.lastBackupAt,
    };
  }

  getQueuedChanges(): WorkspaceSyncQueueItem[] {
    this.ensureReady();
    return structuredClone(this.store.queue);
  }

  getConflicts(): WorkspaceSyncConflict[] {
    this.ensureReady();
    return structuredClone(this.store.conflicts);
  }

  async configureCloud(configuration: WorkspaceCloudConfiguration): Promise<void> {
    this.ensureReady();
    if (configuration.enabled && !configuration.connectorId?.trim()) {
      throw new Error("An enabled cloud configuration requires an approved connector id");
    }
    this.store.cloud = { enabled: configuration.enabled, connectorId: configuration.connectorId?.trim() || null };
    await this.persist();
  }

  async snapshotLocalWorkspace(): Promise<WorkspaceSyncEntry[]> {
    this.ensureReady();
    const entries = await this.inventory();
    const current = Object.fromEntries(entries.map((entry) => [entry.path, entry]));

    for (const entry of entries) {
      const previous = this.store.baseline[entry.path];
      if (!previous || previous.checksum !== entry.checksum) this.queue(entry, "local-change");
    }
    for (const previousPath of Object.keys(this.store.baseline)) {
      if (!current[previousPath]) this.queue({ ...this.store.baseline[previousPath], checksum: "deleted" }, "local-change");
    }

    this.store.baseline = current;
    this.store.lastInventoryAt = new Date().toISOString();
    await this.persist();
    return entries;
  }

  async detectRemoteConflict(remote: Pick<WorkspaceSyncEntry, "path" | "checksum">): Promise<WorkspaceSyncConflict | null> {
    this.ensureReady();
    const local = this.store.baseline[normalizeRelativePath(remote.path)];
    if (!local || local.checksum === remote.checksum) return null;
    const conflict: WorkspaceSyncConflict = {
      id: randomUUID(),
      path: local.path,
      localChecksum: local.checksum,
      remoteChecksum: remote.checksum,
      detectedAt: new Date().toISOString(),
      resolution: "local-wins-pending-upload",
    };
    this.store.conflicts.unshift(conflict);
    this.store.conflicts.splice(100);
    this.queue(local, "conflict-local-wins");
    await this.persist();
    return structuredClone(conflict);
  }

  async synchronize(): Promise<{ synchronized: false; reason: string; queuedChanges: number }> {
    this.ensureReady();
    await this.snapshotLocalWorkspace();
    const reason = !this.store.cloud.enabled
      ? "Cloud synchronization is disabled; local changes remain queued"
      : "A provider-specific cloud synchronization adapter is required";
    return { synchronized: false, reason, queuedChanges: this.store.queue.length };
  }

  async createBackup(): Promise<WorkspaceBackupResult> {
    this.ensureReady();
    await this.snapshotLocalWorkspace();
    const diagnostics: string[] = [];
    let backupId: string | null = null;
    let workspaceCopyCreated = false;

    if (this.dependencies.backup) {
      const backup = await this.dependencies.backup.createManualBackup();
      if (backup.success) backupId = backup.backupId;
      else diagnostics.push("Memory Backup Engine did not create a validated archive");
    } else diagnostics.push("Memory Backup Engine is unavailable");

    if (this.dependencies.desktop) {
      const copies = await Promise.all(SCOPES.map(async ({ directory }) => {
        const backup = await this.dependencies.desktop!.backup("studio", directory, "backup", DESKTOP_PERMISSIONS);
        return backup?.id ?? null;
      }));
      this.store.workspaceBackups[backupId ?? randomUUID()] = copies.filter((id): id is string => id !== null);
      workspaceCopyCreated = copies.some((id) => id !== null);
    } else diagnostics.push("Desktop Integration workspace-copy backup is unavailable");

    this.store.lastBackupAt = new Date().toISOString();
    await this.persist();
    return { backupId, archiveCreated: backupId !== null, workspaceCopyCreated, diagnostics };
  }

  async restoreBackup(backupId: string): Promise<{ restored: boolean; diagnostics: string[] }> {
    this.ensureReady();
    const diagnostics: string[] = [];
    let restored = false;
    if (this.dependencies.backup) {
      const result = await this.dependencies.backup.restore(backupId, "selective", ["config", "database", "projects", "memory", "knowledge", "media", "exports"]);
      restored = result.success;
      diagnostics.push(...result.diagnostics);
    } else diagnostics.push("Memory Backup Engine is unavailable");

    const workspaceBackupIds = this.store.workspaceBackups[backupId] ?? [];
    if (workspaceBackupIds.length > 0 && this.dependencies.desktop) {
      for (const workspaceBackupId of workspaceBackupIds) {
        await this.dependencies.desktop.recoverBackup(workspaceBackupId, DESKTOP_PERMISSIONS);
      }
      restored = true;
    } else if (workspaceBackupIds.length === 0) diagnostics.push("No workspace copies are associated with this archive");
    return { restored, diagnostics };
  }

  private async inventory(): Promise<WorkspaceSyncEntry[]> {
    const entries: WorkspaceSyncEntry[] = [];
    for (const mapping of SCOPES) {
      const directory = path.join(this.root, mapping.directory);
      await this.collect(directory, mapping.scope, entries);
    }
    return entries.sort((left, right) => left.path.localeCompare(right.path));
  }

  private async collect(directory: string, scope: WorkspaceSyncScope, entries: WorkspaceSyncEntry[]): Promise<void> {
    let children: import("node:fs").Dirent[];
    try { children = await fs.readdir(directory, { withFileTypes: true }); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const child of children) {
      const candidate = path.join(directory, child.name);
      if (child.isSymbolicLink()) continue;
      if (child.isDirectory()) await this.collect(candidate, scope, entries);
      else if (child.isFile()) {
        const [contents, stats] = await Promise.all([fs.readFile(candidate), fs.stat(candidate)]);
        entries.push({
          path: normalizeRelativePath(path.relative(this.root, candidate)),
          scope,
          checksum: createHash("sha256").update(contents).digest("hex"),
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        });
      }
    }
  }

  private queue(entry: WorkspaceSyncEntry, reason: WorkspaceSyncQueueItem["reason"]): void {
    const existing = this.store.queue.find((item) => item.path === entry.path);
    const item = { id: existing?.id ?? randomUUID(), path: entry.path, checksum: entry.checksum, queuedAt: new Date().toISOString(), reason };
    if (existing) Object.assign(existing, item);
    else this.store.queue.unshift(item);
  }

  private async readStore(): Promise<WorkspaceSynchronizationStore> {
    try {
      const saved = JSON.parse(await fs.readFile(this.statePath, "utf8")) as Partial<WorkspaceSynchronizationStore>;
      const workspaceBackups = Object.fromEntries(Object.entries(saved.workspaceBackups ?? {}).map(([backupId, value]) => [backupId, Array.isArray(value) ? value : value ? [value] : []]));
      return { ...structuredClone(DEFAULT_STORE), ...saved, cloud: { ...DEFAULT_STORE.cloud, ...saved.cloud }, baseline: saved.baseline ?? {}, queue: saved.queue ?? [], conflicts: saved.conflicts ?? [], workspaceBackups };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(DEFAULT_STORE);
      throw error;
    }
  }

  private async persist(): Promise<void> {
    const temporary = `${this.statePath}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
    await fs.rename(temporary, this.statePath);
  }

  private ensureReady(): void {
    if (!this.initialized) throw new Error("Workspace Synchronization Manager is not initialized");
  }
}

function normalizeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => part === "..")) throw new Error("Workspace synchronization path is invalid");
  return normalized;
}