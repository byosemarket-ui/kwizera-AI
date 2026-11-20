/**
 * Phase 5F STEP 3 — bounded historical performance aggregation.
 * Never counts revisions as independent predictions.
 * Never labels frequencies as calibrated probabilities.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  MIF_PREDICTION_OUTCOME_CONTRACT_ID,
  MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
  MIF_PREDICTION_PERFORMANCE_POLICY_ID,
  MIF_PREDICTION_PERFORMANCE_POLICY_VERSION,
} from "./contracts.js";
import type { MifPredictionOutcomeStorage } from "./persistence.js";
import type {
  MifPredictionDirection,
  MifPredictionDistributionStats,
  MifPredictionMarketSourceMode,
  MifPredictionOutcomeRecord,
  MifPredictionPerformanceGroupKey,
  MifPredictionPerformanceSummary,
  MifPredictionSnapshot,
} from "./types.js";

function dist(values: number[]): MifPredictionDistributionStats {
  if (!values.length) {
    return { count: 0, mean: null, median: null, min: null, max: null, stdev: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  const variance =
    sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / sorted.length;
  return {
    count: sorted.length,
    mean,
    median,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    stdev: Math.sqrt(variance),
  };
}

export interface AggregatePredictionPerformanceInput {
  storage: MifPredictionOutcomeStorage;
  /** Optional snapshot lookup for grouping fields. */
  snapshots?: Map<string, MifPredictionSnapshot>;
  groupKey?: Partial<MifPredictionPerformanceGroupKey>;
  /** Preloaded outcomes; otherwise load from storage. */
  outcomes?: readonly MifPredictionOutcomeRecord[];
}

/**
 * Select latest eligible revision per predictionId (max revisionOrdinal).
 */
export function selectLatestOutcomesByPrediction(
  outcomes: readonly MifPredictionOutcomeRecord[],
): MifPredictionOutcomeRecord[] {
  const map = new Map<string, MifPredictionOutcomeRecord>();
  for (const o of outcomes) {
    const prev = map.get(o.predictionId);
    if (!prev || o.revisionOrdinal >= prev.revisionOrdinal) {
      map.set(o.predictionId, o);
    }
  }
  return [...map.values()];
}

function matchesGroup(
  outcome: MifPredictionOutcomeRecord,
  snapshot: MifPredictionSnapshot | undefined,
  key: Partial<MifPredictionPerformanceGroupKey>,
): boolean {
  if (key.marketSourceMode && outcome.marketSourceMode !== key.marketSourceMode) {
    return false;
  }
  if (key.outcomeStatus && outcome.levelOutcome.resultKind !== key.outcomeStatus) {
    return false;
  }
  if (key.dateFromIso && outcome.computationTimestamp < key.dateFromIso) return false;
  if (key.dateToIso && outcome.computationTimestamp > key.dateToIso) return false;
  if (snapshot) {
    if (key.instrument && snapshot.instrument !== key.instrument.toUpperCase()) {
      return false;
    }
    if (key.timeframe && snapshot.timeframe !== key.timeframe.toUpperCase()) {
      return false;
    }
    if (key.direction && snapshot.direction !== key.direction) return false;
    if (key.modelVersion && snapshot.modelVersion !== key.modelVersion) return false;
    if (key.strategyVersion && snapshot.strategyVersion !== key.strategyVersion) {
      return false;
    }
  } else if (key.instrument || key.timeframe || key.direction) {
    // Cannot filter without snapshot — exclude to avoid silent mis-group.
    if (key.instrument || key.timeframe || key.direction) return false;
  }
  return true;
}

/**
 * Aggregate descriptive performance for unique predictions (latest revision only).
 */
export async function aggregatePredictionPerformance(
  input: AggregatePredictionPerformanceInput,
): Promise<MifPredictionPerformanceSummary> {
  const groupKey: MifPredictionPerformanceGroupKey = {
    instrument: input.groupKey?.instrument ?? null,
    timeframe: input.groupKey?.timeframe ?? null,
    direction: (input.groupKey?.direction as MifPredictionDirection | null) ?? null,
    horizon: input.groupKey?.horizon ?? null,
    modelVersion: input.groupKey?.modelVersion ?? null,
    strategyVersion: input.groupKey?.strategyVersion ?? null,
    marketSourceMode:
      (input.groupKey?.marketSourceMode as MifPredictionMarketSourceMode | null) ?? null,
    outcomeStatus: input.groupKey?.outcomeStatus ?? null,
    dateFromIso: input.groupKey?.dateFromIso ?? null,
    dateToIso: input.groupKey?.dateToIso ?? null,
  };

  const raw = input.outcomes
    ? [...input.outcomes]
    : await input.storage.listAllOutcomes();

  const snapshots = input.snapshots ?? new Map<string, MifPredictionSnapshot>();
  if (!input.snapshots) {
    for (const o of raw) {
      if (!snapshots.has(o.predictionId)) {
        const snap = await input.storage.getSnapshot(o.predictionId);
        if (snap) snapshots.set(o.predictionId, snap);
      }
    }
  }

  const filtered = raw.filter((o) =>
    matchesGroup(o, snapshots.get(o.predictionId), groupKey),
  );
  const latest = selectLatestOutcomesByPrediction(filtered);

  let completeOutcomes = 0;
  let partialOutcomes = 0;
  let insufficientOutcomes = 0;
  let missingLevelCount = 0;
  let ambiguousTargetInvalidationCount = 0;
  let gapAffectedCount = 0;
  let unsupportedDirectionCount = 0;
  const levelOutcomeFrequencies: Record<string, number> = {};

  const horizonSet = new Set<number>();
  for (const o of latest) {
    for (const h of o.requestedHorizons) horizonSet.add(h);
  }
  if (groupKey.horizon != null) {
    horizonSet.clear();
    horizonSet.add(groupKey.horizon);
  }

  const byHorizon = new Map<
    number,
    { fr: number[]; mfe: number[]; mae: number[]; complete: number; partial: number; insuff: number }
  >();
  for (const h of horizonSet) {
    byHorizon.set(h, { fr: [], mfe: [], mae: [], complete: 0, partial: 0, insuff: 0 });
  }

  for (const o of latest) {
    if (o.completeness === "COMPLETE") completeOutcomes += 1;
    else if (o.completeness === "PARTIAL") partialOutcomes += 1;
    else insufficientOutcomes += 1;

    const rk = o.levelOutcome.resultKind;
    levelOutcomeFrequencies[rk] = (levelOutcomeFrequencies[rk] ?? 0) + 1;
    if (rk === "LEVELS_NOT_PROVIDED") missingLevelCount += 1;
    if (rk === "BOTH_AMBIGUOUS_SAME_CANDLE" || rk === "AMBIGUOUS_OUTCOME") {
      ambiguousTargetInvalidationCount += 1;
    }
    if (o.dataQuality.gapDetected || o.pathOutcome.gapDetected) gapAffectedCount += 1;
    if (o.pathOutcome.unsupportedReason) unsupportedDirectionCount += 1;

    for (const hm of o.pathOutcome.horizons) {
      if (groupKey.horizon != null && hm.requestedHorizon !== groupKey.horizon) continue;
      const bucket = byHorizon.get(hm.requestedHorizon);
      if (!bucket) continue;
      if (hm.completeness === "COMPLETE") bucket.complete += 1;
      else if (hm.completeness === "PARTIAL") bucket.partial += 1;
      else bucket.insuff += 1;
      if (hm.completeness === "COMPLETE" || hm.completeness === "PARTIAL") {
        if (hm.forwardReturn != null) bucket.fr.push(hm.forwardReturn);
        if (hm.mfe != null) bucket.mfe.push(hm.mfe);
        if (hm.mae != null) bucket.mae.push(hm.mae);
      }
    }
  }

  const pathDistributions = [...byHorizon.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([horizon, b]) => ({
      horizon,
      forwardReturn: dist(b.fr),
      mfe: dist(b.mfe),
      mae: dist(b.mae),
      completeHorizonCount: b.complete,
      partialHorizonCount: b.partial,
      insufficientHorizonCount: b.insuff,
    }));

  const computedAt = new Date().toISOString();
  const summaryId = `perf:${createHash("sha256")
    .update(stableSerialize({ groupKey, n: latest.length, computedAt: computedAt.slice(0, 13) }), "utf8")
    .digest("hex")
    .slice(0, 24)}`;

  return {
    contractId: MIF_PREDICTION_OUTCOME_CONTRACT_ID,
    contractVersion: MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
    policyId: MIF_PREDICTION_PERFORMANCE_POLICY_ID,
    policyVersion: MIF_PREDICTION_PERFORMANCE_POLICY_VERSION,
    summaryId,
    groupKey,
    totalUniquePredictions: latest.length,
    completeOutcomes,
    partialOutcomes,
    insufficientOutcomes,
    missingLevelCount,
    ambiguousTargetInvalidationCount,
    gapAffectedCount,
    unsupportedDirectionCount,
    levelOutcomeFrequencies,
    pathDistributions,
    warnings: {
      historicalPitMetadataLimited: true,
      historicalTransactionCostsIncomplete: true,
      resultsNotCostAdjusted: true,
      historicalCoverageShallow: true,
      doesNotGuaranteeFuturePerformance: true,
      isNotCalibratedProbability: true,
    },
    computedAt,
    note:
      "Descriptive frequencies and path distributions only. Not calibrated probabilities. Revisions deduplicated by predictionId.",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    analyticalOutcomeOnly: true,
    doesNotApproveAiReasoning: true,
    isNotCalibratedProbability: true,
    notExecutable: true,
  };
}
