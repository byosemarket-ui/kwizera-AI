/**
 * Candle series validation for pattern detection.
 * Never fabricates OHLC. Sorts ascending; drops exact duplicate timestamps (keep first).
 */

import type { PatternCandle, PatternValidationInfo } from "./types.js";

export interface ValidatedCandleSeries {
  candles: PatternCandle[];
  validation: PatternValidationInfo;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidPatternCandle(candle: PatternCandle): boolean {
  if (!isFiniteNumber(candle.time) || candle.time <= 0) return false;
  if (
    !isFiniteNumber(candle.open)
    || !isFiniteNumber(candle.high)
    || !isFiniteNumber(candle.low)
    || !isFiniteNumber(candle.close)
  ) {
    return false;
  }
  if (candle.high < Math.max(candle.open, candle.close)) return false;
  if (candle.low > Math.min(candle.open, candle.close)) return false;
  if (candle.high < candle.low) return false;
  return true;
}

/**
 * Validate, de-duplicate by time (keep first), sort ascending.
 * Reports unsorted input via warnings. Never invents prices.
 */
export function validatePatternCandles(raw: PatternCandle[]): ValidatedCandleSeries {
  const warnings: string[] = [];
  let skippedInvalid = 0;
  let skippedDuplicates = 0;

  const valid: PatternCandle[] = [];
  for (const candle of raw) {
    if (!isValidPatternCandle(candle)) {
      skippedInvalid += 1;
      continue;
    }
    valid.push({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      isClosed: typeof candle.isClosed === "boolean"
        ? candle.isClosed
        : typeof candle.closed === "boolean"
          ? candle.closed
          : undefined,
      closed: typeof candle.closed === "boolean"
        ? candle.closed
        : typeof candle.isClosed === "boolean"
          ? candle.isClosed
          : undefined,
    });
  }

  if (skippedInvalid > 0) {
    warnings.push(`Skipped ${skippedInvalid} invalid OHLC candle(s).`);
  }

  // Detect genuine out-of-order that sorting cannot safely resolve:
  // non-finite times already dropped; remaining are sortable. Warn if input order differed.
  let wasUnsorted = false;
  for (let i = 1; i < valid.length; i += 1) {
    if (valid[i]!.time < valid[i - 1]!.time) {
      wasUnsorted = true;
      break;
    }
  }
  if (wasUnsorted) {
    warnings.push("Input timestamps were out of order; sorted ascending for analysis.");
  }

  // Stable sort by time; drop exact duplicate timestamps (keep first occurrence in sorted order,
  // which preserves the first-seen among equal times after sorting by original index).
  const indexed = valid.map((candle, index) => ({ candle, index }));
  indexed.sort((a, b) => {
    if (a.candle.time !== b.candle.time) return a.candle.time - b.candle.time;
    return a.index - b.index;
  });

  const seen = new Set<number>();
  const candles: PatternCandle[] = [];
  for (const { candle } of indexed) {
    if (seen.has(candle.time)) {
      skippedDuplicates += 1;
      continue;
    }
    seen.add(candle.time);
    candles.push(candle);
  }

  if (skippedDuplicates > 0) {
    warnings.push(`Dropped ${skippedDuplicates} duplicate timestamp(s) (kept first).`);
  }

  // After sort+dedupe, series is monotonic non-decreasing with unique times — safe.
  const ok = candles.length > 0 || raw.length === 0;
  return {
    candles,
    validation: {
      ok,
      skippedInvalid,
      skippedDuplicates,
      warnings,
      insufficientHistory: false,
    },
  };
}
