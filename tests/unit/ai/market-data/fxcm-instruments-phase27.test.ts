/**
 * Phase 27 — FXCM instrument discovery & symbol mapping tests.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createFxcmInstrumentDiscoveryService,
} from "../../../../ai/market-data/fxcm/instrument-discovery.ts";
import {
  assertSafeDiscoveryPayload,
  filterDiscoveredInstruments,
  mapFxcmInstrumentCatalog,
  mapFxcmInstrumentList,
  toCanonicalFxcmSymbol,
  toDisplayFxcmSymbol,
} from "../../../../ai/market-data/fxcm/instrument-mapper.ts";
import { createFxcmMarketDataProvider } from "../../../../ai/market-data/fxcm/provider.ts";
import {
  createMarketDataProviderRegistry,
  resolveMarketProviderForSymbol,
  marketIdentityKey,
} from "../../../../ai/market-data/providers/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const TOKEN = "abcdef0123456789abcdef0123456789token";

function mockFetch(instruments: Array<Record<string, unknown>>) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/socket.io/")) {
      return new Response('97:0{"sid":"DiscSid","upgrades":[]}', { status: 200 });
    }
    if (url.includes("/trading/get_instruments")) {
      return new Response(JSON.stringify({
        response: { executed: true },
        data: { instrument: instruments },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const SAMPLE = [
  { symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 },
  { symbol: "GBP/USD", visible: true, order: 2, instrumentType: 1 },
  { symbol: "USD/JPY", visible: true, order: 3, instrumentType: 1 },
  { symbol: "XAU/USD", visible: true, order: 4, instrumentType: 5 },
];

describe("Forex Phase 27 — FXCM instrument discovery", () => {
  it("1/2 discovery via authenticated mocked Socket REST", async () => {
    const discovery = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(SAMPLE),
    });
    const result = await discovery.discover({ refresh: true });
    expect(result.discoveryStatus).toBe("READY");
    expect(result.source).toBe("FXCM");
    expect(result.environmentLabel).toBe("FXCM DEMO");
    expect(result.count).toBe(4);
    expect(result.marketData).toBe("NOT_STARTED");
    expect(result.liveStream).toBe("NOT_ENABLED_YET");
    expect(result.trading).toBe("DISABLED");
    expect(result.authenticationState).toBe("AUTHENTICATED");
  });

  it("3/4/5/6/7/8 normalization + identity + base/quote + market type", () => {
    const catalog = mapFxcmInstrumentCatalog({
      response: { executed: true },
      data: { instrument: SAMPLE },
    });
    const eur = catalog.discovered.find((i) => i.providerSymbol === "EUR/USD")!;
    expect(eur.provider).toBe("FXCM");
    expect(eur.providerSymbol).toBe("EUR/USD");
    expect(eur.canonicalSymbol).toBe("EURUSD");
    expect(eur.displaySymbol).toBe("EUR/USD");
    expect(eur.marketType).toBe("FOREX");
    expect(eur.baseAsset).toBe("EUR");
    expect(eur.quoteAsset).toBe("USD");
    expect(eur.mappingStatus).toBe("VALIDATED");
    expect(eur.identity).toEqual({
      provider: "FXCM",
      marketType: "FOREX",
      providerSymbol: "EUR/USD",
      canonicalSymbol: "EURUSD",
    });
    expect(toCanonicalFxcmSymbol("EUR/USD")).toBe("EURUSD");
    expect(toDisplayFxcmSymbol("EUR/USD")).toBe("EUR/USD");
    const xau = catalog.discovered.find((i) => i.providerSymbol === "XAU/USD")!;
    expect(xau.marketType).toBe("COMMODITY");
    expect(xau.baseAsset).toBeNull();
    expect(xau.quoteAsset).toBeNull();
  });

  it("9/10 duplicate detection + mapping conflict", () => {
    const catalog = mapFxcmInstrumentCatalog({
      data: {
        instrument: [
          { symbol: "EUR/USD", instrumentType: 1 },
          { symbol: "EUR/USD", instrumentType: 1 },
          { symbol: "EUR-USD", instrumentType: 1 },
        ],
      },
    });
    // Duplicate providerSymbol skipped; EUR/USD and EUR-USD both → EURUSD → conflict
    expect(catalog.instruments).toHaveLength(2);
    expect(catalog.conflicts.some((c) => c.canonicalSymbol === "EURUSD")).toBe(true);
    expect(catalog.discovered.every((d) =>
      d.providerSymbol === "EUR/USD" || d.providerSymbol === "EUR-USD"
        ? d.mappingStatus === "CONFLICT"
        : true,
    )).toBe(true);
  });

  it("11 unresolved mapping for FOREX without valid base/quote", () => {
    const catalog = mapFxcmInstrumentCatalog({
      data: { instrument: [{ symbol: "WEIRD/PAIRINGTOOLONG", instrumentType: 1 }] },
    });
    expect(catalog.discovered[0]?.mappingStatus).toBe("UNRESOLVED");
    expect(catalog.discovered[0]?.baseAsset).toBeNull();
  });

  it("12/13 DEMO/REAL cache separation", async () => {
    const fetchImpl = mockFetch(SAMPLE);
    const demo = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl,
      cacheTtlMs: 60_000,
    });
    const real = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "real",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl,
      cacheTtlMs: 60_000,
    });
    await demo.discover({ refresh: true });
    await real.discover({ refresh: true });
    expect(demo.cachedEnvironments()).toEqual(["demo"]);
    expect(real.cachedEnvironments()).toEqual(["real"]);
    expect((await demo.discover()).environment).toBe("demo");
    expect((await real.discover()).environment).toBe("real");
  });

  it("14 cache freshness FRESH then CACHED", async () => {
    const discovery = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(SAMPLE),
      cacheTtlMs: 60_000,
    });
    const first = await discovery.discover({ refresh: true });
    expect(first.source).toBe("FXCM");
    expect(first.freshness).toBe("FRESH");
    const second = await discovery.discover();
    expect(second.source).toBe("CACHED");
    expect(second.freshness).toBe("FRESH");
  });

  it("15/16 search + filtering", () => {
    const catalog = mapFxcmInstrumentCatalog({ data: { instrument: SAMPLE } });
    const eur = filterDiscoveredInstruments(catalog.discovered, { search: "EUR" });
    expect(eur.every((i) =>
      i.providerSymbol.includes("EUR")
      || i.canonicalSymbol?.includes("EUR")
      || i.baseAsset === "EUR",
    )).toBe(true);
    const forex = filterDiscoveredInstruments(catalog.discovered, { marketType: "FOREX" });
    expect(forex.every((i) => i.marketType === "FOREX")).toBe(true);
    expect(forex).toHaveLength(3);
  });

  it("17/18/19 safe API payload — no credentials", async () => {
    const discovery = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(SAMPLE),
    });
    const result = await discovery.discover({ refresh: true });
    expect(() => assertSafeDiscoveryPayload(result, TOKEN)).not.toThrow();
    const json = JSON.stringify(result);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain("Bearer ");
    expect(json).not.toContain("authorizationHeader");
    expect(json).not.toContain("password");
  });

  it("20 Binance symbol regression — no false FX mapping", () => {
    expect(resolveMarketProviderForSymbol("BTCUSDT")).toBe("BINANCE");
    expect(resolveMarketProviderForSymbol("ETHUSDT")).toBe("BINANCE");
    expect(resolveMarketProviderForSymbol("EURUSDC")).toBe("BINANCE");
    expect(resolveMarketProviderForSymbol("EUR/USD")).toBe("FXCM");
    expect(marketIdentityKey({
      provider: "BINANCE",
      marketType: "CRYPTO",
      symbol: "BTCUSDT",
    })).not.toBe(marketIdentityKey({
      provider: "FXCM",
      marketType: "FOREX",
      symbol: "EURUSD",
    }));
  });

  it("21 provider listInstruments + getInstrument", async () => {
    const provider = createFxcmMarketDataProvider({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(SAMPLE),
    });
    const list = await provider.listInstruments({ refresh: true });
    expect(list.length).toBe(4);
    const found = await provider.getInstrument("EUR/USD");
    expect(found?.canonicalSymbol).toBe("EURUSD");
    expect(found?.provider).toBe("FXCM");
  });

  it("22 disabled / not configured discovery states", async () => {
    const disabled = createFxcmInstrumentDiscoveryService({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    const d1 = await disabled.discover();
    expect(d1.discoveryStatus).toBe("DISABLED");
    expect(d1.count).toBe(0);

    const missing = createFxcmInstrumentDiscoveryService({
      env: { KWIZERA_FXCM_ENABLED: "1", KWIZERA_FXCM_ENVIRONMENT: "demo" },
    });
    const d2 = await missing.discover();
    expect(d2.discoveryStatus).toBe("NOT_CONFIGURED");

    // API treats these as ok=true configuration states (see forex-providers-api).
    const api = read("dev/server/forex-providers-api.ts");
    expect(api).toContain("configState || readyOrCached");
  });

  it("23/24/25/26 no fake market data / trading / hardcoded catalog in production", () => {
    const files = [
      "ai/market-data/fxcm/instrument-discovery.ts",
      "ai/market-data/fxcm/instrument-mapper.ts",
      "ai/market-data/fxcm/provider.ts",
      "dev/server/forex-providers-api.ts",
      "desktop/forex-admin/ForexAdminInstrumentsPage.tsx",
    ];
    const banned = [
      "fakePrice", "mockPrice", "demoPrice", "simulatedPrice",
      "fakeInstrument", "hardcodedCatalog", "Math.random",
      "placeOrder", "open_trade", "createOrder",
    ];
    for (const file of files) {
      const src = read(file);
      for (const token of banned) {
        expect(src).not.toContain(token);
      }
    }
    expect(mapFxcmInstrumentList([])).toEqual([]);
  });

  it("admin route + API wiring", () => {
    const routes = read("desktop/forex-admin/forex-admin-routes.ts");
    const api = read("dev/server/forex-providers-api.ts");
    const pages = read("desktop/forex-admin/ForexAdminPages.tsx");
    expect(routes).toContain("/admin/forex/instruments");
    expect(api).toContain("/api/forex/providers/fxcm/instruments");
    expect(api).toContain("marketType");
    expect(api).toContain("assertSafeDiscoveryPayload");
    expect(pages).toContain("ForexAdminInstrumentsPage");
    expect(pages).not.toContain("KWIZERA_FXCM_ACCESS_TOKEN");
  });

  it("registry still includes Binance + FXCM", async () => {
    const registry = createMarketDataProviderRegistry({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    expect(registry.listProviderIds()).toEqual(["BINANCE", "FXCM"]);
    const snap = await registry.snapshot();
    expect(snap.providers.some((p) => p.info.provider === "BINANCE")).toBe(true);
  });

  it("capabilities distinguish phase-enabled from provider surface", async () => {
    const discovery = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(SAMPLE),
    });
    const result = await discovery.discover({ refresh: true });
    const caps = result.instruments[0]!.capabilities;
    expect(caps.phaseEnabled.instruments).toBe(true);
    expect(caps.phaseEnabled.liveQuotes).toBe(false);
    expect(caps.phaseEnabled.trading).toBe(false);
    expect(caps.providerOfficialSurface.instruments).toBe(true);
    expect(caps.providerOfficialSurface.trading).toBe("DISABLED");
    expect(caps.providerOfficialSurface.streaming).toBe("NOT_ENABLED");
    // Phase 28 enables historical candles on the phase/capability surface.
    expect(caps.phaseEnabled.historicalPrices).toBe(true);
    expect(caps.phaseEnabled.candles).toBe(true);
    expect(caps.providerOfficialSurface.historical).toBe("HISTORICAL_ENABLED");
  });
});
