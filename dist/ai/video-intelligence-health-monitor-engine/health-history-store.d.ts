import { VideoIntelligenceHealthHistoryEntry } from "./types.js";
export declare class VideoIntelligenceHealthHistoryStore {
    private historyPath;
    private entries;
    initialize(healthDir: string): void;
    append(entry: VideoIntelligenceHealthHistoryEntry): void;
    getAll(): VideoIntelligenceHealthHistoryEntry[];
    getRecent(count?: number): VideoIntelligenceHealthHistoryEntry[];
    private persist;
}
export declare class VideoIntelligenceTrendAnalyzer {
    analyze(history: VideoIntelligenceHealthHistoryEntry[]): {
        direction: "improving" | "stable" | "declining";
        averageScore: number;
        scoreChange: number;
        warningTrend: number;
        prediction: string;
    };
}
//# sourceMappingURL=health-history-store.d.ts.map