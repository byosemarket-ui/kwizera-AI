import { MemoryFoundationLogger } from "./memory-logger.js";
import { MemoryStorageManager } from "./memory-storage.js";
export declare class MemoryBackupManager {
    private readonly logger;
    constructor(logger: MemoryFoundationLogger);
    createBackup(storage: MemoryStorageManager, label: string): {
        backupPath: string;
        durationMs: number;
    };
    listBackups(storage: MemoryStorageManager): string[];
}
//# sourceMappingURL=memory-backup-manager.d.ts.map