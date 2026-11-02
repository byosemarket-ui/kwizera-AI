/**
 * Phase 4.18F.7 remediation — getLatestQuoteState must prefer LIVE evidence across TF
 * sessions for the same instrument (never first insertion-order MARKET_INACTIVE).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ForexConnectLiveCandleService,
} from "../../../../ai/market-data/forexconnect/live-service.ts";
import type { ForexConnectBridge } from "../../../../ai/market-data/forexconnect/client.ts";

function mockBridge(options?: {
  pollQuotes?: () => Array<Record<string, unknown>>;
}): ForexConnectBridge {
  let updateCount = 0;
  return {
    getConfig: () => ({
      environment: "demo",
      environmentLabel: "FXCM DEMO",
      enabled: true,
    }),
    subscribeQuotes: vi.fn(async (symbol: string) => ({
      ok: true,
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    })),
    unsubscribeQuotes: vi.fn(async () => undefined),
    getHistoricalCandles: vi.fn(async ({ symbol, timeframe }: { symbol: string; timeframe: string }) => ({
      ok: true,
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      displaySymbol: symbol,
      marketType: "FOREX",
      timeframe,
      candles: [
        {
          time: Math.floor(Date.now() / 60_000) * 60,
          open: 2650,
          high: 2650,
          low: 2650,
          close: 2650,
          volume: 1,
          closed: false,
        },
      ],
    })),
    pollQuotes: vi.fn(async () => (options?.pollQuotes ? options.pollQuotes() : [])),
    getStreamStatus: vi.fn(async () => {
      updateCount += 1;
      return {
        ok: true,
        provider: "FOREXCONNECT",
        sessionStatus: "CONNECTED",
        streamState: "LIVE",
        offersListenerActive: true,
        offersPollerActive: true,
        callbackRegistered: true,
        subscriptionCount: 1,
        subscriptions: ["XAU/USD"],
        maxSubscriptions: 8,
        lastQuoteAt: new Date().toISOString(),
        lastQuoteAgeMs: 100,
        lastStreamError: null,
        updateCount,
        lastEventSource: "offers-table-diff",
        diagnostics: null,
        priceBasis: "bid",
        trading: "DISABLED",
      };
    }),
  } as unknown as ForexConnectBridge;
}

describe("Phase 4.18F.7 getLatestQuoteState TF preference", () => {
  const services: ForexConnectLiveCandleService[] = [];
  afterEach(async () => {
    for (const s of services) {
      try {
        await s.clearAllSessions({ clearIntended: true });
      } catch {
        /* ignore */
      }
    }
    services.length = 0;
  });

  it("prefers LIVE session over earlier MARKET_INACTIVE for same instrument", async () => {
    const now = Date.now();
    const quote = {
      provider: "FOREXCONNECT" as const,
      providerSymbol: "XAU/USD",
      canonicalSymbol: "XAUUSD",
      displaySymbol: "XAU/USD",
      bid: 2650.4,
      ask: 2650.7,
      candlePrice: 2650.4,
      sourceTimestampMs: now,
      receivedAtMs: now,
      eventSource: "offers-table-diff",
      tradingStatus: "O",
    };
    const bridge = mockBridge({
      pollQuotes: () => [quote],
    });
    const live = new ForexConnectLiveCandleService({ bridge });
    services.push(live);

    // Cold 1m first (insertion order), then 15m.
    await live.ensure("XAU/USD", "1m");
    await live.ensure("XAU/USD", "15m");

    const sessions = (live as unknown as {
      sessions: Map<string, {
        lastQuote: typeof quote | null;
        lastQuoteAtMs: number | null;
        lastPriceChangeAtMs: number | null;
        updateCount: number;
        streamState: string;
      }>;
    }).sessions;
    const rows = [...sessions.values()];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // Reproduce the F.7 failure shape: first TF cold MARKET_INACTIVE, later TF LIVE.
    rows[0]!.lastQuote = quote;
    rows[0]!.lastQuoteAtMs = now;
    rows[0]!.lastPriceChangeAtMs = null;
    rows[0]!.updateCount = 0;
    rows[0]!.streamState = "MARKET_INACTIVE";
    rows[1]!.lastQuote = { ...quote, bid: 2650.9, ask: 2651.2, candlePrice: 2650.9 };
    rows[1]!.lastQuoteAtMs = now;
    rows[1]!.lastPriceChangeAtMs = now - 400;
    rows[1]!.updateCount = 4;
    rows[1]!.streamState = "LIVE";

    const state = live.getLatestQuoteState("XAU/USD");
    expect(state).not.toBeNull();
    expect(state!.streamState).toBe("LIVE");
    expect(state!.updateCount).toBe(4);
    expect(state!.quote.bid).toBe(2650.9);
  });

  it("skips quote-less peer session instead of returning null when another TF has a quote", async () => {
    const now = Date.now();
    const quote = {
      provider: "FOREXCONNECT" as const,
      providerSymbol: "XAU/USD",
      canonicalSymbol: "XAUUSD",
      displaySymbol: "XAU/USD",
      bid: 2650.1,
      ask: 2650.4,
      candlePrice: 2650.1,
      sourceTimestampMs: now,
      receivedAtMs: now,
      eventSource: "offers-table-diff",
      tradingStatus: "O",
    };
    const bridge = mockBridge({ pollQuotes: () => [] });
    const live = new ForexConnectLiveCandleService({ bridge });
    services.push(live);
    await live.ensure("XAU/USD", "1m");
    await live.ensure("XAU/USD", "15m");
    const sessions = (live as unknown as {
      sessions: Map<string, {
        lastQuote: typeof quote | null;
        lastQuoteAtMs: number | null;
        lastPriceChangeAtMs: number | null;
        updateCount: number;
        streamState: string;
      }>;
    }).sessions;
    const rows = [...sessions.values()];
    rows[0]!.lastQuote = null;
    rows[0]!.updateCount = 0;
    rows[1]!.lastQuote = quote;
    rows[1]!.lastQuoteAtMs = now;
    rows[1]!.lastPriceChangeAtMs = now - 200;
    rows[1]!.updateCount = 2;
    rows[1]!.streamState = "LIVE";

    const state = live.getLatestQuoteState("XAU/USD");
    expect(state).not.toBeNull();
    expect(state!.streamState).toBe("LIVE");
    expect(state!.updateCount).toBe(2);
  });
});

