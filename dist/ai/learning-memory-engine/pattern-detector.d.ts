import { LearningRecord } from "./types.js";
import { LearningHistoryStore } from "./learning-history-store.js";
export declare class PatternDetector {
    private readonly history;
    constructor(history: LearningHistoryStore);
    detectPatterns(records: LearningRecord[]): string[];
    findRepeatedMistakes(records: LearningRecord[]): string[];
}
//# sourceMappingURL=pattern-detector.d.ts.map