import { MemoryBackupLogger } from "./backup-logger.js";
import { RestorePoint, RestorePointTrigger } from "./types.js";
export declare class RestorePointManager {
    private readonly backupsRoot;
    private readonly logger;
    private pointsPath;
    private points;
    constructor(backupsRoot: string, logger: MemoryBackupLogger);
    initialize(): void;
    create(trigger: RestorePointTrigger, backupId: string, projectId?: string): RestorePoint;
    list(): RestorePoint[];
    getLatest(): RestorePoint | undefined;
    private persist;
}
//# sourceMappingURL=restore-point-manager.d.ts.map