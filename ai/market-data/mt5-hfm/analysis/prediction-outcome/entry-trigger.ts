/**
 * P8.C — entry-zone trigger determination.
 *
 * Prediction activation (P8.A) ≠ entry trigger.
 * Trigger requires a CLOSED candle strictly after activation that intersects the entry zone.
 * Activation candle never triggers. Trigger candle is excluded from TP/SL evaluation.
 */
import type { MifCanonicalCandle } from "../../mif/canonical/candle.js";
import type { MifPredictionSnapshot } from "../../mif/prediction-outcome/types.js";
import {
  HFM_CHARTS_ENTRY_TRIGGER_POLICY_ID,
  HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION,
  HFM_CHARTS_ENTRY_ZONE_TOUCH_RULE,
} from "./contracts.js";
import type {
  HfmChartsEntryTriggerRecord,
  HfmChartsEntryZone,
} from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Normalize Charts entryZone {low,high} or a point price into an inclusive zone.
 */
export function normalizeEntryZone(input: {
  low?: number | null;
  high?: number | null;
  price?: number | null;
}): HfmChartsEntryZone | null {
  const low = finitePositive(input.low) ? input.low : null;
  const high = finitePositive(input.high) ? input.high : null;
  const price = finitePositive(input.price) ? input.price : null;
  if (low != null && high != null) {
    if (high < low) return null;
    return { low, high };
  }
  if (low != null && high == null) return { low, high: low };
  if (high != null && low == null) return { high, low: high };
  if (price != null) return { low: price, high: price };
  return null;
}

/**
 * Resolve entry zone for evaluation.
 * Prefer request override (Charts tradePlan.entryZone); else snapshot structured entry point.
 * Historical P8.A snapshots store midpoint entry only — treated as a degenerate point zone.
 */
export function resolveChartsEntryZone(input: {
  snapshot: MifPredictionSnapshot;
  entryZoneOverride?: { low?: number | null; high?: number | null } | null;
}):
  | {
      ok: true;
      zone: HfmChartsEntryZone;
      source: "REQUEST_OVERRIDE" | "SNAPSHOT_STRUCTURED_ENTRY_POINT";
    }
  | { ok: false; code: string; message: string } {
  if (input.entryZoneOverride) {
    const zone = normalizeEntryZone(input.entryZoneOverride);
    if (zone) {
      return { ok: true, zone, source: "REQUEST_OVERRIDE" };
    }
    return {
      ok: false,
      code: "INVALID_ENTRY_ZONE",
      message: "entryZone override is invalid (need finite low/high with high >= low)",
    };
  }
  const price = input.snapshot.levels.entry.price;
  const zone = normalizeEntryZone({ price });
  if (!zone) {
    return {
      ok: false,
      code: "MISSING_ENTRY_ZONE",
      message: "snapshot has no structured entry price and no entryZone override was provided",
    };
  }
  return { ok: true, zone, source: "SNAPSHOT_STRUCTURED_ENTRY_POINT" };
}

/**
 * Inclusive range intersection: candle traded through [zone.low, zone.high].
 * Direction-agnostic — BUY/SELL use the same geometric touch rule.
 */
export function candleIntersectsEntryZone(
  candle: MifCanonicalCandle,
  zone: HfmChartsEntryZone,
): boolean {
  if (candle.candleState !== "CLOSED") return false;
  if (!finitePositive(candle.high) || !finitePositive(candle.low)) return false;
  return candle.high >= zone.low && candle.low <= zone.high;
}

/**
 * Find first CLOSED post-activation candle that intersects the entry zone.
 * Does not invent intrabar ordering; does not treat activation overlap as a trigger.
 */
export function findEntryTrigger(input: {
  activationOpenTimeSec: number;
  entryZone: HfmChartsEntryZone;
  entryZoneSource: "REQUEST_OVERRIDE" | "SNAPSHOT_STRUCTURED_ENTRY_POINT";
  closedCandles: readonly MifCanonicalCandle[];
  maxBars?: number;
}): HfmChartsEntryTriggerRecord {
  const maxBars = input.maxBars ?? 10_000;
  const after = [...input.closedCandles]
    .filter(
      (c) =>
        c.candleState === "CLOSED"
        && c.openTimeSec > input.activationOpenTimeSec,
    )
    .sort((a, b) => a.openTimeSec - b.openTimeSec)
    .slice(0, maxBars);

  for (const c of after) {
    if (candleIntersectsEntryZone(c, input.entryZone)) {
      const mid =
        finitePositive(c.close)
          ? c.close
          : (input.entryZone.low + input.entryZone.high) / 2;
      return {
        policyId: HFM_CHARTS_ENTRY_TRIGGER_POLICY_ID,
        policyVersion: HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION,
        status: "TRIGGERED",
        entryZone: input.entryZone,
        entryZoneSource: input.entryZoneSource,
        touchRule: HFM_CHARTS_ENTRY_ZONE_TOUCH_RULE,
        activationOpenTimeSec: input.activationOpenTimeSec,
        triggerOpenTimeSec: c.openTimeSec,
        triggerCloseTimeSec: c.closeTimeSec ?? null,
        triggerReferencePrice: mid,
        triggerCandleExcludedFromLevelEval: true,
        barsScannedForTrigger: after.length,
        reason: null,
      };
    }
  }

  return {
    policyId: HFM_CHARTS_ENTRY_TRIGGER_POLICY_ID,
    policyVersion: HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION,
    status: "UNTRIGGERED",
    entryZone: input.entryZone,
    entryZoneSource: input.entryZoneSource,
    touchRule: HFM_CHARTS_ENTRY_ZONE_TOUCH_RULE,
    activationOpenTimeSec: input.activationOpenTimeSec,
    triggerOpenTimeSec: null,
    triggerCloseTimeSec: null,
    triggerReferencePrice: null,
    triggerCandleExcludedFromLevelEval: true,
    barsScannedForTrigger: after.length,
    reason:
      after.length === 0
        ? "no CLOSED candles strictly after activation"
        : "entry zone never intersected by a subsequent CLOSED candle",
  };
}

/**
 * Post-trigger observation window: CLOSED candles strictly after the trigger candle.
 * Conservative — OHLC cannot prove entry-before-TP/SL within the trigger bar.
 */
export function selectPostTriggerClosedCandles(input: {
  closedCandles: readonly MifCanonicalCandle[];
  triggerOpenTimeSec: number;
}): MifCanonicalCandle[] {
  return [...input.closedCandles]
    .filter(
      (c) =>
        c.candleState === "CLOSED" && c.openTimeSec > input.triggerOpenTimeSec,
    )
    .sort((a, b) => a.openTimeSec - b.openTimeSec);
}
