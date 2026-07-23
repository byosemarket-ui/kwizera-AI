import { StateManagerLogger } from "./state-logger.js";
import { ApplicationStateSnapshot, StateSnapshot } from "./types.js";
export declare class StateSnapshotStore {
    private readonly logger;
    private stateDirectory;
    private snapshotsDirectory;
    private currentStatePath;
    private readonly snapshots;
    private diskWrites;
    constructor(logger: StateManagerLogger);
    initialize(stateDirectory: string): void;
    saveSnapshot(snapshot: StateSnapshot): void;
    loadLatestSnapshot(): StateSnapshot | null;
    loadLatestFromSnapshotsDirectory(): StateSnapshot | null;
    getSnapshots(): ReadonlyArray<StateSnapshot>;
    getSnapshotCount(): number;
    getDiskWrites(): number;
    getStateDirectory(): string | null;
    persistCurrentState(state: ApplicationStateSnapshot, cleanShutdown: boolean): void;
}
//# sourceMappingURL=state-snapshot-store.d.ts.map