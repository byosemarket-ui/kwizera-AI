/**
 * Phase 05 — candle-structure pressure proxies (HFM_MT5).
 * Uses close location + body direction. Tick volume is activity only — not aggressor side.
 */
import { atrAt, ATR_METHOD_V1 } from "../../../../../forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { HfmCandlePressureBarMetrics } from "./types.js";

export function closeLocation(high: number, low: number, close: number): number | null {
  const range = high - low;
  if (!(range > 0) || !Number.isFinite(range)) return null;
  return (close - low) / range;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Buying pressure proxy in [0, 100].
 * - Close near high → buyers more in control of the bar
 * - Bullish body adds weight; bearish body reduces
 * NOT aggressor volume. NOT probability.
 */
export function candleBuyingPressureScore(input: {
  open: number;
  high: number;
  low: number;
  close: number;
}): number {
  const loc = closeLocation(input.high, input.low, input.close);
  const range = input.high - input.low;
  if (loc == null || !(range > 0)) return 50;
  const body = Math.abs(input.close - input.open);
  const bodyFrac = clamp01(body / range);
  const bull = input.close >= input.open;
  // Close location is primary (0–1 → buy share). Body reinforces direction.
  let buyShare = loc;
  if (bull) buyShare = clamp01(buyShare + 0.15 * bodyFrac);
  else buyShare = clamp01(buyShare - 0.15 * bodyFrac);
  return Math.round(buyShare * 1000) / 10;
}

export function candleSellingPressureScore(input: {
  open: number;
  high: number;
  low: number;
  close: number;
}): number {
  const buy = candleBuyingPressureScore(input);
  return Math.round((100 - buy) * 10) / 10;
}

export function pressureImbalanceFromScores(buy: number, sell: number): number {
  const t = buy + sell;
  if (!(t > 0)) return 0;
  return Math.round(((buy - sell) / t) * 1000) / 1000;
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

export function computeBarPressureMetrics(input: {
  candles: readonly MifCanonicalCandle[];
  index: number;
  atrPeriod: number;
}): HfmCandlePressureBarMetrics | null {
  const tip = input.candles[input.index];
  if (!tip) return null;
  const range = tip.high - tip.low;
  const body = Math.abs(tip.close - tip.open);
  const loc = closeLocation(tip.high, tip.low, tip.close);
  const buy = candleBuyingPressureScore(tip);
  const sell = candleSellingPressureScore(tip);
  const atr = computeAtrSmaOfTr(input.candles, input.atrPeriod, input.index);
  const bodyAtr = atr != null && atr > 0 ? body / atr : null;
  const state =
    tip.candleState === "CLOSED" || tip.candleState === "FORMING"
      ? tip.candleState
      : "UNKNOWN";
  return {
    openTimeSec: tip.openTimeSec,
    candleState: state,
    body,
    range: range > 0 ? range : 0,
    closeLocation: loc,
    buyingPressureScore: buy,
    sellingPressureScore: sell,
    pressureImbalance: pressureImbalanceFromScores(buy, sell),
    tickVolume:
      tip.tickVolume != null && Number.isFinite(tip.tickVolume) ? tip.tickVolume : null,
    atr,
    bodyAtr,
  };
}

export function meanTickVolume(
  bars: readonly HfmCandlePressureBarMetrics[],
): number | null {
  const vals = bars
    .map((b) => b.tickVolume)
    .filter((v): v is number => v != null && Number.isFinite(v) && v >= 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Re-export ATR method id for diagnostics. */
export const BSP_ATR_METHOD = ATR_METHOD_V1;
