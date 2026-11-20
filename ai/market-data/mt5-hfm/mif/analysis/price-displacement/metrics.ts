/**
 * Phase 5D.7 — ATR-normalized displacement metrics (no look-ahead).
 * ATR uses SMA_OF_TR via shared atrAt helper — same method as regime/patterns.
 */
import {
  atrAt,
  ATR_METHOD_V1,
} from "../../../../../forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import { MIF_PRICE_DISPLACEMENT_ATR_METHOD_ID } from "./contracts.js";
import type { MifDisplacementDirection, MifPriceDisplacementMetrics } from "./types.js";

export function trueRangeAt(
  candles: readonly MifCanonicalCandle[],
  index: number,
): number | null {
  const c = candles[index];
  if (!c) return null;
  const prev = index > 0 ? candles[index - 1] : null;
  const hl = c.high - c.low;
  if (prev == null) return hl;
  return Math.max(hl, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
}

export function closeLocation(high: number, low: number, close: number): number | null {
  const range = high - low;
  if (!(range > 0) || !Number.isFinite(range)) return null;
  return (close - low) / range;
}

export function computeAtrSmaOfTr(
  closed: readonly MifCanonicalCandle[],
  period: number,
  endIndex: number,
): number | null {
  if (closed.length < period + 1) return null;
  if (endIndex < period) return null;
  const highs = closed.map((c) => c.high);
  const lows = closed.map((c) => c.low);
  const closes = closed.map((c) => c.close);
  return atrAt(highs, lows, closes, period, endIndex);
}

export interface StructuralBoundaryInput {
  price: number;
  side: "SUPPORT" | "RESISTANCE" | "UNKNOWN";
  refId: string | null;
}

/**
 * Compute tip displacement metrics.
 * - tipIndex must address a candle already in `candles` (closed subset for confirmed).
 * - ATR at tip uses only candles at/before tipIndex (no future bars).
 */
export function computeDisplacementMetrics(input: {
  candles: readonly MifCanonicalCandle[];
  tipIndex: number;
  atrPeriod: number;
  atrMethodId: string;
  minBodyAtr: number;
  minTrueRangeAtr: number;
  minCloseLocation: number;
  structuralBreakBufferAtr: number;
  structuralBoundary?: StructuralBoundaryInput | null;
}): MifPriceDisplacementMetrics | null {
  const { candles, tipIndex, atrPeriod } = input;
  const tip = candles[tipIndex];
  if (!tip) return null;
  if (
    input.atrMethodId !== MIF_PRICE_DISPLACEMENT_ATR_METHOD_ID
    && input.atrMethodId !== ATR_METHOD_V1
  ) {
    return null;
  }

  const body = Math.abs(tip.close - tip.open);
  const tr = trueRangeAt(candles, tipIndex);
  if (tr == null) return null;

  // ATR excludes the tip's own TR contribution for period warm-up consistency:
  // atrAt(endIndex) uses TR at endIndex; that is intentional and matches regime/patterns.
  const atr = computeAtrSmaOfTr(candles, atrPeriod, tipIndex);
  const bodyAtr = atr != null && atr > 0 ? body / atr : null;
  const trueRangeAtr = atr != null && atr > 0 ? tr / atr : null;
  const loc = closeLocation(tip.high, tip.low, tip.close);

  let direction: MifDisplacementDirection = "NONE";
  if (tip.close > tip.open) direction = "UP";
  else if (tip.close < tip.open) direction = "DOWN";

  const strongBull =
    bodyAtr != null
    && trueRangeAtr != null
    && loc != null
    && bodyAtr >= input.minBodyAtr
    && trueRangeAtr >= input.minTrueRangeAtr
    && loc >= input.minCloseLocation
    && direction === "UP";

  const strongBear =
    bodyAtr != null
    && trueRangeAtr != null
    && loc != null
    && bodyAtr >= input.minBodyAtr
    && trueRangeAtr >= input.minTrueRangeAtr
    && loc <= 1 - input.minCloseLocation
    && direction === "DOWN";

  const strongCandle = strongBull || strongBear;

  let structuralBreak = false;
  let structuralBoundaryPrice: number | null = null;
  let structuralBoundarySide: StructuralBoundaryInput["side"] | null = null;
  let structuralBoundaryRefId: string | null = null;

  const boundary = input.structuralBoundary ?? null;
  if (boundary && atr != null && atr > 0 && Number.isFinite(boundary.price)) {
    structuralBoundaryPrice = boundary.price;
    structuralBoundarySide = boundary.side;
    structuralBoundaryRefId = boundary.refId;
    const buffer = input.structuralBreakBufferAtr * atr;
    if (boundary.side === "RESISTANCE" && tip.close >= boundary.price + buffer) {
      structuralBreak = true;
    } else if (boundary.side === "SUPPORT" && tip.close <= boundary.price - buffer) {
      structuralBreak = true;
    }
  }

  const candleState =
    tip.candleState === "CLOSED"
      ? "CLOSED"
      : tip.candleState === "FORMING"
        ? "FORMING"
        : "UNKNOWN";

  return {
    openTimeSec: tip.openTimeSec,
    closeTimeSec: tip.closeTimeSec,
    candleState,
    open: tip.open,
    high: tip.high,
    low: tip.low,
    close: tip.close,
    body,
    trueRange: tr,
    atr,
    bodyAtr,
    trueRangeAtr,
    closeLocation: loc,
    direction: strongBull ? "UP" : strongBear ? "DOWN" : direction,
    strongCandle,
    structuralBreak,
    structuralBoundaryPrice,
    structuralBoundarySide,
    structuralBoundaryRefId,
    lookbackBars: tipIndex + 1,
    atrPeriod,
    atrMethodId: MIF_PRICE_DISPLACEMENT_ATR_METHOD_ID,
  };
}
