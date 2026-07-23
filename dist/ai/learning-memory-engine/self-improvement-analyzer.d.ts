import { LearningRecord, SelfImprovementInsight } from "./types.js";
import { PatternDetector } from "./pattern-detector.js";
import { LearningHistoryStore } from "./learning-history-store.js";
import { PreferenceStore } from "./preference-store.js";
export declare class SelfImprovementAnalyzer {
    private readonly history;
    private readonly patterns;
    private readonly preferences;
    constructor(history: LearningHistoryStore, patterns: PatternDetector, preferences: PreferenceStore);
    analyze(): SelfImprovementInsight;
    computeAccuracy(records: LearningRecord[]): number;
}
//# sourceMappingURL=self-improvement-analyzer.d.ts.map