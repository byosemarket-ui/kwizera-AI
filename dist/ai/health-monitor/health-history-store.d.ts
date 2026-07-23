import { HealthHistoryRecord } from "./types.js";
export declare class HealthHistoryStore {
    private historyPath;
    private readonly records;
    initialize(healthDirectory: string): void;
    append(record: HealthHistoryRecord): void;
    getRecords(): ReadonlyArray<HealthHistoryRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
    getPerformanceTrends(): Array<{
        timestamp: string;
        score: number;
    }>;
}
//# sourceMappingURL=health-history-store.d.ts.map