/**
 * P8.D — bounded deterministic Performance Analytics over immutable Charts evaluations.
 * Does not rerun outcome evaluation or load OHLC archives.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../../mif/quality/stable-identity.js";
import {
  HFM_CHARTS_ANALYTICAL_CONFIDENCE_LABEL,
  HFM_CHARTS_INSUFFICIENT_SAMPLE_THRESHOLD,
  HFM_CHARTS_PERFORMANCE_ANALYTICS_POLICY_VERSION,
  HFM_CHARTS_PERFORMANCE_ANALYTICS_SCHEMA_VERSION,
  HFM_CHARTS_PERFORMANCE_POLICY_ID,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
  HFM_CHARTS_SIGNED_R_POLICY_VERSION,
} from "./contracts.js";
import type { HfmChartsPredictionOutcomeStorage } from "./persistence.js";
import { computeDecisiveWinRate } from "./performance-summary.js";
import type {
  HfmChartsPredictionEvaluationRecord,
} from "./types.js";
import type {
  HfmChartsAnalyticsFilters,
  HfmChartsBreakdownRow,
  HfmChartsConfidenceBucket,
  HfmChartsDistributionStats,
  HfmChartsOutcomeDistribution,
  HfmChartsPerformanceAnalyticsReport,
  HfmChartsPopulationMode,
  HfmChartsRateMetric,
  HfmChartsReasoningPopulationCounts,
  HfmChartsSignedRStats,
  HfmChartsTimeBasis,
} from "./analytics-types.js";

const SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  isNotCalibratedProbability: true as const,
  notBrokerAccountPnl: true as const,
  scheduledWorker: false as const,
};

export function defaultAnalyticsFilters(
  overrides?: Partial<HfmChartsAnalyticsFilters>,
): HfmChartsAnalyticsFilters {
  return {
    timeBasis: "activationOpenTimeSec",
    populationMode: "LATEST_PER_PREDICTION",
    startUtc: null,
    endUtc: null,
    symbol: null,
    timeframe: null,
    direction: null,
    evaluatorVersion: null,
    signedRPolicyVersion: null,
    confidenceBucket: null,
    ...overrides,
  };
}

export function classifyAnalyticalConfidenceBucket(
  confidence: number | null | undefined,
): HfmChartsConfidenceBucket {
  if (confidence == null || !Number.isFinite(confidence)) return "UNKNOWN";
  // Accept both 0–1 and 0–100 scales from historical reasoning records.
  const c = confidence > 1 ? confidence / 100 : confidence;
  if (!(c >= 0)) return "UNKNOWN";
  if (c < 0.5) return "<0.5";
  if (c < 0.75) return "0.5–0.75";
  return "≥0.75";
}

export function computeRate(numerator: number, denominator: number): HfmChartsRateMetric {
  if (denominator <= 0) {
    return {
      numerator,
      denominator,
      rate: null,
      unavailableReason: "denominator is zero",
    };
  }
  return {
    numerator,
    denominator,
    rate: numerator / denominator,
    unavailableReason: null,
  };
}

function median(sorted: number[]): number | null {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function computeDistributionStats(
  values: readonly number[],
  unavailable = 0,
): HfmChartsDistributionStats {
  if (!values.length) {
    return {
      count: 0,
      mean: null,
      median: null,
      min: null,
      max: null,
      unavailable,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    mean: sum / sorted.length,
    median: median(sorted),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    unavailable,
  };
}

export function computeSignedRStats(
  evaluations: readonly HfmChartsPredictionEvaluationRecord[],
): HfmChartsSignedRStats {
  const values: number[] = [];
  let unavailable = 0;
  let positive = 0;
  let negative = 0;
  let zero = 0;
  const evaluatorVersions = new Set<string>();
  const policyVersions = new Set<string>();

  for (const e of evaluations) {
    evaluatorVersions.add(e.evaluatorVersion);
    policyVersions.add(e.signedRPolicyVersion);
    const decisive =
      e.resultKind === "TARGET_REACHED" || e.resultKind === "INVALIDATION_REACHED";
    if (!decisive) {
      unavailable += 1;
      continue;
    }
    const r = e.realizedSignedRMultiple;
    if (r == null || !Number.isFinite(r)) {
      unavailable += 1;
      continue;
    }
    values.push(r);
    if (r > 0) positive += 1;
    else if (r < 0) negative += 1;
    else zero += 1;
  }

  const base = computeDistributionStats(values, unavailable);
  return {
    ...base,
    evaluatorVersion:
      evaluatorVersions.size === 1 ? [...evaluatorVersions][0]! : null,
    signedRPolicyVersion:
      policyVersions.size === 1 ? [...policyVersions][0]! : null,
    positive,
    negative,
    zero,
  };
}

function resolveRecordUnixSec(
  e: HfmChartsPredictionEvaluationRecord,
  timeBasis: HfmChartsTimeBasis,
): number | null {
  if (timeBasis === "activationOpenTimeSec") {
    const v = e.entryTrigger?.activationOpenTimeSec;
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  const iso = e.computationTimestamp;
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function parseUtcBound(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

export type ValidateAnalyticsFiltersResult =
  | { ok: true; filters: HfmChartsAnalyticsFilters }
  | { ok: false; code: string; message: string };

export function validateAnalyticsFilters(
  raw: Partial<HfmChartsAnalyticsFilters> & Record<string, unknown>,
): ValidateAnalyticsFiltersResult {
  const timeBasis =
    raw.timeBasis === "computationTimestamp"
      ? "computationTimestamp"
      : raw.timeBasis === "activationOpenTimeSec" || raw.timeBasis == null
        ? "activationOpenTimeSec"
        : null;
  if (!timeBasis) {
    return {
      ok: false,
      code: "INVALID_TIME_BASIS",
      message: "timeBasis must be activationOpenTimeSec or computationTimestamp",
    };
  }
  const populationMode =
    raw.populationMode === "PER_PIT_MANIFEST"
      ? "PER_PIT_MANIFEST"
      : raw.populationMode === "LATEST_PER_PREDICTION" || raw.populationMode == null
        ? "LATEST_PER_PREDICTION"
        : null;
  if (!populationMode) {
    return {
      ok: false,
      code: "INVALID_POPULATION_MODE",
      message: "populationMode must be LATEST_PER_PREDICTION or PER_PIT_MANIFEST",
    };
  }

  const startUtc = raw.startUtc != null && String(raw.startUtc).trim()
    ? String(raw.startUtc).trim()
    : null;
  const endUtc = raw.endUtc != null && String(raw.endUtc).trim()
    ? String(raw.endUtc).trim()
    : null;
  const startSec = parseUtcBound(startUtc);
  const endSec = parseUtcBound(endUtc);
  if (startUtc && startSec == null) {
    return { ok: false, code: "INVALID_START_UTC", message: "startUtc is not a valid ISO timestamp" };
  }
  if (endUtc && endSec == null) {
    return { ok: false, code: "INVALID_END_UTC", message: "endUtc is not a valid ISO timestamp" };
  }
  if (startSec != null && endSec != null && startSec > endSec) {
    return { ok: false, code: "INVALID_RANGE", message: "startUtc must be <= endUtc" };
  }
  // ~10 years max window
  if (startSec != null && endSec != null && endSec - startSec > 10 * 365 * 24 * 3600) {
    return {
      ok: false,
      code: "RANGE_TOO_LARGE",
      message: "date range exceeds 10 years",
    };
  }

  const confidenceBucket =
    raw.confidenceBucket == null || raw.confidenceBucket === ""
      ? null
      : (["UNKNOWN", "<0.5", "0.5–0.75", "≥0.75"] as const).includes(
            raw.confidenceBucket as HfmChartsConfidenceBucket,
          )
        ? (raw.confidenceBucket as HfmChartsConfidenceBucket)
        : null;
  if (raw.confidenceBucket && !confidenceBucket) {
    return {
      ok: false,
      code: "INVALID_CONFIDENCE_BUCKET",
      message: "confidenceBucket must be UNKNOWN | <0.5 | 0.5–0.75 | ≥0.75",
    };
  }

  const direction =
    raw.direction == null || String(raw.direction).trim() === ""
      ? null
      : String(raw.direction).trim().toUpperCase();
  if (direction && direction !== "BUY" && direction !== "SELL") {
    return {
      ok: false,
      code: "INVALID_DIRECTION",
      message: "direction must be BUY or SELL",
    };
  }

  return {
    ok: true,
    filters: {
      timeBasis,
      populationMode,
      startUtc,
      endUtc,
      symbol: raw.symbol ? String(raw.symbol).trim().toUpperCase() : null,
      timeframe: raw.timeframe ? String(raw.timeframe).trim().toUpperCase() : null,
      direction,
      evaluatorVersion: raw.evaluatorVersion
        ? String(raw.evaluatorVersion).trim()
        : null,
      signedRPolicyVersion: raw.signedRPolicyVersion
        ? String(raw.signedRPolicyVersion).trim()
        : null,
      confidenceBucket,
    },
  };
}

/**
 * Select population: latest per predictionId, or keep all for per-PIT mode
 * (still one row per evaluationId; overview KPIs for PER_PIT use all selected
 * rows without collapsing — caller must not mix into LATEST overview).
 */
export function selectEvaluationPopulation(
  evaluations: readonly HfmChartsPredictionEvaluationRecord[],
  mode: HfmChartsPopulationMode,
): HfmChartsPredictionEvaluationRecord[] {
  if (mode === "PER_PIT_MANIFEST") {
    // One row per evaluation identity (already unique by evaluationId).
    const byId = new Map<string, HfmChartsPredictionEvaluationRecord>();
    for (const e of evaluations) {
      byId.set(e.evaluationId, e);
    }
    return [...byId.values()];
  }
  const latest = new Map<string, HfmChartsPredictionEvaluationRecord>();
  for (const e of evaluations) {
    const prev = latest.get(e.predictionId);
    if (!prev || e.computationTimestamp >= prev.computationTimestamp) {
      latest.set(e.predictionId, e);
    }
  }
  return [...latest.values()];
}

export function filterEvaluations(
  evaluations: readonly HfmChartsPredictionEvaluationRecord[],
  filters: HfmChartsAnalyticsFilters,
): {
  selected: HfmChartsPredictionEvaluationRecord[];
  excludedByFilter: number;
  excludedMissingTimestamp: number;
} {
  const startSec = parseUtcBound(filters.startUtc);
  const endSec = parseUtcBound(filters.endUtc);
  let excludedByFilter = 0;
  let excludedMissingTimestamp = 0;
  const selected: HfmChartsPredictionEvaluationRecord[] = [];

  for (const e of evaluations) {
    // Version separation: if not filtered, still allow multi-version sets but
    // signed-R summary will null out version identity when mixed.
    if (
      filters.evaluatorVersion
      && e.evaluatorVersion !== filters.evaluatorVersion
    ) {
      excludedByFilter += 1;
      continue;
    }
    if (
      filters.signedRPolicyVersion
      && e.signedRPolicyVersion !== filters.signedRPolicyVersion
    ) {
      excludedByFilter += 1;
      continue;
    }
    if (
      filters.symbol
      && String(e.provenance.symbol || "").toUpperCase() !== filters.symbol
    ) {
      excludedByFilter += 1;
      continue;
    }
    if (
      filters.timeframe
      && String(e.provenance.timeframe || "").toUpperCase() !== filters.timeframe
    ) {
      excludedByFilter += 1;
      continue;
    }
    if (
      filters.direction
      && String(e.provenance.direction || "").toUpperCase() !== filters.direction
    ) {
      excludedByFilter += 1;
      continue;
    }
    const bucket = classifyAnalyticalConfidenceBucket(
      e.provenance.analyticalConfidence,
    );
    if (filters.confidenceBucket && bucket !== filters.confidenceBucket) {
      excludedByFilter += 1;
      continue;
    }

    if (filters.startUtc || filters.endUtc) {
      const ts = resolveRecordUnixSec(e, filters.timeBasis);
      if (ts == null) {
        excludedMissingTimestamp += 1;
        continue;
      }
      if (startSec != null && ts < startSec) {
        excludedByFilter += 1;
        continue;
      }
      if (endSec != null && ts > endSec) {
        excludedByFilter += 1;
        continue;
      }
    }

    selected.push(e);
  }

  return { selected, excludedByFilter, excludedMissingTimestamp };
}

function emptyOutcomeDistribution(): HfmChartsOutcomeDistribution {
  return {
    TARGET_REACHED: 0,
    INVALIDATION_REACHED: 0,
    BOTH_AMBIGUOUS_SAME_CANDLE: 0,
    UNTRIGGERED: 0,
    EXPIRED_UNRESOLVED: 0,
    STILL_ACTIVE: 0,
    NO_OBSERVATION_WINDOW: 0,
    OTHER: 0,
  };
}

function summarizeSubset(
  evaluations: readonly HfmChartsPredictionEvaluationRecord[],
  key: string,
  extras?: Partial<HfmChartsBreakdownRow>,
): HfmChartsBreakdownRow {
  let triggered = 0;
  let untriggered = 0;
  let targetReached = 0;
  let invalidationReached = 0;
  let ambiguousSameCandle = 0;
  const signed = computeSignedRStats(evaluations);
  const maeVals: number[] = [];
  const mfeVals: number[] = [];
  const evaluatorVersions = new Set<string>();
  const policyVersions = new Set<string>();

  for (const e of evaluations) {
    evaluatorVersions.add(e.evaluatorVersion);
    policyVersions.add(e.signedRPolicyVersion);
    if (e.entryTrigger.status === "TRIGGERED") {
      triggered += 1;
      if (e.mae != null && Number.isFinite(e.mae)) maeVals.push(e.mae);
      if (e.mfe != null && Number.isFinite(e.mfe)) mfeVals.push(e.mfe);
    } else untriggered += 1;
    if (e.resultKind === "TARGET_REACHED") targetReached += 1;
    else if (e.resultKind === "INVALIDATION_REACHED") invalidationReached += 1;
    else if (
      e.resultKind === "BOTH_AMBIGUOUS_SAME_CANDLE"
      || e.resultKind === "AMBIGUOUS_OUTCOME"
    ) {
      ambiguousSameCandle += 1;
    }
  }

  const n = evaluations.length;
  return {
    key,
    observationCount: n,
    triggered,
    untriggered,
    targetReached,
    invalidationReached,
    ambiguousSameCandle,
    decisiveWinRate: computeDecisiveWinRate(targetReached, invalidationReached),
    triggerRate: computeRate(triggered, n),
    signedRMean: signed.mean,
    signedRCount: signed.count,
    maeMean: maeVals.length ? maeVals.reduce((a, b) => a + b, 0) / maeVals.length : null,
    mfeMean: mfeVals.length ? mfeVals.reduce((a, b) => a + b, 0) / mfeVals.length : null,
    evaluatorVersion:
      evaluatorVersions.size === 1 ? [...evaluatorVersions][0]! : null,
    signedRPolicyVersion:
      policyVersions.size === 1 ? [...policyVersions][0]! : null,
    sampleWarning:
      n > 0 && n < HFM_CHARTS_INSUFFICIENT_SAMPLE_THRESHOLD
        ? "INSUFFICIENT_SAMPLE"
        : null,
    ...extras,
  };
}

function groupBy(
  evaluations: readonly HfmChartsPredictionEvaluationRecord[],
  keyFn: (e: HfmChartsPredictionEvaluationRecord) => string,
): HfmChartsBreakdownRow[] {
  const map = new Map<string, HfmChartsPredictionEvaluationRecord[]>();
  for (const e of evaluations) {
    const k = keyFn(e);
    const arr = map.get(k) ?? [];
    arr.push(e);
    map.set(k, arr);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, rows]) => summarizeSubset(rows, k));
}

export function computeAnalyticsSummaryId(input: {
  evaluationIds: readonly string[];
  filters: HfmChartsAnalyticsFilters;
  policyVersion?: string;
}): string {
  const digest = createHash("sha256")
    .update(
      stableSerialize({
        schemaVersion: HFM_CHARTS_PERFORMANCE_ANALYTICS_SCHEMA_VERSION,
        policyVersion:
          input.policyVersion ?? HFM_CHARTS_PERFORMANCE_ANALYTICS_POLICY_VERSION,
        filters: input.filters,
        evaluationIds: [...input.evaluationIds].sort(),
      }),
      "utf8",
    )
    .digest("hex");
  return `cps:${digest.slice(0, 24)}`;
}

export function buildChartsPerformanceAnalytics(input: {
  evaluations: readonly HfmChartsPredictionEvaluationRecord[];
  filters?: Partial<HfmChartsAnalyticsFilters>;
  reasoningCounts?: HfmChartsReasoningPopulationCounts | null;
  generatedAt?: string;
}): HfmChartsPerformanceAnalyticsReport {
  const validated = validateAnalyticsFilters(input.filters ?? {});
  const filters = validated.ok
    ? validated.filters
    : defaultAnalyticsFilters();

  const rawCount = input.evaluations.length;
  const populated = selectEvaluationPopulation(
    input.evaluations,
    filters.populationMode,
  );
  const {
    selected,
    excludedByFilter,
    excludedMissingTimestamp,
  } = filterEvaluations(populated, filters);

  const outcomeDistribution = emptyOutcomeDistribution();
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
  let maeUnavailable = 0;
  let mfeUnavailable = 0;

  for (const e of selected) {
    if (e.entryTrigger.status === "TRIGGERED") {
      triggered += 1;
      if (e.mae != null && Number.isFinite(e.mae)) maeValues.push(e.mae);
      else maeUnavailable += 1;
      if (e.mfe != null && Number.isFinite(e.mfe)) mfeValues.push(e.mfe);
      else mfeUnavailable += 1;
    } else {
      untriggered += 1;
      maeUnavailable += 1;
      mfeUnavailable += 1;
    }

    switch (e.resultKind) {
      case "TARGET_REACHED":
        targetReached += 1;
        outcomeDistribution.TARGET_REACHED += 1;
        break;
      case "INVALIDATION_REACHED":
        invalidationReached += 1;
        outcomeDistribution.INVALIDATION_REACHED += 1;
        break;
      case "BOTH_AMBIGUOUS_SAME_CANDLE":
      case "AMBIGUOUS_OUTCOME":
        ambiguousSameCandle += 1;
        outcomeDistribution.BOTH_AMBIGUOUS_SAME_CANDLE += 1;
        break;
      case "EXPIRED_UNRESOLVED":
        expiredUnresolved += 1;
        outcomeDistribution.EXPIRED_UNRESOLVED += 1;
        break;
      case "STILL_ACTIVE":
        stillActive += 1;
        outcomeDistribution.STILL_ACTIVE += 1;
        break;
      case "NO_OBSERVATION_WINDOW":
        noObservationWindow += 1;
        outcomeDistribution.NO_OBSERVATION_WINDOW += 1;
        break;
      case "UNTRIGGERED":
        outcomeDistribution.UNTRIGGERED += 1;
        break;
      default:
        outcomeDistribution.OTHER += 1;
        break;
    }
  }

  // Count untriggered resultKind rows that only appear via trigger status.
  if (outcomeDistribution.UNTRIGGERED === 0 && untriggered > 0) {
    outcomeDistribution.UNTRIGGERED = untriggered;
  }

  const eligible = selected.length;
  const decisiveWinRate = computeDecisiveWinRate(targetReached, invalidationReached);
  const trigger = computeRate(triggered, eligible);
  const signedR = computeSignedRStats(selected);
  const mae = computeDistributionStats(maeValues, maeUnavailable);
  const mfe = computeDistributionStats(mfeValues, mfeUnavailable);

  const warnings: string[] = [];
  if (eligible === 0) warnings.push("NO_ELIGIBLE_EVALUATIONS");
  if (eligible > 0 && eligible < HFM_CHARTS_INSUFFICIENT_SAMPLE_THRESHOLD) {
    warnings.push("INSUFFICIENT_SAMPLE");
  }
  if (decisiveWinRate.winRate == null) warnings.push("DECISIVE_WIN_RATE_UNAVAILABLE");
  if (trigger.rate == null) warnings.push("TRIGGER_RATE_UNAVAILABLE");
  if (signedR.count === 0) warnings.push("SIGNED_R_UNAVAILABLE");
  if (mae.count === 0) warnings.push("MAE_UNAVAILABLE");
  if (mfe.count === 0) warnings.push("MFE_UNAVAILABLE");
  if (excludedMissingTimestamp > 0) warnings.push("MISSING_TIMESTAMPS_EXCLUDED");
  if (signedR.evaluatorVersion == null && signedR.count > 0) {
    warnings.push("MIXED_EVALUATOR_VERSIONS");
  }
  if (signedR.signedRPolicyVersion == null && signedR.count > 0) {
    warnings.push("MIXED_SIGNED_R_POLICY_VERSIONS");
  }
  warnings.push("CALIBRATION_MINIMUM_NOT_MET");
  warnings.push("NOT_BROKER_ACCOUNT_PNL");
  warnings.push("ANALYTICAL_CONFIDENCE_NOT_WIN_PROBABILITY");

  const reasoningCounts: HfmChartsReasoningPopulationCounts =
    input.reasoningCounts
    ?? {
      authority: "UNAVAILABLE",
      unavailableReason: "reasoning store scan not provided",
      scanned: 0,
      completed: 0,
      failed: 0,
      rejected: 0,
      buy: 0,
      sell: 0,
      noTrade: 0,
      waiting: 0,
      withPredictionLinkage: 0,
      withoutPredictionLinkage: 0,
      timeBasis: "reasoning.createdAt",
    };
  if (reasoningCounts.authority === "UNAVAILABLE") {
    warnings.push("REASONING_COUNTS_UNAVAILABLE");
  }

  const breakdowns = {
    symbol: groupBy(
      selected,
      (e) => String(e.provenance.symbol || "UNKNOWN").toUpperCase() || "UNKNOWN",
    ),
    timeframe: groupBy(
      selected,
      (e) => String(e.provenance.timeframe || "UNKNOWN").toUpperCase() || "UNKNOWN",
    ),
    direction: groupBy(
      selected,
      (e) => String(e.provenance.direction || "UNKNOWN").toUpperCase() || "UNKNOWN",
    ),
    setupFingerprint: groupBy(
      selected,
      (e) => e.provenance.setupFingerprint?.trim() || "UNKNOWN",
    ),
    analyticalConfidence: groupBy(selected, (e) =>
      classifyAnalyticalConfidenceBucket(e.provenance.analyticalConfidence),
    ),
    ...(filters.populationMode === "PER_PIT_MANIFEST"
      ? {
          pitManifest: groupBy(selected, (e) => e.provenance.pitManifestId || "UNKNOWN").map(
            (row) => {
              const sample = selected.find(
                (e) => (e.provenance.pitManifestId || "UNKNOWN") === row.key,
              );
              return {
                ...row,
                pitManifestId: row.key === "UNKNOWN" ? null : row.key,
                datasetId: sample?.provenance.datasetId ?? null,
                datasetContentHash: sample?.provenance.datasetContentHash ?? null,
              };
            },
          ),
        }
      : {}),
  };

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const summaryId = computeAnalyticsSummaryId({
    evaluationIds: selected.map((e) => e.evaluationId),
    filters,
  });

  return {
    schemaVersion: HFM_CHARTS_PERFORMANCE_ANALYTICS_SCHEMA_VERSION,
    contractId: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
    contractVersion: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
    policyId: HFM_CHARTS_PERFORMANCE_POLICY_ID,
    policyVersion: HFM_CHARTS_PERFORMANCE_ANALYTICS_POLICY_VERSION,
    summaryId,
    generatedAt,
    filters,
    populationMode: filters.populationMode,
    timeBasis: filters.timeBasis,
    population: {
      rawEvaluationRecords: rawCount,
      selectedEvaluations: selected.length,
      excludedByFilter,
      excludedMissingTimestamp,
      eligibleDirectional: eligible,
      triggered,
      untriggered,
      evaluated: selected.length,
    },
    trigger,
    winRate: decisiveWinRate,
    outcomeDistribution,
    eligibleDirectionalPredictions: eligible,
    triggered,
    untriggered,
    expiredUnresolved,
    targetReached,
    invalidationReached,
    ambiguousSameCandle,
    stillActive,
    noObservationWindow,
    decisiveWinRate,
    signedR,
    mae,
    mfe,
    maeSampleCount: mae.count,
    mfeSampleCount: mfe.count,
    maeMean: mae.mean,
    mfeMean: mfe.mean,
    breakdowns,
    analyticalConfidenceLabel: HFM_CHARTS_ANALYTICAL_CONFIDENCE_LABEL,
    reasoningCounts,
    warnings: [...new Set(warnings)],
    note:
      "P8.D Performance Analytics. Decisive win-rate = TARGET_REACHED / (TARGET_REACHED + INVALIDATION_REACHED). "
      + "UNTRIGGERED, AMBIGUOUS, EXPIRED, NO_TRADE, WAITING are not ordinary losses. "
      + "Analytical confidence is not win probability. OHLC research only — not broker account P&L. "
      + `Default evaluator ${HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION}; signed-R policy ${HFM_CHARTS_SIGNED_R_POLICY_VERSION}. `
      + "Calibration minimum 100/bucket not implemented and not met.",
    ...SAFETY,
    totalCompletedAnalyses:
      reasoningCounts.authority === "REASONING_STORE"
        ? reasoningCounts.completed
        : null,
    noTradeSkipped:
      reasoningCounts.authority === "REASONING_STORE"
        ? reasoningCounts.noTrade
        : null,
    waitingSkipped:
      reasoningCounts.authority === "REASONING_STORE"
        ? reasoningCounts.waiting
        : null,
  };
}

export async function loadAllChartsEvaluationsBounded(
  storage: HfmChartsPredictionOutcomeStorage,
  maxRecords = 10_000,
): Promise<HfmChartsPredictionEvaluationRecord[]> {
  const listed = await storage.listAllEvaluations({ offset: 0, limit: 100 });
  const all = [...listed.items];
  let offset = listed.items.length;
  while (offset < listed.total && offset < maxRecords) {
    const page = await storage.listAllEvaluations({ offset, limit: 100 });
    if (!page.items.length) break;
    all.push(...page.items);
    offset += page.items.length;
  }
  return all;
}

export async function buildChartsPerformanceAnalyticsFromStorage(input: {
  storage: HfmChartsPredictionOutcomeStorage;
  filters?: Partial<HfmChartsAnalyticsFilters>;
  reasoningCounts?: HfmChartsReasoningPopulationCounts | null;
}): Promise<HfmChartsPerformanceAnalyticsReport> {
  const evaluations = await loadAllChartsEvaluationsBounded(input.storage);
  return buildChartsPerformanceAnalytics({
    evaluations,
    filters: input.filters,
    reasoningCounts: input.reasoningCounts,
  });
}
