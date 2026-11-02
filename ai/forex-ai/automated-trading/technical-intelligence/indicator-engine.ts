/**
 * Phase 4.18F.3 — Deterministic indicator engine for AT analysis.
 *
 * Methods (documented):
 * - SMA: arithmetic mean of last N closes
 * - EMA: seed = SMA(N), then k=2/(N+1) recursive
 * - RSI(14): Wilder average gain/loss (same family as chart RSI)
 * - MACD(12,26,9): EMA fast − EMA slow; signal = EMA of MACD; hist = MACD − signal
 * - Bollinger(20,2): SMA middle ± 2 * population stdev
 * - ATR strategy: SMA_OF_TR (NOT Wilder) — preserves kwizera.sma-crossover.v1
 * - ADX(14): Wilder DX smoothing when history sufficient
 *
 * Closed candles only. No invented defaults.
 */

import { atrAt } from "../auto-engine/strategy/evaluate.js";
import type { StrategyCandle } from "../auto-engine/strategy/rules.js";
import {
  INDICATOR_ENGINE_VERSION,
  TECH_INTEL_SCHEMA,
  type AdxBundle,
  type AtrBundle,
  type BollingerBundle,
  type IndicatorQuality,
  type IndicatorRecord,
  type IndicatorSuite,
  type MacdBundle,
  type MovingAverageBundle,
  type RsiBundle,
  type VolatilityStateIntel,
} from "./types.js";

export interface IndicatorCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  closed?: boolean;
}

function closedOnly(candles: readonly IndicatorCandle[]): IndicatorCandle[] {
  let rows = candles.filter(
    (c) =>
      c
      && Number.isFinite(c.time)
      && Number.isFinite(c.open)
      && Number.isFinite(c.high)
      && Number.isFinite(c.low)
      && Number.isFinite(c.close)
      && c.high >= c.low,
  );
  if (rows.length && rows[rows.length - 1]!.closed === false) {
    rows = rows.slice(0, -1);
  }
  return rows;
}

function smaAt(closes: number[], period: number, end: number): number | null {
  if (period < 1 || end + 1 < period) return null;
  let sum = 0;
  for (let i = end - period + 1; i <= end; i++) {
    const v = closes[i];
    if (v == null || !Number.isFinite(v)) return null;
    sum += v;
  }
  return sum / period;
}

function emaSeries(closes: number[], period: number): Array<number | null> {
  const out: Array<number | null> = closes.map(() => null);
  if (period < 1 || closes.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i]!;
  let ema = sum / period;
  out[period - 1] = ema;
  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i]! * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function lastFinite(series: Array<number | null>): { value: number | null; index: number } {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v != null && Number.isFinite(v)) return { value: v, index: i };
  }
  return { value: null, index: -1 };
}

function prevFinite(series: Array<number | null>, beforeIndex: number): number | null {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const v = series[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

function slopeLabel(curr: number | null, prev: number | null): "UP" | "DOWN" | "FLAT" | "UNKNOWN" {
  if (curr == null || prev == null) return "UNKNOWN";
  const eps = Math.max(Math.abs(curr) * 1e-10, Number.EPSILON);
  if (Math.abs(curr - prev) <= eps) return "FLAT";
  return curr > prev ? "UP" : "DOWN";
}

function cmp(a: number | null, b: number | null): "ABOVE" | "BELOW" | "AT" | "UNKNOWN" {
  if (a == null || b == null) return "UNKNOWN";
  const eps = Math.max(Math.abs(b) * 1e-10, Number.EPSILON);
  if (Math.abs(a - b) <= eps) return "AT";
  return a > b ? "ABOVE" : "BELOW";
}

function baseRecord(input: {
  instrument: string;
  timeframe: string;
  name: string;
  parameters: Record<string, number | string>;
  value: number | null;
  previousValue?: number | null;
  method: string;
  candleTimestampSec: number | null;
  calculatedAtMs: number;
  inputCandleCount: number;
  quality: IndicatorQuality;
  note?: string;
  staleMs?: number | null;
  nowMs?: number;
}): IndicatorRecord {
  let freshness: IndicatorRecord["dataFreshness"] = "UNKNOWN";
  if (input.candleTimestampSec != null && input.nowMs != null && input.staleMs != null) {
    const ageMs = Math.max(0, input.nowMs - input.candleTimestampSec * 1000);
    freshness = ageMs > input.staleMs ? "STALE" : "FRESH";
  }
  let quality = input.quality;
  if (quality === "VALID" && freshness === "STALE") quality = "STALE";
  return {
    instrument: input.instrument,
    timeframe: input.timeframe,
    name: input.name,
    parameters: input.parameters,
    value: input.value,
    previousValue: input.previousValue ?? null,
    method: input.method,
    engineVersion: INDICATOR_ENGINE_VERSION,
    candleTimestampSec: input.candleTimestampSec,
    calculatedAtMs: input.calculatedAtMs,
    inputCandleCount: input.inputCandleCount,
    dataFreshness: freshness,
    quality,
    note: input.note,
  };
}

function unavailable(
  instrument: string,
  timeframe: string,
  name: string,
  parameters: Record<string, number | string>,
  method: string,
  calculatedAtMs: number,
  inputCandleCount: number,
  quality: IndicatorQuality,
  note: string,
): IndicatorRecord {
  return baseRecord({
    instrument,
    timeframe,
    name,
    parameters,
    value: null,
    method,
    candleTimestampSec: null,
    calculatedAtMs,
    inputCandleCount,
    quality,
    note,
  });
}

function rsiSeries(closes: number[], period: number): Array<number | null> {
  const out: Array<number | null> = closes.map(() => null);
  if (period < 1 || closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    const up = d > 0 ? d : 0;
    const down = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + up) / period;
    avgLoss = (avgLoss * (period - 1) + down) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function bollingerAt(
  closes: number[],
  period: number,
  deviation: number,
  end: number,
): { mid: number; upper: number; lower: number; bandwidth: number } | null {
  const mid = smaAt(closes, period, end);
  if (mid == null) return null;
  let variance = 0;
  for (let i = end - period + 1; i <= end; i++) {
    const d = closes[i]! - mid;
    variance += d * d;
  }
  const std = Math.sqrt(variance / period);
  const upper = mid + deviation * std;
  const lower = mid - deviation * std;
  const bandwidth = mid !== 0 ? (upper - lower) / mid : null;
  if (bandwidth == null || !Number.isFinite(bandwidth)) return null;
  return { mid, upper, lower, bandwidth };
}

/** Wilder ADX(+DI/-DI). Needs period*2+1 bars ideally; returns nulls when short. */
function adxAt(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number,
): { adx: number; plusDi: number; minusDi: number } | null {
  const n = highs.length;
  // Need enough bars: TR/DM series + Wilder smooth + ADX smooth ≈ 2*period
  if (n < period * 2 + 1) return null;
  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let i = 1; i < n; i++) {
    const high = highs[i]!;
    const low = lows[i]!;
    const prevHigh = highs[i - 1]!;
    const prevLow = lows[i - 1]!;
    const prevClose = closes[i - 1]!;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  if (tr.length < period * 2) return null;

  let atr = 0;
  let pDm = 0;
  let mDm = 0;
  for (let i = 0; i < period; i++) {
    atr += tr[i]!;
    pDm += plusDm[i]!;
    mDm += minusDm[i]!;
  }
  const dx: number[] = [];
  for (let i = period; i < tr.length; i++) {
    if (i > period) {
      atr = atr - atr / period + tr[i]!;
      pDm = pDm - pDm / period + plusDm[i]!;
      mDm = mDm - mDm / period + minusDm[i]!;
    }
    const plusDi = atr === 0 ? 0 : (100 * pDm) / atr;
    const minusDi = atr === 0 ? 0 : (100 * mDm) / atr;
    const sum = plusDi + minusDi;
    dx.push(sum === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / sum);
    if (i === tr.length - 1) {
      // finalize ADX from dx window
    }
  }
  if (dx.length < period) return null;
  let adx = 0;
  for (let i = 0; i < period; i++) adx += dx[i]!;
  adx /= period;
  for (let i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]!) / period;
  }
  // Recompute final +DI/-DI from last smoothed state
  let atr2 = 0;
  let p2 = 0;
  let m2 = 0;
  for (let i = 0; i < period; i++) {
    atr2 += tr[i]!;
    p2 += plusDm[i]!;
    m2 += minusDm[i]!;
  }
  for (let i = period; i < tr.length; i++) {
    atr2 = atr2 - atr2 / period + tr[i]!;
    p2 = p2 - p2 / period + plusDm[i]!;
    m2 = m2 - m2 / period + minusDm[i]!;
  }
  const plusDi = atr2 === 0 ? 0 : (100 * p2) / atr2;
  const minusDi = atr2 === 0 ? 0 : (100 * m2) / atr2;
  if (![adx, plusDi, minusDi].every((x) => Number.isFinite(x))) return null;
  return { adx, plusDi, minusDi };
}

function classifyAtrPct(pct: number | null): VolatilityStateIntel {
  if (pct == null || !Number.isFinite(pct)) return "UNKNOWN";
  if (pct < 0.15) return "LOW";
  if (pct < 0.6) return "NORMAL";
  if (pct < 1.5) return "HIGH";
  return "EXTREME";
}

function staleThresholdMs(timeframe: string): number {
  const map: Record<string, number> = {
    "1m": 5 * 60_000,
    "5m": 20 * 60_000,
    "15m": 45 * 60_000,
    "30m": 90 * 60_000,
    "1h": 3 * 60 * 60_000,
    "4h": 12 * 60 * 60_000,
    "1d": 3 * 24 * 60 * 60_000,
  };
  return map[timeframe] ?? 2 * 60 * 60_000;
}

export function computeIndicatorSuite(input: {
  instrument: string;
  timeframe: string;
  candles: readonly IndicatorCandle[] | readonly StrategyCandle[];
  nowMs?: number;
}): IndicatorSuite {
  const nowMs = input.nowMs ?? Date.now();
  const instrument = String(input.instrument || "").trim() || "UNKNOWN";
  const timeframe = String(input.timeframe || "").trim() || "UNKNOWN";
  const closed = closedOnly(input.candles as IndicatorCandle[]);
  const calculatedAtMs = nowMs;
  const closes = closed.map((c) => c.close);
  const highs = closed.map((c) => c.high);
  const lows = closed.map((c) => c.low);
  const end = closed.length - 1;
  const lastTs = end >= 0 ? closed[end]!.time : null;
  const staleMs = staleThresholdMs(timeframe);

  const mk = (
    name: string,
    parameters: Record<string, number | string>,
    value: number | null,
    method: string,
    previousValue: number | null,
    minBars: number,
  ): IndicatorRecord => {
    if (closed.length === 0) {
      return unavailable(instrument, timeframe, name, parameters, method, calculatedAtMs, 0, "INVALID_INPUT", "No valid OHLC candles.");
    }
    if (closed.length < minBars || value == null) {
      return unavailable(
        instrument,
        timeframe,
        name,
        parameters,
        method,
        calculatedAtMs,
        closed.length,
        "INSUFFICIENT_DATA",
        `Need >= ${minBars} closed candles; have ${closed.length}.`,
      );
    }
    return baseRecord({
      instrument,
      timeframe,
      name,
      parameters,
      value,
      previousValue,
      method,
      candleTimestampSec: lastTs,
      calculatedAtMs,
      inputCandleCount: closed.length,
      quality: "VALID",
      staleMs,
      nowMs,
    });
  };

  // --- Moving averages ---
  const sma9s = closes.map((_, i) => smaAt(closes, 9, i));
  const sma21s = closes.map((_, i) => smaAt(closes, 21, i));
  const sma50s = closes.map((_, i) => smaAt(closes, 50, i));
  const sma200s = closes.map((_, i) => smaAt(closes, 200, i));
  const ema9s = emaSeries(closes, 9);
  const ema21s = emaSeries(closes, 21);
  const ema50s = emaSeries(closes, 50);
  const ema200s = emaSeries(closes, 200);

  const lastClose = end >= 0 ? closes[end]! : null;
  const sma9 = lastFinite(sma9s);
  const sma21 = lastFinite(sma21s);
  const sma9Prev = prevFinite(sma9s, sma9.index >= 0 ? sma9.index + 1 : -1);
  // For previous closed-candle values use index end-1
  const prevSma9 = end >= 1 ? smaAt(closes, 9, end - 1) : null;
  const prevSma21 = end >= 1 ? smaAt(closes, 21, end - 1) : null;

  let crossover: MovingAverageBundle["crossover"] = "UNKNOWN";
  if (sma9.value != null && sma21.value != null && prevSma9 != null && prevSma21 != null) {
    if (prevSma9 <= prevSma21 && sma9.value > sma21.value) crossover = "BULLISH_CROSS";
    else if (prevSma9 >= prevSma21 && sma9.value < sma21.value) crossover = "BEARISH_CROSS";
    else crossover = "NONE";
  } else if (sma9.value == null || sma21.value == null) {
    crossover = "UNKNOWN";
  } else {
    crossover = "NONE";
  }

  const movingAverages: MovingAverageBundle = {
    sma9: mk("SMA", { period: 9 }, smaAt(closes, 9, end), "SMA_ARITHMETIC", prevSma9, 9),
    sma21: mk("SMA", { period: 21 }, smaAt(closes, 21, end), "SMA_ARITHMETIC", prevSma21, 21),
    sma50: mk("SMA", { period: 50 }, smaAt(closes, 50, end), "SMA_ARITHMETIC", end >= 1 ? smaAt(closes, 50, end - 1) : null, 50),
    sma200: mk("SMA", { period: 200 }, smaAt(closes, 200, end), "SMA_ARITHMETIC", end >= 1 ? smaAt(closes, 200, end - 1) : null, 200),
    ema9: mk("EMA", { period: 9 }, ema9s[end] ?? null, "EMA_SMA_SEED", end >= 1 ? ema9s[end - 1] ?? null : null, 9),
    ema21: mk("EMA", { period: 21 }, ema21s[end] ?? null, "EMA_SMA_SEED", end >= 1 ? ema21s[end - 1] ?? null : null, 21),
    ema50: mk("EMA", { period: 50 }, ema50s[end] ?? null, "EMA_SMA_SEED", end >= 1 ? ema50s[end - 1] ?? null : null, 50),
    ema200: mk("EMA", { period: 200 }, ema200s[end] ?? null, "EMA_SMA_SEED", end >= 1 ? ema200s[end - 1] ?? null : null, 200),
    priceVsSma21: cmp(lastClose, sma21.value),
    sma9VsSma21: cmp(sma9.value, sma21.value),
    sma9Slope: slopeLabel(sma9.value, sma9Prev),
    crossover,
  };

  // --- RSI ---
  const rsiArr = rsiSeries(closes, 14);
  const rsiVal = end >= 0 ? rsiArr[end] ?? null : null;
  const rsiPrev = end >= 1 ? rsiArr[end - 1] ?? null : null;
  const rsiRec = mk("RSI", { period: 14 }, rsiVal, "WILDER_RSI", rsiPrev, 15);
  let zone: RsiBundle["zone"] = "UNKNOWN";
  if (rsiVal != null) {
    if (rsiVal >= 70) zone = "OVERBOUGHT";
    else if (rsiVal <= 30) zone = "OVERSOLD";
    else zone = "NEUTRAL";
  }
  const rsi: RsiBundle = {
    rsi14: rsiRec,
    zone,
    momentum: slopeLabel(rsiVal, rsiPrev),
    divergence: "UNAVAILABLE",
  };

  // --- MACD ---
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine: Array<number | null> = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? ema12[i]! - ema26[i]! : null,
  );
  const macdCloses = macdLine.map((v, i) => ({ time: i, close: v ?? NaN }));
  // Build signal on contiguous macd values only
  const macdFiniteIdx: number[] = [];
  const macdFiniteVals: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] != null && Number.isFinite(macdLine[i]!)) {
      macdFiniteIdx.push(i);
      macdFiniteVals.push(macdLine[i]!);
    }
  }
  const signalOnFinite = emaSeries(macdFiniteVals, 9);
  const signalLine: Array<number | null> = closes.map(() => null);
  for (let j = 0; j < macdFiniteIdx.length; j++) {
    signalLine[macdFiniteIdx[j]!] = signalOnFinite[j] ?? null;
  }
  const histLine: Array<number | null> = closes.map((_, i) =>
    macdLine[i] != null && signalLine[i] != null ? macdLine[i]! - signalLine[i]! : null,
  );
  const macdV = end >= 0 ? macdLine[end] : null;
  const sigV = end >= 0 ? signalLine[end] : null;
  const histV = end >= 0 ? histLine[end] : null;
  const macdPrev = end >= 1 ? macdLine[end - 1] : null;
  const sigPrev = end >= 1 ? signalLine[end - 1] : null;
  const histPrev = end >= 1 ? histLine[end - 1] : null;
  let macdCross: MacdBundle["cross"] = "UNKNOWN";
  if (macdV != null && sigV != null && macdPrev != null && sigPrev != null) {
    if (macdPrev <= sigPrev && macdV > sigV) macdCross = "BULLISH_CROSS";
    else if (macdPrev >= sigPrev && macdV < sigV) macdCross = "BEARISH_CROSS";
    else macdCross = "NONE";
  } else if (macdV == null || sigV == null) macdCross = "UNKNOWN";
  else macdCross = "NONE";

  let histMom: MacdBundle["histogramMomentum"] = "UNKNOWN";
  if (histV != null && histPrev != null) {
    if (Math.abs(histV) > Math.abs(histPrev) && histV > 0) histMom = "EXPANDING_BULL";
    else if (Math.abs(histV) > Math.abs(histPrev) && histV < 0) histMom = "EXPANDING_BEAR";
    else histMom = "CONTRACTING";
  }

  const macd: MacdBundle = {
    macd: mk("MACD", { fast: 12, slow: 26 }, macdV, "EMA_MACD_12_26", macdPrev, 26),
    signal: mk("MACD_SIGNAL", { signal: 9 }, sigV, "EMA_OF_MACD_9", sigPrev, 26 + 9),
    histogram: mk("MACD_HISTOGRAM", { fast: 12, slow: 26, signal: 9 }, histV, "MACD_MINUS_SIGNAL", histPrev, 26 + 9),
    cross: macdCross,
    histogramMomentum: histMom,
  };
  void macdCloses;

  // --- Bollinger ---
  const bb = end >= 0 ? bollingerAt(closes, 20, 2, end) : null;
  const bbPrev = end >= 1 ? bollingerAt(closes, 20, 2, end - 1) : null;
  let pricePos: BollingerBundle["pricePosition"] = "UNKNOWN";
  if (bb && lastClose != null) {
    if (lastClose > bb.upper) pricePos = "ABOVE_UPPER";
    else if (lastClose < bb.lower) pricePos = "BELOW_LOWER";
    else if (Math.abs(lastClose - bb.mid) <= Math.abs(bb.mid) * 1e-10) pricePos = "AT_MIDDLE";
    else pricePos = "INSIDE";
  }
  let volReg: BollingerBundle["volatilityRegime"] = "UNKNOWN";
  if (bb && bbPrev) {
    volReg = bb.bandwidth > bbPrev.bandwidth ? "EXPANSION" : "CONTRACTION";
  }
  const bollinger: BollingerBundle = {
    middle: mk("BB_MIDDLE", { period: 20, deviation: 2 }, bb?.mid ?? null, "SMA_BB_MIDDLE", bbPrev?.mid ?? null, 20),
    upper: mk("BB_UPPER", { period: 20, deviation: 2 }, bb?.upper ?? null, "SMA_PLUS_2_STDEV", bbPrev?.upper ?? null, 20),
    lower: mk("BB_LOWER", { period: 20, deviation: 2 }, bb?.lower ?? null, "SMA_MINUS_2_STDEV", bbPrev?.lower ?? null, 20),
    bandwidth: mk("BB_BANDWIDTH", { period: 20, deviation: 2 }, bb?.bandwidth ?? null, "(UPPER-LOWER)/MIDDLE", bbPrev?.bandwidth ?? null, 20),
    pricePosition: pricePos,
    volatilityRegime: volReg,
  };

  // --- ATR SMA_OF_TR (strategy-compatible) ---
  const atr = end >= 0 ? atrAt(highs, lows, closes, 14, end) : null;
  const atrPrev = end >= 1 ? atrAt(highs, lows, closes, 14, end - 1) : null;
  const atrPct = atr != null && lastClose != null && lastClose !== 0 ? (atr / lastClose) * 100 : null;
  const atrBundle: AtrBundle = {
    atr: mk("ATR", { period: 14 }, atr, "SMA_OF_TR", atrPrev, 15),
    atrPctOfPrice: mk("ATR_PCT", { period: 14 }, atrPct, "ATR_DIV_CLOSE_PCT", null, 15),
    method: "SMA_OF_TR",
    volatilityClass: classifyAtrPct(atrPct),
  };

  // --- ADX ---
  const adxRaw = adxAt(highs, lows, closes, 14);
  let trendStrength: AdxBundle["trendStrength"] = "UNKNOWN";
  if (adxRaw) {
    if (adxRaw.adx < 15) trendStrength = "ABSENT";
    else if (adxRaw.adx < 20) trendStrength = "WEAK";
    else if (adxRaw.adx < 40) trendStrength = "MODERATE";
    else trendStrength = "STRONG";
  } else if (closed.length < 14 * 2 + 1) {
    trendStrength = "UNKNOWN";
  }
  const adx: AdxBundle = {
    adx: mk("ADX", { period: 14 }, adxRaw?.adx ?? null, "WILDER_ADX", null, 14 * 2 + 1),
    plusDi: mk("PLUS_DI", { period: 14 }, adxRaw?.plusDi ?? null, "WILDER_PLUS_DI", null, 14 * 2 + 1),
    minusDi: mk("MINUS_DI", { period: 14 }, adxRaw?.minusDi ?? null, "WILDER_MINUS_DI", null, 14 * 2 + 1),
    trendStrength,
  };

  return {
    schemaVersion: TECH_INTEL_SCHEMA,
    engineVersion: INDICATOR_ENGINE_VERSION,
    instrument,
    timeframe,
    closedCandleCount: closed.length,
    lastClosedCandleSec: lastTs,
    calculatedAtMs,
    movingAverages,
    rsi,
    macd,
    bollinger,
    atr: atrBundle,
    adx,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

/** Exported helpers for unit tests / numerical examples. */
export const __indicatorTestUtils = {
  smaAt,
  emaSeries,
  rsiSeries,
  bollingerAt,
  adxAt,
  atrAt,
};
