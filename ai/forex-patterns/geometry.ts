/**
 * Candle geometry helpers — body, wicks, range ratios.
 * Pure functions; never mutate or fabricate OHLC.
 */

import type { PatternCandle, PatternRuleParams } from "./types.js";

export interface CandleGeometry {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
  body: number;
  range: number;
  upperWick: number;
  lowerWick: number;
  bodyTop: number;
  bodyBottom: number;
  isBullish: boolean;
  isBearish: boolean;
  isDojiLike: boolean;
}

export function isCandleClosed(candle: PatternCandle): boolean {
  if (typeof candle.isClosed === "boolean") return candle.isClosed;
  if (typeof candle.closed === "boolean") return candle.closed;
  return true;
}

export function priceScale(candle: Pick<PatternCandle, "open" | "high" | "low" | "close">): number {
  return Math.max(
    Math.abs(candle.open),
    Math.abs(candle.high),
    Math.abs(candle.low),
    Math.abs(candle.close),
    1,
  );
}

/** True when high-low is effectively zero relative to price scale. */
export function isZeroRange(candle: PatternCandle, params: PatternRuleParams): boolean {
  const range = candle.high - candle.low;
  return range <= params.minRangeEpsilon * priceScale(candle);
}

export function bodySize(candle: PatternCandle): number {
  return Math.abs(candle.close - candle.open);
}

export function rangeSize(candle: PatternCandle): number {
  return candle.high - candle.low;
}

export function upperWick(candle: PatternCandle): number {
  return candle.high - Math.max(candle.open, candle.close);
}

export function lowerWick(candle: PatternCandle): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

export function bodyRatio(candle: PatternCandle, params: PatternRuleParams): number | null {
  if (isZeroRange(candle, params)) return null;
  return bodySize(candle) / rangeSize(candle);
}

export function measureCandle(candle: PatternCandle, params: PatternRuleParams): CandleGeometry {
  const body = bodySize(candle);
  const range = rangeSize(candle);
  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);
  return {
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    time: candle.time,
    body,
    range,
    upperWick: upperWick(candle),
    lowerWick: lowerWick(candle),
    bodyTop,
    bodyBottom,
    isBullish: candle.close > candle.open,
    isBearish: candle.close < candle.open,
    isDojiLike: !isZeroRange(candle, params) && body / range <= params.dojiBodyMaxRatio,
  };
}

/** Classic body engulf: current open/close range fully covers prior body. */
export function bodyEngulfs(engulfing: PatternCandle, prior: PatternCandle): boolean {
  const priorTop = Math.max(prior.open, prior.close);
  const priorBottom = Math.min(prior.open, prior.close);
  const currTop = Math.max(engulfing.open, engulfing.close);
  const currBottom = Math.min(engulfing.open, engulfing.close);
  return currBottom <= priorBottom && currTop >= priorTop;
}

/** Midpoint of a candle's body (average of open and close). */
export function bodyMidpoint(candle: PatternCandle): number {
  return (candle.open + candle.close) / 2;
}
