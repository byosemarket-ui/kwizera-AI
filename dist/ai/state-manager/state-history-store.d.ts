import { StateHistoryRecord } from "./types.js";
export declare class StateHistoryStore {
    private historyPath;
    private readonly records;
    initialize(stateDirectory: string): void;
    append(record: StateHistoryRecord): void;
    getRecords(): ReadonlyArray<StateHistoryRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=state-history-store.d.ts.map