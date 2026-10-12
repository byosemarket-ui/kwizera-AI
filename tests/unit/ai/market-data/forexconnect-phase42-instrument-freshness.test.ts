/**
 * Phase 42 — instrument-specific freshness vs global Offers counter;
 * same-price genuine heartbeats stay LIVE; seeded peer snapshots stay inactive.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ForexConnectLiveCandleService,
} from "../../../../ai/market-data/forexconnect/live-service.ts";
import type { ForexConnectBridge } from "../../../../ai/market-data/forexconnect/client.ts";
import type { ForexConnectLiveQuote } from "../../../../ai/market-data/forexconnect/live-types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function histCandle(nowMs: number, price: number) {
  return {
    time: Math.floor(nowMs / 60_000) * 60,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 1,
    closed: false,
  };
}

function mockBridge(options: {
  quotes: () => ForexConnectLiveQuote[];
  streamUpdateCount: () => number;
  streamState?: string;
}): ForexConnectBridge {
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
      candles: [histCandle(Date.now(), symbol.includes("AUD") ? 4.65 : 1.1)],
    })),
    pollQuotes: vi.fn(async () => options.quotes()),
    getStreamStatus: vi.fn(async () => ({
      ok: true,
      provider: "FOREXCONNECT",
      sessionStatus: "CONNECTED",
      streamState: options.streamState ?? "LIVE",
      offersListenerActive: true,
      offersPollerActive: true,
      callbackRegistered: true,
      subscriptionCount: 2,
      subscriptions: ["AUD/CNH", "EUR/USD"],
      maxSubscriptions: 8,
      lastQuoteAt: new Date().toISOString(),
      lastQuoteAgeMs: 100,
      lastStreamError: null,
      updateCount: options.streamUpdateCount(),
      lastEventSource: "offers-callback",
      diagnostics: {
        callbackRegistered: true,
        callbackInvocations: 10,
        callbackAccepted: 5,
        callbackFiltered: 5,
        callbackNoBid: 0,
        callbackParseFailures: 0,
        pollCycles: 10,
        pollChanges: 1,
        lastCallbackAt: new Date().toISOString(),
        lastPollChangeAt: null,
        offersPollerActive: true,
      },
      priceBasis: "bid",
      trading: "DISABLED",
    })),
  } as unknown as ForexConnectBridge;
}

describe("Phase 42 instrument-specific freshness", () => {
  const services: ForexConnectLiveCandleService[] = [];
  afterEach(async () => {
    for (const svc of services.splice(0)) {
      await svc.clearAllSessions();
    }
  });

  it("does not mark AUD/CNH LIVE when only EUR/USD Offers advance (global counter)", async () => {
    const now = Date.now();
    let streamUpd = 10;
    const seededAud: ForexConnectLiveQuote = {
      provider: "FOREXCONNECT",
      providerSymbol: "AUD/CNH",
      canonicalSymbol: "AUDCNH",
      displaySymbol: "AUD/CNH",
      bid: 4.65881,
      ask: 4.65957,
      mid: 4.65919,
      candlePrice: 4.65881,
      priceBasis: "bid",
      sourceTimestampMs: now - 60_000,
      receivedAtMs: now - 60_000,
      offerId: "27",
      eventSource: null,
    };
    let eurRecv = now - 1_000;
    const bridge = mockBridge({
      streamUpdateCount: () => streamUpd,
      quotes: () => [
        seededAud,
        {
          provider: "FOREXCONNECT",
          providerSymbol: "EUR/USD",
          canonicalSymbol: "EURUSD",
          displaySymbol: "EUR/USD",
          bid: 1.1156,
          ask: 1.1157,
          mid: 1.11565,
          candlePrice: 1.1156,
          priceBasis: "bid",
          sourceTimestampMs: eurRecv,
          receivedAtMs: eurRecv,
          offerId: "1",
          eventSource: "offers-callback",
        },
      ],
    });
    const svc = new ForexConnectLiveCandleService({ bridge });
    services.push(svc);

    await svc.ensure("AUD/CNH", "1m");
    await svc.ensure("EUR/USD", "1m");

    for (let i = 0; i < 4; i += 1) {
      streamUpd += 1;
      eurRecv += 200;
      await svc.ensure("AUD/CNH", "1m");
      await svc.ensure("EUR/USD", "1m");
    }

    const aud = svc.getSeries("AUD/CNH", "1m")!;
    const eur = svc.getSeries("EUR/USD", "1m")!;
    expect(eur.streamState).toBe("LIVE");
    expect(eur.updateCount).toBeGreaterThan(0);
    expect(["MARKET_INACTIVE", "SUBSCRIBED_WAITING"]).toContain(aud.streamState);
    expect(aud.streamState).not.toBe("LIVE");
    expect(aud.streamState).not.toBe("STALE");
    expect(aud.updateCount).toBe(0);
    expect(aud.lastQuoteAt).toBeNull();
    expect(aud.sidecarUpdateCount).toBeGreaterThan(aud.updateCount);
    // After peers are LIVE, seeded-only instruments must surface MARKET_INACTIVE.
    expect(aud.streamState).toBe("MARKET_INACTIVE");
  });

  it("keeps LIVE on genuine same-price heartbeats without global updateCount bumps", async () => {
    const now = Date.now();
    let recv = now;
    const bid = 1.1156;
    const bridge = mockBridge({
      streamUpdateCount: () => 3, // frozen global price-change counter
      quotes: () => [{
        provider: "FOREXCONNECT",
        providerSymbol: "EUR/USD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EUR/USD",
        bid,
        ask: bid + 0.0001,
        mid: bid + 0.00005,
        candlePrice: bid,
        priceBasis: "bid",
        sourceTimestampMs: recv,
        receivedAtMs: recv,
        offerId: "1",
        eventSource: "offers-callback",
      }],
    });
    const svc = new ForexConnectLiveCandleService({ bridge });
    services.push(svc);
    await svc.ensure("EUR/USD", "1m");
    expect(svc.getSeries("EUR/USD", "1m")!.streamState).toBe("LIVE");

    for (let i = 0; i < 5; i += 1) {
      recv += 500;
      const series = await svc.ensure("EUR/USD", "1m");
      expect(series.streamState).toBe("LIVE");
      expect(series.lastQuoteAgeMs).toBeLessThan(5_000);
    }
    expect(svc.getSeries("EUR/USD", "1m")!.updateCount).toBeGreaterThan(1);
  });

  it("repeated ensure does not leak sessions and awaits shared poll", async () => {
    const now = Date.now();
    let recv = now;
    const bridge = mockBridge({
      streamUpdateCount: () => 1,
      quotes: () => [{
        provider: "FOREXCONNECT",
        providerSymbol: "EUR/USD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EUR/USD",
        bid: 1.1,
        ask: 1.1001,
        mid: 1.10005,
        candlePrice: 1.1,
        priceBasis: "bid",
        sourceTimestampMs: recv,
        receivedAtMs: recv,
        offerId: "1",
        eventSource: "offers-callback",
      }],
    });
    const svc = new ForexConnectLiveCandleService({ bridge });
    services.push(svc);
    await Promise.all([
      svc.ensure("EUR/USD", "1m"),
      svc.ensure("EUR/USD", "1m"),
      svc.ensure("EUR/USD", "1m"),
    ]);
    expect(svc.getSessionCount()).toBe(1);
    expect(bridge.subscribeQuotes).toHaveBeenCalledTimes(1);
  });

  it("source contracts: no sidecar lastQuote fallback; instrument diagnostics; Binance header scoped", () => {
    const live = read("ai/market-data/forexconnect/live-service.ts");
    expect(live).toContain("Instrument-specific freshness only");
    expect(live).toContain("never gate per-instrument LIVE");
    expect(live).toContain("MARKET_INACTIVE");
    expect(live).not.toContain("bootstrapFromLivePeer");
    expect(live).not.toContain("hasNewOffersEvents");

    const svc = read("ai/market-data/providers/market-data-service.ts");
    expect(svc).toContain("sidecarUpdateCount: Number(result.sidecarUpdateCount ?? 0)");
    expect(svc).toContain("updateCount: Number(result.updateCount ?? 0)");

    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("Same bid/ask: still refresh instrument receipt time");

    const header = read("desktop/forex/ForexHeader.tsx");
    expect(header).toContain("Binance API health ·");
    expect(header).toContain("isForexConnectSelection");

    const chart = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(chart).toContain("Offers · instrument");
    expect(chart).toContain("stream {unified.streamDiagnostics.sidecarUpdateCount}");
  });
});
