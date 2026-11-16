import { describe, expect, it, beforeEach } from "vitest";
import {
  calculateSpreadPoints,
  calculateSpreadPrice,
  validateHfmRawQuote,
} from "../../../../ai/market-data/mt5-hfm/quote-validation";
import {
  HfmQuoteService,
  resetHfmQuoteServiceForTests,
} from "../../../../ai/market-data/mt5-hfm/quote-service";
import {
  HfmQuoteSubscriptionRegistry,
  resetHfmQuoteSubscriptionRegistryForTests,
  getHfmQuoteSubscriptionRegistry,
} from "../../../../ai/market-data/mt5-hfm/quote-subscriptions";
import { HFM_DEFAULT_QUOTE_SYMBOLS } from "../../../../ai/market-data/mt5-hfm/quote-types";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";

function catalogMap(rows: Array<Partial<HfmCatalogInstrument> & { symbol: string }>) {
  const map = new Map<string, HfmCatalogInstrument>();
  for (const r of rows) {
    const full = {
      symbolExists: true,
      customSymbol: false,
      description: null,
      path: `Forex\\${r.symbol}`,
      isin: null,
      categoryRaw: null,
      sector: null,
      industry: null,
      sectorName: null,
      industryName: null,
      selected: true,
      visible: true,
      digits: 5,
      point: 0.00001,
      tickSize: 0.00001,
      tickValue: null,
      tickValueProfit: null,
      tickValueLoss: null,
      contractSize: 100000,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
      volumeLimit: null,
      tradeCalcMode: 0,
      tradeMode: 4,
      orderMode: null,
      executionMode: 2,
      fillingMode: null,
      expirationMode: null,
      stopsLevel: null,
      freezeLevel: null,
      marginInitial: null,
      marginMaintenance: null,
      marginHedged: null,
      marginHedgedUseLeg: null,
      liquidityRate: null,
      spread: null,
      spreadFloat: null,
      tradeAllowed: true,
      startTime: null,
      expirationTime: null,
      currencyBase: "EUR",
      currencyProfit: "USD",
      currencyMargin: "USD",
      synchronized: true,
      sessions: null,
      fieldErrors: {},
      provider: "HFM_MT5" as const,
      environment: "demo" as const,
      brokerServer: "HFMarketsGlobal-Demo",
      catalogVersion: "v-test",
      lifecycle: "ACTIVE" as const,
      firstDiscoveredAt: "2026-01-01T00:00:00Z",
      lastDiscoveredAt: "2026-01-01T00:00:00Z",
      metadataCompleteness: 80,
      metadataQuality: {
        metadataCompleteness: 80,
        metadataCompletenessPercent: 80,
        requiredFieldsComplete: true,
        optionalFieldsComplete: false,
        missingRequiredFields: [],
        missingOptionalFields: [],
        fieldQuality: {},
        groups: [],
        metadataCollectedAt: "2026-01-01T00:00:00Z",
        metadataUpdatedAt: "2026-01-01T00:00:00Z",
      },
      classification: {
        category: "FOREX" as const,
        subcategory: "MAJOR",
        classificationStatus: "CONFIRMED" as const,
        confidence: "HIGH" as const,
        classificationConfidence: 0.98,
        classificationMethod: "SYMBOL_PATH" as const,
        method: "SYMBOL_PATH" as const,
        classificationEvidence: ["path"],
        evidence: ["path"],
        classificationWarnings: [],
        classifiedAt: "2026-01-01T00:00:00Z",
        classifierVersion: "2.0.1",
      },
      ...r,
    } as HfmCatalogInstrument;
    map.set(full.symbol, full);
    map.set(full.symbol.toUpperCase(), full);
  }
  return map;
}

describe("HFM STEP 2A spread calculation (synthetic)", () => {
  it("computes price and point spreads without inventing values", () => {
    expect(calculateSpreadPrice(1.1, 1.1002)).toBeCloseTo(0.0002, 10);
    expect(calculateSpreadPoints(1.1, 1.1002, 0.00001)).toBeCloseTo(20, 8);
    expect(calculateSpreadPrice(null, 1.1)).toBeNull();
    expect(calculateSpreadPoints(1.1, 1.1002, null)).toBeNull();
  });
});

describe("HFM STEP 2A quote validation (synthetic fixtures)", () => {
  const receivedAt = "2026-01-01T12:00:00.000Z";
  const catalog = catalogMap([{ symbol: "EURUSD" }, { symbol: "XAUUSD", digits: 2, point: 0.01, tickSize: 0.01, path: "Metals\\XAUUSD" }]);

  it("accepts a valid two-sided quote", () => {
    const { quote, accepted } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.08501, ask: 1.08521, digits: 5, point: 0.00001, tickTime: 1_700_000_000 },
      {
        receivedAt,
        server: "HFMarketsGlobal-Demo",
        sequence: 1,
        catalogBySymbol: catalog,
        requireCatalogMatch: true,
      },
    );
    expect(accepted).toBe(true);
    expect(quote.status).toBe("LIVE");
    expect(quote.spread).toBeCloseTo(0.0002, 10);
    expect(quote.spreadPoints).toBeCloseTo(20, 6);
    expect(quote.provider).toBe("HFM_MT5");
    expect(quote.environment).toBe("demo");
  });

  it("rejects ask below bid and does not invent spread", () => {
    const { quote, accepted } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.2, ask: 1.1 },
      { receivedAt, server: null, sequence: 1, catalogBySymbol: catalog, requireCatalogMatch: true },
    );
    expect(accepted).toBe(false);
    expect(quote.status).toBe("INVALID");
    expect(quote.validation.errors).toContain("ASK_BELOW_BID");
    expect(quote.spread).toBeNull();
  });

  it("rejects NaN/Infinity and unknown catalog symbol when required", () => {
    const nan = validateHfmRawQuote(
      { symbol: "EURUSD", bid: Number.NaN, ask: 1.1 },
      { receivedAt, server: null, sequence: 1, catalogBySymbol: catalog, requireCatalogMatch: true },
    );
    expect(nan.accepted).toBe(false);
    const unknown = validateHfmRawQuote(
      { symbol: "FAKEPAIR", bid: 1.1, ask: 1.2 },
      { receivedAt, server: null, sequence: 1, catalogBySymbol: catalog, requireCatalogMatch: true },
    );
    expect(unknown.accepted).toBe(false);
    expect(unknown.quote.validation.errors).toContain("SYMBOL_NOT_IN_CATALOG");
  });

  it("marks one-sided quotes incomplete without fabricating the missing side", () => {
    const { quote, accepted } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: null },
      { receivedAt, server: null, sequence: 1, catalogBySymbol: catalog, requireCatalogMatch: true },
    );
    expect(accepted).toBe(true);
    expect(quote.status).toBe("INCOMPLETE");
    expect(quote.ask).toBeNull();
    expect(quote.spread).toBeNull();
  });

  it("allows legitimate zero last without treating it as bid/ask", () => {
    const { quote, accepted } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: 1.1001, last: 0 },
      { receivedAt, server: null, sequence: 1, catalogBySymbol: catalog, requireCatalogMatch: true },
    );
    expect(accepted).toBe(true);
    expect(quote.last).toBe(0);
  });

  it("rejects wrong provider identity", () => {
    const { accepted, quote } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: 1.1001 },
      {
        receivedAt,
        server: null,
        sequence: 1,
        catalogBySymbol: catalog,
        requireCatalogMatch: true,
        provider: "FXCM",
      },
    );
    expect(accepted).toBe(false);
    expect(quote.validation.errors).toContain("PROVIDER_MISMATCH");
  });
});

describe("HFM STEP 2A subscriptions + LKG (synthetic)", () => {
  beforeEach(() => {
    resetHfmQuoteServiceForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
  });

  it("defaults to the nine-symbol universe and enforces caps", () => {
    const reg = getHfmQuoteSubscriptionRegistry();
    expect(reg.list().symbols).toEqual([...HFM_DEFAULT_QUOTE_SYMBOLS]);
    const limited = new HfmQuoteSubscriptionRegistry({ maxActive: 2, seedDefaults: false });
    expect(limited.activate("EURUSD").ok).toBe(true);
    expect(limited.activate("GBPUSD").ok).toBe(true);
    expect(limited.activate("USDJPY").ok).toBe(false);
    expect(limited.activate("USDJPY").reason).toBe("SUBSCRIPTION_LIMIT");
  });

  it("does not overwrite last-known-good with an invalid update", async () => {
    const svc = new HfmQuoteService();
    const good = await svc.ingestRawQuotes(
      [{ symbol: "EURUSD", bid: 1.1, ask: 1.1002, tickTime: 1_700_000_000 }],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 1,
        receivedAt: "2026-01-01T12:00:00.000Z",
        ageSec: 2,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
      },
    );
    expect(good.published).toHaveLength(1);
    expect(svc.getQuote("EURUSD")?.bid).toBe(1.1);

    const bad = await svc.ingestRawQuotes(
      [{ symbol: "EURUSD", bid: 1.2, ask: 1.1 }],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 2,
        receivedAt: "2026-01-01T12:00:03.000Z",
        ageSec: 2,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
      },
    );
    expect(bad.rejected).toHaveLength(1);
    expect(svc.getQuote("EURUSD")?.bid).toBe(1.1);
    expect(svc.getRejected("EURUSD")?.status).toBe("INVALID");
  });

  it("labels market-closed quotes without claiming LIVE", async () => {
    const svc = new HfmQuoteService();
    await svc.ingestRawQuotes(
      [{ symbol: "EURUSD", bid: 1.1, ask: 1.1002, tickTime: 1_700_000_000 }],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 1,
        receivedAt: "2026-01-01T12:00:00.000Z",
        ageSec: 2,
        marketClosed: true,
        terminalRunning: true,
        feedFreshness: "MARKET_CLOSED",
        requireCatalogMatch: false,
      },
    );
    expect(svc.getQuote("EURUSD")?.status).toBe("MARKET_CLOSED");
  });

  it("skips unsubscribed symbols", async () => {
    const svc = new HfmQuoteService();
    const reg = getHfmQuoteSubscriptionRegistry();
    reg.replaceAll(["EURUSD"]);
    const r = await svc.ingestRawQuotes(
      [
        { symbol: "EURUSD", bid: 1.1, ask: 1.1002 },
        { symbol: "GBPUSD", bid: 1.2, ask: 1.2002 },
      ],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 1,
        receivedAt: "2026-01-01T12:00:00.000Z",
        ageSec: 2,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
      },
    );
    expect(r.published).toHaveLength(1);
    expect(r.skippedUnsubscribed).toBe(1);
  });
});
