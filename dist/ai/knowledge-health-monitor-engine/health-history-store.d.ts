import { KnowledgeHealthHistoryEntry } from "./types.js";
export declare class KnowledgeHealthHistoryStore {
    private historyPath;
    private entries;
    initialize(healthDir: string): void;
    append(entry: KnowledgeHealthHistoryEntry): void;
    getAll(): KnowledgeHealthHistoryEntry[];
    getRecent(count?: number): KnowledgeHealthHistoryEntry[];
    private persist;
}
export declare class KnowledgeTrendAnalyzer {
    analyze(history: KnowledgeHealthHistoryEntry[]): {
        direction: "improving" | "stable" | "declining";
        averageScore: number;
        scoreChange: number;
        warningTrend: number;
        prediction: string;
    };
}
//# sourceMappingURL=health-history-store.d.ts.map