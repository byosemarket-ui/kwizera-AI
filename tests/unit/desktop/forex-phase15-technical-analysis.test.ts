import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calculateEMA, calculateMACD, calculateRSI, calculateSMA, calculateBollingerBands, lastValue } from "../../../desktop/forex/chart/indicators.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Forex Phase 15 — Technical Analysis Binance live integration", () => {
  it("Technical Analysis and Charts share ForexChartWorkspace Binance candle pipeline", () => {
    const shell = read("desktop/forex/ForexShell.tsx");
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(shell).toContain('route === "charts" || route === "technical-analysis"');
    expect(shell).toContain('mode={route === "charts" ? "charts" : "analysis"}');
    expect(workspace).toContain("useUnifiedCandles");
    expect(workspace).toContain("useBinanceLiveKline");
    expect(workspace).toContain("applyLiveKline");
    expect(workspace).not.toContain("useBinanceKlines");
    expect(workspace).not.toContain("fetchMarketSeries");
    expect(workspace).not.toContain("getDevelopmentSeries");
    expect(workspace).not.toContain("generateDevelopmentCandles");
    expect(workspace).not.toContain("Math.random");
    expect(workspace).toContain('data-ta-source={candleProvider ? "unified-market-data" : "none"}');
    expect(workspace).toContain('data-candle-source="unified-market-data"');
    expect(workspace).toContain("Loading ${candleProvider} candle data for technical analysis");
  });

  it("Analysis summary exposes real calculated Binance-derived values", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain("data-ta-analysis-summary");
    expect(workspace).toContain("data-ta-sma20");
    expect(workspace).toContain("data-ta-ema50");
    expect(workspace).toContain("data-ta-rsi14");
    expect(workspace).toContain("data-ta-macd");
    expect(workspace).toContain("Insufficient data for SMA 20 / SMA 50");
    expect(workspace).toContain("No buy or sell recommendation");
  });

  it("indicator math uses candle closes and returns finite aligned values", () => {
    const candles = Array.from({ length: 60 }, (_, index) => ({
      time: 1_700_000_000 + index * 60,
      close: 100 + Math.sin(index / 5) * 2 + index * 0.01,
    }));
    const sma = calculateSMA(candles, 20);
    const ema = calculateEMA(candles, 50);
    const rsi = calculateRSI(candles, 14);
    const macd = calculateMACD(candles, 12, 26, 9);
    const bb = calculateBollingerBands(candles, 20, 2);
    expect(sma.length).toBeGreaterThan(0);
    expect(ema.length).toBeGreaterThan(0);
    expect(rsi.length).toBeGreaterThan(0);
    expect(macd.macd.length).toBeGreaterThan(0);
    expect(bb.upper.length).toBe(bb.middle.length);
    const rsiLast = lastValue(rsi)!;
    expect(rsiLast).toBeGreaterThanOrEqual(0);
    expect(rsiLast).toBeLessThanOrEqual(100);
    expect(sma.every((point, index) => index === 0 || point.time > sma[index - 1]!.time)).toBe(true);
    expect(Number.isFinite(lastValue(sma)!)).toBe(true);
    expect(Number.isFinite(lastValue(ema)!)).toBe(true);
    expect(Number.isFinite(lastValue(macd.macd)!)).toBe(true);
  });

  it("insufficient history does not invent indicator values", () => {
    const short = [
      { time: 1, close: 10 },
      { time: 2, close: 11 },
      { time: 3, close: 12 },
    ];
    expect(calculateSMA(short, 20)).toHaveLength(0);
    expect(calculateEMA(short, 50)).toHaveLength(0);
    expect(calculateRSI(short, 14)).toHaveLength(0);
    expect(lastValue(calculateSMA(short, 20))).toBeNull();
  });
});
