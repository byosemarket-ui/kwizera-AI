/**
 * Candle series validation for market structure.
 * Reuses forex-patterns validation (identical OHLC rules) and maps to StructureCandle.
 */

import type { PatternCandle } from "../forex-patterns/types.js";
import { isValidPatternCandle, validatePatternCandles } from "../forex-patterns/validate.js";
import type { StructureCandle, StructureValidationInfo } from "./types.js";

export interface ValidatedStructureSeries {
  candles: StructureCandle[];
  validation: StructureValidationInfo;
}

export function isValidStructureCandle(candle: StructureCandle): boolean {
  return isValidPatternCandle(candle as PatternCandle);
}

/**
 * Validate, de-duplicate by time (keep first), sort ascending.
 * Never invents prices — delegates to validatePatternCandles.
 */
export function validateStructureCandles(raw: StructureCandle[]): ValidatedStructureSeries {
  const { candles, validation } = validatePatternCandles(raw as PatternCandle[]);
  return {
    candles: candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      isClosed: candle.isClosed,
      closed: candle.closed,
    })),
    validation: {
      ok: validation.ok,
      skippedInvalid: validation.skippedInvalid,
      skippedDuplicates: validation.skippedDuplicates,
      warnings: [...validation.warnings],
      insufficientHistory: validation.insufficientHistory,
    },
  };
}

export function isStructureCandleClosed(candle: StructureCandle): boolean {
  if (typeof candle.isClosed === "boolean") return candle.isClosed;
  if (typeof candle.closed === "boolean") return candle.closed;
  return true;
}

export function priceScale(price: number): number {
  return Math.max(Math.abs(price), 1);
}

/** Relative equality: |a-b| <= epsilonRel * scale. */
export function pricesEqualRel(a: number, b: number, epsilonRel: number): boolean {
  const scale = Math.max(priceScale(a), priceScale(b));
  return Math.abs(a - b) <= epsilonRel * scale;
}
