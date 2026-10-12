/**
 * Phase 40 — ForexConnect catalog must not collapse to the last subscribed quote symbol.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MarketDataService } from "../../../../ai/market-data/providers/market-data-service.ts";
import { createMarketInstrumentRegistry } from "../../../../ai/market-data/providers/instrument-registry.ts";
import type { MarketDataProvider, MarketInstrument } from "../../../../ai/market-data/providers/types.ts";
import { buildForexConnectCatalog } from "../../../../ai/market-data/forexconnect/instrument-classify.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function fcInstrument(symbol: string, extras?: Partial<MarketInstrument>): MarketInstrument {
  const slash = symbol.includes("/") ? symbol : symbol;
  return {
    provider: "FOREXCONNECT",
    providerSymbol: slash,
    canonicalSymbol: slash.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
    displaySymbol: slash,
    marketType: "FOREX",
    baseAsset: slash.split("/")[0] ?? null,
    quoteAsset: slash.split("/")[1] ?? null,
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
    metadata: {
      instrumentType: "1",
      instrumentTypeLabel: "Forex",
      environment: "demo",
      environmentLabel: "FXCM DEMO",
      source: "forexconnect-offers",
      ...extras?.metadata,
    },
    ...extras,
  };
}

function mockFcProvider(fullCatalog: MarketInstrument[]): MarketDataProvider {
  return {
    getProviderInfo: () => ({
      provider: "FOREXCONNECT",
      displayName: "FXCM ForexConnect",
      apiPath: "test",
      marketTypes: ["FOREX"],
      environmentLabel: "FXCM DEMO",
      capabilities: fullCatalog[0]!.capabilities,
    }),
    getCapabilities: () => fullCatalog[0]!.capabilities,
    healthCheck: async () => ({
      provider: "FOREXCONNECT",
      enabled: true,
      environment: "demo",
      environmentLabel: "FXCM DEMO",
      configured: true,
      authenticated: true,
      reachable: true,
      status: "CONNECTED",
      connectionState: "CONNECTED",
      liveStreamEnabled: true,
      tradingEnabled: false,
      instrumentDiscovery: "READY",
      checkedAt: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
      notes: [],
    }),
    listInstruments: vi.fn(async () => fullCatalog.slice()),
    getInstrument: async (symbol: string) => {
      const compact = symbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase();
      return fullCatalog.find((i) => i.canonicalSymbol === compact || i.providerSymbol === symbol) ?? null;
    },
  };
}

describe("Phase 40 ForexConnect catalog hydration", () => {
  it("does not treat a single getInstrument upsert as a full catalog", async () => {
    const catalog = [
      fcInstrument("EUR/USD"),
      fcInstrument("GBP/USD"),
      fcInstrument("USD/JPY"),
      {
        ...fcInstrument("US30"),
        marketType: "INDEX" as const,
        metadata: {
          instrumentType: "2",
          instrumentTypeLabel: "Indices",
          environment: "demo",
          environmentLabel: "FXCM DEMO",
          source: "forexconnect-offers",
        },
      },
      {
        ...fcInstrument("XAU/USD"),
        marketType: "COMMODITY" as const,
        metadata: {
          instrumentType: "4",
          instrumentTypeLabel: "Metals",
          environment: "demo",
          environmentLabel: "FXCM DEMO",
          source: "forexconnect-offers",
        },
      },
    ];
    const provider = mockFcProvider(catalog);
    const registry = {
      listProviderIds: () => ["FOREXCONNECT" as const],
      getProvider: () => provider,
      getFxcm: () => ({ getConfig: () => ({ environment: "demo" }) }),
      getForexConnect: () => ({ getBridge: () => ({ getConfig: () => ({ environment: "demo" }) }) }),
    };
    const instruments = createMarketInstrumentRegistry();
    const service = new MarketDataService({
      registry: registry as never,
      instruments,
      binance: {
        listKlines: async () => ({ symbol: "BTCUSDT", candles: [] }),
      } as never,
      forexConnectLive: {
        getLatestQuote: () => null,
        getLatestQuoteState: () => null,
        getSeries: () => null,
        subscribe: async () => {
          throw new Error("unused");
        },
        unsubscribe: async () => undefined,
      } as never,
    });

    // Charts / snapshot path seeds only the selected instrument.
    const one = await provider.getInstrument!("EUR/USD");
    expect(one).not.toBeNull();
    instruments.upsert(one!);
    expect(instruments.listByProvider("FOREXCONNECT")).toHaveLength(1);

    // Market Explorer list must still discover the full authenticated catalog.
    const listed = await service.listInstruments({ provider: "FOREXCONNECT", limit: 2000 });
    expect(listed.length).toBe(5);
    expect(listed.map((i) => i.providerSymbol).sort()).toEqual(
      ["EUR/USD", "GBP/USD", "US30", "USD/JPY", "XAU/USD"].sort(),
    );
    expect(provider.listInstruments).toHaveBeenCalled();
  });

  it("keeps last good catalog when a later discovery fails", async () => {
    const catalog = [fcInstrument("EUR/USD"), fcInstrument("GBP/USD")];
    const provider = mockFcProvider(catalog);
    const instruments = createMarketInstrumentRegistry();
    const service = new MarketDataService({
      registry: {
        listProviderIds: () => ["FOREXCONNECT" as const],
        getProvider: () => provider,
        getFxcm: () => ({ getConfig: () => ({ environment: "demo" }) }),
        getForexConnect: () => ({ getBridge: () => ({ getConfig: () => ({ environment: "demo" }) }) }),
      } as never,
      instruments,
      binance: { listKlines: async () => ({ symbol: "BTCUSDT", candles: [] }) } as never,
      forexConnectLive: {
        getLatestQuote: () => null,
        getLatestQuoteState: () => null,
        getSeries: () => null,
        subscribe: async () => {
          throw new Error("unused");
        },
        unsubscribe: async () => undefined,
      } as never,
    });

    const first = await service.listInstruments({ provider: "FOREXCONNECT" });
    expect(first).toHaveLength(2);

    (provider.listInstruments as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("sidecar blip"),
    );
    const second = await service.listInstruments({ provider: "FOREXCONNECT", refresh: true });
    expect(second).toHaveLength(2);
    expect(second.map((i) => i.providerSymbol).sort()).toEqual(["EUR/USD", "GBP/USD"]);
  });

  it("category mapping still classifies multi-asset Offers metadata", () => {
    const catalog = buildForexConnectCatalog([
      {
        provider: "FOREXCONNECT",
        providerSymbol: "EUR/USD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EUR/USD",
        marketType: "FOREX",
        baseAsset: "EUR",
        quoteAsset: "USD",
        status: "available",
        offerId: "1",
        source: "forexconnect-offers",
        description: "EUR/USD",
        instrumentType: "1",
        instrumentTypeLabel: "Forex",
        contractCurrency: "EUR",
        tradingStatus: "O",
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
        offerId: "2",
        source: "forexconnect-offers",
        description: "US30",
        instrumentType: "2",
        instrumentTypeLabel: "Indices",
        contractCurrency: "USD",
        tradingStatus: "O",
      },
      {
        provider: "FOREXCONNECT",
        providerSymbol: "XAU/USD",
        canonicalSymbol: "XAUUSD",
        displaySymbol: "XAU/USD",
        marketType: "FOREX",
        baseAsset: "XAU",
        quoteAsset: "USD",
        status: "available",
        offerId: "3",
        source: "forexconnect-offers",
        description: "Gold",
        instrumentType: "5",
        instrumentTypeLabel: "Metals",
        contractCurrency: "USD",
        tradingStatus: "O",
      },
    ], { environment: "demo", environmentLabel: "FXCM DEMO" });

    expect(catalog.summary.categoryCounts.all).toBe(3);
    expect(catalog.summary.categoryCounts.forex).toBe(1);
    expect(catalog.summary.categoryCounts.indices).toBe(1);
    expect(catalog.summary.categoryCounts.metals).toBe(1);
    expect(catalog.instruments.map((i) => i.categoryId).sort()).toEqual(
      ["forex", "indices", "metals"].sort(),
    );
  });

  it("service code documents catalog hydration vs quote subscription separation", () => {
    const svc = read("ai/market-data/providers/market-data-service.ts");
    expect(svc).toContain("catalogHydrated");
    expect(svc).toContain("needsFullCatalog");
    expect(svc).not.toMatch(/subscriptions\.size|subscriptionCount.*listInstruments/);
    const hook = read("desktop/forex/market-data/use-unified-instruments.ts");
    expect(hook).toContain('provider === "FOREXCONNECT" ? "2000"');
    expect(hook).toContain('tick > 0 || provider === "FOREXCONNECT"');
  });
});
