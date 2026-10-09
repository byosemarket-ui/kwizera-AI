import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyLiveKline } from "../../../ai/market-data/binance/adapter.ts";
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  lastValue,
} from "../../../desktop/forex/chart/indicators.ts";
import { sanitizeCandles } from "../../../desktop/forex/chart/validate-candles.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Forex Phase 16 — Charts + Technical Analysis live consistency", () => {
  it("Charts and Technical Analysis share one ForexChartWorkspace Binance pipeline", () => {
    const shell = read("desktop/forex/ForexShell.tsx");
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    const liveKline = read("desktop/forex/market-data/use-binance-live-kline.ts");

    expect(shell).toContain('route === "charts" || route === "technical-analysis"');
    expect(shell).toContain('mode={route === "charts" ? "charts" : "analysis"}');
    expect(shell).toContain("selectedMarket={selectedMarket}");
    expect(shell).toContain("timeframe={chartTimeframe}");
    expect(shell).toContain("liveTicker={liveTicker}");

    expect(workspace).toContain("useUnifiedCandles");
    expect(workspace).toContain("useBinanceLiveKline");
    expect(workspace).toContain("applyLiveKline");
    expect(workspace).toContain("sanitizeCandles");
    expect(workspace).toContain('data-candle-source="unified-market-data"');
    expect(workspace).not.toContain("useBinanceKlines");
    expect(workspace).not.toContain("fetchMarketSeries");
    expect(workspace).not.toContain("getDevelopmentSeries");
    expect(workspace).not.toContain("Math.random");

    expect(workspace).toContain("data-fx-provider=");
    expect(workspace).toContain('data-fx-source={forexConnectSelected ? "forexconnect-bid" : fxcmSelected ? "fxcm-mid" : binanceSelected ? "binance-spot" : "none"}');
    expect(workspace).toContain("data-fx-symbol=");
    expect(workspace).toContain("data-fx-timeframe=");
    expect(workspace).toContain("data-fx-open=");
    expect(workspace).toContain("data-fx-high=");
    expect(workspace).toContain("data-fx-low=");
    expect(workspace).toContain("data-fx-close=");
    expect(workspace).toContain("data-fx-volume=");
    expect(workspace).toContain("data-fx-connection=");

    expect(liveKline).toContain("sharedClient");
    expect(liveKline).toContain("getSharedLiveKlineClient");
  });

  it("does not create a second Binance WebSocket or market-data service for Technical Analysis", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).not.toContain("technicalAnalysisWebSocket");
    expect(workspace).not.toContain("createBinanceLiveKlineClient(");
    expect(workspace).toContain("useBinanceLiveKline(");
    expect(workspace).toContain("useUnifiedCandles(");
    expect(workspace).not.toContain("useBinanceKlines(");
  });

  it("shared candle identity attrs cover both Charts and Technical Analysis pages", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain('data-forex-page={mode === "charts" ? "charts" : "technical-analysis"}');
    expect(workspace).toContain("data-fx-candle-count=");
    expect(workspace).toContain("data-fx-last-time=");
    expect(workspace).toContain("data-fx-forming=");
  });

  it("sanitize + applyLiveKline keep one continuous Binance series without duplicates", () => {
    const historical = sanitizeCandles([
      { time: 100, open: 10, high: 11, low: 9, close: 10.5, volume: 1, closed: true },
      { time: 200, open: 10.5, high: 12, low: 10, close: 11, volume: 2, closed: true },
      { time: 200, open: 99, high: 99, low: 99, close: 99, volume: 9, closed: true },
    ]);
    expect(historical).toHaveLength(2);
    expect(historical.map((c) => c.time)).toEqual([100, 200]);

    const merged = sanitizeCandles(applyLiveKline(historical, {
      time: 200,
      open: 10.5,
      high: 12.5,
      low: 10,
      close: 12.1,
      volume: 3.5,
      closed: false,
    }));
    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
      time: 200,
      open: 10.5,
      high: 12.5,
      close: 12.1,
      volume: 3.5,
      closed: false,
    });
  });

  it("indicators from a shared candle series stay finite and timestamp-aligned", () => {
    const candles = Array.from({ length: 80 }, (_, index) => ({
      time: 1_700_000_000 + index * 900,
      open: 100 + index * 0.02,
      high: 101 + index * 0.02,
      low: 99 + index * 0.02,
      close: 100.5 + index * 0.02,
      volume: 10 + index,
      closed: index < 79,
    }));
    const sma = calculateSMA(candles, 20);
    const ema = calculateEMA(candles, 50);
    const rsi = calculateRSI(candles, 14);
    const macd = calculateMACD(candles, 12, 26, 9);
    const bb = calculateBollingerBands(candles, 20, 2);
    expect(lastValue(sma)).not.toBeNull();
    expect(lastValue(ema)).not.toBeNull();
    expect(lastValue(rsi)).not.toBeNull();
    expect(lastValue(macd.macd)).not.toBeNull();
    expect(bb.middle.length).toBeGreaterThan(0);
    expect(sma.every((point, index) => index === 0 || point.time > sma[index - 1]!.time)).toBe(true);
    expect(Number.isFinite(lastValue(sma)!)).toBe(true);
    expect(Number.isFinite(lastValue(rsi)!)).toBe(true);
  });
});
