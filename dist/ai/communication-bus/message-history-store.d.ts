import { BusMessageHistoryRecord } from "./types.js";
export declare class MessageHistoryStore {
    private historyPath;
    private readonly records;
    initialize(communicationsDirectory: string): void;
    append(record: BusMessageHistoryRecord): void;
    getRecords(): ReadonlyArray<BusMessageHistoryRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=message-history-store.d.ts.map