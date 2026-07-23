import { ReasoningRecord } from "./types.js";
export declare class ReasoningHistoryStore {
    private historyPath;
    private readonly records;
    initialize(reasoningDirectory: string): void;
    append(record: ReasoningRecord): void;
    getAll(): ReadonlyArray<ReasoningRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=reasoning-history-store.d.ts.map