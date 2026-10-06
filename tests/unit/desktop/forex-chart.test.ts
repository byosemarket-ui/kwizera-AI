import { describe, expect, it } from "vitest";
import { calculateBollingerBands, calculateEMA, calculateMACD, calculateRSI, calculateSMA } from "../../../desktop/forex/chart/indicators.ts";
import { generateDevelopmentCandles } from "../../../desktop/forex/chart/development-provider.ts";
import { fetchMarketSeries, parseChartSymbol, parseChartTimeframe } from "../../../desktop/forex/chart/market-data.ts";
import { sanitizeCandles } from "../../../desktop/forex/chart/validate-candles.ts";

const sample = [
  { time: 1, close: 1 },
  { time: 2, close: 2 },
  { time: 3, close: 3 },
  { time: 4, close: 4 },
  { time: 5, close: 5 },
];

describe("Forex Phase 4 indicator calculations", () => {
  it("calculates SMA from close prices", () => {
    expect(calculateSMA(sample, 3).map((item) => item.value)).toEqual([2, 3, 4]);
  });

  it("calculates EMA seeded from the first SMA window", () => {
    const ema = calculateEMA(sample, 3);
    expect(ema[0]?.value).toBe(2);
    expect(ema[1]?.value).toBeCloseTo(3, 8);
  });

  it("calculates RSI, MACD, and Bollinger bands without NaN", () => {
    const prices = Array.from({ length: 40 }, (_, index) => ({ time: index + 1, close: 10 + (index % 5) }));
    const rsi = calculateRSI(prices, 14);
    const macd = calculateMACD(prices);
    const bands = calculateBollingerBands(prices, 20, 2);
    expect(rsi.length).toBeGreaterThan(0);
    expect(rsi.every((item) => Number.isFinite(item.value))).toBe(true);
    expect(macd.macd.every((item) => Number.isFinite(item.value))).toBe(true);
    expect(macd.signal.length).toBeGreaterThan(0);
    expect(bands.upper.length).toBe(bands.middle.length);
    expect(bands.lower[0].value).toBeLessThan(bands.upper[0].value);
  });
});

describe("Forex Phase 4 candle data", () => {
  it("builds deterministic development candles with valid OHLC", () => {
    const first = generateDevelopmentCandles("EUR/USD", "1h");
    const second = generateDevelopmentCandles("EUR/USD", "1h");
    const gold = generateDevelopmentCandles("XAU/USD", "1h");
    expect(first).toHaveLength(300);
    expect(first).toEqual(second);
    expect(first[0]?.close).not.toEqual(gold[0]?.close);
    for (const candle of first) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      expect(candle.volume).toBeUndefined();
    }
  });

  it("rejects invalid and duplicate candles", () => {
    const cleaned = sanitizeCandles([
      { time: 2, open: 2, high: 3, low: 1, close: 2 },
      { time: 2, open: 2, high: 3, low: 1, close: 2 },
      { time: 1, open: 2, high: 1, low: 0, close: 2 },
      { time: 3, open: Number.NaN, high: 2, low: 1, close: 1.5 },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]?.time).toBe(2);
  });

  it("loads development series and parses chart query values", () => {
    const ready = fetchMarketSeries("EUR/USD", "1h");
    expect(ready.state).toBe("ready");
    expect(ready.series?.kind).toBe("development");
    expect(parseChartSymbol("GBPUSD")).toBe("GBP/USD");
    expect(parseChartTimeframe("4h")).toBe("4h");
    expect(parseChartTimeframe("99m")).toBe("1h");
  });
});
