import { StateManagerLogger } from "./state-logger.js";
import { StateSnapshotStore } from "./state-snapshot-store.js";
import { ApplicationStateSnapshot, AutoSaveTrigger } from "./types.js";
export declare class StateAutoSave {
    private readonly logger;
    private readonly snapshots;
    private readonly triggers;
    private autoSaveCount;
    constructor(logger: StateManagerLogger, snapshots: StateSnapshotStore);
    trigger(trigger: AutoSaveTrigger, state: ApplicationStateSnapshot): void;
    getTriggeredCount(): number;
    getActiveTriggers(): AutoSaveTrigger[];
    supports(trigger: AutoSaveTrigger): boolean;
}
//# sourceMappingURL=state-auto-save.d.ts.map