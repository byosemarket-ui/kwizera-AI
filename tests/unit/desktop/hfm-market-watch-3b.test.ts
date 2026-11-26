/**
 * STEP 3B — HFM Market Watch functional table, search/filter/sort/pagination,
 * favorites, watchlists, sessions honesty, and no screenshot sample data.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { HfmCatalogInstrument } from "../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmCanonicalQuote } from "../../../ai/market-data/mt5-hfm/quote-types";
import {
  buildInstrumentRows,
  filterInstrumentRows,
  instrumentMatchesSearch,
  normalizeSearchQuery,
  paginateRows,
  sortInstrumentRows,
} from "../../../desktop/forex/hfm-dashboard/market-watch/instrument-query";
import {
  sessionsFromInstrumentMetadata,
  resolveTradingSessionOverview,
} from "../../../desktop/forex/hfm-dashboard/market-watch/sessions";
import { unavailableMovementSummary } from "../../../desktop/forex/hfm-dashboard/market-watch/movement";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fakeInstrument(partial: Partial<HfmCatalogInstrument> & { symbol: string }): HfmCatalogInstrument {
  return {
    provider: "HFM_MT5",
    environment: "demo",
    brokerServer: null,
    catalogVersion: "t",
    lifecycle: "ACTIVE",
    firstDiscoveredAt: "t",
    lastDiscoveredAt: "t",
    metadataCompleteness: 0.8,
    metadataQuality: {} as HfmCatalogInstrument["metadataQuality"],
    classification: {
      category: "FOREX",
      subcategory: null,
      classificationStatus: "CONFIRMED",
      confidence: "HIGH",
      classificationConfidence: 1,
      classificationMethod: "SYMBOL_PATH",
      method: "SYMBOL_PATH",
      classificationEvidence: [],
      evidence: [],
      classificationWarnings: [],
      classifiedAt: "t",
      classifierVersion: "t",
    },
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
    tradeAllowed: true,
    startTime: null,
    expirationTime: null,
    currencyBase: "EUR",
    currencyProfit: "USD",
    currencyMargin: "USD",
    synchronized: true,
    sessions: null,
    fieldErrors: {},
    ...partial,
  } as HfmCatalogInstrument;
}

function fakeQuote(partial: Partial<HfmCanonicalQuote> & { symbol: string }): HfmCanonicalQuote {
  return {
    provider: "HFM_MT5",
    environment: "demo",
    server: null,
    bid: null,
    ask: null,
    last: null,
    spread: null,
    spreadPoints: null,
    brokerSpreadPoints: null,
    digits: 5,
    point: 0.00001,
    tickSize: 0.00001,
    tickVolume: null,
    realVolume: null,
    tickFlags: null,
    quoteTimestamp: null,
    quoteTimestampMs: null,
    quoteTimestampUtc: null,
    quoteTimestampUtcMs: null,
    brokerUtcOffsetSec: null,
    receivedAtUtc: "t",
    clockSkewSec: null,
    timestampSource: "unknown",
    timestampNormalizationStatus: "UNAVAILABLE",
    timestampNormalizationReason: "TEST_FIXTURE",
    marketSessionState: "SESSION_UNKNOWN",
    marketSessionReason: "TEST_FIXTURE",
    brokerClockFrozen: false,
    receivedAt: "t",
    sequence: null,
    status: "NO_QUOTE",
    validation: {
      verdict: "ok",
      errors: [],
      warnings: [],
      catalogMatched: true,
      catalogVersion: "t",
    },
    source: "HFM_MT5",
    acquisitionMethod: "unknown",
    previousStatus: null,
    statusReason: null,
    statusChangedAt: null,
    mutatesBroker: false,
    placesOrders: false,
    acceptsForExecution: false,
    ...partial,
  };
}

describe("STEP 3B search / filter / sort / pagination", () => {
  const instruments = [
    fakeInstrument({ symbol: "EURUSD", description: "Euro vs US Dollar", currencyBase: "EUR" }),
    fakeInstrument({
      symbol: "XAUUSD",
      description: "Gold vs US Dollar",
      currencyBase: "XAU",
      classification: {
        ...fakeInstrument({ symbol: "XAUUSD" }).classification,
        category: "METALS",
      },
    }),
    fakeInstrument({ symbol: "GBPUSD", description: "British Pound vs US Dollar", currencyBase: "GBP" }),
  ];

  it("matches exact, partial, description and currency search case-insensitively", () => {
    expect(normalizeSearchQuery("  EuR  Usd ")).toBe("eur usd");
    expect(instrumentMatchesSearch(instruments[0]!, "eurusd")).toBe(true);
    expect(instrumentMatchesSearch(instruments[0]!, "EURO")).toBe(true);
    expect(instrumentMatchesSearch(instruments[1]!, "gold")).toBe(true);
    expect(instrumentMatchesSearch(instruments[2]!, "gbp")).toBe(true);
    expect(instrumentMatchesSearch(instruments[0]!, "nope")).toBe(false);
    expect(instrumentMatchesSearch(instruments[0]!, "")).toBe(true);
  });

  it("filters by category, quote status, subscription and favorites together", () => {
    const rows = buildInstrumentRows({
      instruments,
      quotesBySymbol: {
        EURUSD: fakeQuote({ symbol: "EURUSD", status: "LIVE", bid: 1.1, ask: 1.1002 }),
        XAUUSD: fakeQuote({ symbol: "XAUUSD", status: "NO_QUOTE" }),
      },
      subscriptionsBySymbol: {
        EURUSD: {
          subscriptionId: "1",
          provider: "HFM_MT5",
          environment: "demo",
          symbol: "EURUSD",
          status: "ACTIVE",
          priority: "HIGH",
          priorityWeight: 1,
          requestedBy: "t",
          createdAt: "t",
          updatedAt: "t",
          lastAcquiredAt: null,
          lastValidQuoteAt: null,
          lastError: null,
          subscriptionConfig: {
            acquisitionIntervalMs: null,
            freshnessThresholdMs: null,
            allowEngineSelect: true,
          },
          engineSelected: false,
          previousStatus: null,
          statusReason: null,
          delayedForCapacity: false,
        },
      },
      favoriteSymbols: ["XAUUSD"],
    });

    const metalsFav = filterInstrumentRows(rows, {
      search: "",
      category: "METALS",
      quoteStatus: "ALL",
      subscription: "ALL",
      favoritesOnly: true,
    });
    expect(metalsFav.map((r) => r.symbol)).toEqual(["XAUUSD"]);

    const liveSubscribed = filterInstrumentRows(rows, {
      search: "",
      category: "ALL",
      quoteStatus: "LIVE",
      subscription: "ACTIVE",
    });
    expect(liveSubscribed.map((r) => r.symbol)).toEqual(["EURUSD"]);
  });

  it("sorts numeric bids with nulls last and keeps stable symbol tie-break", () => {
    const rows = buildInstrumentRows({
      instruments,
      quotesBySymbol: {
        EURUSD: fakeQuote({ symbol: "EURUSD", bid: 1.2, ask: 1.21, status: "LIVE" }),
        GBPUSD: fakeQuote({ symbol: "GBPUSD", bid: 1.1, ask: 1.11, status: "LIVE" }),
      },
      subscriptionsBySymbol: {},
      favoriteSymbols: [],
    });
    const asc = sortInstrumentRows(rows, "bid_asc").map((r) => r.symbol);
    expect(asc[0]).toBe("GBPUSD");
    expect(asc[1]).toBe("EURUSD");
    expect(asc[2]).toBe("XAUUSD"); // null bid last
  });

  it("paginates and clamps invalid pages", () => {
    const items = Array.from({ length: 47 }, (_, i) => i);
    const p1 = paginateRows(items, 1, 10);
    expect(p1.slice).toHaveLength(10);
    expect(p1.totalPages).toBe(5);
    const overflow = paginateRows(items, 99, 10);
    expect(overflow.page).toBe(5);
    expect(overflow.slice[0]).toBe(40);
  });
});

describe("STEP 3B favorites and watchlists persistence", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const local: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      setItem: (k, v) => {
        store.set(k, String(v));
      },
      removeItem: (k) => {
        store.delete(k);
      },
      key: (i) => [...store.keys()][i] ?? null,
    };
    vi.stubGlobal("localStorage", local);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("adds/removes favorites without duplicates and persists", async () => {
    const fav = await import("../../../desktop/forex/hfm-dashboard/market-watch/favorites-store.ts");
    expect(fav.addHfmFavorite("EURUSD").ok).toBe(true);
    expect(fav.addHfmFavorite("EURUSD").symbols.filter((s) => s === "EURUSD")).toHaveLength(1);
    expect(fav.isHfmFavorite("EURUSD")).toBe(true);
    expect(fav.toggleHfmFavorite("EURUSD").favorite).toBe(false);
    expect(fav.listHfmFavoriteSymbols()).toEqual([]);
  });

  it("creates watchlists and prevents duplicate symbols", async () => {
    const wl = await import("../../../desktop/forex/hfm-dashboard/market-watch/watchlists-store.ts");
    const created = wl.createHfmWatchlist(" Metals Core ");
    expect(created.ok).toBe(true);
    expect(created.list?.provider).toBe("HFM_MT5");
    expect(created.list?.environment).toBe("demo");
    const id = created.list!.id;
    expect(wl.addSymbolToHfmWatchlist(id, "XAUUSD").ok).toBe(true);
    expect(wl.addSymbolToHfmWatchlist(id, "XAUUSD").list?.symbols).toEqual(["XAUUSD"]);
    expect(wl.renameHfmWatchlist(id, "Metals").list?.name).toBe("Metals");
    expect(wl.removeSymbolFromHfmWatchlist(id, "XAUUSD").list?.symbols).toEqual([]);
    expect(wl.deleteHfmWatchlist(id).ok).toBe(true);
  });
});

describe("STEP 3B sessions and movement honesty", () => {
  it("keeps named hub overview unavailable and maps MT5 day windows without inventing hubs", () => {
    expect(resolveTradingSessionOverview(null).availability).toBe("unavailable");
    expect(unavailableMovementSummary().rising).toBeNull();

    const mapped = sessionsFromInstrumentMetadata({
      tradeSessionDays: 5,
      quoteSessionDays: 5,
      "1": { tradeFrom: 0, tradeTo: 86400, quoteFrom: 0, quoteTo: 86400 },
      "2": { tradeFrom: 120, tradeTo: 86000, quoteFrom: 0, quoteTo: 86400 },
    });
    expect(mapped.availability).toBe("available");
    expect(mapped.rows[0]?.name).toBe("Mon");
    expect(mapped.rows.some((r) => /London|Sydney|Tokyo|New York/.test(r.name))).toBe(false);
    expect(mapped.rows[0]?.status).toBe("Schedule");
  });
});

describe("STEP 3B SSE quote bridge and status counts", () => {
  it("merges SSE ticks without inventing bids and counts statuses distinctly", async () => {
    const bridge = await import(
      "../../../desktop/forex/hfm-dashboard/market-watch/sse-quote-bridge.ts"
    );
    const merged = bridge.mergeSseQuotesIntoCanonicalMap(
      {
        EURUSD: fakeQuote({ symbol: "EURUSD", bid: 1.1, ask: 1.2, status: "STALE" }),
      },
      {
        EURUSD: {
          symbol: "EURUSD",
          bid: 1.101,
          ask: 1.102,
          last: null,
          spread: 0.001,
          digits: 5,
          point: 0.00001,
          tickTime: 1700000000,
          tickVolume: 1,
          freshness: "LIVE",
          status: "LIVE",
          prevMid: null,
        },
      },
    );
    expect(merged.EURUSD?.bid).toBe(1.101);
    expect(merged.EURUSD?.status).toBe("LIVE");

    const counts = bridge.countQuoteAndSubscriptionStatuses([
      { quote: fakeQuote({ symbol: "EURUSD", status: "LIVE" }), subscription: { status: "ACTIVE" } },
      { quote: fakeQuote({ symbol: "GBPUSD", status: "STALE" }), subscription: { status: "ACTIVE" } },
      { quote: null, subscription: null },
    ]);
    expect(counts.live).toBe(1);
    expect(counts.stale).toBe(1);
    expect(counts.unquoted).toBe(1);
    expect(counts.activeSubscriptions).toBe(2);
  });
});

describe("STEP 3B source integrity and API wiring", () => {
  it("wires confirmed endpoints and does not hardcode designer sample facts", () => {
    const api = read("desktop/forex/hfm-dashboard/market-watch/api.ts");
    expect(api).toContain("/api/forex/providers/mt5-hfm/symbols");
    expect(api).toContain("/api/forex/providers/mt5-hfm/quotes");
    expect(api).toContain("/api/forex/providers/mt5-hfm/subscriptions");
    expect(api).not.toContain("fxcm");
    expect(api).not.toContain("binance");

    const page = read("desktop/forex/hfm-dashboard/market-watch/HfmMarketWatchPage.tsx");
    const table = read(
      "desktop/forex/hfm-dashboard/market-watch/components/HfmInstrumentsTable.tsx",
    );
    const joined = page + table;
    for (const sample of ["49903799", "2347.61", "1.08542", "London (Open)"]) {
      expect(joined.includes(sample)).toBe(false);
    }
    expect(table).toContain("Unavailable");
    expect(page).toContain("selectedSymbol");
    expect(page).toContain("subscribeHfmSymbols");
    expect(page).toContain("mergeSseQuotesIntoCanonicalMap");
    expect(page).toContain("deleteHfmWatchlist");
    expect(page).toContain("renameHfmWatchlist");
    expect(page).not.toMatch(/submitOrder|placeOrder/);
  });

  it("preserves STEP 3A overview honesty for rising/falling and named sessions", () => {
    const page = read("desktop/forex/hfm-dashboard/market-watch/HfmMarketWatchPage.tsx");
    expect(page).toContain("unavailableMovementSummary()");
    expect(page).toContain("resolveTradingSessionOverview(null)");
    // STEP 3C supersedes the step marker while preserving 3B behavior.
    expect(page).toMatch(/data-hfm-step="3[bc]"/);
  });
});
