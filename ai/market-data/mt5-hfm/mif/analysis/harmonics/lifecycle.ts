/**
 * Phase 5C Step 2 — harmonic lifecycle.
 * FORMING / CONFIRMED / FAILED / INVALIDATED — never conflated.
 *
 * Rules (deterministic):
 * - INVALIDATED: geometry/ratios no longer valid, or malformed structure flag.
 * - FORMING: required ratios pass; XABC confirmed; D may be provisional OR
 *   no CLOSED reaction candle after D yet. Quality may force FORMING-only.
 * - CONFIRMED: all five pivots CONFIRMED; ratios pass; quality allows confirmed;
 *   ≥1 CLOSED candle after D with reaction toward A (bullish close > D, bearish close < D);
 *   no prior CLOSED invalidation through PRZ.
 * - FAILED: after D, a CLOSED candle closes through PRZ opposite to expected reaction
 *   (bullish: close < PRZ.low; bearish: close > PRZ.high) before confirmation reaction.
 *
 * FORMING candles never confirm or fail. No future candles.
 */
import type { StructureCandle } from "../../../../../forex-structure/types.js";
import { closedCandlesAfter, isClosedCandle } from "../patterns/geometry.js";
import type {
  MifHarmonicLifecycle,
  MifHarmonicOrientation,
  MifHarmonicPivotRef,
  MifHarmonicPrz,
} from "./types.js";

export interface HarmonicLifecycleInput {
  ratiosValid: boolean;
  structureInvalidated: boolean;
  orientation: MifHarmonicOrientation;
  pivots: MifHarmonicPivotRef[];
  prz: MifHarmonicPrz;
  atr: number;
  candles: readonly StructureCandle[];
  allowConfirmed: boolean;
  /** Buffer as ATR multiple for PRZ breach (default 0 = exact). */
  failureBufferAtrMult?: number;
}

export interface HarmonicLifecycleResult {
  lifecycle: MifHarmonicLifecycle;
  confirmationCandleOpenTimeSec: number | null;
  failureCandleOpenTimeSec: number | null;
}

export function evaluateHarmonicLifecycle(input: HarmonicLifecycleInput): HarmonicLifecycleResult {
  if (input.structureInvalidated || !input.ratiosValid) {
    return {
      lifecycle: "INVALIDATED",
      confirmationCandleOpenTimeSec: null,
      failureCandleOpenTimeSec: null,
    };
  }

  const d = input.pivots.find((p) => p.role === "D");
  if (!d) {
    return {
      lifecycle: "INVALIDATED",
      confirmationCandleOpenTimeSec: null,
      failureCandleOpenTimeSec: null,
    };
  }

  const buf = (input.failureBufferAtrMult ?? 0) * input.atr;
  const after = closedCandlesAfter(input.candles, d.timeSec).filter((c) => isClosedCandle(c));

  const przLow = input.prz.low;
  const przHigh = input.prz.high;

  let failureCandle: StructureCandle | null = null;
  let confirmCandle: StructureCandle | null = null;

  for (const c of after) {
    if (przLow != null && przHigh != null) {
      const bearFail =
        input.orientation === "BEARISH" && c.close > przHigh + buf;
      const bullFail =
        input.orientation === "BULLISH" && c.close < przLow - buf;
      if (bearFail || bullFail) {
        failureCandle = c;
        break;
      }
    }
    // Reaction confirmation: move back toward A from D.
    const bullOk = input.orientation === "BULLISH" && c.close > d.price;
    const bearOk = input.orientation === "BEARISH" && c.close < d.price;
    if (bullOk || bearOk) {
      confirmCandle = c;
      break;
    }
  }

  if (failureCandle) {
    return {
      lifecycle: "FAILED",
      confirmationCandleOpenTimeSec: null,
      failureCandleOpenTimeSec: failureCandle.time,
    };
  }

  const allConfirmed = input.pivots.every((p) => p.status === "CONFIRMED");
  if (confirmCandle && allConfirmed && input.allowConfirmed) {
    return {
      lifecycle: "CONFIRMED",
      confirmationCandleOpenTimeSec: confirmCandle.time,
      failureCandleOpenTimeSec: null,
    };
  }

  return {
    lifecycle: "FORMING",
    confirmationCandleOpenTimeSec: null,
    failureCandleOpenTimeSec: null,
  };
}
