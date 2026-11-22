/**
 * Phase 5F STEP 1 + P8.B — dataset → replay tip clipping helpers.
 *
 * Open-time clipping (`clipResearchBarsToTip`) is NOT sufficient as the sole
 * multi-timeframe Point-in-Time gate. Production replay / authoritative research
 * must use close-time visibility (`clipResearchBarsClosedAtDecision`).
 */
import type { HfmHistoricalBar } from "../../historical-engine.js";
import {
  filterBarsClosedAtDecision,
  resolveDecisionTimeSec,
  type MtfVisibilityResult,
} from "../production-integration/mtf-visibility.js";
import type { MifResearchStoredBar } from "./types.js";

/** Explicit clipping modes for manifests / callers. */
export const MIF_REPLAY_CLIP_MODES = [
  "OPEN_TIME_ONLY",
  "CLOSE_TIME_AT_DECISION",
] as const;
export type MifReplayClipMode = (typeof MIF_REPLAY_CLIP_MODES)[number];

export const MIF_PIT_VISIBILITY_POLICY_ID =
  "kwizera.mif.pit-close-time-visibility.v1" as const;
export const MIF_PIT_VISIBILITY_POLICY_VERSION = "1.0.0" as const;

export function researchBarsToHfmHistorical(
  bars: readonly MifResearchStoredBar[],
): HfmHistoricalBar[] {
  return bars.map((b) => ({
    time: b.time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    tickVolume: b.tickVolume,
    realVolume: b.realVolume,
    spread: b.spread,
    validationStatus: "ok" as const,
    provenance: b.provenance,
  }));
}

export function hfmHistoricalToResearchBars(
  bars: readonly HfmHistoricalBar[],
): MifResearchStoredBar[] {
  return bars.map((b) => ({
    time: b.time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    tickVolume: b.tickVolume ?? null,
    realVolume: b.realVolume ?? null,
    spread: b.spread ?? null,
    validationStatus: "ok" as const,
    provenance: b.provenance === "cached" ? "cached" : "native",
    timebase: "BROKER_SERVER" as const,
  }));
}

/**
 * Clip bars so no candle with openTime > tipOpenTimeSec is visible.
 *
 * WARNING: Open-time only. Insufficient as the sole MTF Point-in-Time gate.
 * Prefer `clipResearchBarsClosedAtDecision` for production replay.
 */
export function clipResearchBarsToTip(
  bars: readonly MifResearchStoredBar[],
  tipOpenTimeSec: number,
): {
  bars: MifResearchStoredBar[];
  futureBarsExcluded: number;
  maxVisibleOpenTimeSec: number | null;
  noFutureLeakage: boolean;
  clipMode: "OPEN_TIME_ONLY";
  sufficientAsSoleMtfPitGate: false;
} {
  const visible: MifResearchStoredBar[] = [];
  let futureBarsExcluded = 0;
  for (const b of bars) {
    if (b.time <= tipOpenTimeSec) visible.push(b);
    else futureBarsExcluded += 1;
  }
  visible.sort((a, b) => a.time - b.time);
  const maxVisibleOpenTimeSec = visible.length ? visible[visible.length - 1]!.time : null;
  const noFutureLeakage =
    futureBarsExcluded === bars.length - visible.length &&
    (maxVisibleOpenTimeSec == null || maxVisibleOpenTimeSec <= tipOpenTimeSec) &&
    visible.every((b) => b.time <= tipOpenTimeSec);
  return {
    bars: visible,
    futureBarsExcluded,
    maxVisibleOpenTimeSec,
    noFutureLeakage,
    clipMode: "OPEN_TIME_ONLY",
    sufficientAsSoleMtfPitGate: false,
  };
}

export function assertNoFutureBarsBeyondTip(
  bars: readonly MifResearchStoredBar[],
  tipOpenTimeSec: number,
): { ok: true } | { ok: false; leakCount: number } {
  const leaks = bars.filter((b) => b.time > tipOpenTimeSec);
  if (leaks.length) return { ok: false, leakCount: leaks.length };
  return { ok: true };
}

export type ClipResearchBarsClosedAtDecisionResult =
  | {
      ok: true;
      bars: MifResearchStoredBar[];
      decisionTimeSec: number;
      excludedCount: number;
      clipMode: "CLOSE_TIME_AT_DECISION";
      visibility: MtfVisibilityResult;
      limitation: null;
      policyId: typeof MIF_PIT_VISIBILITY_POLICY_ID;
      policyVersion: typeof MIF_PIT_VISIBILITY_POLICY_VERSION;
    }
  | {
      ok: false;
      code: string;
      message: string;
      bars: [];
      decisionTimeSec: number | null;
      excludedCount: number;
      clipMode: "CLOSE_TIME_AT_DECISION";
      visibility: MtfVisibilityResult | null;
      limitation: string;
      policyId: typeof MIF_PIT_VISIBILITY_POLICY_ID;
      policyVersion: typeof MIF_PIT_VISIBILITY_POLICY_VERSION;
    };

/**
 * Point-in-Time clip: candle visible only when closeTime <= decisionTime.
 * decisionTime defaults to tipOpen + timeframe duration (authoritative tip close).
 *
 * Unsupported timeframe duration → explicit failure (never silent empty series).
 */
export function clipResearchBarsClosedAtDecision(input: {
  bars: readonly MifResearchStoredBar[];
  timeframe: string;
  tipOpenTimeSec: number;
  /** Override decision time; must still be finite positive. */
  decisionTimeSec?: number | null;
}): ClipResearchBarsClosedAtDecisionResult {
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  const tip = input.tipOpenTimeSec;
  const policy = {
    policyId: MIF_PIT_VISIBILITY_POLICY_ID,
    policyVersion: MIF_PIT_VISIBILITY_POLICY_VERSION,
    clipMode: "CLOSE_TIME_AT_DECISION" as const,
  };

  let decisionTimeSec: number;
  if (
    input.decisionTimeSec != null
    && Number.isFinite(input.decisionTimeSec)
    && input.decisionTimeSec > 0
  ) {
    decisionTimeSec = input.decisionTimeSec;
  } else {
    const resolved = resolveDecisionTimeSec({
      tipOpenTimeSec: tip,
      primaryTimeframe: timeframe,
    });
    if (!resolved.ok) {
      return {
        ok: false,
        code: resolved.reason,
        message: `unsupported or invalid timeframe/tip for close-time visibility: ${resolved.reason}`,
        bars: [],
        decisionTimeSec: null,
        excludedCount: input.bars.length,
        visibility: null,
        limitation: resolved.reason,
        ...policy,
      };
    }
    decisionTimeSec = resolved.decisionTimeSec;
  }

  const hfm = researchBarsToHfmHistorical(input.bars);
  const visibility = filterBarsClosedAtDecision({
    bars: hfm,
    timeframe,
    decisionTimeSec,
  });

  if (visibility.limitation) {
    return {
      ok: false,
      code: "TIMEFRAME_DURATION_UNKNOWN",
      message: visibility.limitation,
      bars: [],
      decisionTimeSec,
      excludedCount: input.bars.length,
      visibility,
      limitation: visibility.limitation,
      ...policy,
    };
  }

  const bars = hfmHistoricalToResearchBars(visibility.visible);
  return {
    ok: true,
    bars,
    decisionTimeSec,
    excludedCount: visibility.excluded.length,
    visibility,
    limitation: null,
    ...policy,
  };
}

/**
 * Assert every bar's close time is <= decisionTimeSec for the timeframe.
 */
export function assertNoBarsOpenAfterCloseDecision(input: {
  bars: readonly MifResearchStoredBar[];
  timeframe: string;
  decisionTimeSec: number;
}): { ok: true } | { ok: false; leakCount: number; reasons: string[] } {
  const check = clipResearchBarsClosedAtDecision({
    bars: input.bars,
    timeframe: input.timeframe,
    tipOpenTimeSec: input.decisionTimeSec, // unused when decisionTimeSec provided
    decisionTimeSec: input.decisionTimeSec,
  });
  if (!check.ok) {
    return {
      ok: false,
      leakCount: input.bars.length,
      reasons: [check.code, check.message],
    };
  }
  if (check.excludedCount > 0 && check.bars.length !== input.bars.length) {
    // Callers may pass already-clipped bars; only fail if any input bar would be excluded.
    const visibleTimes = new Set(check.bars.map((b) => b.time));
    const leaks = input.bars.filter((b) => !visibleTimes.has(b.time));
    if (leaks.length) {
      return {
        ok: false,
        leakCount: leaks.length,
        reasons: leaks.map(
          (b) => `open=${b.time} excluded_at_decision=${input.decisionTimeSec}`,
        ),
      };
    }
  }
  return { ok: true };
}
