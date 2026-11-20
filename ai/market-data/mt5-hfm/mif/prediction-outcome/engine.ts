/**
 * Phase 5F STEP 3 — Prediction Outcome Engine.
 * Composes evaluateOpportunityOutcome + path metrics. Does not rewrite 5D.7 semantics.
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import {
  evaluateOpportunityOutcome,
  type MifOutcomeLevelSpec,
} from "../production-integration/outcome-evaluation.js";
import {
  MIF_PREDICTION_DEFAULT_HORIZONS,
  MIF_PREDICTION_OUTCOME_CONTRACT_ID,
  MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
  MIF_PREDICTION_OUTCOME_ENGINE_ID,
  MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
  MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
} from "./contracts.js";
import { computeCandleRangeHash, computeOutcomeId } from "./identity.js";
import { computePathOutcome } from "./path-metrics.js";
import { isPredictionSnapshotValid } from "./snapshot.js";
import type {
  MifPredictionDataQuality,
  MifPredictionMarketProvenance,
  MifPredictionMarketSourceMode,
  MifPredictionOutcomeRecord,
  MifPredictionSnapshot,
} from "./types.js";

export interface EvaluatePredictionOutcomeInput {
  snapshot: MifPredictionSnapshot;
  futureClosedCandles: readonly MifCanonicalCandle[];
  activationClose: number | null;
  marketSourceMode: MifPredictionMarketSourceMode;
  marketProvenance: MifPredictionMarketProvenance;
  dataQuality: MifPredictionDataQuality;
  horizons?: readonly number[];
  maxAgeBars?: number;
  evaluationTimestamp?: string;
  revisionOrdinal?: number;
}

export type EvaluatePredictionOutcomeResult =
  | { ok: true; outcome: MifPredictionOutcomeRecord }
  | { ok: false; code: string; message: string };

function levelsFromSnapshot(snapshot: MifPredictionSnapshot): MifOutcomeLevelSpec {
  return {
    entryPrice: snapshot.levels.entry.price,
    targetPrice: snapshot.levels.target.price,
    targetSide: snapshot.levels.target.side,
    invalidationPrice: snapshot.levels.invalidation.price,
    invalidationSide: snapshot.levels.invalidation.side,
  };
}

function overallCompleteness(
  path: ReturnType<typeof computePathOutcome>,
  futureCount: number,
): "COMPLETE" | "PARTIAL" | "INSUFFICIENT" {
  if (futureCount === 0) return "INSUFFICIENT";
  const statuses = path.horizons.map((h) => h.completeness);
  if (statuses.every((s) => s === "COMPLETE")) return "COMPLETE";
  if (statuses.some((s) => s === "COMPLETE" || s === "PARTIAL")) return "PARTIAL";
  return "INSUFFICIENT";
}

function provenanceKey(p: MifPredictionMarketProvenance): string {
  if (p.mode === "HISTORICAL_ARCHIVE") {
    return `hist:${p.datasetId}:v${p.datasetVersion}:${p.contentHash}`;
  }
  if (p.mode === "LIVE_COPYRATES") {
    return `live:${p.sourceProvenance}:${p.snapshotId ?? ""}:${p.sequenceId ?? ""}`;
  }
  return `unbound:${p.note}`;
}

/**
 * Evaluate a frozen prediction against validated future CLOSED candles.
 * Activation candle is never included in measurements (caller must supply future-only).
 */
export function evaluatePredictionOutcome(
  input: EvaluatePredictionOutcomeInput,
): EvaluatePredictionOutcomeResult {
  const { snapshot } = input;
  if (!isPredictionSnapshotValid(snapshot)) {
    return {
      ok: false,
      code: "INVALID_SNAPSHOT",
      message: snapshot.invalidReason ?? "snapshot is not FROZEN",
    };
  }
  if (
    !Number.isFinite(snapshot.activationOpenTimeSec)
    || snapshot.activationOpenTimeSec <= 0
  ) {
    return {
      ok: false,
      code: "MISSING_ACTIVATION_CUTOFF",
      message: "activation cutoff absent or invalid; now() fallback forbidden",
    };
  }

  // Hard guard: never include activation or earlier bars.
  const future = input.futureClosedCandles.filter(
    (c) => c.openTimeSec > snapshot.activationOpenTimeSec && c.candleState === "CLOSED",
  );
  const leaked = input.futureClosedCandles.filter(
    (c) => c.openTimeSec <= snapshot.activationOpenTimeSec,
  );
  if (leaked.length > 0) {
    return {
      ok: false,
      code: "ACTIVATION_LEAKAGE",
      message: `${leaked.length} bars at or before activation were supplied as future bars`,
    };
  }

  const horizons = [...(input.horizons ?? MIF_PREDICTION_DEFAULT_HORIZONS)];
  const computationTimestamp = input.evaluationTimestamp ?? new Date().toISOString();

  const pathOutcome = computePathOutcome({
    snapshot,
    futureClosedCandles: future,
    activationClose: input.activationClose,
    horizons,
  });

  const levelOutcome = evaluateOpportunityOutcome({
    candidateId: snapshot.candidateId,
    opportunitySnapshotRef: snapshot.predictionId,
    activationOpenTimeSec: snapshot.activationOpenTimeSec,
    levels: levelsFromSnapshot(snapshot),
    closedCandles: future,
    maxAgeBars: input.maxAgeBars ?? Math.max(...horizons, 200),
    evaluationTimestamp: computationTimestamp,
  });

  const candleRangeHash = computeCandleRangeHash({
    openTimeSecs: future.map((c) => c.openTimeSec),
    closes: future.map((c) => c.close),
    highs: future.map((c) => c.high),
    lows: future.map((c) => c.low),
    marketSourceMode: input.marketSourceMode,
    provenanceKey: provenanceKey(input.marketProvenance),
  });

  const outcomeId = computeOutcomeId({
    predictionId: snapshot.predictionId,
    policyVersion: MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
    evaluatorVersion: MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
    candleRangeHash,
  });

  const outcome: MifPredictionOutcomeRecord = {
    contractId: MIF_PREDICTION_OUTCOME_CONTRACT_ID,
    contractVersion: MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
    engineId: MIF_PREDICTION_OUTCOME_ENGINE_ID,
    engineVersion: MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
    outcomeId,
    predictionId: snapshot.predictionId,
    snapshotHash: snapshot.snapshotHash,
    policyVersion: MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
    evaluatorVersion: MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
    marketSourceMode: input.marketSourceMode,
    marketProvenance: input.marketProvenance,
    evaluatedCandleRange: {
      firstOpenTimeSec: future[0]?.openTimeSec ?? null,
      lastOpenTimeSec: future[future.length - 1]?.openTimeSec ?? null,
      barCount: future.length,
    },
    candleRangeHash,
    requestedHorizons: horizons,
    pathOutcome,
    levelOutcome,
    dataQuality: input.dataQuality,
    completeness: overallCompleteness(pathOutcome, future.length),
    computationTimestamp,
    revisionOrdinal: input.revisionOrdinal ?? 1,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    analyticalOutcomeOnly: true,
    doesNotApproveAiReasoning: true,
    isNotCalibratedProbability: true,
    notExecutable: true,
  };

  return { ok: true, outcome };
}
