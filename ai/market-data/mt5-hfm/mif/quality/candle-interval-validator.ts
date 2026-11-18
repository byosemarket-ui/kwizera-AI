/**
 * Phase 5B.2 Step 1 — interval boundary validation for [openTimeSec, closeTimeSec).
 */
import {
  resolveTimeframeDurationSec,
  type MifCanonicalCandle,
} from "../canonical/candle.js";
import {
  MIF_QI_DURATION_UNSUPPORTED,
  MIF_QI_INVALID_INTERVAL,
  MIF_QI_UNEXPECTED_DURATION,
} from "./codes.js";
import type { MifQualityFinding } from "./types.js";

export function validateCandleInterval(
  candle: MifCanonicalCandle,
  index: number,
  seriesTimeframe: string,
): MifQualityFinding[] {
  const out: MifQualityFinding[] = [];
  const expectedDuration = resolveTimeframeDurationSec(seriesTimeframe);
  const base = {
    candleIndex: index,
    openTimeSec: candle.openTimeSec,
    closeTimeSec: candle.closeTimeSec,
    candleState: candle.candleState,
    expectedDurationSec: expectedDuration,
  };

  if (candle.closeTimeSec != null) {
    if (typeof candle.closeTimeSec !== "number" || !Number.isFinite(candle.closeTimeSec)) {
      out.push({
        code: MIF_QI_INVALID_INTERVAL,
        severity: "blocking",
        message: "closeTimeSec is not finite",
        ...base,
      });
      return out;
    }
    if (
      typeof candle.openTimeSec === "number" &&
      Number.isFinite(candle.openTimeSec) &&
      candle.closeTimeSec <= candle.openTimeSec
    ) {
      out.push({
        code: MIF_QI_INVALID_INTERVAL,
        severity: "blocking",
        message: "closeTimeSec <= openTimeSec (interval must be positive half-open)",
        ...base,
        actualDurationSec: candle.closeTimeSec - candle.openTimeSec,
      });
    } else if (
      expectedDuration != null &&
      typeof candle.openTimeSec === "number" &&
      Number.isFinite(candle.openTimeSec)
    ) {
      const actual = candle.closeTimeSec - candle.openTimeSec;
      if (actual !== expectedDuration) {
        out.push({
          code: MIF_QI_UNEXPECTED_DURATION,
          severity: "blocking",
          message: `interval duration ${actual}s != expected ${expectedDuration}s for ${seriesTimeframe}`,
          ...base,
          actualDurationSec: actual,
        });
      }
    }
  } else if (expectedDuration == null) {
    // e.g. MN1 — null close is allowed; report uncertainty, not blocking.
    out.push({
      code: MIF_QI_DURATION_UNSUPPORTED,
      severity: "warning",
      message: `timeframe ${seriesTimeframe} has no fixed duration; closeTimeSec null is expected`,
      ...base,
    });
  }
  // When duration is known but closeTimeSec is null: adapters may omit; treat as warning uncertainty.
  else {
    out.push({
      code: MIF_QI_INVALID_INTERVAL,
      severity: "warning",
      message: `closeTimeSec null while timeframe ${seriesTimeframe} has known duration ${expectedDuration}s`,
      ...base,
    });
  }

  return out;
}

/** Effective exclusive close for overlap/gap math when duration is known. */
export function effectiveCloseTimeSec(
  candle: MifCanonicalCandle,
  seriesTimeframe: string,
): number | null {
  if (candle.closeTimeSec != null && Number.isFinite(candle.closeTimeSec)) {
    return candle.closeTimeSec;
  }
  const d = resolveTimeframeDurationSec(seriesTimeframe);
  if (d == null || !Number.isFinite(candle.openTimeSec) || candle.openTimeSec <= 0) return null;
  return candle.openTimeSec + d;
}
