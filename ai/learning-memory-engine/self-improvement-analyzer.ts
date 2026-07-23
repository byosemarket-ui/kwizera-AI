import { LearningOutcome, LearningRecord, SelfImprovementInsight } from "./types.js";
import { UserPreferences } from "./types.js";
import { PatternDetector } from "./pattern-detector.js";
import { LearningHistoryStore } from "./learning-history-store.js";
import { PreferenceStore } from "./preference-store.js";

export class SelfImprovementAnalyzer {
  constructor(
    private readonly history: LearningHistoryStore,
    private readonly patterns: PatternDetector,
    private readonly preferences: PreferenceStore
  ) {}

  analyze(): SelfImprovementInsight {
    const records = [...this.history.getAll()];
    const prefs = this.preferences.get();

    const workedWell = records
      .filter((r) => r.outcome === LearningOutcome.Success && r.learningValue >= 70)
      .slice(-5)
      .map((r) => `${r.title} (${r.source})`);

    const failed = records
      .filter((r) => r.outcome === LearningOutcome.Failure)
      .slice(-5)
      .map((r) => r.title);

    const shouldImprove = records
      .filter((r) => r.outcome === LearningOutcome.Partial || r.learningValue < 60)
      .slice(-3)
      .map((r) => r.title);

    const neverRepeat = this.patterns.findRepeatedMistakes(records);

    const recommendations: string[] = [];
    if (prefs.videoStyle) {
      recommendations.push(`Use preferred video style: ${prefs.videoStyle}`);
    }
    if (prefs.marketingStyle) {
      recommendations.push(`Apply marketing style: ${prefs.marketingStyle}`);
    }
    if (prefs.preferredWorkflow) {
      recommendations.push(`Follow workflow: ${prefs.preferredWorkflow}`);
    }
    if (workedWell.length > 0) {
      recommendations.push(`Repeat successful pattern: ${workedWell[0]}`);
    }
    if (neverRepeat.length > 0) {
      recommendations.push(`Avoid: ${neverRepeat[0]}`);
    }

    return {
      workedWell,
      failed,
      shouldImprove,
      neverRepeat,
      recommendations,
    };
  }

  computeAccuracy(records: LearningRecord[]): number {
    if (records.length === 0) return 100;
    const verified = records.filter((r) => r.verified).length;
    const highValue = records.filter((r) => r.learningValue >= 60).length;
    return Math.round(((verified + highValue) / (records.length * 2)) * 100);
  }
}
