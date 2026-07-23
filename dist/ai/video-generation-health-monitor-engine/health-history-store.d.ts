import { VideoGenerationHealthHistoryEntry } from "./types.js";
export declare class VideoGenerationHealthHistoryStore {
    private historyPath;
    private entries;
    initialize(healthDir: string): void;
    append(entry: VideoGenerationHealthHistoryEntry): void;
    getAll(): VideoGenerationHealthHistoryEntry[];
    getRecent(count?: number): VideoGenerationHealthHistoryEntry[];
    private persist;
}
export declare class VideoGenerationTrendAnalyzer {
    analyze(history: VideoGenerationHealthHistoryEntry[]): {
        direction: "improving" | "stable" | "declining";
        averageScore: number;
        scoreChange: number;
        warningTrend: number;
        prediction: string;
    };
}
//# sourceMappingURL=health-history-store.d.ts.map