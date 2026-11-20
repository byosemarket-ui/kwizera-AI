/**
 * Phase 5F STEP 4 — MTF look-ahead leakage correction.
 * A candle is visible at decision time only if its authoritative close time
 * is not later than the decision timestamp. Never use wall-clock now().
 */
import {
  deriveCloseTimeSec,
  resolveTimeframeDurationSec,
} from "../canonical/candle.js";
import type { HfmHistoricalBar } from "../../historical-engine.js";

export interface MtfVisibilityResult {
  visible: HfmHistoricalBar[];
  excluded: Array<{
    openTimeSec: number;
    timeframe: string;
    closeTimeSec: number | null;
    reason: string;
  }>;
  decisionTimeSec: number;
  timeframeDurationSec: number | null;
  limitation: string | null;
}

export function resolveBarCloseTimeSec(
  openTimeSec: number,
  timeframe: string,
): number | null {
  return deriveCloseTimeSec(openTimeSec, timeframe);
}

export function resolveDecisionTimeSec(input: {
  tipOpenTimeSec: number;
  primaryTimeframe: string;
}): { ok: true; decisionTimeSec: number; durationSec: number } | { ok: false; reason: string } {
  const duration = resolveTimeframeDurationSec(input.primaryTimeframe);
  if (duration == null || !Number.isFinite(duration) || duration <= 0) {
    return {
      ok: false,
      reason: `PRIMARY_TIMEFRAME_DURATION_UNKNOWN:${input.primaryTimeframe}`,
    };
  }
  if (!Number.isFinite(input.tipOpenTimeSec) || input.tipOpenTimeSec <= 0) {
    return { ok: false, reason: "INVALID_TIP_OPEN_TIME" };
  }
  return {
    ok: true,
    decisionTimeSec: input.tipOpenTimeSec + duration,
    durationSec: duration,
  };
}

export function isBarClosedAtDecision(input: {
  openTimeSec: number;
  timeframe: string;
  decisionTimeSec: number;
}):
  | { visible: true; closeTimeSec: number }
  | { visible: false; reason: string; closeTimeSec: number | null } {
  if (!Number.isFinite(input.decisionTimeSec) || input.decisionTimeSec <= 0) {
    return { visible: false, reason: "INVALID_DECISION_TIME", closeTimeSec: null };
  }
  if (!Number.isFinite(input.openTimeSec) || input.openTimeSec <= 0) {
    return { visible: false, reason: "INVALID_OPEN_TIME", closeTimeSec: null };
  }
  const closeTimeSec = resolveBarCloseTimeSec(input.openTimeSec, input.timeframe);
  if (closeTimeSec == null) {
    return {
      visible: false,
      reason: "CLOSURE_UNVERIFIED_NO_DURATION",
      closeTimeSec: null,
    };
  }
  if (input.openTimeSec > input.decisionTimeSec) {
    return { visible: false, reason: "OPENS_AFTER_DECISION", closeTimeSec };
  }
  if (closeTimeSec > input.decisionTimeSec) {
    return { visible: false, reason: "STILL_FORMING_AT_DECISION", closeTimeSec };
  }
  return { visible: true, closeTimeSec };
}

export function filterBarsClosedAtDecision(input: {
  bars: readonly HfmHistoricalBar[];
  timeframe: string;
  decisionTimeSec: number;
}): MtfVisibilityResult {
  const duration = resolveTimeframeDurationSec(input.timeframe);
  const visible: HfmHistoricalBar[] = [];
  const excluded: MtfVisibilityResult["excluded"] = [];

  if (duration == null) {
    for (const b of input.bars) {
      excluded.push({
        openTimeSec: b.time,
        timeframe: input.timeframe,
        closeTimeSec: null,
        reason: "CLOSURE_UNVERIFIED_NO_DURATION",
      });
    }
    return {
      visible: [],
      excluded,
      decisionTimeSec: input.decisionTimeSec,
      timeframeDurationSec: null,
      limitation: `timeframe ${input.timeframe} duration unknown; all bars excluded`,
    };
  }

  for (const b of input.bars) {
    const check = isBarClosedAtDecision({
      openTimeSec: b.time,
      timeframe: input.timeframe,
      decisionTimeSec: input.decisionTimeSec,
    });
    if (check.visible) {
      visible.push(b);
    } else {
      excluded.push({
        openTimeSec: b.time,
        timeframe: input.timeframe,
        closeTimeSec: check.closeTimeSec,
        reason: check.reason,
      });
    }
  }

  visible.sort((a, b) => a.time - b.time);
  return {
    visible,
    excluded,
    decisionTimeSec: input.decisionTimeSec,
    timeframeDurationSec: duration,
    limitation: null,
  };
}
