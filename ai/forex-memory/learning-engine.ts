/**
 * Aggregate learning statistics with minimum sample thresholds.
 * Never fabricates win rates from tiny samples as authoritative accuracy.
 */
import {
  FOREX_MEMORY_MIN_SAMPLE,
  type ForexAnalysisMemoryRecord,
  type ForexLearningBucket,
  type ForexMistakeRecord,
  type ForexModelPerfCounters,
  type ForexScenarioOutcomeRecord,
  type ForexStatisticalConfidence,
} from "./types.js";

function emptyBucket(key: string): ForexLearningBucket {
  return {
    key,
    sampleSize: 0,
    confirmed: 0,
    invalidated: 0,
    partiallyConfirmed: 0,
    inconclusive: 0,
    expired: 0,
    pending: 0,
    zoneTouched: 0,
    statisticalConfidence: "INSUFFICIENT_SAMPLE",
  };
}

function finalize(bucket: ForexLearningBucket): ForexLearningBucket {
  const confidence: ForexStatisticalConfidence =
    bucket.sampleSize >= FOREX_MEMORY_MIN_SAMPLE ? "OK" : "INSUFFICIENT_SAMPLE";
  return { ...bucket, statisticalConfidence: confidence };
}

function bump(bucket: ForexLearningBucket, outcome: ForexScenarioOutcomeRecord): void {
  bucket.sampleSize += 1;
  if (outcome.zoneTouched) bucket.zoneTouched += 1;
  switch (outcome.status) {
    case "CONFIRMED":
      bucket.confirmed += 1;
      break;
    case "INVALIDATED":
      bucket.invalidated += 1;
      break;
    case "PARTIALLY_CONFIRMED":
      bucket.partiallyConfirmed += 1;
      break;
    case "EXPIRED":
      bucket.expired += 1;
      break;
    case "PENDING":
      bucket.pending += 1;
      break;
    default:
      bucket.inconclusive += 1;
      break;
  }
}

export function aggregateLearning(input: {
  analyses: ForexAnalysisMemoryRecord[];
  outcomes: ForexScenarioOutcomeRecord[];
  mistakes: ForexMistakeRecord[];
  modelPerf: ForexModelPerfCounters[];
}): {
  scenarioPerformance: ForexLearningBucket[];
  timeframePerformance: ForexLearningBucket[];
  regimePerformance: ForexLearningBucket[];
  mistakePatterns: Array<{ category: string; count: number; severityHigh: number }>;
  modelPerformance: Array<{
    modelId: string;
    totalAnalyses: number;
    fallbackRate: number | null;
    avgLatencyMs: number | null;
    avgPromptChars: number | null;
    sampleSize: number;
    statisticalConfidence: ForexStatisticalConfidence;
  }>;
  totals: {
    analyses: number;
    outcomes: number;
    mistakes: number;
    pendingOutcomes: number;
  };
} {
  const byScenario = new Map<string, ForexLearningBucket>();
  const byTf = new Map<string, ForexLearningBucket>();
  const byRegime = new Map<string, ForexLearningBucket>();
  const analysisById = new Map(input.analyses.map((a) => [a.id, a]));

  for (const outcome of input.outcomes) {
    const analysis = analysisById.get(outcome.analysisId);
    const scenarioKey = outcome.scenario || analysis?.scenario || "UNKNOWN";
    const s = byScenario.get(scenarioKey) ?? emptyBucket(scenarioKey);
    bump(s, outcome);
    byScenario.set(scenarioKey, s);

    const regimeKey = analysis?.marketRegime ?? "UNKNOWN";
    const r = byRegime.get(regimeKey) ?? emptyBucket(regimeKey);
    bump(r, outcome);
    byRegime.set(regimeKey, r);

    const tfs = analysis?.timeframes?.length ? analysis.timeframes : ["UNKNOWN"];
    for (const tf of tfs) {
      const t = byTf.get(tf) ?? emptyBucket(tf);
      bump(t, outcome);
      byTf.set(tf, t);
    }
  }

  const mistakeCounts = new Map<string, { count: number; severityHigh: number }>();
  for (const m of input.mistakes) {
    const cur = mistakeCounts.get(m.category) ?? { count: 0, severityHigh: 0 };
    cur.count += 1;
    if (m.severity === "HIGH") cur.severityHigh += 1;
    mistakeCounts.set(m.category, cur);
  }

  const modelPerformance = input.modelPerf.map((m) => {
    const sampleSize = m.totalAnalyses;
    return {
      modelId: m.modelId,
      totalAnalyses: m.totalAnalyses,
      fallbackRate: sampleSize > 0 ? m.deterministicFallback / sampleSize : null,
      avgLatencyMs: m.samplesWithLatency > 0 ? m.totalLatencyMs / m.samplesWithLatency : null,
      avgPromptChars: m.samplesWithPrompt > 0 ? m.totalPromptChars / m.samplesWithPrompt : null,
      sampleSize,
      statisticalConfidence: (sampleSize >= FOREX_MEMORY_MIN_SAMPLE
        ? "OK"
        : "INSUFFICIENT_SAMPLE") as ForexStatisticalConfidence,
    };
  });

  return {
    scenarioPerformance: [...byScenario.values()].map(finalize).sort((a, b) => b.sampleSize - a.sampleSize),
    timeframePerformance: [...byTf.values()].map(finalize).sort((a, b) => b.sampleSize - a.sampleSize),
    regimePerformance: [...byRegime.values()].map(finalize).sort((a, b) => b.sampleSize - a.sampleSize),
    mistakePatterns: [...mistakeCounts.entries()]
      .map(([category, v]) => ({ category, count: v.count, severityHigh: v.severityHigh }))
      .sort((a, b) => b.count - a.count),
    modelPerformance,
    totals: {
      analyses: input.analyses.length,
      outcomes: input.outcomes.length,
      mistakes: input.mistakes.length,
      pendingOutcomes: input.outcomes.filter((o) => o.status === "PENDING").length,
    },
  };
}
