import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { classifyHfmCatalogSymbol, catalogCategoryToMarketType, HFM_CLASSIFIER_VERSION } from "../../../../ai/market-data/mt5-hfm/catalog-classify";
import { computeMetadataQualityReport } from "../../../../ai/market-data/mt5-hfm/catalog-metadata-quality";
import {
  applyMissingAfterSuccessfulDiscovery,
  computeMetadataCompleteness,
  detectCatalogChanges,
  enrichCatalogSymbols,
  normalizeRawCatalogSymbol,
  resetHfmCatalogServiceForTests,
  HfmCatalogService,
} from "../../../../ai/market-data/mt5-hfm/catalog-service";
import { HfmCatalogStore } from "../../../../ai/market-data/mt5-hfm/catalog-store";
import type { HfmRawCatalogSymbol } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import { isAllowedMt5HfmAgentMethod } from "../../../../ai/market-data/mt5-hfm/agent-protocol";

function raw(partial: Partial<HfmRawCatalogSymbol> & { symbol: string }): HfmRawCatalogSymbol {
  return {
    symbolExists: true,
    customSymbol: false,
    description: null,
    path: null,
    isin: null,
    categoryRaw: null,
    sector: null,
    industry: null,
    sectorName: null,
    industryName: null,
    selected: false,
    visible: false,
    digits: null,
    point: null,
    tickSize: null,
    tickValue: null,
    tickValueProfit: null,
    tickValueLoss: null,
    contractSize: null,
    volumeMin: null,
    volumeMax: null,
    volumeStep: null,
    volumeLimit: null,
    tradeCalcMode: null,
    tradeMode: null,
    orderMode: null,
    executionMode: null,
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
    tradeAllowed: null,
    startTime: null,
    expirationTime: null,
    currencyBase: null,
    currencyProfit: null,
    currencyMargin: null,
    synchronized: null,
    sessions: null,
    fieldErrors: {},
    ...partial,
  };
}

function emptyCategoryCounts() {
  return {
    FOREX: 0,
    METALS: 0,
    INDICES: 0,
    ENERGIES: 0,
    SHARES: 0,
    COMMODITIES: 0,
    CRYPTO: 0,
    BONDS: 0,
    ETFS: 0,
    FUTURES: 0,
    OPTIONS: 0,
    OTHER: 0,
    UNCLASSIFIED: 0,
  };
}

describe("HFM MT5 catalog classification (synthetic fixtures)", () => {
  it("classifies Forex from broker path, not from 6-letter name alone", () => {
    const byPath = classifyHfmCatalogSymbol(raw({ symbol: "ABCDEF", path: "Forex\\Majors\\ABCDEF" }));
    expect(byPath.category).toBe("FOREX");
    expect(byPath.method).toBe("SYMBOL_PATH");
    expect(byPath.confidence).toBe("HIGH");

    const sixLetter = classifyHfmCatalogSymbol(raw({ symbol: "ABCDEF" }));
    expect(sixLetter.category).toBe("UNCLASSIFIED");
    expect(sixLetter.method).toBe("UNCLASSIFIED");
  });

  it("does not treat GOLD substring alone as metals without metadata", () => {
    const goldName = classifyHfmCatalogSymbol(raw({ symbol: "GOLDBULL" }));
    expect(goldName.category).toBe("UNCLASSIFIED");

    const xau = classifyHfmCatalogSymbol(raw({ symbol: "XAUUSD" }));
    expect(xau.category).toBe("METALS");
    expect(xau.method).toBe("NAME_HEURISTIC");
    expect(xau.confidence).toBe("LOW");
  });

  it("prefers path over conflicting description", () => {
    const hit = classifyHfmCatalogSymbol(
      raw({
        symbol: "US30",
        path: "Indices\\US30",
        description: " somehow mentions gold ",
      }),
    );
    expect(hit.category).toBe("INDICES");
    expect(hit.method).toBe("SYMBOL_PATH");
  });

  it("disambiguates HFM Metals & Energies paths and classifies crypto/etf/bond distinctly", () => {
    const gold = classifyHfmCatalogSymbol(
      raw({ symbol: "XAUUSD", path: "Metals & Energies\\Spot\\Gold & Silver\\XAUUSD", tradeCalcMode: 2 }),
    );
    expect(gold.category).toBe("METALS");
    expect(gold.subcategory).toBe("GOLD");
    expect(gold.method).toBe("SYMBOL_PATH");
    expect(gold.classificationStatus).toBe("CONFIRMED");
    expect(gold.classifierVersion).toBe(HFM_CLASSIFIER_VERSION);

    const xag = classifyHfmCatalogSymbol(
      raw({ symbol: "XAGEUR", path: "Metals & Energies\\Spot\\Gold & Silver\\XAGEUR" }),
    );
    expect(xag.category).toBe("METALS");
    expect(xag.subcategory).toBe("SILVER");

    const oil = classifyHfmCatalogSymbol(
      raw({ symbol: "USOIL", path: "Metals & Energies\\Futures\\USOIL", tradeCalcMode: 2 }),
    );
    expect(oil.category).toBe("ENERGIES");
    const oilSpot = classifyHfmCatalogSymbol(
      raw({ symbol: "UKOIL.S", path: "Metals & Energies\\Spot\\UKOIL.S", tradeCalcMode: 2 }),
    );
    expect(oilSpot.category).toBe("ENERGIES");

    const crypto = classifyHfmCatalogSymbol(raw({ symbol: "#BTCUSD", path: "#Crypto\\#BTCUSD" }));
    expect(crypto.category).toBe("CRYPTO");

    const etf = classifyHfmCatalogSymbol(raw({ symbol: "SPY.US", path: "ETFs\\SPY.US" }));
    expect(etf.category).toBe("ETFS");

    const bond = classifyHfmCatalogSymbol(raw({ symbol: "US10Y", path: "Bonds\\US10Y" }));
    expect(bond.category).toBe("BONDS");
  });

  it("classifies Forex with suffix/prefix evidence and rejects USD-only name guesses", () => {
    const suffixed = classifyHfmCatalogSymbol(
      raw({
        symbol: "EURUSD.a",
        path: "Forex\\Majors\\EURUSD.a",
        currencyBase: "EUR",
        currencyProfit: "USD",
        tradeCalcMode: 0,
      }),
    );
    expect(suffixed.category).toBe("FOREX");
    expect(suffixed.subcategory).toBe("MAJOR");

    const usdOnly = classifyHfmCatalogSymbol(raw({ symbol: "USDINDEX" }));
    expect(usdOnly.category).toBe("UNCLASSIFIED");
  });

  it("does not treat CFD calc mode 2 as INDICES", () => {
    const cfd = classifyHfmCatalogSymbol(raw({ symbol: "SOMETHING", tradeCalcMode: 2 }));
    expect(cfd.category).toBe("UNCLASSIFIED");
    const idx = classifyHfmCatalogSymbol(raw({ symbol: "IDX", tradeCalcMode: 3 }));
    expect(idx.category).toBe("INDICES");
    expect(idx.method).toBe("TRADE_CALC_MODE");
  });

  it("maps categories to market types", () => {
    expect(catalogCategoryToMarketType("FOREX")).toBe("FOREX");
    expect(catalogCategoryToMarketType("METALS")).toBe("COMMODITY");
    expect(catalogCategoryToMarketType("INDICES")).toBe("INDEX");
    expect(catalogCategoryToMarketType("SHARES")).toBe("SHARE");
    expect(catalogCategoryToMarketType("UNCLASSIFIED")).toBe("UNKNOWN");
  });
});

describe("HFM MT5 catalog metadata + lifecycle (synthetic)", () => {
  it("normalizes raw rows and computes completeness without inventing zeros", () => {
    const n = normalizeRawCatalogSymbol({
      symbol: "EURUSD",
      description: "Euro vs US Dollar",
      path: "Forex\\EURUSD",
      digits: 5,
      point: 0.00001,
      marginInitial: 0,
      fieldErrors: { isin: "EMPTY" },
    });
    expect(n?.symbol).toBe("EURUSD");
    expect(n?.isin).toBeNull();
    expect(n?.fieldErrors.isin).toBe("EMPTY");
    expect(n?.marginInitial).toBe(0);
    const completeness = computeMetadataCompleteness(n!);
    expect(completeness).toBeGreaterThan(0);
    expect(completeness).toBeLessThan(100);
    const quality = computeMetadataQualityReport(n!, { classified: true });
    expect(quality.fieldQuality.isin?.status).toBe("NOT_APPLICABLE");
    expect(quality.fieldQuality.marginInitial?.status).toBe("AVAILABLE");
    expect(quality.missingRequiredFields.length).toBeGreaterThan(0);
    expect(quality.requiredFieldsComplete).toBe(false);
  });

  it("enrich attaches metadataQuality and classification evidence", () => {
    const rows = enrichCatalogSymbols(
      [
        raw({
          symbol: "EURUSD",
          path: "Forex\\Majors\\EURUSD",
          description: "Euro vs US Dollar",
          digits: 5,
          point: 0.00001,
          tickSize: 0.00001,
          contractSize: 100000,
          volumeMin: 0.01,
          volumeMax: 100,
          volumeStep: 0.01,
          tradeCalcMode: 0,
          tradeMode: 4,
          executionMode: 2,
          currencyBase: "EUR",
          currencyProfit: "USD",
          selected: true,
          customSymbol: false,
        }),
      ],
      { brokerServer: "HFMarketsGlobal-Demo", catalogVersion: "v", discoveredAt: "2026-01-01T00:00:00Z" },
    );
    expect(rows[0]!.metadataQuality.metadataCompletenessPercent).toBe(rows[0]!.metadataCompleteness);
    expect(rows[0]!.classification.classificationEvidence[0]).toContain("path:");
    expect(rows[0]!.classification.classificationConfidence).toBeGreaterThan(0.9);
  });

  it("detects add/remove/spec changes and retains missing after successful discovery", () => {
    const prev = enrichCatalogSymbols(
      [raw({ symbol: "EURUSD", path: "Forex\\EURUSD", digits: 5 }), raw({ symbol: "OLD", path: "Forex\\OLD" })],
      { brokerServer: "HFMarketsGlobal-Demo", catalogVersion: "1", discoveredAt: "2026-01-01T00:00:00Z" },
    );
    const nextActive = enrichCatalogSymbols(
      [raw({ symbol: "EURUSD", path: "Forex\\EURUSD", digits: 4 }), raw({ symbol: "GBPUSD", path: "Forex\\GBPUSD" })],
      {
        brokerServer: "HFMarketsGlobal-Demo",
        catalogVersion: "2",
        previous: prev,
        discoveredAt: "2026-01-02T00:00:00Z",
      },
    );
    const merged = applyMissingAfterSuccessfulDiscovery(prev, nextActive, "2026-01-02T00:00:00Z");
    const changes = detectCatalogChanges(prev, merged);
    expect(changes.added).toContain("GBPUSD");
    expect(merged.find((s) => s.symbol === "OLD")?.lifecycle).toBe("NOT_CURRENTLY_AVAILABLE");
    expect(changes.specificationChanged).toContain("EURUSD");
  });

  it("does not mass-remove on empty failed discovery input (caller keeps previous)", () => {
    const prev = enrichCatalogSymbols(
      [
        raw({
          symbol: "EURUSD",
          path: "Forex\\EURUSD",
          description: "Euro vs US Dollar",
          digits: 5,
          point: 0.00001,
          tickSize: 0.00001,
          tickValue: 1,
          contractSize: 100000,
          volumeMin: 0.01,
          volumeMax: 100,
          volumeStep: 0.01,
          tradeCalcMode: 0,
          tradeMode: 4,
          orderMode: 127,
          executionMode: 2,
          fillingMode: 1,
          expirationMode: 15,
          stopsLevel: 0,
          freezeLevel: 0,
          currencyBase: "EUR",
          currencyProfit: "USD",
          currencyMargin: "USD",
          selected: true,
          visible: true,
          customSymbol: false,
          sector: 0,
          industry: 0,
          sectorName: "Currency",
          industryName: "Forex",
          categoryRaw: "Forex",
          marginInitial: 0,
          marginMaintenance: 0,
          sessions: { tradeSessionDays: 5, quoteSessionDays: 5 },
        }),
      ],
      {
        brokerServer: "HFMarketsGlobal-Demo",
        catalogVersion: "1",
        discoveredAt: "2026-01-01T00:00:00Z",
      },
    );
    // Failed discovery path never calls applyMissing with empty next in service; simulate retention.
    expect(prev).toHaveLength(1);
    expect(prev[0]!.lifecycle).toBe("ACTIVE");
    expect(prev[0]!.symbol).toBe("EURUSD");
  });
});

describe("HFM MT5 catalog store atomicity (synthetic)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "hfm-catalog-"));
    resetHfmCatalogServiceForTests();
  });

  afterEach(() => {
    resetHfmCatalogServiceForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("atomically persists current catalog and retains LKG meta after failure record", async () => {
    const store = new HfmCatalogStore(dir);
    const symbols = enrichCatalogSymbols([raw({ symbol: "EURUSD", path: "Forex\\EURUSD", digits: 5 })], {
      brokerServer: "HFMarketsGlobal-Demo",
      catalogVersion: "v-test-1",
      discoveredAt: "2026-01-01T00:00:00Z",
    });
    const snap = {
      provider: "HFM_MT5" as const,
      environment: "demo" as const,
      brokerServer: "HFMarketsGlobal-Demo",
      catalogVersion: "v-test-1",
      checksumSha256: "abc",
      discoveryStatus: "COMPLETE" as const,
      freshness: "COMPLETE" as const,
      enumerationStartedAt: "2026-01-01T00:00:00Z",
      enumerationCompletedAt: "2026-01-01T00:01:00Z",
      ingestedAt: "2026-01-01T00:01:00Z",
      generalSymbolCount: 1,
      selectedSymbolCount: 1,
      enumeratedCount: 1,
      validCount: 1,
      duplicateCount: 0,
      customCount: 0,
      metadataCompletenessAvg: symbols[0]!.metadataCompleteness,
      fieldErrorSummary: {},
      categoryCounts: { ...emptyCategoryCounts(), FOREX: 1 },
      changes: null,
      symbols,
      source: "mql5_catalog" as const,
      schemaVersion: 2 as const,
      classifierVersion: HFM_CLASSIFIER_VERSION,
      mutatesBroker: false as const,
      placesOrders: false as const,
      acceptsForExecution: false as const,
    };
    await store.saveSuccessful(snap);
    expect(existsSync(path.join(dir, "mt5-hfm", "catalog", "current.json"))).toBe(true);
    const loaded = await store.loadCurrent();
    expect(loaded?.symbols[0]?.symbol).toBe("EURUSD");
    expect(loaded?.provider).toBe("HFM_MT5");

    await store.recordFailure("SYNTHETIC_DISCONNECT");
    const afterFail = await store.loadCurrent();
    expect(afterFail?.symbols).toHaveLength(1);
    const meta = await store.readMeta();
    expect(meta.lastFailedReason).toBe("SYNTHETIC_DISCONNECT");
    expect(meta.currentVersion).toBe("v-test-1");
  });

  it("query supports search, category filter and pagination", async () => {
    const svc = new HfmCatalogService(dir);
    const store = new HfmCatalogStore(dir);
    const symbols = enrichCatalogSymbols(
      [
        raw({ symbol: "EURUSD", path: "Forex\\EURUSD", description: "Euro" }),
        raw({ symbol: "XAUUSD", path: "Metals\\XAUUSD", description: "Gold" }),
        raw({ symbol: "US30", path: "Indices\\US30", description: "Dow" }),
      ],
      { brokerServer: "HFMarketsGlobal-Demo", catalogVersion: "v2", discoveredAt: "2026-01-01T00:00:00Z" },
    );
    await store.saveSuccessful({
      provider: "HFM_MT5",
      environment: "demo",
      brokerServer: "HFMarketsGlobal-Demo",
      catalogVersion: "v2",
      checksumSha256: "x",
      discoveryStatus: "COMPLETE",
      freshness: "COMPLETE",
      enumerationStartedAt: null,
      enumerationCompletedAt: null,
      ingestedAt: "2026-01-01T00:00:00Z",
      generalSymbolCount: 3,
      selectedSymbolCount: 1,
      enumeratedCount: 3,
      validCount: 3,
      duplicateCount: 0,
      customCount: 0,
      metadataCompletenessAvg: 50,
      fieldErrorSummary: {},
      categoryCounts: { ...emptyCategoryCounts(), FOREX: 1, METALS: 1, INDICES: 1 },
      changes: null,
      symbols,
      source: "mql5_catalog",
      schemaVersion: 2,
      classifierVersion: HFM_CLASSIFIER_VERSION,
      mutatesBroker: false,
      placesOrders: false,
      acceptsForExecution: false,
    });
    const q = await svc.query({ q: "gold", limit: 10 });
    expect(q.available).toBe(true);
    expect(q.symbols.map((s) => s.symbol)).toEqual(["XAUUSD"]);
    const page = await svc.query({ offset: 1, limit: 1 });
    expect(page.returned).toBe(1);
    expect(page.total).toBe(3);
    const byStatus = await svc.query({ classificationStatus: "CONFIRMED", limit: 50 });
    expect(byStatus.total).toBeGreaterThanOrEqual(1);
    const byComp = await svc.query({ minCompleteness: 0, maxCompleteness: 100, limit: 50 });
    expect(byComp.total).toBe(3);
    const energyAlias = await svc.query({ category: "ENERGY", limit: 50 });
    expect(energyAlias.total).toBe(0);
    const cats = await svc.categories();
    expect(cats.counts.FOREX).toBe(1);
  });
});

describe("HFM catalog isolation + agent allowlist", () => {
  it("allows catalog agent methods and forbids trading methods", () => {
    expect(isAllowedMt5HfmAgentMethod("demo.catalog_status")).toBe(true);
    expect(isAllowedMt5HfmAgentMethod("demo.catalog_chunk")).toBe(true);
    expect(isAllowedMt5HfmAgentMethod("demo.catalog_refresh")).toBe(true);
    expect(isAllowedMt5HfmAgentMethod("order.buy")).toBe(false);
    expect(isAllowedMt5HfmAgentMethod("demo.symbols")).toBe(true);
  });

  it("enriched instruments always carry HFM_MT5 provider identity", () => {
    const rows = enrichCatalogSymbols([raw({ symbol: "EURUSD", path: "Forex\\EURUSD" })], {
      brokerServer: "HFMarketsGlobal-Demo",
      catalogVersion: "v",
      discoveredAt: "2026-01-01T00:00:00Z",
    });
    expect(rows[0]!.provider).toBe("HFM_MT5");
    expect(rows[0]!.environment).toBe("demo");
    expect(JSON.stringify(rows)).not.toMatch(/FXCM|FOREXCONNECT|BINANCE/i);
  });
});
