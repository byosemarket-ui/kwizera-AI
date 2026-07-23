import { StateManagerLogger } from "./state-logger.js";
import { StateSnapshotStore } from "./state-snapshot-store.js";
import { ApplicationStateSnapshot, StateSnapshot } from "./types.js";
export interface RecoveryResult {
    recovered: boolean;
    snapshotId?: string;
    message: string;
    unfinishedWorkflows: string[];
    unfinishedTasks: string[];
}
export declare class StateRecovery {
    private readonly snapshots;
    private readonly logger;
    constructor(snapshots: StateSnapshotStore, logger: StateManagerLogger);
    recoverFromUnexpectedShutdown(snapshot: StateSnapshot, target: ApplicationStateSnapshot): RecoveryResult;
    wasUncleanShutdown(snapshot: StateSnapshot | null): boolean;
}
//# sourceMappingURL=state-recovery.d.ts.map