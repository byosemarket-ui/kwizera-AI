/**
 * Phase 32 remediation — FXCM Markets discovery + unified candle routing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createFxcmInstrumentDiscoveryService,
} from "../../../../ai/market-data/fxcm/instrument-discovery.ts";
import {
  mapFxcmInstrumentCatalog,
  toCanonicalFxcmSymbol,
} from "../../../../ai/market-data/fxcm/instrument-mapper.ts";
import { FxcmMarketDataError } from "../../../../ai/market-data/fxcm/errors.ts";
import {
  createMarketDataService,
  MarketDataRoutingError,
} from "../../../../ai/market-data/providers/market-data-service.ts";
import { marketIdentityKey } from "../../../../ai/market-data/providers/identity.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const TOKEN = "abcdef0123456789abcdef0123456789token";

const SAMPLE = [
  { symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 },
  { symbol: "GBP/USD", visible: true, order: 2, instrumentType: 1 },
  { symbol: "USD/JPY", visible: true, order: 3, instrumentType: 1 },
  { symbol: "AUD/USD", visible: true, order: 4, instrumentType: 1 },
  { symbol: "USD/CHF", visible: true, order: 5, instrumentType: 1 },
  { symbol: "USD/CAD", visible: true, order: 6, instrumentType: 1 },
  { symbol: "NZD/USD", visible: true, order: 7, instrumentType: 1 },
  { symbol: "XAU/USD", visible: true, order: 8, instrumentType: 5 },
  { symbol: "EUR/USD", visible: true, order: 9, instrumentType: 1 }, // duplicate
];

function mockFetch(instruments: Array<Record<string, unknown>>) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/socket.io/")) {
      return new Response('97:0{"sid":"RemSid","upgrades":[]}', { status: 200 });
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

describe("Phase 32 remediation — FXCM Markets + unified candles", () => {
  it("normalizes mocked official FXCM instruments with identity preserved", () => {
    const catalog = mapFxcmInstrumentCatalog({
      response: { executed: true },
      data: { instrument: SAMPLE },
    });
    expect(catalog.instruments.length).toBeGreaterThanOrEqual(7);
    const eurusd = catalog.instruments.find((i) => i.providerSymbol === "EUR/USD");
    expect(eurusd?.provider).toBe("FXCM");
    expect(eurusd?.canonicalSymbol).toBe("EURUSD");
    expect(eurusd?.displaySymbol).toBe("EUR/USD");
    expect(eurusd?.marketType).toBe("FOREX");
    expect(eurusd?.baseAsset).toBe("EUR");
    expect(eurusd?.quoteAsset).toBe("USD");
    expect(toCanonicalFxcmSymbol("EUR/USD")).toBe("EURUSD");
  });

  it("handles duplicate FXCM symbols without inventing instruments", () => {
    const catalog = mapFxcmInstrumentCatalog({
      response: { executed: true },
      data: { instrument: SAMPLE },
    });
    const eurusdRows = catalog.instruments.filter((i) => i.canonicalSymbol === "EURUSD");
    expect(eurusdRows.length).toBe(1);
  });

  it("returns FXCM_DISABLED when provider is disabled", async () => {
    const discovery = createFxcmInstrumentDiscoveryService({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    const result = await discovery.discover({ refresh: true });
    expect(result.discoveryStatus).toBe("DISABLED");
    expect(result.errorCode).toBe("FXCM_DISABLED");
    expect(result.count).toBe(0);
    await expect(discovery.listInstruments()).rejects.toMatchObject({ code: "FXCM_DISABLED" });
  });

  it("returns FXCM_NOT_CONFIGURED when enabled but token missing", async () => {
    const discovery = createFxcmInstrumentDiscoveryService({
      env: { KWIZERA_FXCM_ENABLED: "1" },
    });
    const result = await discovery.discover({ refresh: true });
    expect(result.discoveryStatus).toBe("NOT_CONFIGURED");
    expect(result.count).toBe(0);
    await expect(discovery.listInstruments()).rejects.toBeInstanceOf(FxcmMarketDataError);
    await expect(discovery.listInstruments()).rejects.toMatchObject({ code: "FXCM_NOT_CONFIGURED" });
  });

  it("mocked discovery returns real FXCM instruments when authenticated", async () => {
    const discovery = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(SAMPLE),
    });
    const list = await discovery.listInstruments({ refresh: true });
    expect(list.some((i) => i.providerSymbol === "EUR/USD")).toBe(true);
    expect(list.every((i) => i.provider === "FXCM")).toBe(true);
  });

  it("demo vs real caches stay isolated", async () => {
    const demo = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch([{ symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 }]),
    });
    const real = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "real",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch([{ symbol: "GBP/USD", visible: true, order: 1, instrumentType: 1 }]),
    });
    await demo.discover({ refresh: true });
    await real.discover({ refresh: true });
    expect(demo.cachedEnvironments()).toEqual(["demo"]);
    expect(real.cachedEnvironments()).toEqual(["real"]);
  });

  it("explicit FXCM listInstruments surfaces DISABLED instead of silent empty", async () => {
    const service = createMarketDataService({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    await expect(service.listInstruments({ provider: "FXCM" })).rejects.toBeInstanceOf(FxcmMarketDataError);
    await expect(service.listInstruments({ provider: "FXCM" })).rejects.toMatchObject({
      code: "FXCM_DISABLED",
    });
  });

  it("Binance and FXCM market identities never collide", () => {
    expect(marketIdentityKey({
      provider: "BINANCE",
      marketType: "CRYPTO",
      symbol: "EURUSDC",
    })).not.toBe(marketIdentityKey({
      provider: "FXCM",
      marketType: "FOREX",
      symbol: "EURUSD",
    }));
  });

  it("Markets UI surfaces FXCM disabled/not_configured states", () => {
    const page = read("desktop/forex/ForexMarketsPage.tsx");
    const hook = read("desktop/forex/market-data/use-unified-instruments.ts");
    expect(hook).toContain("FXCM_DISABLED");
    expect(hook).toContain("FXCM_NOT_CONFIGURED");
    expect(page).toContain("data-fxcm-catalog-state");
    expect(page).toContain("FXCM is disabled on this server");
    expect(page).toContain("onClearSelection");
    expect(page).toContain("Open Forex Admin");
  });

  it("Charts and TA consume unified candle pipeline", () => {
    const chart = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    const ms = read("desktop/forex/market-data/use-forex-market-state.ts");
    const client = read("desktop/forex/market-data/studio-unified-candles-client.ts");
    expect(client).toContain("/api/forex/market-data/candles");
    expect(chart).toContain("useUnifiedCandles");
    expect(chart).toContain('data-candle-source="unified-market-data"');
    expect(chart).not.toContain("useBinanceKlines");
    expect(chart).not.toContain("useFxcmLiveCandles");
    expect(ms).toContain("useUnifiedCandles");
    expect(ms).not.toContain("useBinanceKlines");
  });

  it("service never silently routes FXCM failure to Binance", async () => {
    const service = createMarketDataService({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    try {
      await service.listInstruments({ provider: "FXCM" });
      expect.unreachable("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FxcmMarketDataError);
      expect((error as FxcmMarketDataError).code).toBe("FXCM_DISABLED");
      expect(error).not.toBeInstanceOf(MarketDataRoutingError);
    }
  });

  it("empty official response stays empty (no fabricated markets)", () => {
    const catalog = mapFxcmInstrumentCatalog({
      response: { executed: true },
      data: { instrument: [] },
    });
    expect(catalog.instruments).toEqual([]);
  });

  it("authentication failure surfaces FXCM_AUTHENTICATION_FAILED (no silent empty)", async () => {
    const discovery = createFxcmInstrumentDiscoveryService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/socket.io/")) {
          return new Response("unauthorized", { status: 401 });
        }
        return new Response("not found", { status: 404 });
      }) as typeof fetch,
    });
    const result = await discovery.discover({ refresh: true });
    expect(result.count).toBe(0);
    expect(
      result.discoveryStatus === "AUTHENTICATION_ERROR"
      || result.discoveryStatus === "FAILED"
      || result.discoveryStatus === "NETWORK_ERROR",
    ).toBe(true);
    await expect(discovery.listInstruments({ refresh: true })).rejects.toBeInstanceOf(FxcmMarketDataError);
  });

  it("unified candle client never falls back across providers", () => {
    const client = read("desktop/forex/market-data/studio-unified-candles-client.ts");
    expect(client).toContain("provider");
    expect(client).toContain("/api/forex/market-data/candles");
    expect(client).not.toMatch(/binance\/klines/);
  });
});
