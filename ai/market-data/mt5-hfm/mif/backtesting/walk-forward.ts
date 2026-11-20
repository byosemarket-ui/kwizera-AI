/**
 * Phase 5F STEP 4 — rolling walk-forward fold planner + purge/embargo.
 */
import {
  MIF_BACKTEST_DEFAULT_MAX_FOLDS,
  MIF_BACKTEST_DEFAULT_MIN_OOS_SAMPLES,
  MIF_BACKTEST_HARD_MAX_FOLDS,
  MIF_WALK_FORWARD_POLICY_ID,
  MIF_WALK_FORWARD_POLICY_VERSION,
} from "./contracts.js";
import { applyEmbargo, applyPurge, resolvePurgeEmbargoBars } from "./purge-embargo.js";

export interface WalkForwardPlanFold {
  foldIndex: number;
  isStartIndex: number;
  isEndIndex: number; // exclusive tip index end
  valStartIndex: number | null;
  valEndIndex: number | null;
  oosStartIndex: number;
  oosEndIndex: number;
  purgeBars: number;
  embargoBars: number;
}

export interface WalkForwardPlan {
  policyId: string;
  policyVersion: string;
  mode: "ROLLING";
  warmupBars: number;
  barCount: number;
  tipStartIndex: number;
  tipEndIndex: number;
  folds: WalkForwardPlanFold[];
  horizonBars: number;
  limitation: string | null;
}

/**
 * Build rolling folds over tip indices [warmup, barCount).
 * Fractions: IS 50%, VAL 20% (optional), OOS 30% within each window; roll forward.
 */
export function planRollingWalkForward(input: {
  barCount: number;
  warmupBars: number;
  maxFolds?: number;
  maxHorizonBars?: number;
  maxLevelObservationBars?: number;
  timeframe: string;
  useValidation?: boolean;
}): WalkForwardPlan {
  const tipStart = Math.max(0, input.warmupBars);
  const tipEnd = input.barCount;
  const usable = tipEnd - tipStart;
  const maxFolds = Math.min(
    MIF_BACKTEST_HARD_MAX_FOLDS,
    Math.max(1, input.maxFolds ?? MIF_BACKTEST_DEFAULT_MAX_FOLDS),
  );
  const { purgeBars, embargoBars, horizonBars } = resolvePurgeEmbargoBars({
    maxHorizonBars: input.maxHorizonBars ?? 16,
    maxLevelObservationBars: input.maxLevelObservationBars ?? 200,
    timeframe: input.timeframe,
  });

  if (usable < 40) {
    return {
      policyId: MIF_WALK_FORWARD_POLICY_ID,
      policyVersion: MIF_WALK_FORWARD_POLICY_VERSION,
      mode: "ROLLING",
      warmupBars: input.warmupBars,
      barCount: input.barCount,
      tipStartIndex: tipStart,
      tipEndIndex: tipEnd,
      folds: [],
      horizonBars,
      limitation: "INSUFFICIENT_HISTORY_FOR_WALK_FORWARD",
    };
  }

  // Each fold window size ≈ usable / maxFolds (with overlap via rolling stride)
  const windowSize = Math.max(30, Math.floor(usable / Math.max(1, maxFolds - 0.5)));
  const stride = Math.max(10, Math.floor(windowSize * 0.35));
  const useVal = input.useValidation !== false;
  const folds: WalkForwardPlanFold[] = [];

  for (let start = tipStart; start + windowSize <= tipEnd && folds.length < maxFolds; start += stride) {
    const end = Math.min(tipEnd, start + windowSize);
    const span = end - start;
    const isLen = Math.floor(span * 0.5);
    const valLen = useVal ? Math.floor(span * 0.2) : 0;
    const oosLen = span - isLen - valLen;
    if (oosLen < 5 || isLen < 5) continue;

    const isStartIndex = start;
    const isEndIndex = start + isLen;
    const valStartIndex = useVal ? isEndIndex : null;
    const valEndIndex = useVal ? isEndIndex + valLen : null;
    const oosStartIndex = useVal ? (valEndIndex as number) : isEndIndex;
    const oosEndIndex = end;

    folds.push({
      foldIndex: folds.length,
      isStartIndex,
      isEndIndex,
      valStartIndex,
      valEndIndex,
      oosStartIndex,
      oosEndIndex,
      purgeBars,
      embargoBars,
    });
  }

  return {
    policyId: MIF_WALK_FORWARD_POLICY_ID,
    policyVersion: MIF_WALK_FORWARD_POLICY_VERSION,
    mode: "ROLLING",
    warmupBars: input.warmupBars,
    barCount: input.barCount,
    tipStartIndex: tipStart,
    tipEndIndex: tipEnd,
    folds,
    horizonBars,
    limitation: folds.length ? null : "NO_FOLDS_PLANNED",
  };
}

/**
 * Tip indices eligible for OOS after embargo; IS tips after purge vs OOS start.
 */
export function selectFoldTipIndices(input: {
  fold: WalkForwardPlanFold;
  allTipIndices: readonly number[];
  tipOpenTimesByIndex: ReadonlyMap<number, number>;
  forSegment: "IS" | "VAL" | "OOS";
  nextSegmentStartIndex: number | null;
  horizonBars: number;
}): {
  tipIndices: number[];
  exclusions: Array<{ tipIndex: number; tipOpenTimeSec: number; reason: string }>;
} {
  const fold = input.fold;
  let lo = fold.isStartIndex;
  let hi = fold.isEndIndex;
  if (input.forSegment === "VAL") {
    if (fold.valStartIndex == null || fold.valEndIndex == null) {
      return { tipIndices: [], exclusions: [] };
    }
    lo = fold.valStartIndex;
    hi = fold.valEndIndex;
  } else if (input.forSegment === "OOS") {
    lo = fold.oosStartIndex;
    hi = fold.oosEndIndex;
  }

  const inSeg = input.allTipIndices.filter((i) => i >= lo && i < hi);
  const opens = inSeg.map((i) => input.tipOpenTimesByIndex.get(i) ?? 0);

  if (input.forSegment === "OOS") {
    const emb = applyEmbargo({
      tipIndices: inSeg,
      tipOpenTimes: opens,
      intervalStartIndex: fold.oosStartIndex,
      embargoBars: fold.embargoBars,
    });
    return { tipIndices: emb.keptIndices, exclusions: emb.excluded };
  }

  // IS/VAL: purge those whose outcome overlaps next segment
  const nextStart = input.nextSegmentStartIndex ?? fold.oosStartIndex;
  const purged = applyPurge({
    tipIndices: inSeg,
    tipOpenTimes: opens,
    nextIntervalStartIndex: nextStart,
    horizonBars: input.horizonBars,
  });
  return { tipIndices: purged.keptIndices, exclusions: purged.excluded };
}

export { MIF_BACKTEST_DEFAULT_MIN_OOS_SAMPLES };
