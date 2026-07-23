import { StateManagerLogger } from "./state-logger.js";
import { StateSnapshotStore } from "./state-snapshot-store.js";
import { ApplicationStateSnapshot, RestorationResult, StateSnapshot } from "./types.js";
export declare class StateRestoration {
    private readonly snapshots;
    private readonly logger;
    constructor(snapshots: StateSnapshotStore, logger: StateManagerLogger);
    restore(snapshot: StateSnapshot, target: ApplicationStateSnapshot): RestorationResult;
    findRestorableSnapshot(): StateSnapshot | null;
}
//# sourceMappingURL=state-restoration.d.ts.map