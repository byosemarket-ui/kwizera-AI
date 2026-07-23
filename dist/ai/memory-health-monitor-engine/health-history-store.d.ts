import { HealthHistoryEntry } from "./types.js";
export declare class HealthHistoryStore {
    private historyPath;
    private entries;
    initialize(healthDir: string): void;
    append(entry: HealthHistoryEntry): void;
    getAll(): HealthHistoryEntry[];
    getRecent(count?: number): HealthHistoryEntry[];
    private persist;
}
export declare class TrendAnalyzer {
    analyze(history: HealthHistoryEntry[]): {
        direction: "improving" | "stable" | "declining";
        averageScore: number;
        scoreChange: number;
        warningTrend: number;
        prediction: string;
    };
}
//# sourceMappingURL=health-history-store.d.ts.map