/**
 * Phase 36D — ForexConnect Multi-Asset Market Explorer classification (unit).
 * Production catalog verification is done online against the live Demo Offers table.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildForexConnectCatalog,
  classifyForexConnectInstrument,
  dedupeForexConnectInstruments,
  filterClassifiedInstruments,
  FOREXCONNECT_EXPLORER_CATEGORIES,
} from "../../../../ai/market-data/forexconnect/instrument-classify.ts";
import type { ForexConnectInstrument } from "../../../../ai/market-data/forexconnect/types.ts";
import { parseSelectedMarket } from "../../../../desktop/forex/market-data/selected-market.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function inst(symbol: string, extras: Partial<ForexConnectInstrument> = {}): ForexConnectInstrument {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: symbol,
    canonicalSymbol: symbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
    displaySymbol: symbol,
    marketType: "FOREX",
    baseAsset: null,
    quoteAsset: null,
    status: "available",
    offerId: "1",
    ...extras,
  };
}

describe("Phase 36D classification rules", () => {
  it("classifies forex pairs, indices, metals, energy, crypto, treasury", () => {
    expect(classifyForexConnectInstrument(inst("EUR/USD")).categoryId).toBe("forex");
    expect(classifyForexConnectInstrument(inst("US30")).categoryId).toBe("indices");
    expect(classifyForexConnectInstrument(inst("XAU/USD")).categoryId).toBe("metals");
    expect(classifyForexConnectInstrument(inst("USOil")).categoryId).toBe("energy");
    expect(classifyForexConnectInstrument(inst("BTC/USD")).categoryId).toBe("cryptocurrency");
    expect(classifyForexConnectInstrument(inst("10USNote")).categoryId).toBe("treasury");
    expect(classifyForexConnectInstrument(inst("Bund")).categoryId).toBe("treasury");
    expect(classifyForexConnectInstrument(inst("EMBasket")).categoryId).toBe("forex_baskets");
    expect(classifyForexConnectInstrument(inst("USD/INR")).categoryId).toBe("forex_ndf");
    expect(classifyForexConnectInstrument(inst("FAANG")).categoryId).toBe("stock_baskets");
  });

  it("classifies country share suffixes without inventing prices", () => {
    expect(classifyForexConnectInstrument(inst("AAPL.us")).categoryId).toBe("shares_us");
    expect(classifyForexConnectInstrument(inst("AAPL.ext")).categoryId).toBe("shares_us");
    expect(classifyForexConnectInstrument(inst("BARC.uk")).categoryId).toBe("shares_uk");
    expect(classifyForexConnectInstrument(inst("ABX.ca")).categoryId).toBe("shares_ca");
    expect(classifyForexConnectInstrument(inst("ALV.de")).categoryId).toBe("shares_de");
    expect(classifyForexConnectInstrument(inst("AIR.fr")).categoryId).toBe("shares_fr");
    expect(classifyForexConnectInstrument(inst("7203.jp")).categoryId).toBe("shares_jp");
    expect(classifyForexConnectInstrument(inst("0700.hk")).categoryId).toBe("shares_hk");
    expect(classifyForexConnectInstrument(inst("ASML.nl")).categoryId).toBe("shares_nl");
  });

  it("uses provider instrument type when present and falls back to Other", () => {
    const typed = classifyForexConnectInstrument(inst("ZZZ999", { instrumentType: "Index" }));
    expect(typed.categoryId).toBe("indices");
    expect(typed.classificationSource).toBe("provider_instrument_type");
    const unknown = classifyForexConnectInstrument(inst("WEIRDTHING"));
    expect(unknown.categoryId).toBe("other");
    expect(unknown.classificationConfidence).toBe("low");
    expect(classifyForexConnectInstrument(inst("CHN.ECOMM")).categoryId).toBe("stock_baskets");
    expect(classifyForexConnectInstrument(inst("USD/INR")).categoryId).toBe("forex_ndf");
  });

  it("deduplicates and reconciles All Markets counts", () => {
    const catalog = buildForexConnectCatalog([
      inst("EUR/USD"),
      inst("EUR/USD"),
      inst("US30"),
      inst("AAPL.us"),
    ], { environment: "demo", environmentLabel: "DEMO" });
    expect(catalog.summary.rawCount).toBe(4);
    expect(catalog.summary.deduplicatedCount).toBe(3);
    expect(catalog.summary.categoryCounts.all).toBe(3);
    expect(catalog.summary.categoryCounts.forex).toBe(1);
    expect(catalog.summary.categoryCounts.indices).toBe(1);
    expect(catalog.summary.categoryCounts.shares_us).toBe(1);
    expect(catalog.summary.environment).toBe("demo");
    expect(catalog.summary.provider).toBe("FOREXCONNECT");
    expect(dedupeForexConnectInstruments([inst("EUR/USD"), inst("EUR/USD")])).toHaveLength(1);
  });

  it("preserves exact provider symbols and DEMO environment", () => {
    const item = classifyForexConnectInstrument(inst("AAPL.us"), {
      environment: "demo",
      environmentLabel: "DEMO",
    });
    expect(item.provider).toBe("FOREXCONNECT");
    expect(item.providerSymbol).toBe("AAPL.us");
    expect(item.environment).toBe("demo");
    expect(item.environmentLabel).toBe("DEMO");
  });

  it("filters by category and search without fabricating rows", () => {
    const { instruments } = buildForexConnectCatalog([
      inst("EUR/USD"),
      inst("GBP/USD"),
      inst("US30"),
      inst("AAPL.us"),
    ]);
    expect(filterClassifiedInstruments(instruments, { categoryId: "forex" })).toHaveLength(2);
    expect(filterClassifiedInstruments(instruments, { query: "aapl" })).toHaveLength(1);
    expect(filterClassifiedInstruments(instruments, { categoryId: "etfs" })).toHaveLength(0);
    expect(FOREXCONNECT_EXPLORER_CATEGORIES.some((c) => c.id === "other")).toBe(true);
  });
});

describe("Phase 36D selection / navigation identity", () => {
  it("preserves multi-asset ForexConnect symbols in URL parsing", () => {
    expect(parseSelectedMarket("AAPL.us", "FOREXCONNECT")).toEqual({
      venue: "forexconnect",
      symbol: "AAPL.us",
      displaySymbol: "AAPL.us",
      provider: "FOREXCONNECT",
    });
    expect(parseSelectedMarket("US30", "FOREXCONNECT")?.symbol).toBe("US30");
    expect(parseSelectedMarket("EUR/USD", "FOREXCONNECT")?.provider).toBe("FOREXCONNECT");
  });

  it("wires explorer into Markets and Admin diagnostics", () => {
    const markets = read("desktop/forex/ForexMarketsPage.tsx");
    expect(markets).toContain("ForexConnectMarketExplorer");
    const explorer = read("desktop/forex/ForexConnectMarketExplorer.tsx");
    expect(explorer).toContain('data-fc-explorer="true"');
    expect(explorer).toContain("Open Charts");
    expect(explorer).toContain("Open Technical Analysis");
    const admin = read("desktop/forex-admin/ForexAdminForexConnectPage.tsx");
    expect(admin).toContain("data-fc-catalog-summary");
    expect(admin).toContain("Unclassified:");
  });

  it("does not use Binance as ForexConnect fallback", () => {
    const explorer = read("desktop/forex/ForexConnectMarketExplorer.tsx");
    expect(explorer).not.toContain("BINANCE");
    expect(explorer).toContain('provider: "FOREXCONNECT"');
    const classify = read("ai/market-data/forexconnect/instrument-classify.ts");
    expect(classify).toContain("Never invent instruments");
  });
});
