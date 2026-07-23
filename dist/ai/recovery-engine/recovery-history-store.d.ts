import { RecoveryHistoryRecord } from "./types.js";
export declare class RecoveryHistoryStore {
    private historyPath;
    private readonly records;
    initialize(recoveryDirectory: string): void;
    append(record: RecoveryHistoryRecord): void;
    getRecords(): ReadonlyArray<RecoveryHistoryRecord>;
    getCount(): number;
    getSuccessRate(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=recovery-history-store.d.ts.map