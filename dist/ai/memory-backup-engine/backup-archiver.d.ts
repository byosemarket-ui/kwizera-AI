import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { BackupCompressor } from "./backup-compressor.js";
import { BackupIntegrityValidator } from "./backup-integrity-validator.js";
import { MemoryBackupLogger } from "./backup-logger.js";
import { BackupRetentionManager } from "./backup-retention-manager.js";
import { BackupSourceScanner } from "./backup-source-scanner.js";
import { BackupVersionStore } from "./backup-version-store.js";
import { BackupCreateResult, BackupSource, BackupType } from "./types.js";
export interface CreateBackupOptions {
    projectId?: string;
    sources?: BackupSource[];
    compress?: boolean;
    isMilestone?: boolean;
    sinceTimestamp?: string;
}
export declare class BackupArchiver {
    private readonly foundation;
    private readonly storageRoot;
    private readonly backupsRoot;
    private readonly scanner;
    private readonly compressor;
    private readonly validator;
    private readonly versionStore;
    private readonly retentionManager;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, storageRoot: string, backupsRoot: string, scanner: BackupSourceScanner, compressor: BackupCompressor, validator: BackupIntegrityValidator, versionStore: BackupVersionStore, retentionManager: BackupRetentionManager, logger: MemoryBackupLogger);
    createBackup(backupType: BackupType, options?: CreateBackupOptions): Promise<BackupCreateResult>;
}
//# sourceMappingURL=backup-archiver.d.ts.map