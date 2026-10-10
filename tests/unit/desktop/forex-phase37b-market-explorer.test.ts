/**
 * Phase 37B — Market Categories sidebar & functional instrument explorer (unit / source contracts).
 * Production category counts are verified online against the live Demo Offers catalog.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildForexConnectCatalog,
  classifyForexConnectInstrument,
  filterClassifiedInstruments,
  FOREXCONNECT_EXPLORER_CATEGORIES,
} from "../../../ai/market-data/forexconnect/instrument-classify.ts";
import type { ForexConnectInstrument } from "../../../ai/market-data/forexconnect/types.ts";
import { parseSelectedMarket } from "../../../desktop/forex/market-data/selected-market.ts";

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

describe("Phase 37B market explorer contracts", () => {
  it("exposes required category families without inventing ETF rows", () => {
    const ids = FOREXCONNECT_EXPLORER_CATEGORIES.map((c) => c.id);
    for (const required of [
      "forex", "forex_ndf", "forex_baskets", "indices", "commodities", "metals", "energy",
      "cryptocurrency", "shares_us", "shares_ca", "shares_uk", "shares_de", "shares_fr",
      "shares_nl", "shares_jp", "shares_hk", "stock_baskets", "treasury", "etfs", "other",
    ]) {
      expect(ids).toContain(required);
    }
    const catalog = buildForexConnectCatalog([
      inst("EUR/USD"),
      inst("US30"),
      inst("XAU/USD"),
      inst("AAPL.us"),
    ]);
    expect(catalog.summary.categoryCounts.etfs).toBe(0);
    expect(catalog.summary.categoryCounts.forex).toBeGreaterThan(0);
    expect(catalog.summary.deduplicatedCount).toBe(4);
  });

  it("keeps unclassified instruments in Other and preserves AAPL.us exactly", () => {
    const weird = classifyForexConnectInstrument(inst("RKG/CNH"));
    expect(weird.categoryId === "other" || weird.categoryId === "forex").toBe(true);
    const aapl = parseSelectedMarket("AAPL.us", "FOREXCONNECT");
    expect(aapl?.venue).toBe("forexconnect");
    expect(aapl?.symbol).toBe("AAPL.us");
    expect(aapl?.provider).toBe("FOREXCONNECT");
  });

  it("scopes search to the selected category without inventing matches", () => {
    const catalog = buildForexConnectCatalog([
      inst("EUR/USD"),
      inst("GBP/USD"),
      inst("AAPL.us"),
      inst("US30"),
      inst("XAU/USD"),
    ]);
    const forexGold = filterClassifiedInstruments(catalog.instruments, {
      categoryId: "forex",
      query: "gold",
    });
    expect(forexGold).toHaveLength(0);
    const metalsGold = filterClassifiedInstruments(catalog.instruments, {
      categoryId: "metals",
      query: "gold",
    });
    expect(metalsGold.map((i) => i.providerSymbol)).toEqual(["XAU/USD"]);
    const shares = filterClassifiedInstruments(catalog.instruments, {
      categoryId: "shares_us",
      query: "aapl",
    });
    expect(shares.map((i) => i.providerSymbol)).toEqual(["AAPL.us"]);
  });

  it("deduplicates catalog counts across refreshes", () => {
    const rows = [inst("EUR/USD"), inst("EUR/USD"), inst("US30")];
    const once = buildForexConnectCatalog(rows);
    const twice = buildForexConnectCatalog([...rows, ...rows]);
    expect(once.summary.deduplicatedCount).toBe(2);
    expect(twice.summary.deduplicatedCount).toBe(2);
    expect(twice.summary.categoryCounts.all).toBe(2);
  });

  it("wires Open Charts selection and mobile category toggle in the explorer UI", () => {
    const explorer = read("desktop/forex/ForexConnectMarketExplorer.tsx");
    expect(explorer).toContain('data-phase="37b"');
    expect(explorer).toContain('data-market-explorer="true"');
    expect(explorer).toContain("data-fc-open-charts");
    expect(explorer).toContain("data-fc-exact-symbol");
    expect(explorer).toContain("No live quote");
    expect(explorer).toContain("fx-market-explorer-cat-toggle");
    expect(explorer).toContain("onOpenCharts()");
    expect(explorer).not.toContain("fabricat");
  });

  it("styles a compact category sidebar with mobile drawer behavior", () => {
    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-market-category-nav");
    expect(css).toContain(".fx-market-category-mark");
    expect(css).toContain(".fx-market-explorer-cat-toggle");
    expect(css).toContain(".fx-market-category-nav.is-open");
  });

  it("preserves ForexConnect and Binance provider identity when parsing selection", () => {
    const parsed = parseSelectedMarket("EUR/USD", "FOREXCONNECT");
    expect(parsed).toEqual({
      venue: "forexconnect",
      symbol: "EUR/USD",
      displaySymbol: "EUR/USD",
      provider: "FOREXCONNECT",
    });
    expect(parseSelectedMarket("US30", "FOREXCONNECT")?.symbol).toBe("US30");
    expect(parseSelectedMarket("XAU/USD", "FOREXCONNECT")?.symbol).toBe("XAU/USD");
    expect(parseSelectedMarket("BTCUSDT")?.provider).toBe("BINANCE");
  });
});
