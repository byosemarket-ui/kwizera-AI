import { ImageGenerationHealthHistoryEntry } from "./types.js";
export declare class ImageGenerationHealthHistoryStore {
    private historyPath;
    private entries;
    initialize(healthDir: string): void;
    append(entry: ImageGenerationHealthHistoryEntry): void;
    getAll(): ImageGenerationHealthHistoryEntry[];
    getRecent(count?: number): ImageGenerationHealthHistoryEntry[];
    private persist;
}
export declare class ImageGenerationTrendAnalyzer {
    analyze(history: ImageGenerationHealthHistoryEntry[]): {
        direction: "improving" | "stable" | "declining";
        averageScore: number;
        scoreChange: number;
        warningTrend: number;
        prediction: string;
    };
}
//# sourceMappingURL=health-history-store.d.ts.map