/**
 * P8.C — decisive-only performance summary.
 * Win rate = TARGET_REACHED / (TARGET_REACHED + INVALIDATION_REACHED).
 * UNTRIGGERED / AMBIGUOUS / EXPIRED / NO_TRADE / WAITING are never ordinary losses.
 */
import {
  HFM_CHARTS_PERFORMANCE_POLICY_ID,
  HFM_CHARTS_PERFORMANCE_POLICY_VERSION,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
} from "./contracts.js";
import { computeChartsPerformanceSummaryId } from "./identity.js";
import type { HfmChartsPredictionOutcomeStorage } from "./persistence.js";
import type {
  HfmChartsDecisiveWinRate,
  HfmChartsPredictionEvaluationRecord,
  HfmChartsPredictionPerformanceSummary,
} from "./types.js";

export function computeDecisiveWinRate(
  targetReached: number,
  invalidationReached: number,
): HfmChartsDecisiveWinRate {
  const numerator = targetReached;
  const denominator = targetReached + invalidationReached;
  if (denominator <= 0) {
    return {
      numerator,
      denominator,
      winRate: null,
      unavailableReason: "denominator is zero (no decisive TARGET_REACHED or INVALIDATION_REACHED outcomes)",
    };
  }
  return {
    numerator,
    denominator,
    winRate: numerator / denominator,
    unavailableReason: null,
  };
}

export function aggregateChartsPredictionPerformance(input: {
  evaluations: readonly HfmChartsPredictionEvaluationRecord[];
  totalCompletedAnalyses?: number | null;
  noTradeSkipped?: number | null;
  waitingSkipped?: number | null;
  computedAt?: string;
}): HfmChartsPredictionPerformanceSummary {
  let triggered = 0;
  let untriggered = 0;
  let expiredUnresolved = 0;
  let targetReached = 0;
  let invalidationReached = 0;
  let ambiguousSameCandle = 0;
  let stillActive = 0;
  let noObservationWindow = 0;
  const maeValues: number[] = [];
  const mfeValues: number[] = [];

  for (const e of input.evaluations) {
    if (e.entryTrigger.status === "TRIGGERED") triggered += 1;
    else untriggered += 1;

    switch (e.resultKind) {
      case "TARGET_REACHED":
        targetReached += 1;
        break;
      case "INVALIDATION_REACHED":
        invalidationReached += 1;
        break;
      case "BOTH_AMBIGUOUS_SAME_CANDLE":
      case "AMBIGUOUS_OUTCOME":
        ambiguousSameCandle += 1;
        break;
      case "EXPIRED_UNRESOLVED":
        expiredUnresolved += 1;
        break;
      case "STILL_ACTIVE":
        stillActive += 1;
        break;
      case "NO_OBSERVATION_WINDOW":
        noObservationWindow += 1;
        break;
      case "UNTRIGGERED":
        // counted via entryTrigger.status; keep separate from losses
        break;
      default:
        break;
    }

    if (e.entryTrigger.status === "TRIGGERED") {
      if (e.mae != null && Number.isFinite(e.mae)) maeValues.push(e.mae);
      if (e.mfe != null && Number.isFinite(e.mfe)) mfeValues.push(e.mfe);
    }
  }

  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  const summaryId = computeChartsPerformanceSummaryId({
    evaluationIds: input.evaluations.map((e) => e.evaluationId),
    policyVersion: HFM_CHARTS_PERFORMANCE_POLICY_VERSION,
  });

  return {
    contractId: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
    contractVersion: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
    policyId: HFM_CHARTS_PERFORMANCE_POLICY_ID,
    policyVersion: HFM_CHARTS_PERFORMANCE_POLICY_VERSION,
    summaryId,
    totalCompletedAnalyses: input.totalCompletedAnalyses ?? null,
    eligibleDirectionalPredictions: input.evaluations.length,
    triggered,
    untriggered,
    expiredUnresolved,
    targetReached,
    invalidationReached,
    ambiguousSameCandle,
    stillActive,
    noObservationWindow,
    noTradeSkipped: input.noTradeSkipped ?? null,
    waitingSkipped: input.waitingSkipped ?? null,
    decisiveWinRate: computeDecisiveWinRate(targetReached, invalidationReached),
    maeSampleCount: maeValues.length,
    mfeSampleCount: mfeValues.length,
    maeMean: mean(maeValues),
    mfeMean: mean(mfeValues),
    note:
      "Decisive win-rate denominator is TARGET_REACHED + INVALIDATION_REACHED only. "
      + "UNTRIGGERED, AMBIGUOUS, EXPIRED, NO_TRADE, and WAITING are not ordinary losses. "
      + "Analytical confidence is not win probability. Metrics are OHLC research, not broker account P&L.",
    computedAt: input.computedAt ?? new Date().toISOString(),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    isNotCalibratedProbability: true,
    notBrokerAccountPnl: true,
  };
}

export async function aggregateChartsPredictionPerformanceFromStorage(input: {
  storage: HfmChartsPredictionOutcomeStorage;
  totalCompletedAnalyses?: number | null;
  noTradeSkipped?: number | null;
  waitingSkipped?: number | null;
}): Promise<HfmChartsPredictionPerformanceSummary> {
  const listed = await input.storage.listAllEvaluations({ offset: 0, limit: 100 });
  // Bound: load sequentially in pages if needed (VPS-safe).
  const all = [...listed.items];
  let offset = listed.items.length;
  while (offset < listed.total && offset < 10_000) {
    const page = await input.storage.listAllEvaluations({ offset, limit: 100 });
    if (!page.items.length) break;
    all.push(...page.items);
    offset += page.items.length;
  }
  // Latest evaluation per predictionId (by computationTimestamp).
  const latest = new Map<string, (typeof all)[number]>();
  for (const e of all) {
    const prev = latest.get(e.predictionId);
    if (!prev || e.computationTimestamp >= prev.computationTimestamp) {
      latest.set(e.predictionId, e);
    }
  }
  return aggregateChartsPredictionPerformance({
    evaluations: [...latest.values()],
    totalCompletedAnalyses: input.totalCompletedAnalyses,
    noTradeSkipped: input.noTradeSkipped,
    waitingSkipped: input.waitingSkipped,
  });
}

/** @deprecated Prefer buildChartsPerformanceAnalyticsFromStorage for P8.D. Kept for P8.C callers. */
export { buildChartsPerformanceAnalyticsFromStorage } from "./analytics-engine.js";

