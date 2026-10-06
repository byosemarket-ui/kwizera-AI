/**
 * Deterministic classification rules for Market State.
 * Documented thresholds — not AI-generated descriptions.
 */
import type {
  MomentumClassification,
  TrendDirection,
  TrendStrength,
  VolatilityClassification,
  VolumeClassification,
  VolumeDirection,
} from "./types.js";

/** Volume average lookback (closed + forming candles). */
export const VOLUME_LOOKBACK = 20;

/**
 * ATR% = (ATR / close) * 100
 * LOW < 0.5 | NORMAL < 1.5 | HIGH < 3.0 | EXTREME >= 3.0
 */
export function classifyVolatility(atrPercent: number | null): VolatilityClassification {
  if (atrPercent == null || !Number.isFinite(atrPercent)) return "UNKNOWN";
  if (atrPercent < 0.5) return "LOW";
  if (atrPercent < 1.5) return "NORMAL";
  if (atrPercent < 3) return "HIGH";
  return "EXTREME";
}

/**
 * relativeRatio = currentVolume / averageVolume
 * ABOVE_AVERAGE >= 1.25 | BELOW_AVERAGE <= 0.75 | else AVERAGE
 */
export function classifyVolume(relativeRatio: number | null): VolumeClassification {
  if (relativeRatio == null || !Number.isFinite(relativeRatio)) return "UNKNOWN";
  if (relativeRatio >= 1.25) return "ABOVE_AVERAGE";
  if (relativeRatio <= 0.75) return "BELOW_AVERAGE";
  return "AVERAGE";
}

export function classifyVolumeDirection(current: number, previous: number | null): VolumeDirection {
  if (previous == null || !Number.isFinite(previous) || !Number.isFinite(current)) return "UNKNOWN";
  if (current > previous * 1.02) return "INCREASING";
  if (current < previous * 0.98) return "DECREASING";
  return "STABLE";
}

/**
 * Trend from EMA50 / SMA20 / SMA50 alignment (same indicators as Charts/TA).
 * BULLISH: close > EMA50 and SMA20 > SMA50
 * BEARISH: close < EMA50 and SMA20 < SMA50
 * else NEUTRAL
 */
export function classifyTrend(input: {
  close: number;
  ema50: number | null;
  sma20: number | null;
  sma50: number | null;
}): { direction: TrendDirection; strength: TrendStrength; priceVsEma50: "ABOVE" | "BELOW" | "UNKNOWN"; sma20VsSma50: "ABOVE" | "BELOW" | "UNKNOWN" | "EQUAL" } {
  const { close, ema50, sma20, sma50 } = input;
  const priceVsEma50 = ema50 == null ? "UNKNOWN" : close > ema50 ? "ABOVE" : "BELOW";
  let sma20VsSma50: "ABOVE" | "BELOW" | "UNKNOWN" | "EQUAL" = "UNKNOWN";
  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50) sma20VsSma50 = "ABOVE";
    else if (sma20 < sma50) sma20VsSma50 = "BELOW";
    else sma20VsSma50 = "EQUAL";
  }

  let direction: TrendDirection = "NEUTRAL";
  if (ema50 != null && sma20 != null && sma50 != null) {
    if (close > ema50 && sma20 > sma50) direction = "BULLISH";
    else if (close < ema50 && sma20 < sma50) direction = "BEARISH";
  }

  let strength: TrendStrength = "UNKNOWN";
  if (sma20 != null && sma50 != null && close > 0) {
    const spread = Math.abs(sma20 - sma50) / close;
    if (direction === "NEUTRAL") strength = "WEAK";
    else if (spread >= 0.008) strength = "STRONG";
    else if (spread >= 0.003) strength = "MODERATE";
    else strength = "WEAK";
  }

  return { direction, strength, priceVsEma50, sma20VsSma50 };
}

/**
 * Momentum from RSI14 (+ MACD histogram sign as tie-break).
 * RSI >= 70 STRONG | >= 55 POSITIVE | <= 30 WEAK | <= 45 NEGATIVE | else NEUTRAL
 */
export function classifyMomentum(rsi: number | null, macdHistogram: number | null): MomentumClassification {
  if (rsi != null && Number.isFinite(rsi)) {
    if (rsi >= 70) return "STRONG";
    if (rsi >= 55) return "POSITIVE";
    if (rsi <= 30) return "WEAK";
    if (rsi <= 45) return "NEGATIVE";
    return "NEUTRAL";
  }
  if (macdHistogram != null && Number.isFinite(macdHistogram)) {
    if (macdHistogram > 0) return "POSITIVE";
    if (macdHistogram < 0) return "NEGATIVE";
  }
  return "NEUTRAL";
}

/** Stale threshold: max(30s, min(interval, 180s)) * 2 — aligned with live-kline client. */
export function staleLimitMs(timeframeMinutes: number): number {
  const intervalMs = timeframeMinutes * 60 * 1000;
  return Math.max(30_000, Math.min(intervalMs, 180_000)) * 2;
}
