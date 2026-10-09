/**
 * Phase 30 — FXCM live candle sync tests.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyFxcmPriceToCandles,
  closeElapsedFxcmCandles,
  dedupeSortFxcmLiveCandles,
  formingCandleOf,
  fxcmCandleBucketStartSec,
  fxcmCandlePriceFromQuote,
  historicalToLiveCandle,
  mergeHistoricalWithLiveCandles,
} from "../../../../ai/market-data/fxcm/live-candle-sync.ts";
import type { FxcmLiveCandle } from "../../../../ai/market-data/fxcm/live-candle-types.ts";
import { createFxcmLiveCandleService } from "../../../../ai/market-data/fxcm/live-candle-service.ts";
import type { FakeFxcmTransportController } from "../../../../ai/market-data/fxcm/stream-transport.ts";
import { createFxcmRealtimeStreamService } from "../../../../ai/market-data/fxcm/stream-service.ts";
import { createFxcmHistoricalMarketDataService } from "../../../../ai/market-data/fxcm/historical-service.ts";
import { createFxcmInstrumentDiscoveryService } from "../../../../ai/market-data/fxcm/instrument-discovery.ts";
import { createFxcmAuthenticationService } from "../../../../ai/market-data/fxcm/auth-service.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const TOKEN = "abcdef0123456789abcdef0123456789token";
const identity = {
  marketType: "FOREX" as const,
  providerSymbol: "EUR/USD",
  canonicalSymbol: "EURUSD",
  timeframe: "15m" as const,
};

function candle(timeSec: number, o: number, h: number, l: number, c: number, closed = true): FxcmLiveCandle {
  return {
    time: timeSec,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: null,
    tickQty: null,
    closed,
    priceBasis: "mid",
    provider: "FXCM",
    marketType: "FOREX",
    providerSymbol: "EUR/USD",
    canonicalSymbol: "EURUSD",
    timeframe: "15m",
  };
}

function mockFetch() {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/socket.io/")) {
      return new Response('97:0{"sid":"LiveSid","upgrades":[]}', { status: 200 });
    }
    if (url.includes("/trading/get_instruments")) {
      return new Response(JSON.stringify({
        response: { executed: true },
        data: { instrument: [{ symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 }] },
      }), { status: 200 });
    }
    if (url.includes("/trading/get_model")) {
      return new Response(JSON.stringify({
        response: { executed: true },
        Offer: [{ offerId: 1, currency: "EUR/USD" }],
      }), { status: 200 });
    }
    if (url.includes("/candles/")) {
      const base = Math.floor(Date.UTC(2026, 0, 1, 10, 0, 0) / 1000);
      const rows = [0, 1, 2].map((i) => {
        const mid = 1.1 + i * 0.0001;
        const bid = mid - 0.0001;
        const ask = mid + 0.0001;
        return [base + i * 900, bid, bid, bid + 0.0002, bid - 0.0002, ask, ask, ask + 0.0002, ask - 0.0002, 10];
      });
      return new Response(JSON.stringify({
        response: { executed: true, error: "" },
        instrument_id: "1",
        period_id: "m15",
        candles: rows,
      }), { status: 200 });
    }
    if (url.includes("/subscribe")) {
      return new Response(JSON.stringify({
        response: { executed: true, error: "" },
        pairs: JSON.stringify({
          Updated: Math.floor(Date.UTC(2026, 0, 1, 10, 32, 0) / 1000),
          Rates: [1.1005, 1.1007, 1.11, 1.09],
          Symbol: "EUR/USD",
        }),
      }), { status: 200 });
    }
    if (url.includes("/unsubscribe")) {
      return new Response(JSON.stringify({ response: { executed: true, error: "" }, pairs: "EUR/USD" }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("Forex Phase 30 — FXCM live candle sync", () => {
  it("1/2 bucket calculation for 15m", () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 0, 0);
    expect(fxcmCandleBucketStartSec(t0, "15m")).toBe(t0 / 1000);
    expect(fxcmCandleBucketStartSec(t0 + 60_000, "15m")).toBe(t0 / 1000);
    expect(fxcmCandleBucketStartSec(t0 + 14 * 60_000 + 59_000, "15m")).toBe(t0 / 1000);
    expect(fxcmCandleBucketStartSec(t0 + 15 * 60_000, "15m")).toBe((t0 + 15 * 60_000) / 1000);
  });

  it("3/4/5/6/7 OHLC open/high/low/close from multiple quotes", () => {
    const openMs = Date.UTC(2026, 0, 1, 10, 0, 0);
    let series: FxcmLiveCandle[] = [];
    const prices = [100, 101, 99, 100.5];
    for (const [i, p] of prices.entries()) {
      const r = applyFxcmPriceToCandles(series, p, openMs + i * 1000, identity, openMs + i * 1000);
      expect(r.applied).toBe(true);
      series = r.candles;
    }
    expect(series).toHaveLength(1);
    expect(series[0]!.open).toBe(100);
    expect(series[0]!.high).toBe(101);
    expect(series[0]!.low).toBe(99);
    expect(series[0]!.close).toBe(100.5);
    expect(series[0]!.closed).toBe(false);
  });

  it("8/9 candle closure + next candle creation", () => {
    const openMs = Date.UTC(2026, 0, 1, 10, 0, 0);
    let series: FxcmLiveCandle[] = [];
    series = applyFxcmPriceToCandles(series, 1.1, openMs + 1000, identity, openMs + 1000).candles;
    const nextOpen = openMs + 15 * 60_000;
    const r = applyFxcmPriceToCandles(series, 1.2, nextOpen + 2000, identity, nextOpen + 2000);
    expect(r.candles).toHaveLength(2);
    expect(r.candles[0]!.closed).toBe(true);
    expect(r.candles[0]!.close).toBe(1.1);
    expect(r.candles[1]!.open).toBe(1.2);
    expect(r.candles[1]!.closed).toBe(false);
  });

  it("10 closed candle immutable to late events", () => {
    const openMs = Date.UTC(2026, 0, 1, 10, 0, 0);
    let series = [candle(openMs / 1000, 1.1, 1.2, 1.0, 1.15, true)];
    const r = applyFxcmPriceToCandles(series, 9.9, openMs + 1000, identity, openMs + 1000);
    expect(r.applied).toBe(false);
    expect(r.reason).toBe("closed_candle_immutable");
    expect(r.candles[0]!.close).toBe(1.15);
  });

  it("11 no synthetic candle when time advances without quotes", () => {
    const openMs = Date.UTC(2026, 0, 1, 10, 0, 0);
    let series = [candle(openMs / 1000, 1.1, 1.1, 1.1, 1.1, false)];
    series = closeElapsedFxcmCandles(series, openMs + 20 * 60_000, "15m");
    expect(series).toHaveLength(1);
    expect(series[0]!.closed).toBe(true);
    expect(formingCandleOf(series)).toBeNull();
  });

  it("12 mid price source validation", () => {
    expect(fxcmCandlePriceFromQuote({ bid: 1.1, ask: 1.2, mid: 1.15, eventTimeMs: 1 })).toBe(1.15);
    expect(fxcmCandlePriceFromQuote({ bid: 1.2, ask: 1.1, mid: null, eventTimeMs: 1 })).toBeNull();
    expect(fxcmCandlePriceFromQuote({ bid: null, ask: null, mid: null, eventTimeMs: 1 })).toBeNull();
  });

  it("13/14 historical/live overlap dedupe", () => {
    const t = Date.UTC(2026, 0, 1, 10, 0, 0) / 1000;
    const hist = [candle(t, 1.1, 1.2, 1.0, 1.15, false)];
    const live = [candle(t, 1.1, 1.25, 0.99, 1.2, false)];
    const merged = mergeHistoricalWithLiveCandles(hist, live, Date.UTC(2026, 0, 1, 10, 5, 0), "15m");
    expect(merged.candles).toHaveLength(1);
    expect(merged.candles[0]!.high).toBe(1.25);
    expect(merged.candles[0]!.low).toBe(0.99);
    expect(merged.candles[0]!.close).toBe(1.2);
    expect(merged.duplicatesRemoved).toBe(1);
  });

  it("15 dedupe sort", () => {
    const t = 1_700_000_000;
    const { candles, duplicatesRemoved } = dedupeSortFxcmLiveCandles([
      candle(t + 900, 1, 1, 1, 1),
      candle(t, 1, 1, 1, 1),
      candle(t, 1, 1, 1, 1),
    ]);
    expect(candles.map((c) => c.time)).toEqual([t, t + 900]);
    expect(duplicatesRemoved).toBe(1);
  });

  it("16 out-of-order bucket ignored", () => {
    const openMs = Date.UTC(2026, 0, 1, 10, 15, 0);
    let series = [candle(openMs / 1000, 1.1, 1.1, 1.1, 1.1, false)];
    const earlier = openMs - 15 * 60_000;
    const r = applyFxcmPriceToCandles(series, 1.0, earlier + 1000, identity, earlier + 1000);
    expect(r.applied).toBe(false);
    expect(r.reason).toBe("out_of_order_bucket");
  });

  it("17 service subscribe merges historical + quote (mocked)", async () => {
    const fake: FakeFxcmTransportController = {};
    const env = {
      KWIZERA_FXCM_ENABLED: "1",
      KWIZERA_FXCM_ENVIRONMENT: "demo",
      KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
    };
    const fetchImpl = mockFetch();
    const auth = createFxcmAuthenticationService({ env, fetchImpl });
    const discovery = createFxcmInstrumentDiscoveryService({ env, fetchImpl, auth });
    const historical = createFxcmHistoricalMarketDataService({ env, fetchImpl, auth, discovery });
    const stream = createFxcmRealtimeStreamService({
      env,
      fetchImpl,
      fakeTransport: fake,
      autoReconnect: false,
      auth,
      discovery,
    });
    const svc = createFxcmLiveCandleService({
      env,
      fetchImpl,
      auth,
      discovery,
      historical,
      stream,
      nowMs: () => Date.UTC(2026, 0, 1, 10, 32, 0),
    });
    try {
      const series = await svc.subscribe("EUR/USD", "15m");
      expect(series.provider).toBe("FXCM");
      expect(series.priceBasis).toBe("mid");
      expect(series.trading).toBe("DISABLED");
      expect(series.count).toBeGreaterThan(0);
      expect(series.candles.every((c) => c.provider === "FXCM")).toBe(true);

      // Multiple quotes update ONE forming candle
      const tipTime = series.candles[series.candles.length - 1]!.time;
      svc.injectQuote("EUR/USD", "15m", {
        provider: "FXCM",
        marketType: "FOREX",
        providerSymbol: "EUR/USD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EUR/USD",
        timestamp: new Date(Date.UTC(2026, 0, 1, 10, 32, 10)).toISOString(),
        sourceTimestamp: new Date(Date.UTC(2026, 0, 1, 10, 32, 10)).toISOString(),
        receivedAt: new Date(Date.UTC(2026, 0, 1, 10, 32, 10)).toISOString(),
        bid: 1.1010,
        ask: 1.1012,
        mid: 1.1011,
        last: null,
        bidSize: null,
        askSize: null,
        sessionHigh: null,
        sessionLow: null,
        sequence: null,
        latencyMs: 0,
        connectionState: "LIVE",
        dataQuality: "LIVE",
        source: "FXCM",
        valid: true,
        invalidReason: null,
      });
      svc.injectQuote("EUR/USD", "15m", {
        provider: "FXCM",
        marketType: "FOREX",
        providerSymbol: "EUR/USD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EUR/USD",
        timestamp: new Date(Date.UTC(2026, 0, 1, 10, 32, 20)).toISOString(),
        sourceTimestamp: new Date(Date.UTC(2026, 0, 1, 10, 32, 20)).toISOString(),
        receivedAt: new Date(Date.UTC(2026, 0, 1, 10, 32, 20)).toISOString(),
        bid: 1.1000,
        ask: 1.1002,
        mid: 1.1001,
        last: null,
        bidSize: null,
        askSize: null,
        sessionHigh: null,
        sessionLow: null,
        sequence: null,
        latencyMs: 0,
        connectionState: "LIVE",
        dataQuality: "LIVE",
        source: "FXCM",
        valid: true,
        invalidReason: null,
      });
      const after = svc.getSeries("EUR/USD", "15m")!;
      const forming = after.forming ?? after.candles[after.candles.length - 1]!;
      expect(forming.time).toBe(tipTime);
      expect(forming.close).toBeCloseTo(1.1001);
    } finally {
      svc.shutdown();
      stream.shutdown();
    }
  });

  it("18 no fake data in production path", () => {
    const sync = read("ai/market-data/fxcm/live-candle-sync.ts");
    const svc = read("ai/market-data/fxcm/live-candle-service.ts");
    expect(sync).not.toMatch(/Math\.random/);
    expect(svc).not.toMatch(/Math\.random/);
    expect(sync).not.toMatch(/fakeCandle|mockCandle|simulatedCandle|interpolatedPrice/);
    expect(svc).not.toMatch(/fakeCandle|mockCandle|simulatedCandle/);
  });

  it("19 API + chart integration surface", () => {
    const api = read("dev/server/forex-providers-api.ts");
    expect(api).toContain("/api/forex/providers/fxcm/candles/live");
    expect(api).toContain("candles/live/subscribe");
    const chart = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(chart).toContain("useFxcmLiveCandles");
    expect(chart).not.toMatch(/Math\.random/);
  });

  it("20 historicalToLiveCandle preserves mid identity", () => {
    const live = historicalToLiveCandle({
      time: 1000,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: null,
      tickQty: 3,
      closed: true,
      priceBasis: "mid",
    }, identity);
    expect(live.provider).toBe("FXCM");
    expect(live.priceBasis).toBe("mid");
    expect(live.canonicalSymbol).toBe("EURUSD");
  });
});
