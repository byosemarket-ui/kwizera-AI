/**
 * Phase 5F STEP 4 — aggregate metrics. Unsupported metrics stay UNSUPPORTED.
 */
import type { MifPredictionOutcomeRecord } from "../prediction-outcome/types.js";
import type { MifBacktestAggregateMetrics, MifBacktestMetricValue } from "./types.js";

function metric(
  values: number[],
  definition: string,
  minSample = 5,
): MifBacktestMetricValue {
  if (!values.length) {
    return {
      value: null,
      availability: "INSUFFICIENT_SAMPLE",
      sampleCount: 0,
      definition,
    };
  }
  if (values.length < minSample) {
    return {
      value: values.reduce((a, b) => a + b, 0) / values.length,
      availability: "INSUFFICIENT_SAMPLE",
      sampleCount: values.length,
      definition,
    };
  }
  return {
    value: values.reduce((a, b) => a + b, 0) / values.length,
    availability: "AVAILABLE",
    sampleCount: values.length,
    definition,
  };
}

function unsupported(definition: string): MifBacktestMetricValue {
  return {
    value: null,
    availability: "UNSUPPORTED",
    sampleCount: 0,
    definition,
  };
}

function horizonFr(
  outcomes: readonly MifPredictionOutcomeRecord[],
  h: number,
): number[] {
  const out: number[] = [];
  for (const o of outcomes) {
    const hm = o.pathOutcome.horizons.find((x) => x.requestedHorizon === h);
    if (
      hm
      && (hm.completeness === "COMPLETE" || hm.completeness === "PARTIAL")
      && hm.forwardReturn != null
    ) {
      out.push(hm.forwardReturn);
    }
  }
  return out;
}

export function aggregateBacktestMetrics(
  outcomes: readonly MifPredictionOutcomeRecord[],
): MifBacktestAggregateMetrics {
  const unique = new Set(outcomes.map((o) => o.predictionId)).size;
  let complete = 0;
  let partial = 0;
  let insuff = 0;
  let ambiguous = 0;
  let gapAffected = 0;
  const levelFrequencies: Record<string, number> = {};

  for (const o of outcomes) {
    if (o.completeness === "COMPLETE") complete += 1;
    else if (o.completeness === "PARTIAL") partial += 1;
    else insuff += 1;
    const rk = o.levelOutcome.resultKind;
    levelFrequencies[rk] = (levelFrequencies[rk] ?? 0) + 1;
    if (rk === "BOTH_AMBIGUOUS_SAME_CANDLE" || rk === "AMBIGUOUS_OUTCOME") {
      ambiguous += 1;
    }
    if (o.dataQuality.gapDetected || o.pathOutcome.gapDetected) gapAffected += 1;
  }

  const targets = outcomes.filter(
    (o) => o.levelOutcome.resultKind === "TARGET_REACHED",
  ).length;
  const decisive = outcomes.filter((o) =>
    ["TARGET_REACHED", "INVALIDATION_REACHED"].includes(o.levelOutcome.resultKind),
  ).length;

  const fr8 = horizonFr(outcomes, 8);
  const mfe8: number[] = [];
  const mae8: number[] = [];
  for (const o of outcomes) {
    const hm = o.pathOutcome.horizons.find((x) => x.requestedHorizon === 8);
    if (hm?.completeness === "COMPLETE" || hm?.completeness === "PARTIAL") {
      if (hm.mfe != null) mfe8.push(hm.mfe);
      if (hm.mae != null) mae8.push(hm.mae);
    }
  }

  return {
    uniquePredictions: unique,
    completeOutcomes: complete,
    partialOutcomes: partial,
    insufficientOutcomes: insuff,
    ambiguousCount: ambiguous,
    gapAffectedCount: gapAffected,
    levelFrequencies,
    pathForwardReturnMeanH4: metric(
      horizonFr(outcomes, 4),
      "mean path forward return at horizon 4 (gross OHLC; not trade PnL)",
    ),
    pathForwardReturnMeanH8: metric(
      fr8,
      "mean path forward return at horizon 8 (gross OHLC; not trade PnL)",
    ),
    pathForwardReturnMeanH16: metric(
      horizonFr(outcomes, 16),
      "mean path forward return at horizon 16 (gross OHLC; not trade PnL)",
    ),
    mfeMeanH8: metric(mfe8, "mean MFE at horizon 8"),
    maeMeanH8: metric(mae8, "mean MAE at horizon 8"),
    targetRate: {
      value: decisive > 0 ? targets / decisive : null,
      availability: decisive >= 10 ? "AVAILABLE" : "INSUFFICIENT_SAMPLE",
      sampleCount: decisive,
      definition: "TARGET_REACHED / (TARGET+INVALIDATION); not win probability",
    },
    // Sharpe/Sortino require defensible periodic returns — unsupported without ledger periods.
    sharpe: unsupported(
      "Sharpe unsupported without defensible periodic ledger returns and sufficient samples",
    ),
    sortino: unsupported(
      "Sortino unsupported without defensible periodic ledger returns and sufficient samples",
    ),
  };
}

export function emptyMetrics(): MifBacktestAggregateMetrics {
  return aggregateBacktestMetrics([]);
}
