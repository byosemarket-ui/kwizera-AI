import { DecisionRecord } from "./types.js";
export declare class DecisionHistoryStore {
    private historyPath;
    private readonly records;
    initialize(decisionsDirectory: string): void;
    append(record: DecisionRecord): void;
    getAll(): ReadonlyArray<DecisionRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=decision-history-store.d.ts.map