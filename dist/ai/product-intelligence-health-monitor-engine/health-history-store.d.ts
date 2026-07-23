import { ProductIntelligenceHealthHistoryEntry } from "./types.js";
export declare class ProductIntelligenceHealthHistoryStore {
    private historyPath;
    private entries;
    initialize(healthDir: string): void;
    append(entry: ProductIntelligenceHealthHistoryEntry): void;
    getAll(): ProductIntelligenceHealthHistoryEntry[];
    getRecent(count?: number): ProductIntelligenceHealthHistoryEntry[];
    private persist;
}
export declare class ProductIntelligenceTrendAnalyzer {
    analyze(history: ProductIntelligenceHealthHistoryEntry[]): {
        direction: "improving" | "stable" | "declining";
        averageScore: number;
        scoreChange: number;
        warningTrend: number;
        prediction: string;
    };
}
//# sourceMappingURL=health-history-store.d.ts.map