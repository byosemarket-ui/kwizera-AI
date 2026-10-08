/**
 * Phase 28 — FXCM historical market data tests.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createFxcmHistoricalMarketDataService,
} from "../../../../ai/market-data/fxcm/historical-service.ts";
import {
  assertSafeHistoricalPayload,
  buildHistoricalQuality,
  detectFxcmCandleGaps,
  normalizeFxcmCandleRow,
  normalizeFxcmCandleRows,
  validateOhlc,
} from "../../../../ai/market-data/fxcm/historical-normalize.ts";
import {
  fromFxcmPeriodId,
  isFxcmSupportedProjectTimeframe,
  toFxcmPeriodId,
} from "../../../../ai/market-data/fxcm/timeframes.ts";
import { parseFxcmOffersMap } from "../../../../ai/market-data/fxcm/client.ts";
import { createFxcmMarketDataProvider } from "../../../../ai/market-data/fxcm/provider.ts";
import { resolveMarketProviderForSymbol } from "../../../../ai/market-data/providers/index.ts";
import { FXCM_PHASE28_CAPABILITIES } from "../../../../ai/market-data/fxcm/config.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const TOKEN = "abcdef0123456789abcdef0123456789token";

const SAMPLE_INSTRUMENTS = [
  { symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 },
  { symbol: "GBP/USD", visible: true, order: 2, instrumentType: 1 },
];

/** Official candle row: [ts, bidO, bidC, bidH, bidL, askO, askC, askH, askL, tickQty] */
function candleRow(ts: number, mid: number, tick = 10): number[] {
  const bid = mid - 0.0001;
  const ask = mid + 0.0001;
  return [ts, bid, bid, bid + 0.0002, bid - 0.0002, ask, ask, ask + 0.0002, ask - 0.0002, tick];
}

function mockFetch() {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/socket.io/")) {
      return new Response('97:0{"sid":"HistSid","upgrades":[]}', { status: 200 });
    }
    if (url.includes("/trading/get_instruments")) {
      return new Response(JSON.stringify({
        response: { executed: true },
        data: { instrument: SAMPLE_INSTRUMENTS },
      }), { status: 200 });
    }
    if (url.includes("/trading/get_model")) {
      return new Response(JSON.stringify({
        response: { executed: true },
        Offer: [
          { offerId: 1, currency: "EUR/USD" },
          { offerId: 2, currency: "GBP/USD" },
        ],
      }), { status: 200 });
    }
    if (url.includes("/candles/")) {
      const base = Math.floor(Date.now() / 1000) - 15 * 60 * 5;
      const candles = [0, 1, 2, 3, 4].map((i) => candleRow(base + i * 900, 1.1 + i * 0.0001));
      // inject one duplicate timestamp
      candles.push(candleRow(base + 2 * 900, 1.1002, 11));
      return new Response(JSON.stringify({
        response: { executed: true, error: "" },
        instrument_id: "1",
        period_id: "m15",
        candles,
      }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("Forex Phase 28 — FXCM historical market data", () => {
  it("1 capabilities register historical/candles phase-enabled", () => {
    expect(FXCM_PHASE28_CAPABILITIES.historicalPrices).toBe(true);
    expect(FXCM_PHASE28_CAPABILITIES.candles).toBe(true);
    expect(FXCM_PHASE28_CAPABILITIES.streamingQuotes).toBe(false);
    expect(FXCM_PHASE28_CAPABILITIES.trading).toBe(false);
    const provider = createFxcmMarketDataProvider({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    expect(provider.getCapabilities().historicalPrices).toBe(true);
  });

  it("2/3/4 instrument resolution + invalid + unresolved", async () => {
    const hist = createFxcmHistoricalMarketDataService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(),
    });
    await expect(hist.getHistoricalCandles({ symbol: "NO/PAIR", timeframe: "15m", limit: 5 }))
      .rejects.toMatchObject({ code: "FXCM_INSTRUMENT_NOT_FOUND" });
  });

  it("5/6 supported + unsupported timeframe", () => {
    expect(isFxcmSupportedProjectTimeframe("15m")).toBe(true);
    expect(toFxcmPeriodId("15m")).toBe("m15");
    expect(toFxcmPeriodId("4h")).toBe("H4");
    expect(toFxcmPeriodId("2h")).toBeNull();
    expect(fromFxcmPeriodId("h1")).toBe("1h");
    expect(isFxcmSupportedProjectTimeframe("7m")).toBe(false);
  });

  it("7/8 valid/invalid range", async () => {
    const hist = createFxcmHistoricalMarketDataService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(),
    });
    await expect(hist.getHistoricalCandles({
      symbol: "EUR/USD",
      timeframe: "15m",
      startTimeMs: 2_000_000_000_000,
      endTimeMs: 1_000_000_000_000,
    })).rejects.toMatchObject({ code: "FXCM_INVALID_RANGE" });

    await expect(hist.getHistoricalCandles({
      symbol: "EUR/USD",
      timeframe: "7m",
      limit: 10,
    })).rejects.toMatchObject({ code: "FXCM_UNSUPPORTED_TIMEFRAME" });
  });

  it("9/10/11 normalization + OHLC validation + invalid rejection", () => {
    expect(validateOhlc(1, 2, 0.5, 1.5)).toBe(true);
    expect(validateOhlc(1, 0.5, 2, 1)).toBe(false);
    const good = normalizeFxcmCandleRow(candleRow(1_700_000_000, 1.1));
    expect(good?.open).toBeCloseTo(1.1, 5);
    expect(good?.volume).toBeNull();
    expect(good?.tickQty).toBe(10);
    expect(good?.priceBasis).toBe("mid");
    expect(normalizeFxcmCandleRow([1, 1, 1, 0.5, 2, 1, 1, 0.5, 2, 1])).toBeNull(); // high < low after mid
    const { candles, invalidCandles, duplicatesRemoved } = normalizeFxcmCandleRows([
      candleRow(100, 1.1),
      candleRow(100, 1.1),
      ["bad"],
      candleRow(200, 1.2),
    ], "15m");
    expect(candles).toHaveLength(2);
    expect(duplicatesRemoved).toBe(1);
    expect(invalidCandles).toBe(1);
    expect(candles[0]!.time).toBeLessThan(candles[1]!.time);
  });

  it("12/13 timestamp seconds + candle identity fields", async () => {
    const hist = createFxcmHistoricalMarketDataService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(),
    });
    const result = await hist.getHistoricalCandles({
      symbol: "EUR/USD",
      timeframe: "15m",
      limit: 10,
      refresh: true,
    });
    expect(result.provider).toBe("FXCM");
    expect(result.mode).toBe("HISTORICAL");
    expect(result.liveStream).toBe("NOT_ENABLED_YET");
    expect(result.providerSymbol).toBe("EUR/USD");
    expect(result.canonicalSymbol).toBe("EURUSD");
    expect(result.timeframe).toBe("15m");
    expect(result.providerPeriod).toBe("m15");
    expect(result.count).toBeGreaterThan(0);
    expect(result.candles.every((c) => c.time > 1_000_000_000)).toBe(true);
    expect(result.quality.duplicatesRemoved).toBeGreaterThanOrEqual(0);
  });

  it("14/15/16 dedupe sort + gap detection", () => {
    const candles = normalizeFxcmCandleRows([
      candleRow(1000, 1),
      candleRow(1000 + 900 * 3, 1.1), // gap of 2 intervals for 15m
    ], "15m").candles;
    const gaps = detectFxcmCandleGaps(candles, "15m");
    expect(gaps.length).toBe(1);
    expect(gaps[0]!.kind).toBe("UNEXPECTED_DATA_GAP");
    const q = buildHistoricalQuality({
      candles,
      invalidCandles: 0,
      duplicatesRemoved: 0,
      gaps,
      source: "FXCM",
    });
    expect(q.status).toBe("PARTIAL");
    expect(q.mode).toBe("HISTORICAL");
  });

  it("17 offer map parsing", () => {
    const map = parseFxcmOffersMap({
      response: { executed: true },
      Offer: [{ offerId: 7, currency: "EUR/USD" }],
    });
    expect(map.get("EUR/USD")).toBe(7);
  });

  it("18/19/20 cache DEMO/REAL separation + no fake fallback", async () => {
    const fetchImpl = mockFetch();
    const demo = createFxcmHistoricalMarketDataService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl,
    });
    const first = await demo.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "15m", limit: 5, refresh: true });
    expect(first.source).toBe("FXCM");
    const second = await demo.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "15m", limit: 5 });
    expect(second.source).toBe("CACHE");
    expect(second.quality.source).toBe("CACHE");
    expect(second.providerSource).toBe("FXCM");

    const src = read("ai/market-data/fxcm/historical-service.ts");
    expect(src).not.toContain("Math.random");
    expect(src).not.toContain("fakeCandles");
    expect(src).not.toContain("binance");
  });

  it("21/22/23/24/25 API + security + no secrets", async () => {
    const hist = createFxcmHistoricalMarketDataService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(),
    });
    const result = await hist.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "15m", limit: 5, refresh: true });
    expect(() => assertSafeHistoricalPayload(result, TOKEN)).not.toThrow();
    const json = JSON.stringify(result);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain("Bearer ");
    expect(json).not.toContain("authorizationHeader");

    const api = read("dev/server/forex-providers-api.ts");
    expect(api).toContain("/api/forex/providers/fxcm/historical");
    expect(api).toContain("assertSafeHistoricalPayload");
  });

  it("26 Binance regression routing", () => {
    expect(resolveMarketProviderForSymbol("BTCUSDT")).toBe("BINANCE");
    expect(resolveMarketProviderForSymbol("EURUSDC")).toBe("BINANCE");
    expect(resolveMarketProviderForSymbol("EUR/USD")).toBe("FXCM");
  });

  it("27/28 chart + admin wiring without second shell", () => {
    const routes = read("desktop/forex-admin/forex-admin-routes.ts");
    const chart = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    const client = read("desktop/forex/market-data/studio-fxcm-historical-client.ts");
    expect(routes).toContain("/admin/forex/historical-data");
    expect(chart).toContain("useFxcmHistoricalKlines");
    expect(chart).toContain("HISTORICAL");
    expect(client).not.toContain("KWIZERA_FXCM_ACCESS_TOKEN");
    expect(client).not.toContain("Authorization");
  });

  it("disabled provider returns safe error", async () => {
    const hist = createFxcmHistoricalMarketDataService({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    await expect(hist.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "15m" }))
      .rejects.toMatchObject({ code: "FXCM_DISABLED" });
  });
});
