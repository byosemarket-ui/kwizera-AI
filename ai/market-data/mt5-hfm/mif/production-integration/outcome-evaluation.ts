/**
 * Phase 5D.7 — deterministic outcome evaluation against subsequent HFM_MT5 candles.
 *
 * Analytical tracking only. Does not invent entry/SL/TP/invalidation levels.
 * Uses only levels supplied by the caller (from the original opportunity snapshot).
 * Temporal rule: only CLOSED candles with openTimeSec STRICTLY AFTER activationOpenTimeSec.
 * Entry considered active at the close of the activation candle (documented).
 * Same-candle target+invalidation → BOTH_AMBIGUOUS_SAME_CANDLE (never favor a side).
 * Missing data never becomes a win or loss.
 */
import { createHash } from "node:crypto";
import type { MifCanonicalCandle } from "../canonical/candle.js";
import { stableSerialize } from "../quality/stable-identity.js";
import type { MifCandidateOutcomeKind } from "./persistence/types.js";

export const MIF_OUTCOME_EVALUATION_CONTRACT_ID =
  "kwizera.mif.outcome-evaluation.v1" as const;
export const MIF_OUTCOME_EVALUATION_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_OUTCOME_EVALUATION_ENGINE_ID = "mif-outcome-evaluation" as const;
export const MIF_OUTCOME_EVALUATION_ENGINE_VERSION = "1.0.0" as const;

export type MifOutcomeEvaluationResultKind =
  | "TARGET_REACHED"
  | "INVALIDATION_REACHED"
  | "EXPIRED_UNRESOLVED"
  | "STILL_ACTIVE"
  | "INSUFFICIENT_HISTORICAL_EVIDENCE"
  | "BOTH_AMBIGUOUS_SAME_CANDLE"
  | "AMBIGUOUS_OUTCOME"
  | "LEVELS_NOT_PROVIDED"
  | "NO_OBSERVATION_WINDOW";

export interface MifOutcomeLevelSpec {
  targetPrice?: number | null;
  targetSide?: "ABOVE" | "BELOW" | null;
  invalidationPrice?: number | null;
  invalidationSide?: "ABOVE" | "BELOW" | null;
  /** Optional entry for R-multiple; never invented. */
  entryPrice?: number | null;
  /** Optional risk distance |entry - invalidation|; computed when both present. */
}

export interface MifOutcomeEvaluationInput {
  candidateId: string;
  /** Original opportunity snapshot reference (id / hash). */
  opportunitySnapshotRef: string;
  /**
   * Activation time: openTimeSec of the signal/detection candle.
   * Only subsequent CLOSED candles (openTimeSec > activation) evaluate outcome.
   */
  activationOpenTimeSec: number;
  levels: MifOutcomeLevelSpec;
  /** Subsequent market observations (any order; sorted internally). */
  closedCandles: readonly MifCanonicalCandle[];
  maxAgeBars?: number;
  evaluationTimestamp?: string;
}

export interface MifOutcomeEvaluationRecord {
  contractId: typeof MIF_OUTCOME_EVALUATION_CONTRACT_ID;
  contractVersion: typeof MIF_OUTCOME_EVALUATION_CONTRACT_VERSION;
  engineId: typeof MIF_OUTCOME_EVALUATION_ENGINE_ID;
  engineVersion: typeof MIF_OUTCOME_EVALUATION_ENGINE_VERSION;
  evaluationId: string;
  evaluationTimestamp: string;
  candidateId: string;
  opportunitySnapshotRef: string;
  activationOpenTimeSec: number;
  /** Documented: entry active after activation candle close; first evaluable bar is next CLOSED. */
  entryActivationRule: "AFTER_ACTIVATION_CANDLE_CLOSE";
  levels: MifOutcomeLevelSpec;
  resultKind: MifOutcomeEvaluationResultKind;
  outcomeKind: MifCandidateOutcomeKind;
  resolvedOpenTimeSec: number | null;
  resolvedClose: number | null;
  barsObserved: number;
  barsExcludedBeforeActivation: number;
  duplicateObservationsDropped: number;
  gapDetected: boolean;
  ambiguityReason: string | null;
  exclusionReason: string | null;
  /** Realized R multiple when entry, invalidation, and resolution price all exist. */
  realizedRMultiple: number | null;
  realizedRMultipleDefinition: string;
  sourceMarketDataRefs: {
    candleOpenTimeSecs: readonly number[];
    candleCount: number;
  };
  evaluationInputsHash: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  analyticalOutcomeOnly: true;
}

function crossed(
  candle: MifCanonicalCandle,
  price: number,
  side: "ABOVE" | "BELOW",
): boolean {
  if (side === "ABOVE") return candle.high >= price;
  return candle.low <= price;
}

function computeR(
  levels: MifOutcomeLevelSpec,
  exitPrice: number | null,
  kind: MifOutcomeEvaluationResultKind,
): number | null {
  if (exitPrice == null) return null;
  const entry = levels.entryPrice;
  const inv = levels.invalidationPrice;
  if (entry == null || inv == null) return null;
  if (!Number.isFinite(entry) || !Number.isFinite(inv) || !Number.isFinite(exitPrice)) return null;
  const risk = Math.abs(entry - inv);
  if (!(risk > 0)) return null;
  if (kind === "TARGET_REACHED") return (exitPrice - entry) / risk;
  if (kind === "INVALIDATION_REACHED") return (exitPrice - entry) / risk;
  return null;
}

/**
 * Deterministic, temporally-correct outcome evaluation.
 * Pure function — does not mutate persistence. Caller decides whether to persist.
 */
export function evaluateOpportunityOutcome(
  input: MifOutcomeEvaluationInput,
): MifOutcomeEvaluationRecord {
  const evaluationTimestamp = input.evaluationTimestamp ?? new Date().toISOString();
  const maxAge = input.maxAgeBars ?? 200;
  const levels = { ...input.levels };

  const inputsHash = createHash("sha256")
    .update(
      stableSerialize({
        candidateId: input.candidateId,
        snapshot: input.opportunitySnapshotRef,
        activation: input.activationOpenTimeSec,
        levels,
        maxAge,
        contract: MIF_OUTCOME_EVALUATION_CONTRACT_VERSION,
      }),
    )
    .digest("hex");

  const base = (
    partial: Omit<
      MifOutcomeEvaluationRecord,
      | "contractId"
      | "contractVersion"
      | "engineId"
      | "engineVersion"
      | "evaluationId"
      | "evaluationTimestamp"
      | "candidateId"
      | "opportunitySnapshotRef"
      | "activationOpenTimeSec"
      | "entryActivationRule"
      | "levels"
      | "evaluationInputsHash"
      | "placesOrders"
      | "mutatesBroker"
      | "acceptsForExecution"
      | "doesNotApproveAiReasoning"
      | "analyticalOutcomeOnly"
      | "realizedRMultipleDefinition"
    > & { resultKind: MifOutcomeEvaluationResultKind },
  ): MifOutcomeEvaluationRecord => {
    const evaluationId = `oe:${inputsHash.slice(0, 12)}:${partial.resultKind}`;
    return {
      contractId: MIF_OUTCOME_EVALUATION_CONTRACT_ID,
      contractVersion: MIF_OUTCOME_EVALUATION_CONTRACT_VERSION,
      engineId: MIF_OUTCOME_EVALUATION_ENGINE_ID,
      engineVersion: MIF_OUTCOME_EVALUATION_ENGINE_VERSION,
      evaluationId,
      evaluationTimestamp,
      candidateId: input.candidateId,
      opportunitySnapshotRef: input.opportunitySnapshotRef,
      activationOpenTimeSec: input.activationOpenTimeSec,
      entryActivationRule: "AFTER_ACTIVATION_CANDLE_CLOSE",
      levels,
      ...partial,
      realizedRMultiple:
        partial.realizedRMultiple
        ?? computeR(levels, partial.resolvedClose, partial.resultKind),
      realizedRMultipleDefinition:
        "(exitClose - entry) / |entry - invalidation|; only when all three prices exist; NOT a win probability",
      evaluationInputsHash: inputsHash,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalOutcomeOnly: true,
    };
  };

  const hasTarget =
    levels.targetPrice != null
    && Number.isFinite(levels.targetPrice)
    && (levels.targetSide === "ABOVE" || levels.targetSide === "BELOW");
  const hasInv =
    levels.invalidationPrice != null
    && Number.isFinite(levels.invalidationPrice)
    && (levels.invalidationSide === "ABOVE" || levels.invalidationSide === "BELOW");

  if (!hasTarget && !hasInv) {
    return base({
      resultKind: "LEVELS_NOT_PROVIDED",
      outcomeKind: "OUTCOME_UNKNOWN",
      resolvedOpenTimeSec: null,
      resolvedClose: null,
      barsObserved: 0,
      barsExcludedBeforeActivation: 0,
      duplicateObservationsDropped: 0,
      gapDetected: false,
      ambiguityReason: null,
      exclusionReason: "no target or invalidation levels were stored on the original opportunity",
      realizedRMultiple: null,
      sourceMarketDataRefs: { candleOpenTimeSecs: [], candleCount: 0 },
    });
  }

  // Sort + filter CLOSED + after activation; drop duplicates idempotently.
  const sorted = [...input.closedCandles]
    .filter((c) => c.candleState === "CLOSED")
    .sort((a, b) => a.openTimeSec - b.openTimeSec);

  let excluded = 0;
  let dupes = 0;
  const seen = new Set<number>();
  const after: MifCanonicalCandle[] = [];
  for (const c of sorted) {
    if (c.openTimeSec <= input.activationOpenTimeSec) {
      excluded += 1;
      continue;
    }
    if (seen.has(c.openTimeSec)) {
      dupes += 1;
      continue;
    }
    seen.add(c.openTimeSec);
    after.push(c);
  }

  if (!after.length) {
    return base({
      resultKind: "NO_OBSERVATION_WINDOW",
      outcomeKind: "NONE",
      resolvedOpenTimeSec: null,
      resolvedClose: null,
      barsObserved: 0,
      barsExcludedBeforeActivation: excluded,
      duplicateObservationsDropped: dupes,
      gapDetected: false,
      ambiguityReason: null,
      exclusionReason: "no CLOSED candles strictly after activationOpenTimeSec",
      realizedRMultiple: null,
      sourceMarketDataRefs: { candleOpenTimeSecs: [], candleCount: 0 },
    });
  }

  // Gap detection: irregular spacing relative to median step (informational).
  let gapDetected = false;
  if (after.length >= 3) {
    const steps: number[] = [];
    for (let i = 1; i < after.length; i++) {
      steps.push(after[i]!.openTimeSec - after[i - 1]!.openTimeSec);
    }
    steps.sort((a, b) => a - b);
    const median = steps[Math.floor(steps.length / 2)]!;
    gapDetected = steps.some((s) => median > 0 && s > median * 2.5);
  }

  const window = after.slice(0, maxAge);
  const refs = window.map((c) => c.openTimeSec);

  let invalidationHit: MifCanonicalCandle | null = null;
  let targetHit: MifCanonicalCandle | null = null;

  for (const c of window) {
    if (
      hasInv
      && !invalidationHit
      && crossed(c, levels.invalidationPrice!, levels.invalidationSide!)
    ) {
      invalidationHit = c;
    }
    if (
      hasTarget
      && !targetHit
      && crossed(c, levels.targetPrice!, levels.targetSide!)
    ) {
      targetHit = c;
    }
    if (invalidationHit && targetHit) break;
  }

  if (invalidationHit && targetHit && invalidationHit.openTimeSec === targetHit.openTimeSec) {
    return base({
      resultKind: "BOTH_AMBIGUOUS_SAME_CANDLE",
      outcomeKind: "BOTH_AMBIGUOUS_SAME_CANDLE",
      resolvedOpenTimeSec: invalidationHit.openTimeSec,
      resolvedClose: invalidationHit.close,
      barsObserved: window.length,
      barsExcludedBeforeActivation: excluded,
      duplicateObservationsDropped: dupes,
      gapDetected,
      ambiguityReason:
        "target and invalidation both touched on the same CLOSED candle; OHLC cannot establish order",
      exclusionReason: null,
      realizedRMultiple: null,
      sourceMarketDataRefs: { candleOpenTimeSecs: refs, candleCount: refs.length },
    });
  }

  if (invalidationHit && (!targetHit || invalidationHit.openTimeSec < targetHit.openTimeSec)) {
    return base({
      resultKind: "INVALIDATION_REACHED",
      outcomeKind: "INVALIDATION_REACHED",
      resolvedOpenTimeSec: invalidationHit.openTimeSec,
      resolvedClose: invalidationHit.close,
      barsObserved: window.length,
      barsExcludedBeforeActivation: excluded,
      duplicateObservationsDropped: dupes,
      gapDetected,
      ambiguityReason: null,
      exclusionReason: null,
      realizedRMultiple: null,
      sourceMarketDataRefs: { candleOpenTimeSecs: refs, candleCount: refs.length },
    });
  }

  if (targetHit) {
    return base({
      resultKind: "TARGET_REACHED",
      outcomeKind: "TARGET_REACHED",
      resolvedOpenTimeSec: targetHit.openTimeSec,
      resolvedClose: targetHit.close,
      barsObserved: window.length,
      barsExcludedBeforeActivation: excluded,
      duplicateObservationsDropped: dupes,
      gapDetected,
      ambiguityReason: null,
      exclusionReason: null,
      realizedRMultiple: null,
      sourceMarketDataRefs: { candleOpenTimeSecs: refs, candleCount: refs.length },
    });
  }

  if (after.length < maxAge && gapDetected && window.length < 3) {
    return base({
      resultKind: "INSUFFICIENT_HISTORICAL_EVIDENCE",
      outcomeKind: "OUTCOME_UNKNOWN",
      resolvedOpenTimeSec: null,
      resolvedClose: null,
      barsObserved: window.length,
      barsExcludedBeforeActivation: excluded,
      duplicateObservationsDropped: dupes,
      gapDetected,
      ambiguityReason: null,
      exclusionReason: "insufficient contiguous historical bars after activation",
      realizedRMultiple: null,
      sourceMarketDataRefs: { candleOpenTimeSecs: refs, candleCount: refs.length },
    });
  }

  if (window.length >= maxAge) {
    return base({
      resultKind: "EXPIRED_UNRESOLVED",
      outcomeKind: "EXPIRED_UNRESOLVED",
      resolvedOpenTimeSec: window[window.length - 1]!.openTimeSec,
      resolvedClose: window[window.length - 1]!.close,
      barsObserved: window.length,
      barsExcludedBeforeActivation: excluded,
      duplicateObservationsDropped: dupes,
      gapDetected,
      ambiguityReason: null,
      exclusionReason: null,
      realizedRMultiple: null,
      sourceMarketDataRefs: { candleOpenTimeSecs: refs, candleCount: refs.length },
    });
  }

  return base({
    resultKind: "STILL_ACTIVE",
    outcomeKind: "NONE",
    resolvedOpenTimeSec: null,
    resolvedClose: null,
    barsObserved: window.length,
    barsExcludedBeforeActivation: excluded,
    duplicateObservationsDropped: dupes,
    gapDetected,
    ambiguityReason: null,
    exclusionReason: null,
    realizedRMultiple: null,
    sourceMarketDataRefs: { candleOpenTimeSecs: refs, candleCount: refs.length },
  });
}

/**
 * Extract levels from persisted candidate invalidation/conditions notes when present.
 * Never invents prices — returns nulls when not parseable.
 */
export function extractLevelsFromCandidateNotes(input: {
  invalidationConditions?: readonly string[] | null;
  requiredConfirmations?: readonly string[] | null;
  thesis?: string | null;
  rationale?: string | null;
}): MifOutcomeLevelSpec {
  const blob = [
    ...(input.invalidationConditions ?? []),
    ...(input.requiredConfirmations ?? []),
    input.thesis ?? "",
    input.rationale ?? "",
  ].join(" | ");

  const num = (keys: string[]): number | null => {
    for (const k of keys) {
      const re = new RegExp(`${k}\\s*[=:]\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
      const m = blob.match(re);
      if (m) {
        const v = Number(m[1]);
        if (Number.isFinite(v)) return v;
      }
    }
    return null;
  };

  const side = (keys: string[]): "ABOVE" | "BELOW" | null => {
    for (const k of keys) {
      const re = new RegExp(`${k}\\s*[=:]\\s*(ABOVE|BELOW)`, "i");
      const m = blob.match(re);
      if (m) return m[1]!.toUpperCase() as "ABOVE" | "BELOW";
    }
    return null;
  };

  return {
    targetPrice: num(["targetPrice", "target", "tp"]),
    targetSide: side(["targetSide", "tpSide"]),
    invalidationPrice: num(["invalidationPrice", "invalidation", "sl", "stop"]),
    invalidationSide: side(["invalidationSide", "slSide"]),
    entryPrice: num(["entryPrice", "entry"]),
  };
}
