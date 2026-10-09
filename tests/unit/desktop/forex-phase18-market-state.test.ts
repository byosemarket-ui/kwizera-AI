import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyLiveKline } from "../../../ai/market-data/binance/adapter.ts";
import {
  buildForexMarketState,
  FOREX_MARKET_STATE_VERSION,
  toForexAiMarketState,
} from "../../../ai/forex-market-state/index.ts";
import { sanitizeCandles } from "../../../desktop/forex/chart/validate-candles.ts";
import { calculateATR } from "../../../desktop/forex/chart/indicators.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function makeCandles(count: number, start = 1_700_000_000) {
  return Array.from({ length: count }, (_, index) => {
    const base = 100 + index * 0.1;
    return {
      time: start + index * 900,
      open: base,
      high: base + 0.5,
      low: base - 0.4,
      close: base + 0.2,
      volume: 10 + (index % 5),
      closed: index < count - 1,
    };
  });
}

describe("Forex Phase 18 — Real Binance Market State Engine", () => {
  it("reuses central Binance + indicator stack (no second WebSocket/client)", () => {
    const engine = read("ai/forex-market-state/engine.ts");
    const api = read("dev/server/forex-market-state-api.ts");
    const hook = read("desktop/forex/market-data/use-forex-market-state.ts");
    const server = read("dev/server/index.ts");

    expect(engine).toContain("sanitizeCandles");
    expect(engine).toContain("calculateSMA");
    expect(engine).toContain("calculateATR");
    expect(engine).not.toContain("new WebSocket");
    expect(engine).not.toContain("Math.random");
    expect(engine).not.toContain("createBinanceLiveKlineClient");
    expect(api).toContain("getMarketDataService");
    expect(api).toContain("/api/forex/market-state");
    expect(api).toContain("getHistoricalCandles");
    expect(api).toContain("No cross-provider fallback");
    expect(hook).toContain("useUnifiedCandles");
    expect(hook).toContain("useBinanceLiveKline");
    expect(hook).toContain("buildForexMarketState");
    expect(hook).not.toContain("useBinanceKlines");
    expect(hook).not.toContain("useFxcmLiveCandles");
    expect(server).toContain("handleForexMarketStateApi");
  });

  it("accepts valid candles and rejects empty/invalid series honestly", () => {
    const ready = buildForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: makeCandles(60),
      connection: "LIVE",
      lastMarketUpdateMs: Date.now(),
    });
    expect(ready.version).toBe(FOREX_MARKET_STATE_VERSION);
    expect(ready.displaySymbol).toBe("BTC/USDT");
    expect(ready.dataQuality.valid).toBe(true);
    expect(ready.price?.close).toBeTypeOf("number");
    expect(ready.candle?.isClosed).toBe(false);
    expect(ready.indicators?.sma20).not.toBeNull();
    expect(ready.supportResistance).toBeNull();

    const empty = buildForexMarketState({
      symbol: "ETHUSDT",
      timeframe: "1h",
      candles: [],
      connection: "NO_DATA",
    });
    expect(empty.dataQuality.valid).toBe(false);
    expect(empty.price).toBeNull();
  });

  it("updates forming candle in place and never duplicates openTime", () => {
    const base = sanitizeCandles(makeCandles(5));
    const openTime = base[base.length - 1]!.time;
    const merged = sanitizeCandles(applyLiveKline(base, {
      time: openTime,
      open: base[base.length - 1]!.open,
      high: base[base.length - 1]!.high + 1,
      low: base[base.length - 1]!.low,
      close: base[base.length - 1]!.close + 0.5,
      volume: 99,
      closed: false,
    }));
    expect(merged).toHaveLength(base.length);
    expect(merged.filter((c) => c.time === openTime)).toHaveLength(1);
    expect(merged[merged.length - 1]!.volume).toBe(99);

    const state = buildForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: merged,
      connection: "LIVE",
      lastMarketUpdateMs: Date.now(),
    });
    expect(state.candleOpenTime).toBe(openTime);
    expect(state.candle?.volume).toBe(99);
  });

  it("isolates symbol and timeframe identity in Market State", () => {
    const btc = buildForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: makeCandles(40, 1_700_000_000),
      connection: "LIVE",
      lastMarketUpdateMs: Date.now(),
    });
    const eth = buildForexMarketState({
      symbol: "ETHUSDT",
      timeframe: "1h",
      candles: makeCandles(40, 1_800_000_000),
      connection: "LIVE",
      lastMarketUpdateMs: Date.now(),
    });
    expect(btc.symbol).toBe("BTCUSDT");
    expect(btc.timeframe).toBe("15m");
    expect(eth.symbol).toBe("ETHUSDT");
    expect(eth.timeframe).toBe("1h");
    expect(btc.candleOpenTime).not.toBe(eth.candleOpenTime);
  });

  it("produces finite indicator values and AI-ready contract without inventing confidence", () => {
    const candles = makeCandles(80);
    const atr = calculateATR(candles, 14);
    expect(atr.length).toBeGreaterThan(0);
    expect(Number.isFinite(atr[atr.length - 1]!.value)).toBe(true);

    const state = buildForexMarketState({
      symbol: "SOLUSDT",
      timeframe: "5m",
      candles,
      connection: "LIVE",
      lastMarketUpdateMs: Date.now(),
    });
    expect(state.volatility?.atr).not.toBeNull();
    expect(state.momentum?.rsi == null || (state.momentum.rsi >= 0 && state.momentum.rsi <= 100)).toBe(true);
    const ai = toForexAiMarketState(state);
    expect(ai.dataSource).toBe("binance-spot");
    expect(ai.symbol).toBe("SOLUSDT");
    expect(ai.indicators.rsi).toBe(state.indicators?.rsi14 ?? null);
  });

  it("Charts/Dashboard wire Market State without a second Binance pipeline", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    const dashboard = read("desktop/forex/ForexDashboard.tsx");
    expect(workspace).toContain("buildForexMarketState");
    expect(workspace).toContain("data-ms-symbol=");
    expect(dashboard).toContain("useForexMarketState");
    expect(dashboard).toContain('data-forex-section="market-state"');
  });
});
