import { LearningOutcome } from "./types.js";
export class PatternDetector {
    history;
    constructor(history) {
        this.history = history;
    }
    detectPatterns(records) {
        const patterns = [];
        const titleCounts = new Map();
        const sourceCounts = new Map();
        for (const record of records) {
            const key = record.source;
            sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
            for (const tag of record.patterns) {
                titleCounts.set(tag, (titleCounts.get(tag) ?? 0) + 1);
            }
        }
        for (const [source, count] of sourceCounts) {
            if (count >= 2) {
                patterns.push(`repeated-source:${source}(${count})`);
            }
        }
        for (const [pattern, count] of titleCounts) {
            if (count >= 2) {
                patterns.push(`repeated-pattern:${pattern}(${count})`);
            }
        }
        return patterns;
    }
    findRepeatedMistakes(records) {
        const failures = records.filter((r) => r.outcome === LearningOutcome.Failure);
        const mistakeMap = new Map();
        for (const f of failures) {
            const key = f.description.slice(0, 80).toLowerCase();
            mistakeMap.set(key, (mistakeMap.get(key) ?? 0) + 1);
        }
        return [...mistakeMap.entries()]
            .filter(([, count]) => count >= 2)
            .map(([desc]) => `repeat-mistake:${desc.slice(0, 40)}`);
    }
}
//# sourceMappingURL=pattern-detector.js.map