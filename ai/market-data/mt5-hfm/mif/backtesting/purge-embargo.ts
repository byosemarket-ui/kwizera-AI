/**
 * Phase 5F STEP 4 — purge overlapping observations + embargo between folds.
 */
import { resolveTimeframeDurationSec } from "../canonical/candle.js";

export interface FoldBoundary {
  startOpenTimeSec: number;
  endOpenTimeSec: number;
}

export interface PurgeEmbargoPolicy {
  maxHorizonBars: number;
  maxLevelObservationBars: number;
  timeframe: string;
}

export function resolvePurgeEmbargoBars(policy: PurgeEmbargoPolicy): {
  purgeBars: number;
  embargoBars: number;
  horizonBars: number;
} {
  const horizonBars = Math.max(
    1,
    policy.maxHorizonBars,
    policy.maxLevelObservationBars > 0
      ? Math.min(policy.maxLevelObservationBars, policy.maxHorizonBars * 4)
      : policy.maxHorizonBars,
  );
  // Embargo at least max prediction horizon (in bars).
  const embargoBars = Math.max(policy.maxHorizonBars, 1);
  // Purge drops observations whose outcome window reaches into the next interval.
  const purgeBars = horizonBars;
  return { purgeBars, embargoBars, horizonBars };
}

/**
 * An observation at tipOpen with horizon H overlaps nextStart if tipOpen + H*step >= nextStart.
 * Using open-time bar counts (not wall-clock) for fold isolation.
 */
export function observationOverlapsNextInterval(input: {
  tipOpenTimeSec: number;
  tipIndex: number;
  nextIntervalStartIndex: number;
  horizonBars: number;
}): boolean {
  const outcomeEndIndex = input.tipIndex + input.horizonBars;
  return outcomeEndIndex >= input.nextIntervalStartIndex;
}

/**
 * Apply purge: exclude tips in `fromTips` whose outcome window overlaps `nextStartIndex`.
 */
export function applyPurge(input: {
  tipIndices: readonly number[];
  tipOpenTimes: readonly number[];
  nextIntervalStartIndex: number;
  horizonBars: number;
}): {
  keptIndices: number[];
  excluded: Array<{ tipIndex: number; tipOpenTimeSec: number; reason: string }>;
} {
  const keptIndices: number[] = [];
  const excluded: Array<{ tipIndex: number; tipOpenTimeSec: number; reason: string }> = [];
  for (let i = 0; i < input.tipIndices.length; i++) {
    const tipIndex = input.tipIndices[i]!;
    const tipOpen = input.tipOpenTimes[i]!;
    if (
      observationOverlapsNextInterval({
        tipOpenTimeSec: tipOpen,
        tipIndex,
        nextIntervalStartIndex: input.nextIntervalStartIndex,
        horizonBars: input.horizonBars,
      })
    ) {
      excluded.push({
        tipIndex,
        tipOpenTimeSec: tipOpen,
        reason: `PURGED_OUTCOME_OVERLAPS_NEXT_INTERVAL:horizon=${input.horizonBars}`,
      });
    } else {
      keptIndices.push(tipIndex);
    }
  }
  return { keptIndices, excluded };
}

/**
 * Embargo: skip tips with tipIndex < boundaryIndex + embargoBars.
 */
export function applyEmbargo(input: {
  tipIndices: readonly number[];
  tipOpenTimes: readonly number[];
  intervalStartIndex: number;
  embargoBars: number;
}): {
  keptIndices: number[];
  excluded: Array<{ tipIndex: number; tipOpenTimeSec: number; reason: string }>;
} {
  const gate = input.intervalStartIndex + input.embargoBars;
  const keptIndices: number[] = [];
  const excluded: Array<{ tipIndex: number; tipOpenTimeSec: number; reason: string }> = [];
  for (let i = 0; i < input.tipIndices.length; i++) {
    const tipIndex = input.tipIndices[i]!;
    const tipOpen = input.tipOpenTimes[i]!;
    if (tipIndex < gate) {
      excluded.push({
        tipIndex,
        tipOpenTimeSec: tipOpen,
        reason: `EMBARGO:need_index>=${gate}`,
      });
    } else {
      keptIndices.push(tipIndex);
    }
  }
  return { keptIndices, excluded };
}

export function barStepSec(timeframe: string): number | null {
  return resolveTimeframeDurationSec(timeframe);
}
