import { MemoryBackupLogger } from "./backup-logger.js";
import { BackupSchedule } from "./types.js";
export declare class BackupScheduler {
    private readonly backupsRoot;
    private readonly logger;
    private schedulePath;
    private schedule;
    constructor(backupsRoot: string, logger: MemoryBackupLogger);
    initialize(): void;
    getSchedule(): BackupSchedule;
    updateSchedule(updates: Partial<BackupSchedule>): BackupSchedule;
    isDue(): boolean;
    markRun(): void;
    private persist;
}
//# sourceMappingURL=backup-scheduler.d.ts.map