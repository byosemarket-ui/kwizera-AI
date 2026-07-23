import { LearningOutcome, LearningRecord } from "./types.js";
import { LearningHistoryStore } from "./learning-history-store.js";

export class PatternDetector {
  constructor(private readonly history: LearningHistoryStore) {}

  detectPatterns(records: LearningRecord[]): string[] {
    const patterns: string[] = [];
    const titleCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();

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

  findRepeatedMistakes(records: LearningRecord[]): string[] {
    const failures = records.filter((r) => r.outcome === LearningOutcome.Failure);
    const mistakeMap = new Map<string, number>();

    for (const f of failures) {
      const key = f.description.slice(0, 80).toLowerCase();
      mistakeMap.set(key, (mistakeMap.get(key) ?? 0) + 1);
    }

    return [...mistakeMap.entries()]
      .filter(([, count]) => count >= 2)
      .map(([desc]) => `repeat-mistake:${desc.slice(0, 40)}`);
  }
}
