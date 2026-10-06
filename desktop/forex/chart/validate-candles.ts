import type { Candle } from "./types";

export function isValidCandle(candle: Candle): boolean {
  if (!Number.isFinite(candle.time) || candle.time <= 0) return false;
  const fields = [candle.open, candle.high, candle.low, candle.close];
  if (fields.some((value) => !Number.isFinite(value))) return false;
  if (candle.high < Math.max(candle.open, candle.close)) return false;
  if (candle.low > Math.min(candle.open, candle.close)) return false;
  if (candle.volume !== undefined && (!Number.isFinite(candle.volume) || candle.volume < 0)) return false;
  return true;
}

export function sanitizeCandles(candles: Candle[]): Candle[] {
  const seen = new Set<number>();
  const valid: Candle[] = [];
  for (const candle of candles) {
    if (!isValidCandle(candle) || seen.has(candle.time)) continue;
    seen.add(candle.time);
    valid.push(candle);
  }
  return valid.sort((left, right) => left.time - right.time);
}

export function roundPrice(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
