import { BackupManifest, RetentionTier } from "./types.js";
import { BackupVersionStore } from "./backup-version-store.js";
import { MemoryBackupLogger } from "./backup-logger.js";
export declare class BackupRetentionManager {
    private readonly versionStore;
    private readonly logger;
    constructor(versionStore: BackupVersionStore, logger: MemoryBackupLogger);
    assignRetentionTier(manifest: BackupManifest, isMilestone?: boolean): RetentionTier;
    organizeHistory(): {
        latest: number;
        daily: number;
        weekly: number;
        monthly: number;
        milestone: number;
    };
    private getWeekKey;
}
//# sourceMappingURL=backup-retention-manager.d.ts.map