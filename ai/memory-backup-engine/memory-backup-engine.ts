import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { BackupArchiver } from "./backup-archiver.js";
import { BackupCompressor } from "./backup-compressor.js";
import { BackupIntegrityValidator } from "./backup-integrity-validator.js";
import { MemoryBackupLogger } from "./backup-logger.js";
import { BackupRestorer } from "./backup-restorer.js";
import { BackupRetentionManager } from "./backup-retention-manager.js";
import { BackupScheduler } from "./backup-scheduler.js";
import { BackupSourceScanner } from "./backup-source-scanner.js";
import { BackupVersionStore } from "./backup-version-store.js";
import { RestorePointManager } from "./restore-point-manager.js";
import {
  BackupCreateResult,
  BackupManifest,
  BackupSchedule,
  BackupSource,
  BackupType,
  MemoryBackupValidationResult,
  MemoryBackupEngineError,
  MemoryBackupStatusReport,
  RestoreMode,
  RestorePoint,
  RestorePointTrigger,
  RestoreResult,
} from "./types.js";

/**
 * Memory Backup Engine — protects every important memory in KWIZERA AI STUDIO.
 */
export class AiMemoryBackupEngine {
  private foundation: AiMemoryFoundation | null = null;
  private storageRoot = "";
  private backupsRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new MemoryBackupLogger();
  readonly versionStore = new BackupVersionStore();

  private scanner: BackupSourceScanner | null = null;
  private compressor: BackupCompressor | null = null;
  private validator: BackupIntegrityValidator | null = null;
  private retentionManager: BackupRetentionManager | null = null;
  private archiver: BackupArchiver | null = null;
  private restorer: BackupRestorer | null = null;
  private restorePoints: RestorePointManager | null = null;
  private scheduler: BackupScheduler | null = null;

  private backupTimes: number[] = [];
  private validationTimes: number[] = [];
  private compressionRatios: number[] = [];

  initialize(foundation: AiMemoryFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.backupsRoot = resolveStoragePath(storageRoot, "backups");

    fs.mkdirSync(this.backupsRoot, { recursive: true });

    const logDir = path.join(storageRoot, "logs");
    this.logger.initialize(logDir);
    this.versionStore.initialize(this.backupsRoot);

    this.scanner = new BackupSourceScanner(storageRoot);
    this.compressor = new BackupCompressor(this.logger);
    this.validator = new BackupIntegrityValidator(foundation, this.logger);
    this.retentionManager = new BackupRetentionManager(this.versionStore, this.logger);
    this.archiver = new BackupArchiver(
      foundation,
      storageRoot,
      this.backupsRoot,
      this.scanner,
      this.compressor,
      this.validator,
      this.versionStore,
      this.retentionManager,
      this.logger
    );
    this.restorer = new BackupRestorer(
      storageRoot,
      this.backupsRoot,
      this.versionStore,
      this.validator,
      this.compressor,
      this.logger
    );
    this.restorePoints = new RestorePointManager(this.backupsRoot, this.logger);
    this.restorePoints.initialize();
    this.scheduler = new BackupScheduler(this.backupsRoot, this.logger);
    this.scheduler.initialize();

    this.initialized = true;
    this.logger.log("info", "startup", "Memory Backup Engine initialized", {
      storageRoot,
      backupsRoot: this.backupsRoot,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    try {
      await this.createAutomaticBackup();
    } catch (error) {
      this.logger.log("warn", "create", "Startup automatic backup deferred", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    if (this.scheduler!.isDue()) {
      await this.runScheduledBackup();
    }

    this.startupComplete = true;
    this.logger.log("info", "startup", "Memory Backup Engine startup complete", {
      totalBackups: this.versionStore.getAll().length,
      durationMs: Date.now() - start,
    });
  }

  async createManualBackup(projectId?: string): Promise<BackupCreateResult> {
    return this.createBackup(BackupType.Manual, { projectId, compress: true });
  }

  async createAutomaticBackup(): Promise<BackupCreateResult> {
    return this.createBackup(BackupType.Automatic, { compress: true });
  }

  async createFullBackup(projectId?: string): Promise<BackupCreateResult> {
    return this.createBackup(BackupType.Full, { projectId, compress: true });
  }

  async createIncrementalBackup(): Promise<BackupCreateResult> {
    const latest = this.versionStore.getLatest();
    return this.createBackup(BackupType.Incremental, {
      compress: true,
      sinceTimestamp: latest?.createdAt,
    });
  }

  async createRestorePointBackup(
    trigger: RestorePointTrigger,
    projectId?: string
  ): Promise<RestorePoint> {
    const typeMap: Partial<Record<RestorePointTrigger, BackupType>> = {
      [RestorePointTrigger.BeforeUpdate]: BackupType.PreUpdate,
      [RestorePointTrigger.BeforeOptimization]: BackupType.PreOptimization,
      [RestorePointTrigger.BeforeMigration]: BackupType.Recovery,
      [RestorePointTrigger.BeforeConfigurationChange]: BackupType.PreUpdate,
      [RestorePointTrigger.BeforeAiEngineChange]: BackupType.PreUpdate,
      [RestorePointTrigger.BeforeMajorProjectChange]: BackupType.Recovery,
    };

    const result = await this.createBackup(typeMap[trigger] ?? BackupType.Recovery, {
      projectId,
      compress: true,
    });

    if (!result.success) {
      throw new MemoryBackupEngineError("Failed to create restore point backup", "RESTORE_POINT_FAILED");
    }

    return this.restorePoints!.create(trigger, result.backupId, projectId);
  }

  async runScheduledBackup(): Promise<BackupCreateResult | null> {
    if (!this.scheduler!.isDue()) return null;

    const schedule = this.scheduler!.getSchedule();
    const result = await this.createBackup(schedule.backupType, { compress: true });
    if (result.success) {
      this.scheduler!.markRun();
    }
    return result;
  }

  async createBackup(
    backupType: BackupType,
    options: {
      projectId?: string;
      sources?: BackupSource[];
      compress?: boolean;
      isMilestone?: boolean;
      sinceTimestamp?: string;
    } = {}
  ): Promise<BackupCreateResult> {
    this.ensureReady();
    const start = Date.now();

    const result = await this.archiver!.createBackup(backupType, options);
    this.backupTimes.push(result.durationMs);
    this.validationTimes.push(Date.now() - start - result.durationMs);

    if (result.manifest.totalSizeBytes > 0) {
      const ratio = this.compressor!.getCompressionRatio(
        result.manifest.totalSizeBytes,
        result.manifest.compressedSizeBytes
      );
      this.compressionRatios.push(ratio);
    }

    if (!result.success) {
      throw new MemoryBackupEngineError(
        `Backup validation failed: ${result.validation.diagnostics.join("; ")}`,
        "BACKUP_REJECTED"
      );
    }

    return result;
  }

  validateBackup(backupId: string): MemoryBackupValidationResult {
    this.ensureReady();
    const manifest = this.versionStore.getById(backupId);
    if (!manifest) {
      return {
        valid: false,
        fileIntegrity: false,
        databaseIntegrity: false,
        memoryIntegrity: false,
        relationshipIntegrity: false,
        configurationIntegrity: false,
        completeness: false,
        diagnostics: ["Backup not found"],
      };
    }

    const backupDir = this.restorer!.findBackupDir(backupId);
    if (!backupDir) {
      return {
        valid: false,
        fileIntegrity: false,
        databaseIntegrity: false,
        memoryIntegrity: false,
        relationshipIntegrity: false,
        configurationIntegrity: false,
        completeness: false,
        diagnostics: ["Backup directory not found"],
      };
    }

    const start = Date.now();
    const result = this.validator!.validate(manifest, backupDir);
    this.validationTimes.push(Date.now() - start);
    return result;
  }

  async restore(backupId: string, mode: RestoreMode = RestoreMode.Full, pathPrefixes?: string[]): Promise<RestoreResult> {
    this.ensureReady();
    return this.restorer!.restore(backupId, mode, pathPrefixes);
  }

  getVersionHistory(): BackupManifest[] {
    this.ensureReady();
    return this.versionStore.getAll();
  }

  listBackups(): BackupManifest[] {
    return this.getVersionHistory();
  }

  getSchedule(): BackupSchedule {
    this.ensureReady();
    return this.scheduler!.getSchedule();
  }

  updateSchedule(updates: Partial<BackupSchedule>): BackupSchedule {
    this.ensureReady();
    return this.scheduler!.updateSchedule(updates);
  }

  listRestorePoints(): RestorePoint[] {
    this.ensureReady();
    return this.restorePoints!.list();
  }

  organizeRetention() {
    this.ensureReady();
    return this.retentionManager!.organizeHistory();
  }

  getBackupsRoot(): string {
    return this.backupsRoot;
  }

  buildStatusReport(): MemoryBackupStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    const all = this.versionStore.getAll();
    const latest = all[0];
    const validated = all.filter((m) => m.validated).length;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      backupIntegrity: all.length > 0 ? `${validated}/${all.length} backups validated` : "no backups yet",
      restoreReadiness: latest?.validated ? "ready" : "awaiting validated backup",
      versionHistoryStatus: `${all.length} version(s) in history`,
      totalBackups: all.length,
      latestBackupId: latest?.backupId,
      performance: {
        averageBackupMs: avg(this.backupTimes),
        averageValidationMs: avg(this.validationTimes),
        averageCompressionRatio: avg(this.compressionRatios),
        lastBackupMs: this.backupTimes[this.backupTimes.length - 1] ?? 0,
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new MemoryBackupEngineError(
        "Memory Backup Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
