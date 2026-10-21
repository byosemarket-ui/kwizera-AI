/**
 * Phase 56.3.3 — reconnect / intended restore + marketType integrity (synthetic).
 * Not production Offers evidence.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  ForexConnectLiveCandleService,
  FOREXCONNECT_RESTORE_MAX_ATTEMPTS,
} from "../../../../ai/market-data/forexconnect/live-service.ts";
import { classifyForexConnectInstrument } from "../../../../ai/market-data/forexconnect/instrument-classify.ts";
import { createForexConnectMarketDataProvider } from "../../../../ai/market-data/forexconnect/provider.ts";
import type { ForexConnectBridge } from "../../../../ai/market-data/forexconnect/client.ts";
import {
  evaluateInstrumentReadiness,
  summarizeInstrumentReadinessCatalog,
} from "../../../../ai/market-data/instrument-readiness/index.ts";
import { isInstrumentAllowlisted } from "../../../../ai/forex-ai/automated-trading/simulation-risk/allowlist.ts";
import type { MarketInstrument } from "../../../../ai/market-data/providers/types.ts";

function mockBridge(options?: { disconnected?: boolean }): ForexConnectBridge {
  let updateCount = 0;
  const disconnected = Boolean(options?.disconnected);
  return {
    getConfig: () => ({
      environment: "demo",
      environmentLabel: "FXCM DEMO",
      enabled: true,
    }),
    subscribeQuotes: vi.fn(async (symbol: string) => ({
      ok: true,
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
    })),
    unsubscribeQuotes: vi.fn(async () => undefined),
    getHistoricalCandles: vi.fn(async ({ symbol, timeframe }: { symbol: string; timeframe: string }) => ({
      ok: true,
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
      displaySymbol: symbol,
      marketType: "FOREX",
      timeframe,
      candles: [{
        time: Math.floor(Date.now() / 60_000) * 60,
        open: 1.1,
        high: 1.1,
        low: 1.1,
        close: 1.1,
        volume: 1,
        closed: false,
      }],
    })),
    pollQuotes: vi.fn(async () => []),
    getStreamStatus: vi.fn(async () => {
      updateCount += 1;
      return {
        ok: true,
        provider: "FOREXCONNECT",
        sessionStatus: disconnected ? "DISCONNECTED" : "CONNECTED",
        streamState: disconnected ? "DISCONNECTED" : "SUBSCRIBED_WAITING",
        offersListenerActive: !disconnected,
        offersPollerActive: !disconnected,
        callbackRegistered: !disconnected,
        subscriptionCount: disconnected ? 0 : 1,
        subscriptions: disconnected ? [] : ["EUR/USD"],
        maxSubscriptions: 8,
        lastQuoteAt: null,
        lastQuoteAgeMs: null,
        lastStreamError: null,
        updateCount,
        lastEventSource: null,
        diagnostics: null,
        priceBasis: "bid",
        trading: "DISABLED",
      };
    }),
    getStatus: vi.fn(async () => ({
      ok: true,
      status: "CONNECTED",
      enabled: true,
      environment: "demo",
      environmentLabel: "DEMO",
      trading: "DISABLED",
    })),
    listInstruments: vi.fn(async () => ({
      ok: true,
      count: 4,
      fetchedAt: new Date().toISOString(),
      instruments: [
        {
          provider: "FOREXCONNECT",
          providerSymbol: "XAU/USD",
          canonicalSymbol: "XAUUSD",
          displaySymbol: "XAU/USD",
          marketType: "FOREX",
          baseAsset: "XAU",
          quoteAsset: "USD",
          status: "available",
          instrumentType: 5,
          instrumentTypeLabel: "Bullion",
        },
        {
          provider: "FOREXCONNECT",
          providerSymbol: "EUR/USD",
          canonicalSymbol: "EURUSD",
          displaySymbol: "EUR/USD",
          marketType: "FOREX",
          baseAsset: "EUR",
          quoteAsset: "USD",
          status: "available",
          instrumentType: 1,
          instrumentTypeLabel: "Forex",
        },
        {
          provider: "FOREXCONNECT",
          providerSymbol: "US30",
          canonicalSymbol: "US30",
          displaySymbol: "US30",
          marketType: "FOREX",
          baseAsset: null,
          quoteAsset: null,
          status: "available",
          instrumentType: 2,
          instrumentTypeLabel: "Indices",
        },
        {
          provider: "FOREXCONNECT",
          providerSymbol: "GBP/USD",
          canonicalSymbol: "GBPUSD",
          displaySymbol: "GBP/USD",
          marketType: "FOREX",
          baseAsset: "GBP",
          quoteAsset: "USD",
          status: "available",
          instrumentType: 1,
          instrumentTypeLabel: "Forex",
        },
      ],
    })),
  } as unknown as ForexConnectBridge;
}

function synth(symbol: string, marketType: MarketInstrument["marketType"]): MarketInstrument {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: symbol,
    canonicalSymbol: symbol.replace("/", ""),
    displaySymbol: symbol,
    marketType,
    baseAsset: null,
    quoteAsset: null,
    status: "available",
    capabilities: {
      instruments: true,
      liveQuotes: true,
      streamingQuotes: true,
      historicalPrices: true,
      candles: true,
      liveCandles: true,
      trading: false,
    },
    metadata: { synthetic: true },
  };
}

describe("Phase 56.3.3 reconnect and metadata (synthetic)", () => {
  const services: ForexConnectLiveCandleService[] = [];
  afterEach(async () => {
    for (const s of services) {
      await s.clearAllSessions({ clearIntended: true });
    }
    services.length = 0;
  });

  it("classifies XAU as COMMODITY and US30 as INDEX (not silent FOREX)", () => {
    expect(classifyForexConnectInstrument({
      provider: "FOREXCONNECT",
      providerSymbol: "XAU/USD",
      canonicalSymbol: "XAUUSD",
      displaySymbol: "XAU/USD",
      marketType: "FOREX",
      baseAsset: "XAU",
      quoteAsset: "USD",
      status: "available",
      instrumentType: 5,
    }).marketType).toBe("COMMODITY");

    expect(classifyForexConnectInstrument({
      provider: "FOREXCONNECT",
      providerSymbol: "US30",
      canonicalSymbol: "US30",
      displaySymbol: "US30",
      marketType: "FOREX",
      baseAsset: null,
      quoteAsset: null,
      status: "available",
      instrumentType: 2,
    }).marketType).toBe("INDEX");

    expect(classifyForexConnectInstrument({
      provider: "FOREXCONNECT",
      providerSymbol: "EUR/USD",
      canonicalSymbol: "EURUSD",
      displaySymbol: "EUR/USD",
      marketType: "FOREX",
      baseAsset: "EUR",
      quoteAsset: "USD",
      status: "available",
      instrumentType: 1,
    }).marketType).toBe("FOREX");
  });

  it("provider listInstruments propagates classified marketType + provenance", async () => {
    const bridge = mockBridge();
    const provider = createForexConnectMarketDataProvider({ bridge });
    const list = await provider.listInstruments();
    const bySym = Object.fromEntries(list.map((i) => [i.providerSymbol, i]));
    expect(bySym["XAU/USD"]?.marketType).toBe("COMMODITY");
    expect(bySym["US30"]?.marketType).toBe("INDEX");
    expect(bySym["EUR/USD"]?.marketType).toBe("FOREX");
    expect(bySym["GBP/USD"]?.marketType).toBe("FOREX");
    expect(bySym["XAU/USD"]?.metadata?.normalizedMarketType).toBe("COMMODITY");
    expect(bySym["XAU/USD"]?.metadata?.providerMarketTypeRaw).toBe("FOREX");
    expect(bySym["XAU/USD"]?.metadata?.classificationSource).toBeTruthy();
  });

  it("disconnect clears active sessions but preserves intended for restore", async () => {
    const bridge = mockBridge();
    const live = new ForexConnectLiveCandleService({ bridge });
    services.push(live);
    await live.ensure("EUR/USD", "1m");
    await live.ensure("XAU/USD", "1m");
    expect(live.getSessionCount()).toBe(2);
    expect(live.listIntendedSubscriptions().length).toBe(2);

    await live.clearAllSessions({ clearIntended: false });
    expect(live.getSessionCount()).toBe(0);
    expect(live.listIntendedSubscriptions().length).toBe(2);
    expect(live.getLifecycleDiagnostics().lifecycleState).toBe("DISCONNECTED");
  });

  it("env switch clears intended subscriptions", async () => {
    const bridge = mockBridge();
    const live = new ForexConnectLiveCandleService({ bridge });
    services.push(live);
    await live.ensure("EUR/USD", "1m");
    await live.clearAllSessions({ clearIntended: true });
    expect(live.listIntendedSubscriptions().length).toBe(0);
  });

  it("restoreIntended is single-flight and bounded", async () => {
    const bridge = mockBridge();
    const live = new ForexConnectLiveCandleService({ bridge });
    services.push(live);
    await live.ensure("EUR/USD", "1m");
    await live.clearAllSessions({ clearIntended: false });

    const p1 = live.restoreIntendedSubscriptions();
    expect(live.getLifecycleDiagnostics().restoreInFlight).toBe(true);
    const p2 = live.restoreIntendedSubscriptions();
    const [r1, r2] = await Promise.all([p1, p2]);
    // Concurrent callers share one recovery workflow result.
    expect(r1.attempted).toBe(r2.attempted);
    expect(r1.restored).toEqual(r2.restored);
    expect(r1.attempted).toBeLessThanOrEqual(FOREXCONNECT_RESTORE_MAX_ATTEMPTS);
    expect(r1.placesOrders).toBe(false);
    expect(r1.acceptsForExecution).toBe(false);
    expect(live.getSessionCount()).toBeGreaterThanOrEqual(1);
    // Restore does not invent LIVE without genuine price changes.
    expect(r1.restored.every((r) => r.streamState !== "LIVE")).toBe(true);
  });

  it("poll disconnect marks sessions DISCONNECTED and clears price-change freshness", async () => {
    const bridge = mockBridge({ disconnected: false });
    const live = new ForexConnectLiveCandleService({ bridge });
    services.push(live);
    await live.ensure("EUR/USD", "1m");
    // Force a disconnected poll cycle
    (bridge.getStreamStatus as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ok: true,
      provider: "FOREXCONNECT",
      sessionStatus: "DISCONNECTED",
      streamState: "DISCONNECTED",
      offersListenerActive: false,
      offersPollerActive: false,
      callbackRegistered: false,
      subscriptionCount: 0,
      subscriptions: [],
      maxSubscriptions: 8,
      lastQuoteAt: null,
      lastQuoteAgeMs: null,
      lastStreamError: null,
      updateCount: 0,
      lastEventSource: null,
      diagnostics: null,
      priceBasis: "bid",
      trading: "DISABLED",
    }));
    await live.ensure("EUR/USD", "1m");
    const series = live.getSeries("EUR/USD", "1m");
    expect(series?.streamState).toBe("DISCONNECTED");
    expect(live.getLifecycleDiagnostics().lifecycleState).toBe("DISCONNECTED");
  });

  it("XAG blocked peer isolation still holds with US30 LIVE fixture", () => {
    const us30 = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("US30", "INDEX"),
      providerSymbol: "US30",
      live: {
        bid: 42000,
        ask: 42001,
        streamState: "LIVE",
        updateCount: 3,
        priceChangeAgeMs: 200,
        receiptAgeMs: 100,
        eventSource: "offers-callback",
      },
    });
    const xag = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("XAG/USD", "COMMODITY"),
      providerSymbol: "XAG/USD",
      live: {
        bid: 50,
        ask: 50.1,
        streamState: "MARKET_INACTIVE",
        updateCount: 0,
        historicalOnly: true,
        eventSource: null,
        priceChangeAgeMs: null,
        receiptAgeMs: 100,
      },
    });
    const summary = summarizeInstrumentReadinessCatalog({
      provider: "FOREXCONNECT",
      snapshots: [us30, xag],
    });
    expect(summary.liveReadySymbols).toEqual(["US30"]);
    expect(summary.blockedSymbols.some((b) => b.symbol === "XAG/USD")).toBe(true);
  });

  it("FAKE/XYZ undiscovered stays unavailable; allowlist unchanged", () => {
    const fake = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: null,
      providerSymbol: "FAKE/XYZ",
      live: null,
    });
    expect(fake.capabilities.discovered).toBe(false);
    expect(fake.capabilities.liveFeedReady).toBe(false);
    expect(isInstrumentAllowlisted("EUR/USD")).toBe(false);
    expect(isInstrumentAllowlisted("US30")).toBe(false);
    expect(isInstrumentAllowlisted("XAU/USD")).toBe(true);
  });

  it("safety invariants remain closed on restore result", async () => {
    const bridge = mockBridge();
    const live = new ForexConnectLiveCandleService({ bridge });
    services.push(live);
    const empty = await live.restoreIntendedSubscriptions();
    expect(empty.placesOrders).toBe(false);
    expect(empty.acceptsForExecution).toBe(false);
    expect(live.getLifecycleDiagnostics().placesOrders).toBe(false);
  });
});
