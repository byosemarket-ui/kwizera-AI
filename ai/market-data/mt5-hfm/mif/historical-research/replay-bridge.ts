/**
 * Phase 5F STEP 1 — dataset → replay tip clipping helpers.
 * Does not weaken existing replay validation; prevents future-bar leakage at tip.
 */
import type { HfmHistoricalBar } from "../../historical-engine.js";
import type { MifResearchStoredBar } from "./types.js";

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

/**
 * Clip bars so no candle with openTime > tipOpenTimeSec is visible.
 * Returns verification that no future leakage remains.
 */
export function clipResearchBarsToTip(
  bars: readonly MifResearchStoredBar[],
  tipOpenTimeSec: number,
): {
  bars: MifResearchStoredBar[];
  futureBarsExcluded: number;
  maxVisibleOpenTimeSec: number | null;
  noFutureLeakage: boolean;
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
