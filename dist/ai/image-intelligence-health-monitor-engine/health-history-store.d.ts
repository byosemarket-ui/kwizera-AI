import { ImageIntelligenceHealthHistoryEntry } from "./types.js";
export declare class ImageIntelligenceHealthHistoryStore {
    private historyPath;
    private entries;
    initialize(healthDir: string): void;
    append(entry: ImageIntelligenceHealthHistoryEntry): void;
    getAll(): ImageIntelligenceHealthHistoryEntry[];
    getRecent(count?: number): ImageIntelligenceHealthHistoryEntry[];
    private persist;
}
export declare class ImageIntelligenceTrendAnalyzer {
    analyze(history: ImageIntelligenceHealthHistoryEntry[]): {
        direction: "improving" | "stable" | "declining";
        averageScore: number;
        scoreChange: number;
        warningTrend: number;
        prediction: string;
    };
}
//# sourceMappingURL=health-history-store.d.ts.map