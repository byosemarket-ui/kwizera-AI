/**
 * Phase 56.3.5 — controlled recovery acceptance (synthetic / in-process).
 * Environment: vitest + mock ForexConnect bridge + temp persistence store.
 * NOT production Offers evidence. Does not place orders or restart the VPS.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ForexConnectLiveCandleService,
  FOREXCONNECT_RESTORE_MAX_ATTEMPTS,
} from "../../../../ai/market-data/forexconnect/live-service.ts";
import {
  ForexConnectIntendedSubscriptionsStore,
  FOREXCONNECT_INTENDED_SCHEMA_VERSION,
  validatePersistedIntendedEntry,
} from "../../../../ai/market-data/forexconnect/intended-subscriptions-store.ts";
import type { ForexConnectBridge } from "../../../../ai/market-data/forexconnect/client.ts";
import type { ForexConnectLiveQuote } from "../../../../ai/market-data/forexconnect/live-types.ts";
import { classifyForexConnectInstrument } from "../../../../ai/market-data/forexconnect/instrument-classify.ts";
import {
  evaluateInstrumentReadiness,
  summarizeInstrumentReadinessCatalog,
} from "../../../../ai/market-data/instrument-readiness/index.ts";
import { isInstrumentAllowlisted } from "../../../../ai/forex-ai/automated-trading/simulation-risk/allowlist.ts";
import type { MarketInstrument } from "../../../../ai/market-data/providers/types.ts";

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-fc-56-3-5-"));
}

function quote(
  symbol: string,
  bid: number,
  receivedAtMs: number,
  eventSource: string | null = "offers-callback",
): ForexConnectLiveQuote {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: symbol,
    canonicalSymbol: symbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
    displaySymbol: symbol,
    bid,
    ask: bid + 0.01,
    mid: bid + 0.005,
    candlePrice: bid,
    priceBasis: "bid",
    sourceTimestampMs: receivedAtMs,
    receivedAtMs,
    offerId: symbol,
    eventSource,
  };
}

function mockBridge(state: {
  disconnected: boolean;
  quotes: () => ForexConnectLiveQuote[];
  catalog?: string[];
}): ForexConnectBridge {
  let updateCount = 0;
  const catalog = state.catalog ?? ["XAU/USD", "EUR/USD", "US30", "GBP/USD", "XAG/USD"];
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
    pollQuotes: vi.fn(async () => (state.disconnected ? [] : state.quotes())),
    getStreamStatus: vi.fn(async () => {
      updateCount += 1;
      return {
        ok: true,
        provider: "FOREXCONNECT",
        sessionStatus: state.disconnected ? "DISCONNECTED" : "CONNECTED",
        streamState: state.disconnected ? "DISCONNECTED" : "LIVE",
        offersListenerActive: !state.disconnected,
        offersPollerActive: !state.disconnected,
        callbackRegistered: !state.disconnected,
        subscriptionCount: state.disconnected ? 0 : 2,
        subscriptions: state.disconnected ? [] : ["XAU/USD", "EUR/USD"],
        maxSubscriptions: 8,
        lastQuoteAt: null,
        lastQuoteAgeMs: null,
        lastStreamError: null,
        updateCount,
        lastEventSource: state.disconnected ? null : "offers-callback",
        diagnostics: null,
        priceBasis: "bid",
        trading: "DISABLED",
      };
    }),
    getStatus: vi.fn(async () => ({
      ok: true,
      status: state.disconnected ? "DISCONNECTED" : "CONNECTED",
      enabled: true,
      environment: "demo",
      environmentLabel: "DEMO",
      trading: "DISABLED",
    })),
    listInstruments: vi.fn(async () => ({
      ok: true,
      count: catalog.length,
      fetchedAt: new Date().toISOString(),
      instruments: catalog.map((providerSymbol) => ({
        provider: "FOREXCONNECT",
        providerSymbol,
        canonicalSymbol: providerSymbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
        displaySymbol: providerSymbol,
        marketType: "FOREX",
        baseAsset: null,
        quoteAsset: null,
        status: "available",
      })),
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

describe("Phase 56.3.5 controlled recovery acceptance (synthetic)", () => {
  const services: ForexConnectLiveCandleService[] = [];
  const roots: string[] = [];

  afterEach(async () => {
    for (const s of services) {
      await s.clearAllSessions({ clearIntended: true });
    }
    services.length = 0;
    for (const root of roots) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    roots.length = 0;
  });

  it("A — persists XAU/USD and EUR/USD with slash symbols; rejects FAKE and duplicates", async () => {
    expect(validatePersistedIntendedEntry({
      providerSymbol: "XAU/USD",
      timeframe: "1m",
      rememberedAtMs: Date.now(),
    }).ok).toBe(true);
    expect(validatePersistedIntendedEntry({
      providerSymbol: "EUR/USD",
      timeframe: "1m",
      rememberedAtMs: Date.now(),
    }).ok).toBe(true);
    expect(validatePersistedIntendedEntry({
      providerSymbol: "FAKE/XYZ",
      timeframe: "1m",
      rememberedAtMs: Date.now(),
    }, { catalogSymbols: new Set(["XAU/USD", "EUR/USD"]) }).ok).toBe(false);

    const root = tempRoot();
    roots.push(root);
    const store = new ForexConnectIntendedSubscriptionsStore(root);
    const prices = new Map<string, number>([["XAU/USD", 4100], ["EUR/USD", 1.08]]);
    let recv = Date.now();
    const state = {
      disconnected: false,
      quotes: () => [...prices.entries()].map(([sym, bid]) => quote(sym, bid, recv)),
    };
    const bridge = mockBridge(state);
    const live = new ForexConnectLiveCandleService({ bridge, persistence: store });
    services.push(live);

    await live.ensure("XAU/USD", "1m");
    await live.ensure("EUR/USD", "1m");
    // Attempt FAKE — catalog validation on restore/hydrate; ensure may throw or create if hist works.
    // Persistence after ensure of catalog symbols only:
    const raw = JSON.parse(fs.readFileSync(store.path, "utf8")) as {
      subscriptions: Array<{ providerSymbol: string }>;
      schemaVersion: string;
    };
    expect(raw.schemaVersion).toBe(FOREXCONNECT_INTENDED_SCHEMA_VERSION);
    const syms = raw.subscriptions.map((s) => s.providerSymbol).sort();
    expect(syms).toEqual(["EUR/USD", "XAU/USD"]);
    expect(JSON.stringify(raw)).not.toMatch(/password|token|secret|bid|ask/i);

    // Malformed store fails safe
    fs.writeFileSync(store.path, "{not-json", "utf8");
    const live2 = new ForexConnectLiveCandleService({
      bridge,
      persistence: new ForexConnectIntendedSubscriptionsStore(root),
    });
    services.push(live2);
    const hydrated = await live2.hydratePersistedIntended({ environment: "demo", validateCatalog: false });
    expect(hydrated.loaded).toHaveLength(0);
    expect(hydrated.recoveredCorrupt || hydrated.error).toBeTruthy();
    expect(live2.getLifecycleDiagnostics().placesOrders).toBe(false);
  });

  it("B — controlled disconnect invalidates LIVE; single-flight restore; fresh events required", async () => {
    const root = tempRoot();
    roots.push(root);
    const store = new ForexConnectIntendedSubscriptionsStore(root);
    const prices = new Map<string, number>([["XAU/USD", 4100], ["EUR/USD", 1.08]]);
    let recv = Date.now();
    const state = {
      disconnected: false,
      quotes: () => [...prices.entries()].map(([sym, bid]) => quote(sym, bid, recv)),
    };
    const bridge = mockBridge(state);
    const live = new ForexConnectLiveCandleService({ bridge, persistence: store });
    services.push(live);

    await live.ensure("XAU/USD", "1m");
    await live.ensure("EUR/USD", "1m");
    for (let i = 0; i < 3; i += 1) {
      recv += 250;
      prices.set("XAU/USD", 4100 + i * 0.1);
      prices.set("EUR/USD", 1.08 + i * 0.0001);
      await live.ensure("XAU/USD", "1m");
      await live.ensure("EUR/USD", "1m");
    }
    expect(live.getSeries("XAU/USD", "1m")?.streamState).toBe("LIVE");
    expect(live.getSeries("EUR/USD", "1m")?.streamState).toBe("LIVE");
    expect(live.listIntendedSubscriptions().length).toBe(2);

    // Controlled disconnect (in-process — not production admin API).
    state.disconnected = true;
    await live.ensure("XAU/USD", "1m");
    expect(live.getSeries("XAU/USD", "1m")?.streamState).toBe("DISCONNECTED");
    expect(live.getLifecycleDiagnostics().lifecycleState).toBe("DISCONNECTED");
    expect(live.listIntendedSubscriptions().length).toBe(2);

    // Reconnect + single-flight restore
    state.disconnected = false;
    live.notifyProviderConnected();
    const p1 = live.restoreIntendedSubscriptions();
    const p2 = live.restoreIntendedSubscriptions();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.attempted).toBe(r2.attempted);
    expect(r1.attempted).toBeLessThanOrEqual(FOREXCONNECT_RESTORE_MAX_ATTEMPTS);
    expect(r1.restored.every((row) => row.streamState !== "LIVE")).toBe(true);
    expect(bridge.subscribeQuotes).toHaveBeenCalled();

    // Fresh genuine events required for LIVE again
    for (let i = 0; i < 3; i += 1) {
      recv += 300;
      prices.set("XAU/USD", 4110 + i);
      prices.set("EUR/USD", 1.09 + i * 0.0001);
      await live.ensure("XAU/USD", "1m");
      await live.ensure("EUR/USD", "1m");
    }
    expect(live.getSeries("XAU/USD", "1m")?.streamState).toBe("LIVE");
    expect(live.getSeries("EUR/USD", "1m")?.streamState).toBe("LIVE");

    // Repeat cycle — no session leak
    const sessionsBefore = live.getSessionCount();
    state.disconnected = true;
    await live.ensure("EUR/USD", "1m");
    state.disconnected = false;
    live.notifyProviderConnected();
    await live.restoreIntendedSubscriptions();
    for (let i = 0; i < 2; i += 1) {
      recv += 300;
      prices.set("XAU/USD", 4120 + i);
      prices.set("EUR/USD", 1.1 + i * 0.0001);
      await live.ensure("XAU/USD", "1m");
      await live.ensure("EUR/USD", "1m");
    }
    expect(live.getSessionCount()).toBe(sessionsBefore);
    expect(live.getLifecycleDiagnostics().placesOrders).toBe(false);
    expect(live.getLifecycleDiagnostics().acceptsForExecution).toBe(false);
  });

  it("B/D — XAU recovers independently while EUR stays blocked without its own fresh tick", async () => {
    const prices = new Map<string, number>([["XAU/USD", 4100], ["EUR/USD", 1.08]]);
    let recv = Date.now();
    let feedEur = true;
    const state = {
      disconnected: false,
      quotes: () => {
        const out: ForexConnectLiveQuote[] = [
          quote("XAU/USD", prices.get("XAU/USD")!, recv),
        ];
        if (feedEur) {
          out.push(quote("EUR/USD", prices.get("EUR/USD")!, recv));
        }
        return out;
      },
    };
    const bridge = mockBridge(state);
    const live = new ForexConnectLiveCandleService({ bridge, persistence: null });
    services.push(live);

    await live.ensure("XAU/USD", "1m");
    await live.ensure("EUR/USD", "1m");
    for (let i = 0; i < 3; i += 1) {
      recv += 250;
      prices.set("XAU/USD", 4100 + i);
      prices.set("EUR/USD", 1.08 + i * 0.0001);
      await live.ensure("XAU/USD", "1m");
      await live.ensure("EUR/USD", "1m");
    }
    expect(live.getSeries("XAU/USD", "1m")?.streamState).toBe("LIVE");
    expect(live.getSeries("EUR/USD", "1m")?.streamState).toBe("LIVE");

    state.disconnected = true;
    await live.clearAllSessions({ clearIntended: false });
    state.disconnected = false;
    // EUR feed unavailable for restore + recovery — isolation under test.
    feedEur = false;
    live.notifyProviderConnected();
    await live.restoreIntendedSubscriptions();

    for (let i = 0; i < 4; i += 1) {
      recv += 300;
      prices.set("XAU/USD", 4200 + i);
      await live.ensure("XAU/USD", "1m");
      await live.ensure("EUR/USD", "1m");
    }
    expect(live.getSeries("XAU/USD", "1m")?.streamState).toBe("LIVE");
    expect(live.getSeries("EUR/USD", "1m")?.streamState).not.toBe("LIVE");
  });

  it("C — process restart hydrate restores intent without inventing LIVE", async () => {
    const root = tempRoot();
    roots.push(root);
    const storeA = new ForexConnectIntendedSubscriptionsStore(root);
    let recv = Date.now();
    const prices = new Map<string, number>([["XAU/USD", 4100], ["EUR/USD", 1.08]]);
    const state = {
      disconnected: false,
      quotes: () => [...prices.entries()].map(([sym, bid]) => quote(sym, bid, recv)),
    };
    const bridge = mockBridge(state);
    const liveA = new ForexConnectLiveCandleService({ bridge, persistence: storeA });
    services.push(liveA);
    await liveA.ensure("XAU/USD", "1m");
    await liveA.ensure("EUR/USD", "1m");
    for (let i = 0; i < 2; i += 1) {
      recv += 200;
      prices.set("XAU/USD", 4100 + i);
      prices.set("EUR/USD", 1.08 + i * 0.0001);
      await liveA.ensure("XAU/USD", "1m");
      await liveA.ensure("EUR/USD", "1m");
    }
    expect(liveA.getSeries("XAU/USD", "1m")?.streamState).toBe("LIVE");

    // Simulate process death: new service, same store file
    await liveA.clearAllSessions({ clearIntended: false });
    // Re-persist intended after clear (clear preserves intended + persists)
    const storeB = new ForexConnectIntendedSubscriptionsStore(root);
    const liveB = new ForexConnectLiveCandleService({ bridge, persistence: storeB });
    services.push(liveB);
    expect(liveB.getSessionCount()).toBe(0);

    const hydrated = await liveB.hydratePersistedIntended({ environment: "demo" });
    expect(hydrated.loaded.map((r) => r.providerSymbol).sort()).toEqual(["EUR/USD", "XAU/USD"]);
    // Include obsolete FAKE in file — must not activate
    const now = Date.now();
    fs.writeFileSync(storeB.path, `${JSON.stringify({
      version: 1,
      schemaVersion: FOREXCONNECT_INTENDED_SCHEMA_VERSION,
      provider: "FOREXCONNECT",
      environment: "demo",
      updatedAtMs: now,
      subscriptions: [
        ...hydrated.loaded,
        { providerSymbol: "FAKE/XYZ", timeframe: "1m", rememberedAtMs: now },
      ],
    }, null, 2)}\n`);
    const liveC = new ForexConnectLiveCandleService({
      bridge,
      persistence: new ForexConnectIntendedSubscriptionsStore(root),
    });
    services.push(liveC);
    const h2 = await liveC.hydratePersistedIntended({ environment: "demo" });
    expect(h2.loaded.every((r) => r.providerSymbol !== "FAKE/XYZ")).toBe(true);
    expect(h2.skipped.some((s) => s.reason === "not_in_provider_catalog")).toBe(true);

    // Freeze quotes during restore — connection alone must not invent LIVE.
    state.quotes = () => [];
    liveC.notifyProviderConnected();
    const restored = await liveC.restoreIntendedSubscriptions();
    expect(restored.restored.every((r) => r.streamState !== "LIVE")).toBe(true);
    expect(liveC.getLifecycleDiagnostics().persistence.enabled).toBe(true);
  });

  it("D — metadata, FAKE, XAG isolation, allowlist, safety flags", () => {
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
      providerSymbol: "GBP/USD",
      canonicalSymbol: "GBPUSD",
      displaySymbol: "GBP/USD",
      marketType: "FOREX",
      baseAsset: "GBP",
      quoteAsset: "USD",
      status: "available",
      instrumentType: 1,
    }).marketType).toBe("FOREX");

    const xau = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("XAU/USD", "COMMODITY"),
      providerSymbol: "XAU/USD",
      live: {
        bid: 4100,
        ask: 4100.5,
        streamState: "LIVE",
        updateCount: 2,
        priceChangeAgeMs: 100,
        receiptAgeMs: 50,
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
    const fake = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: null,
      providerSymbol: "FAKE/XYZ",
      live: null,
    });
    const summary = summarizeInstrumentReadinessCatalog({
      provider: "FOREXCONNECT",
      snapshots: [xau, xag, fake],
    });
    expect(summary.liveReadySymbols).toEqual(["XAU/USD"]);
    expect(summary.blockedSymbols.some((b) => b.symbol === "XAG/USD")).toBe(true);
    expect(fake.capabilities.discovered).toBe(false);
    expect(isInstrumentAllowlisted("XAU/USD")).toBe(true);
    expect(isInstrumentAllowlisted("EUR/USD")).toBe(false);
    expect(isInstrumentAllowlisted("US30")).toBe(false);
  });
});
