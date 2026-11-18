/**
 * Phase 5B.2 Step 1 — pure OHLC + numeric integrity for MifCanonicalCandle.
 * Does not round, repair, or coerce prices.
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import {
  MIF_QI_INVALID_OHLC,
  MIF_QI_INVALID_TIMESTAMP,
  MIF_QI_MALFORMED_FIELD,
  MIF_QI_PROVIDER_MISMATCH,
  MIF_QI_UNSUPPORTED_CANDLE_STATE,
  type MifQualityFindingSeverity,
} from "./codes.js";
import type { MifQualityFinding } from "./types.js";

function fieldTypeOk(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Validate a single candle's numeric OHLC geometry and provider identity.
 * Does NOT impose a universal positive-price rule (canonical contract allows
 * instrument-specific domains). Prices must be finite numbers only.
 */
export function validateCandleOhlcIntegrity(
  candle: MifCanonicalCandle,
  index: number,
): MifQualityFinding[] {
  const out: MifQualityFinding[] = [];
  const base = {
    candleIndex: index,
    openTimeSec: candle.openTimeSec,
    closeTimeSec: candle.closeTimeSec,
    candleState: candle.candleState,
  };

  if (candle.providerId !== MIF_PROVIDER_ID) {
    out.push({
      code: MIF_QI_PROVIDER_MISMATCH,
      severity: "blocking",
      message: `providerId ${String(candle.providerId)} != HFM_MT5`,
      ...base,
    });
  }

  const fields: Array<[string, unknown]> = [
    ["open", candle.open],
    ["high", candle.high],
    ["low", candle.low],
    ["close", candle.close],
  ];
  for (const [name, v] of fields) {
    if (v === null || v === undefined) {
      out.push({
        code: MIF_QI_MALFORMED_FIELD,
        severity: "blocking",
        message: `${name} is null/undefined`,
        ...base,
        evidence: { field: name },
      });
      continue;
    }
    if (typeof v !== "number") {
      out.push({
        code: MIF_QI_MALFORMED_FIELD,
        severity: "blocking",
        message: `${name} is not a number`,
        ...base,
        evidence: { field: name, typeof: typeof v },
      });
      continue;
    }
    if (!Number.isFinite(v)) {
      out.push({
        code: MIF_QI_INVALID_OHLC,
        severity: "blocking",
        message: `${name} is not finite`,
        ...base,
        evidence: { field: name, value: String(v) },
      });
    }
  }

  if (!fieldTypeOk(candle.openTimeSec) || candle.openTimeSec <= 0) {
    out.push({
      code: MIF_QI_INVALID_TIMESTAMP,
      severity: "blocking",
      message: "openTimeSec is not a finite positive unix second",
      ...base,
    });
  }

  // Geometry only when all OHLC are finite numbers.
  if (
    fieldTypeOk(candle.open) &&
    fieldTypeOk(candle.high) &&
    fieldTypeOk(candle.low) &&
    fieldTypeOk(candle.close)
  ) {
    if (candle.high < candle.low) {
      out.push({
        code: MIF_QI_INVALID_OHLC,
        severity: "blocking",
        message: "high < low",
        ...base,
      });
    }
    if (candle.high < candle.open || candle.high < candle.close) {
      out.push({
        code: MIF_QI_INVALID_OHLC,
        severity: "blocking",
        message: "high below open/close",
        ...base,
      });
    }
    if (candle.low > candle.open || candle.low > candle.close) {
      out.push({
        code: MIF_QI_INVALID_OHLC,
        severity: "blocking",
        message: "low above open/close",
        ...base,
      });
    }
  }

  // State awareness: INVALID/MISSING/STALE are not valid closed historical bars.
  if (
    candle.candleState === "INVALID" ||
    candle.candleState === "MISSING" ||
    candle.candleState === "STALE"
  ) {
    const severity: MifQualityFindingSeverity =
      candle.candleState === "INVALID" ? "blocking" : "degraded";
    out.push({
      code: MIF_QI_UNSUPPORTED_CANDLE_STATE,
      severity,
      message: `candleState ${candle.candleState} is not a valid closed historical candle`,
      ...base,
    });
  }

  return out;
}

/** Structurally usable for series chronology/gaps: finite OHLC + positive open + CLOSED or FORMING. */
export function isStructurallyUsableCandle(candle: MifCanonicalCandle): boolean {
  if (candle.providerId !== MIF_PROVIDER_ID) return false;
  if (!fieldTypeOk(candle.openTimeSec) || candle.openTimeSec <= 0) return false;
  if (![candle.open, candle.high, candle.low, candle.close].every(fieldTypeOk)) return false;
  if (candle.high < candle.low) return false;
  if (candle.high < candle.open || candle.high < candle.close) return false;
  if (candle.low > candle.open || candle.low > candle.close) return false;
  if (candle.candleState === "INVALID" || candle.candleState === "MISSING" || candle.candleState === "STALE") {
    return false;
  }
  return candle.candleState === "CLOSED" || candle.candleState === "FORMING";
}

/** Closed historical bar eligible for gap chaining. */
export function isClosedHistoricalCandidate(candle: MifCanonicalCandle): boolean {
  return isStructurallyUsableCandle(candle) && candle.candleState === "CLOSED";
}
