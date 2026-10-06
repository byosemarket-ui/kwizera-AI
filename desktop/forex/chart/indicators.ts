import type { HistogramPoint, LinePoint } from "./types";

function closes(values: Array<{ close: number }>): number[] {
  return values.map((item) => item.close);
}

function point(time: number, value: number | null): LinePoint | null {
  if (value === null || !Number.isFinite(value)) return null;
  return { time, value };
}

export function calculateSMA(candles: Array<{ time: number; close: number }>, period: number): LinePoint[] {
  if (period < 1) return [];
  const prices = closes(candles);
  const out: LinePoint[] = [];
  for (let index = 0; index < prices.length; index += 1) {
    if (index + 1 < period) continue;
    let sum = 0;
    for (let offset = 0; offset < period; offset += 1) sum += prices[index - offset];
    const next = point(candles[index].time, sum / period);
    if (next) out.push(next);
  }
  return out;
}

export function calculateEMA(candles: Array<{ time: number; close: number }>, period: number): LinePoint[] {
  if (period < 1 || candles.length < period) return [];
  const prices = closes(candles);
  const k = 2 / (period + 1);
  let sum = 0;
  for (let index = 0; index < period; index += 1) sum += prices[index];
  let ema = sum / period;
  const out: LinePoint[] = [{ time: candles[period - 1].time, value: ema }];
  for (let index = period; index < prices.length; index += 1) {
    ema = prices[index] * k + ema * (1 - k);
    const next = point(candles[index].time, ema);
    if (next) out.push(next);
  }
  return out;
}

export function calculateRSI(candles: Array<{ time: number; close: number }>, period = 14): LinePoint[] {
  if (period < 1 || candles.length <= period) return [];
  const prices = closes(candles);
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = prices[index] - prices[index - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const out: LinePoint[] = [];
  const push = (time: number, avgG: number, avgL: number) => {
    const rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    const next = point(time, rsi);
    if (next) out.push(next);
  };
  push(candles[period].time, avgGain, avgLoss);
  for (let index = period + 1; index < prices.length; index += 1) {
    const delta = prices[index] - prices[index - 1];
    const up = delta > 0 ? delta : 0;
    const down = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + up) / period;
    avgLoss = (avgLoss * (period - 1) + down) / period;
    push(candles[index].time, avgGain, avgLoss);
  }
  return out;
}

export function calculateMACD(
  candles: Array<{ time: number; close: number }>,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: LinePoint[]; signal: LinePoint[]; histogram: HistogramPoint[] } {
  const fast = calculateEMA(candles, fastPeriod);
  const slow = calculateEMA(candles, slowPeriod);
  const slowByTime = new Map(slow.map((item) => [item.time, item.value]));
  const macd: LinePoint[] = [];
  for (const pointValue of fast) {
    const slowValue = slowByTime.get(pointValue.time);
    if (slowValue === undefined) continue;
    macd.push({ time: pointValue.time, value: pointValue.value - slowValue });
  }
  const signal = calculateEMA(macd.map((item) => ({ time: item.time, close: item.value })), signalPeriod);
  const signalByTime = new Map(signal.map((item) => [item.time, item.value]));
  const histogram: HistogramPoint[] = [];
  for (const pointValue of macd) {
    const signalValue = signalByTime.get(pointValue.time);
    if (signalValue === undefined) continue;
    histogram.push({ time: pointValue.time, value: pointValue.value - signalValue });
  }
  return { macd, signal, histogram };
}

export function calculateBollingerBands(
  candles: Array<{ time: number; close: number }>,
  period = 20,
  deviation = 2,
): { middle: LinePoint[]; upper: LinePoint[]; lower: LinePoint[] } {
  const middle = calculateSMA(candles, period);
  const upper: LinePoint[] = [];
  const lower: LinePoint[] = [];
  const prices = closes(candles);
  const timeIndex = new Map(candles.map((item, index) => [item.time, index]));
  for (const mid of middle) {
    const end = timeIndex.get(mid.time);
    if (end === undefined) continue;
    let variance = 0;
    for (let offset = 0; offset < period; offset += 1) {
      const delta = prices[end - offset] - mid.value;
      variance += delta * delta;
    }
    const std = Math.sqrt(variance / period);
    upper.push({ time: mid.time, value: mid.value + deviation * std });
    lower.push({ time: mid.time, value: mid.value - deviation * std });
  }
  return { middle, upper, lower };
}

export function lastValue(points: LinePoint[]): number | null {
  const value = points[points.length - 1]?.value;
  return value === undefined || !Number.isFinite(value) ? null : value;
}

/** Wilder ATR — authoritative volatility helper for Market State (same candle series as Charts/TA). */
export function calculateATR(
  candles: Array<{ time: number; high: number; low: number; close: number }>,
  period = 14,
): LinePoint[] {
  if (period < 1 || candles.length <= period) return [];
  const trueRanges: number[] = [];
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    if (index === 0) {
      trueRanges.push(candle.high - candle.low);
      continue;
    }
    const prevClose = candles[index - 1]!.close;
    trueRanges.push(Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose),
    ));
  }
  let atr = 0;
  for (let index = 1; index <= period; index += 1) atr += trueRanges[index]!;
  atr /= period;
  const out: LinePoint[] = [{ time: candles[period]!.time, value: atr }];
  for (let index = period + 1; index < candles.length; index += 1) {
    atr = ((atr * (period - 1)) + trueRanges[index]!) / period;
    const next = point(candles[index]!.time, atr);
    if (next) out.push(next);
  }
  return out;
}
