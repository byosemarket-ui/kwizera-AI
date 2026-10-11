/**
 * Fractal swing detection — market-structure-v1.
 *
 * HIGH at i: high[i] > all high[i-L..i-1] AND high[i] >= all high[i+1..i+R]
 * LOW at i:  low[i]  < all low[i-L..i-1]  AND low[i]  <= all low[i+1..i+R]
 *
 * Right-side ties use >= / <= so the earliest qualifying index wins.
 * Forming candles never confirm historical swings.
 */

import type { StructureCandle, StructureRuleParams, StructureSwing, SwingKind } from "./types.js";
import { isStructureCandleClosed } from "./validate.js";

function swingId(kind: SwingKind, time: number, index: number): string {
  return `swing-${kind.toLowerCase()}-${time}-${index}`;
}

function isSwingHighAt(
  candles: StructureCandle[],
  i: number,
  left: number,
  right: number,
): boolean {
  const hi = candles[i]!.high;
  for (let j = i - left; j < i; j += 1) {
    if (candles[j]!.high >= hi) return false; // strict > on left
  }
  for (let j = i + 1; j <= i + right; j += 1) {
    if (candles[j]!.high > hi) return false; // >= on right
  }
  return true;
}

function isSwingLowAt(
  candles: StructureCandle[],
  i: number,
  left: number,
  right: number,
): boolean {
  const lo = candles[i]!.low;
  for (let j = i - left; j < i; j += 1) {
    if (candles[j]!.low <= lo) return false; // strict < on left
  }
  for (let j = i + 1; j <= i + right; j += 1) {
    if (candles[j]!.low < lo) return false; // <= on right
  }
  return true;
}

/**
 * Detect fractal swings on a candle series (ascending, unique times).
 * `closedCount` = number of leading closed candles; indices >= closedCount are forming.
 */
export function detectSwings(
  candles: StructureCandle[],
  closedCount: number,
  params: StructureRuleParams,
  includeForming: boolean,
): StructureSwing[] {
  const left = Math.max(1, Math.floor(params.swingLeft));
  const right = Math.max(1, Math.floor(params.swingRight));
  const n = candles.length;
  if (n < left + 1 || closedCount < left + 1) return [];

  const lastIndex = includeForming && closedCount < n ? n - 1 : closedCount - 1;
  if (lastIndex < left) return [];

  const swings: StructureSwing[] = [];

  for (let i = left; i <= lastIndex; i += 1) {
    const rightAvailable = Math.min(right, lastIndex - i);
    const rightComplete = i + right <= lastIndex;
    const effectiveRight = rightComplete ? right : rightAvailable;

    let rightIncludesForming = false;
    for (let j = i + 1; j <= i + effectiveRight; j += 1) {
      if (j >= closedCount || !isStructureCandleClosed(candles[j]!)) {
        rightIncludesForming = true;
        break;
      }
    }
    const pivotIsForming = i >= closedCount || !isStructureCandleClosed(candles[i]!);

    // Geometry uses full right when available; partial/empty right → provisional candidate.
    if (!isSwingHighAt(candles, i, left, effectiveRight)) {
      // not a high
    } else {
      const status =
        rightComplete && !rightIncludesForming && !pivotIsForming
          ? "CONFIRMED"
          : "PROVISIONAL";
      const candle = candles[i]!;
      swings.push({
        id: swingId("HIGH", candle.time, i),
        kind: "HIGH",
        price: candle.high,
        time: candle.time,
        index: i,
        status,
        evidence: [
          `Fractal HIGH at index ${i} (L=${left}, R=${right})`,
          `price=${candle.high} time=${candle.time}`,
          status === "CONFIRMED"
            ? "Right window fully closed — CONFIRMED"
            : rightIncludesForming || pivotIsForming
              ? "Forming candle in window or pivot — PROVISIONAL"
              : "Right confirmation window incomplete — PROVISIONAL",
        ],
      });
    }

    if (isSwingLowAt(candles, i, left, effectiveRight)) {
      const status =
        rightComplete && !rightIncludesForming && !pivotIsForming
          ? "CONFIRMED"
          : "PROVISIONAL";
      const candle = candles[i]!;
      swings.push({
        id: swingId("LOW", candle.time, i),
        kind: "LOW",
        price: candle.low,
        time: candle.time,
        index: i,
        status,
        evidence: [
          `Fractal LOW at index ${i} (L=${left}, R=${right})`,
          `price=${candle.low} time=${candle.time}`,
          status === "CONFIRMED"
            ? "Right window fully closed — CONFIRMED"
            : rightIncludesForming || pivotIsForming
              ? "Forming candle in window or pivot — PROVISIONAL"
              : "Right confirmation window incomplete — PROVISIONAL",
        ],
      });
    }
  }

  swings.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return a.kind.localeCompare(b.kind);
  });

  if (swings.length > params.maxSwings) {
    return swings.slice(swings.length - params.maxSwings);
  }
  return swings;
}
