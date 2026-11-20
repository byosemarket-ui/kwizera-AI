/**
 * Phase 5D.7 — performance statistics over eligible completed outcomes.
 *
 * Every metric exposes denominator, sample count, exclusions, and coverage.
 * Unresolved / ambiguous outcomes are NEVER mixed into win-rate denominators.
 * Insufficient sample → explicit INSUFFICIENT_SAMPLE status (not a fabricated rate).
 */
import type { MifPersistedCandidate } from "./persistence/types.js";
import type { MifOutcomeEvaluationRecord } from "./outcome-evaluation.js";

export const MIF_PERFORMANCE_STATS_CONTRACT_ID =
  "kwizera.mif.performance-statistics.v1" as const;
export const MIF_PERFORMANCE_STATS_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_PERFORMANCE_STATS_ENGINE_ID = "mif-performance-statistics" as const;
export const MIF_PERFORMANCE_STATS_ENGINE_VERSION = "1.0.0" as const;

/** Minimum completed decisive outcomes required to report a win rate as AVAILABLE. */
export const MIF_PERFORMANCE_MIN_SAMPLE_FOR_WIN_RATE = 10 as const;

export type MifMetricAvailability =
  | "AVAILABLE"
  | "INSUFFICIENT_SAMPLE"
  | "UNAVAILABLE"
  | "NOT_APPLICABLE";

export interface MifMetricValue {
  value: number | null;
  availability: MifMetricAvailability;
  numerator: number | null;
  denominator: number | null;
  sampleCount: number;
  excludedCount: number;
  exclusionReasons: readonly string[];
  definition: string;
}

export interface MifPerformanceGroupKey {
  strategyId?: string;
  providerSymbol?: string;
  timeframe?: string;
  marketRegime?: string;
}

export interface MifPerformanceStatisticsInput {
  candidates: readonly MifPersistedCandidate[];
  evaluations?: readonly MifOutcomeEvaluationRecord[];
  /** Optional window filter on candidate.createdAt ISO. */
  fromIso?: string | null;
  toIso?: string | null;
  groupBy?: MifPerformanceGroupKey | null;
  minSampleForWinRate?: number;
  calculationTimestamp?: string;
}

export interface MifPerformanceStatisticsReport {
  contractId: typeof MIF_PERFORMANCE_STATS_CONTRACT_ID;
  contractVersion: typeof MIF_PERFORMANCE_STATS_CONTRACT_VERSION;
  engineId: typeof MIF_PERFORMANCE_STATS_ENGINE_ID;
  engineVersion: typeof MIF_PERFORMANCE_STATS_ENGINE_VERSION;
  calculationTimestamp: string;
  filter: {
    fromIso: string | null;
    toIso: string | null;
    groupBy: MifPerformanceGroupKey | null;
  };
  totals: {
    totalOpportunities: number;
    confirmedOpportunities: number;
    completedOutcomes: number;
    wins: number;
    losses: number;
    expired: number;
    ambiguous: number;
    unknown: number;
    stillOpen: number;
    excludedFromWindow: number;
  };
  winRate: MifMetricValue;
  outcomeDistribution: Record<string, number>;
  averageRealizedR: MifMetricValue;
  dataCoverage: {
    candidatesInScope: number;
    evaluationsMatched: number;
    evaluationsMissing: number;
  };
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  notWinProbabilityClaim: true;
}

function metric(
  partial: Omit<MifMetricValue, "exclusionReasons"> & { exclusionReasons?: string[] },
): MifMetricValue {
  return {
    ...partial,
    exclusionReasons: partial.exclusionReasons ?? [],
  };
}

function matchGroup(
  c: MifPersistedCandidate,
  g: MifPerformanceGroupKey | null | undefined,
): boolean {
  if (!g) return true;
  if (g.strategyId && c.strategyId !== g.strategyId) return false;
  if (g.providerSymbol && c.providerSymbol !== g.providerSymbol.toUpperCase()) return false;
  if (g.timeframe) {
    const tfs = c.timeframeRoles ?? [];
    const snapTf = (c.candidateSnapshot as { timeframe?: string } | undefined)?.timeframe;
    if (!tfs.includes(g.timeframe) && snapTf !== g.timeframe) return false;
  }
  if (g.marketRegime) {
    const regime = String(
      (c.candidateSnapshot as { marketRegime?: string } | undefined)?.marketRegime ?? "",
    );
    if (regime !== g.marketRegime) return false;
  }
  return true;
}

/**
 * Compute performance statistics. Pure / deterministic for identical inputs.
 */
export function computeOpportunityPerformanceStatistics(
  input: MifPerformanceStatisticsInput,
): MifPerformanceStatisticsReport {
  const calculationTimestamp = input.calculationTimestamp ?? new Date().toISOString();
  const minSample = input.minSampleForWinRate ?? MIF_PERFORMANCE_MIN_SAMPLE_FOR_WIN_RATE;
  const evalById = new Map(
    (input.evaluations ?? []).map((e) => [e.candidateId, e] as const),
  );

  let excludedFromWindow = 0;
  const inScope: MifPersistedCandidate[] = [];
  for (const c of input.candidates) {
    if (input.fromIso && c.createdAt < input.fromIso) {
      excludedFromWindow += 1;
      continue;
    }
    if (input.toIso && c.createdAt > input.toIso) {
      excludedFromWindow += 1;
      continue;
    }
    if (!matchGroup(c, input.groupBy)) {
      excludedFromWindow += 1;
      continue;
    }
    inScope.push(c);
  }

  let confirmed = 0;
  let wins = 0;
  let losses = 0;
  let expired = 0;
  let ambiguous = 0;
  let unknown = 0;
  let stillOpen = 0;
  let completed = 0;
  let evaluationsMatched = 0;
  let evaluationsMissing = 0;
  const rValues: number[] = [];
  const distribution: Record<string, number> = {};

  const bump = (k: string) => {
    distribution[k] = (distribution[k] ?? 0) + 1;
  };

  for (const c of inScope) {
    if (
      c.lifecycleState === "CONFIRMED"
      || c.detectionStatus === "DETECTED"
      || c.lifecycleState === "ACTIVE"
      || c.lifecycleState === "COMPLETED"
    ) {
      // Confirmed = not rejected/invalid at birth; count analytical detections that entered lifecycle.
      if (c.lifecycleState !== "REJECTED" && c.lifecycleState !== "INVALID") {
        confirmed += 1;
      }
    }

    const ev = evalById.get(c.candidateId);
    if (ev) evaluationsMatched += 1;
    else if (
      c.outcomeKind !== "NONE"
      || c.lifecycleState === "COMPLETED"
      || c.lifecycleState === "INVALIDATED"
      || c.lifecycleState === "EXPIRED"
      || c.lifecycleState === "OUTCOME_UNKNOWN"
    ) {
      evaluationsMissing += 1;
    }

    const kind = ev?.outcomeKind ?? c.outcomeKind;
    bump(kind);

    if (kind === "TARGET_REACHED") {
      wins += 1;
      completed += 1;
      if (ev?.realizedRMultiple != null && Number.isFinite(ev.realizedRMultiple)) {
        rValues.push(ev.realizedRMultiple);
      }
    } else if (kind === "INVALIDATION_REACHED") {
      losses += 1;
      completed += 1;
      if (ev?.realizedRMultiple != null && Number.isFinite(ev.realizedRMultiple)) {
        rValues.push(ev.realizedRMultiple);
      }
    } else if (kind === "EXPIRED_UNRESOLVED") {
      expired += 1;
      completed += 1;
    } else if (
      kind === "BOTH_AMBIGUOUS_SAME_CANDLE"
      || (ev?.resultKind === "AMBIGUOUS_OUTCOME")
    ) {
      ambiguous += 1;
    } else if (kind === "OUTCOME_UNKNOWN") {
      unknown += 1;
    } else {
      stillOpen += 1;
    }
  }

  // Win rate denominator = wins + losses ONLY (decisive completed). Ambiguous/expired/open excluded.
  const decisive = wins + losses;
  const excludedFromWinRate =
    inScope.length - decisive;
  const winRateExclusions = [
    `expired=${expired}`,
    `ambiguous=${ambiguous}`,
    `unknown=${unknown}`,
    `stillOpen=${stillOpen}`,
  ];

  const winRate =
    decisive >= minSample
      ? metric({
          value: wins / decisive,
          availability: "AVAILABLE",
          numerator: wins,
          denominator: decisive,
          sampleCount: decisive,
          excludedCount: excludedFromWinRate,
          exclusionReasons: winRateExclusions,
          definition:
            "wins / (wins + losses); excludes expired, ambiguous, unknown, and open; NOT a predicted win probability",
        })
      : metric({
          value: null,
          availability: decisive === 0 ? "UNAVAILABLE" : "INSUFFICIENT_SAMPLE",
          numerator: wins,
          denominator: decisive,
          sampleCount: decisive,
          excludedCount: excludedFromWinRate,
          exclusionReasons: [
            ...winRateExclusions,
            `minSampleRequired=${minSample}`,
          ],
          definition:
            "wins / (wins + losses); unavailable below min sample; NOT a predicted win probability",
        });

  const avgR =
    rValues.length >= Math.min(5, minSample)
      ? metric({
          value: rValues.reduce((a, b) => a + b, 0) / rValues.length,
          availability: "AVAILABLE",
          numerator: null,
          denominator: rValues.length,
          sampleCount: rValues.length,
          excludedCount: decisive - rValues.length,
          exclusionReasons: [
            "requires entry+invalidation+exit prices on evaluation record",
          ],
          definition:
            "mean realized R multiple over evaluations with valid prices; NOT expectancy guarantee",
        })
      : metric({
          value: null,
          availability: rValues.length === 0 ? "UNAVAILABLE" : "INSUFFICIENT_SAMPLE",
          numerator: null,
          denominator: rValues.length,
          sampleCount: rValues.length,
          excludedCount: decisive - rValues.length,
          exclusionReasons: [
            "requires entry+invalidation+exit prices on evaluation record",
          ],
          definition:
            "mean realized R multiple; unavailable without priced evaluations",
        });

  return {
    contractId: MIF_PERFORMANCE_STATS_CONTRACT_ID,
    contractVersion: MIF_PERFORMANCE_STATS_CONTRACT_VERSION,
    engineId: MIF_PERFORMANCE_STATS_ENGINE_ID,
    engineVersion: MIF_PERFORMANCE_STATS_ENGINE_VERSION,
    calculationTimestamp,
    filter: {
      fromIso: input.fromIso ?? null,
      toIso: input.toIso ?? null,
      groupBy: input.groupBy ?? null,
    },
    totals: {
      totalOpportunities: inScope.length,
      confirmedOpportunities: confirmed,
      completedOutcomes: completed,
      wins,
      losses,
      expired,
      ambiguous,
      unknown,
      stillOpen,
      excludedFromWindow,
    },
    winRate,
    outcomeDistribution: distribution,
    averageRealizedR: avgR,
    dataCoverage: {
      candidatesInScope: inScope.length,
      evaluationsMatched,
      evaluationsMissing,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    notWinProbabilityClaim: true,
  };
}
