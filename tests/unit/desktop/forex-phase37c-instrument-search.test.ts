/**
 * Phase 37C — instrument search & selection (unit / source contracts).
 * Production catalogs are verified online against live provider data.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { filterBinanceMarkets } from "../../../ai/market-data/binance/adapter.ts";
import type { NormalizedMarket } from "../../../ai/market-data/binance/types.ts";
import {
  buildForexConnectCatalog,
  filterClassifiedInstruments,
  scoreInstrumentSearchMatch,
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

function binance(symbol: string, base: string, quote: string): NormalizedMarket {
  return {
    venue: "binance-spot",
    marketType: "spot",
    symbol,
    displaySymbol: `${base}/${quote}`,
    displayName: `${base}/${quote}`,
    baseAsset: base,
    quoteAsset: quote,
    status: "TRADING",
    tradable: true,
    permissions: ["SPOT"],
    source: "binance-spot-public",
  };
}

describe("Phase 37C instrument search ranking", () => {
  const catalog = buildForexConnectCatalog([
    inst("EUR/USD"),
    inst("AUD/CNH"),
    inst("XAU/USD"),
    inst("US30"),
    inst("AAPL.us"),
    inst("MSFT.us"),
    inst("GBP/USD"),
  ]);

  it("matches exact, partial, case-insensitive, and suffix-tolerant symbols", () => {
    const eur = filterClassifiedInstruments(catalog.instruments, { query: "eur/usd" });
    expect(eur.map((i) => i.providerSymbol)).toContain("EUR/USD");

    const aapl = filterClassifiedInstruments(catalog.instruments, {
      categoryId: "shares_us",
      query: "AAPL",
    });
    expect(aapl.map((i) => i.providerSymbol)).toEqual(["AAPL.us"]);

    const gold = filterClassifiedInstruments(catalog.instruments, { query: "gold" });
    expect(gold.map((i) => i.providerSymbol)).toContain("XAU/USD");

    const us30 = filterClassifiedInstruments(catalog.instruments, { query: "us30" });
    expect(us30.map((i) => i.providerSymbol)).toEqual(["US30"]);
  });

  it("keeps category scope unless searchAllCategories is set", () => {
    const scoped = filterClassifiedInstruments(catalog.instruments, {
      categoryId: "forex",
      query: "AAPL",
    });
    expect(scoped).toHaveLength(0);

    const global = filterClassifiedInstruments(catalog.instruments, {
      categoryId: "forex",
      query: "AAPL",
      searchAllCategories: true,
    });
    expect(global.map((i) => i.providerSymbol)).toEqual(["AAPL.us"]);
  });

  it("ranks exact matches ahead of partial matches and dedupes", () => {
    const rows = filterClassifiedInstruments(catalog.instruments, { query: "USD" });
    expect(rows.length).toBeGreaterThan(1);
    const symbols = rows.map((i) => i.providerSymbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(scoreInstrumentSearchMatch(catalog.instruments.find((i) => i.providerSymbol === "EUR/USD")!, "EUR/USD"))
      .toBeGreaterThan(
        scoreInstrumentSearchMatch(catalog.instruments.find((i) => i.providerSymbol === "EUR/USD")!, "EUR")!,
      );
  });

  it("preserves exact ForexConnect and Binance selection identities", () => {
    expect(parseSelectedMarket("AAPL.us", "FOREXCONNECT")?.symbol).toBe("AAPL.us");
    expect(parseSelectedMarket("AUD/CNH", "FOREXCONNECT")?.provider).toBe("FOREXCONNECT");
    expect(parseSelectedMarket("BTCUSDT")?.provider).toBe("BINANCE");
    expect(parseSelectedMarket("BTCUSDT")?.symbol).toBe("BTCUSDT");
  });

  it("ranks Binance search without fabricating markets", () => {
    const markets = [
      binance("BTCUSDT", "BTC", "USDT"),
      binance("ETHUSDT", "ETH", "USDT"),
      binance("BTCUSDC", "BTC", "USDC"),
    ];
    const hits = filterBinanceMarkets(markets, { query: "btcusdt" });
    expect(hits[0]?.symbol).toBe("BTCUSDT");
    expect(filterBinanceMarkets(markets, { query: "ZZZNOPE" })).toHaveLength(0);
  });

  it("wires debounced search, clear, Enter→Charts, and stale-safe debounce in explorer", () => {
    const explorer = read("desktop/forex/ForexConnectMarketExplorer.tsx");
    expect(explorer).toContain('data-phase="37c"');
    expect(explorer).toContain("SEARCH_DEBOUNCE_MS");
    expect(explorer).toContain("queryGenRef");
    expect(explorer).toContain("data-fc-search-clear");
    expect(explorer).toContain("data-fc-search-all-toggle");
    expect(explorer).toContain("openInstrumentInCharts");
    expect(explorer).toContain('event.key === "Enter"');
    expect(explorer).not.toContain("fabricat");
  });

  it("preserves Phase 37A chart-first contracts and 37B explorer shell", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain('data-fx-trading-header="true"');
    expect(workspace).toContain("fx-trading-toolbar");
    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-market-category-nav");
    expect(css).toContain(".fx-market-search-clear");
    const markets = read("desktop/forex/ForexMarketsPage.tsx");
    expect(markets).toContain("initialProviderFilter");
  });
});
