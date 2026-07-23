import { RecoveryHistoryEntry } from "./types.js";
export declare class RecoveryHistoryStore {
    private historyPath;
    private entries;
    initialize(recoveryDir: string): void;
    append(entry: RecoveryHistoryEntry): void;
    getAll(): RecoveryHistoryEntry[];
    getSuccessRate(): number;
    private persist;
}
//# sourceMappingURL=recovery-history-store.d.ts.map