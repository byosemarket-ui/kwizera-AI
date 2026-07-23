import { BackupCompressor } from "./backup-compressor.js";
import { BackupIntegrityValidator } from "./backup-integrity-validator.js";
import { MemoryBackupLogger } from "./backup-logger.js";
import { BackupVersionStore } from "./backup-version-store.js";
import { RestoreMode, RestoreResult } from "./types.js";
export declare class BackupRestorer {
    private readonly storageRoot;
    private readonly backupsRoot;
    private readonly versionStore;
    private readonly validator;
    private readonly compressor;
    private readonly logger;
    constructor(storageRoot: string, backupsRoot: string, versionStore: BackupVersionStore, validator: BackupIntegrityValidator, compressor: BackupCompressor, logger: MemoryBackupLogger);
    findBackupDir(backupId: string): string | null;
    restore(backupId: string, mode?: RestoreMode, pathPrefixes?: string[]): Promise<RestoreResult>;
}
//# sourceMappingURL=backup-restorer.d.ts.map