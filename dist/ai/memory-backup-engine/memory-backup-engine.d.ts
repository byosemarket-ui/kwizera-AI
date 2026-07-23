import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryBackupLogger } from "./backup-logger.js";
import { BackupVersionStore } from "./backup-version-store.js";
import { BackupCreateResult, BackupManifest, BackupSchedule, BackupSource, BackupType, MemoryBackupValidationResult, MemoryBackupStatusReport, RestoreMode, RestorePoint, RestorePointTrigger, RestoreResult } from "./types.js";
/**
 * Memory Backup Engine — protects every important memory in KWIZERA AI STUDIO.
 */
export declare class AiMemoryBackupEngine {
    private foundation;
    private storageRoot;
    private backupsRoot;
    private initialized;
    private startupComplete;
    readonly logger: MemoryBackupLogger;
    readonly versionStore: BackupVersionStore;
    private scanner;
    private compressor;
    private validator;
    private retentionManager;
    private archiver;
    private restorer;
    private restorePoints;
    private scheduler;
    private backupTimes;
    private validationTimes;
    private compressionRatios;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createManualBackup(projectId?: string): Promise<BackupCreateResult>;
    createAutomaticBackup(): Promise<BackupCreateResult>;
    createFullBackup(projectId?: string): Promise<BackupCreateResult>;
    createIncrementalBackup(): Promise<BackupCreateResult>;
    createRestorePointBackup(trigger: RestorePointTrigger, projectId?: string): Promise<RestorePoint>;
    runScheduledBackup(): Promise<BackupCreateResult | null>;
    createBackup(backupType: BackupType, options?: {
        projectId?: string;
        sources?: BackupSource[];
        compress?: boolean;
        isMilestone?: boolean;
        sinceTimestamp?: string;
    }): Promise<BackupCreateResult>;
    validateBackup(backupId: string): MemoryBackupValidationResult;
    restore(backupId: string, mode?: RestoreMode, pathPrefixes?: string[]): Promise<RestoreResult>;
    getVersionHistory(): BackupManifest[];
    listBackups(): BackupManifest[];
    getSchedule(): BackupSchedule;
    updateSchedule(updates: Partial<BackupSchedule>): BackupSchedule;
    listRestorePoints(): RestorePoint[];
    organizeRetention(): {
        latest: number;
        daily: number;
        weekly: number;
        monthly: number;
        milestone: number;
    };
    getBackupsRoot(): string;
    buildStatusReport(): MemoryBackupStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=memory-backup-engine.d.ts.map