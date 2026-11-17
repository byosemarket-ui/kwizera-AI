/**
 * STEP 3B — client-side search / filter / sort / pagination over loaded HFM catalog.
 * Quote status & subscription filters use overlay maps; change/high/low stay unavailable
 * unless backend fields appear.
 */

import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmCanonicalQuote } from "../../../../ai/market-data/mt5-hfm/quote-types";
import type { HfmSubscriptionRecord } from "../../../../ai/market-data/mt5-hfm/subscription-types";
import type { HfmMwCategoryFilter } from "./types";

export type HfmMwQuoteStatusFilter =
  | "ALL"
  | "LIVE"
  | "STALE"
  | "MARKET_CLOSED"
  | "NO_QUOTE"
  | "INVALID"
  | "INCOMPLETE"
  | "DELAYED"
  | "ERROR"
  | "UNQUOTED";

export type HfmMwSubscriptionFilter =
  | "ALL"
  | "SUBSCRIBED"
  | "UNSUBSCRIBED"
  | "PAUSED"
  | "FAILED"
  | "RECOVERING"
  | "PENDING"
  | "ACTIVE";

export type HfmMwSortId =
  | "symbol_asc"
  | "symbol_desc"
  | "category_asc"
  | "bid_asc"
  | "bid_desc"
  | "ask_asc"
  | "ask_desc"
  | "spread_asc"
  | "spread_desc"
  | "status_asc"
  | "freshness_asc";

export type HfmMwInstrumentRow = {
  symbol: string;
  instrument: HfmCatalogInstrument;
  quote: HfmCanonicalQuote | null;
  subscription: HfmSubscriptionRecord | null;
  favorite: boolean;
};

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function instrumentMatchesSearch(row: HfmCatalogInstrument, query: string): boolean {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  const hay = [
    row.symbol,
    row.description,
    row.classification?.category,
    row.classification?.subcategory,
    row.currencyBase,
    row.currencyProfit,
    row.currencyMargin,
    row.path,
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function quoteStatusOf(quote: HfmCanonicalQuote | null): string {
  return quote?.status ?? "UNQUOTED";
}

function subscriptionBucket(sub: HfmSubscriptionRecord | null): HfmMwSubscriptionFilter {
  if (!sub) return "UNSUBSCRIBED";
  if (sub.status === "PAUSED") return "PAUSED";
  if (sub.status === "FAILED") return "FAILED";
  if (sub.status === "RECOVERING") return "RECOVERING";
  if (sub.status === "PENDING") return "PENDING";
  if (sub.status === "ACTIVE") return "ACTIVE";
  if (sub.status === "UNSUBSCRIBED") return "UNSUBSCRIBED";
  return "SUBSCRIBED";
}

export function buildInstrumentRows(input: {
  instruments: HfmCatalogInstrument[];
  quotesBySymbol: Record<string, HfmCanonicalQuote>;
  subscriptionsBySymbol: Record<string, HfmSubscriptionRecord>;
  favoriteSymbols: Set<string> | string[];
}): HfmMwInstrumentRow[] {
  const fav =
    input.favoriteSymbols instanceof Set
      ? input.favoriteSymbols
      : new Set(input.favoriteSymbols);
  return input.instruments.map((instrument) => ({
    symbol: instrument.symbol,
    instrument,
    quote: input.quotesBySymbol[instrument.symbol] ?? null,
    subscription: input.subscriptionsBySymbol[instrument.symbol] ?? null,
    favorite: fav.has(instrument.symbol),
  }));
}

export function filterInstrumentRows(
  rows: HfmMwInstrumentRow[],
  opts: {
    search: string;
    category: HfmMwCategoryFilter;
    quoteStatus: HfmMwQuoteStatusFilter;
    subscription: HfmMwSubscriptionFilter;
    favoritesOnly?: boolean;
    watchlistSymbols?: Set<string> | null;
  },
): HfmMwInstrumentRow[] {
  return rows.filter((row) => {
    if (opts.favoritesOnly && !row.favorite) return false;
    if (opts.watchlistSymbols && !opts.watchlistSymbols.has(row.symbol)) return false;
    if (opts.category !== "ALL") {
      const cat = row.instrument.classification?.category;
      if (cat !== opts.category) return false;
    }
    if (!instrumentMatchesSearch(row.instrument, opts.search)) return false;
    if (opts.quoteStatus !== "ALL") {
      const status = quoteStatusOf(row.quote);
      if (opts.quoteStatus === "UNQUOTED") {
        if (row.quote) return false;
      } else if (status !== opts.quoteStatus) {
        return false;
      }
    }
    if (opts.subscription !== "ALL") {
      const bucket = subscriptionBucket(row.subscription);
      if (opts.subscription === "SUBSCRIBED") {
        if (!row.subscription || row.subscription.status === "UNSUBSCRIBED") return false;
      } else if (opts.subscription === "UNSUBSCRIBED") {
        if (row.subscription && row.subscription.status !== "UNSUBSCRIBED") return false;
      } else if (bucket !== opts.subscription && row.subscription?.status !== opts.subscription) {
        return false;
      }
    }
    return true;
  });
}

function cmpNullLast(a: number | null | undefined, b: number | null | undefined): number {
  const aOk = typeof a === "number" && Number.isFinite(a);
  const bOk = typeof b === "number" && Number.isFinite(b);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return a === b ? 0 : a < b ? -1 : 1;
}

export function sortInstrumentRows(rows: HfmMwInstrumentRow[], sort: HfmMwSortId): HfmMwInstrumentRow[] {
  const copy = rows.slice();
  copy.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case "symbol_desc":
        primary = b.symbol.localeCompare(a.symbol);
        break;
      case "category_asc":
        primary = String(a.instrument.classification?.category ?? "").localeCompare(
          String(b.instrument.classification?.category ?? ""),
        );
        break;
      case "bid_asc":
        primary = cmpNullLast(a.quote?.bid ?? null, b.quote?.bid ?? null);
        break;
      case "bid_desc":
        primary = cmpNullLast(b.quote?.bid ?? null, a.quote?.bid ?? null);
        break;
      case "ask_asc":
        primary = cmpNullLast(a.quote?.ask ?? null, b.quote?.ask ?? null);
        break;
      case "ask_desc":
        primary = cmpNullLast(b.quote?.ask ?? null, a.quote?.ask ?? null);
        break;
      case "spread_asc":
        primary = cmpNullLast(
          a.quote?.spreadPoints ?? a.quote?.spread ?? null,
          b.quote?.spreadPoints ?? b.quote?.spread ?? null,
        );
        break;
      case "spread_desc":
        primary = cmpNullLast(
          b.quote?.spreadPoints ?? b.quote?.spread ?? null,
          a.quote?.spreadPoints ?? a.quote?.spread ?? null,
        );
        break;
      case "status_asc":
        primary = quoteStatusOf(a.quote).localeCompare(quoteStatusOf(b.quote));
        break;
      case "freshness_asc": {
        const at = a.quote?.quoteTimestampMs ?? a.quote?.quoteTimestamp ?? null;
        const bt = b.quote?.quoteTimestampMs ?? b.quote?.quoteTimestamp ?? null;
        primary = cmpNullLast(bt, at); // newer first
        break;
      }
      case "symbol_asc":
      default:
        primary = a.symbol.localeCompare(b.symbol);
        break;
    }
    if (primary !== 0) return primary;
    return a.symbol.localeCompare(b.symbol);
  });
  return copy;
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { page: number; pageSize: number; total: number; totalPages: number; slice: T[] } {
  const size = Math.max(1, Math.min(200, pageSize || 25));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size) || 1);
  const safePage = Math.min(Math.max(1, page || 1), totalPages);
  const start = (safePage - 1) * size;
  return {
    page: safePage,
    pageSize: size,
    total,
    totalPages,
    slice: rows.slice(start, start + size),
  };
}

export const HFM_MW_SORT_OPTIONS: Array<{ id: HfmMwSortId; label: string }> = [
  { id: "symbol_asc", label: "Symbol A–Z" },
  { id: "symbol_desc", label: "Symbol Z–A" },
  { id: "category_asc", label: "Category" },
  { id: "bid_asc", label: "Bid ↑" },
  { id: "bid_desc", label: "Bid ↓" },
  { id: "ask_asc", label: "Ask ↑" },
  { id: "ask_desc", label: "Ask ↓" },
  { id: "spread_asc", label: "Spread ↑" },
  { id: "spread_desc", label: "Spread ↓" },
  { id: "status_asc", label: "Quote status" },
  { id: "freshness_asc", label: "Quote freshness" },
];
