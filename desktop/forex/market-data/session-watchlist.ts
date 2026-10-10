/**
 * Session-local watchlist (provider-aware — Phase 31).
 * Stores SelectedMarket identities so FXCM EURUSD never collides with Binance EURUSDC.
 */
import { toDisplaySymbol } from "../../../ai/market-data/binance/adapter";
import { marketIdentityKey } from "../../../ai/market-data/providers/identity";
import type { SelectedMarket } from "./selected-market";

const STORAGE_KEY = "kwizera-forex-watchlist-v2";
const LEGACY_STORAGE_KEY = "kwizera-forex-binance-watchlist";
const MAX_ENTRIES = 8;

interface StoredWatchlistEntry {
  provider: "BINANCE" | "FXCM" | "FOREXCONNECT";
  venue: SelectedMarket["venue"];
  symbol: string;
  displaySymbol: string;
}

function toStored(market: SelectedMarket): StoredWatchlistEntry | null {
  if (market.venue === "binance-spot") {
    return {
      provider: "BINANCE",
      venue: "binance-spot",
      symbol: market.symbol,
      displaySymbol: market.displaySymbol,
    };
  }
  if (market.venue === "fxcm") {
    return {
      provider: "FXCM",
      venue: "fxcm",
      symbol: market.symbol,
      displaySymbol: market.displaySymbol,
    };
  }
  if (market.venue === "forexconnect") {
    return {
      provider: "FOREXCONNECT",
      venue: "forexconnect",
      symbol: market.symbol,
      displaySymbol: market.displaySymbol,
    };
  }
  return null;
}

function fromStored(entry: StoredWatchlistEntry): SelectedMarket {
  return {
    venue: entry.venue,
    symbol: entry.symbol,
    displaySymbol: entry.displaySymbol,
    provider: entry.provider,
  };
}

function entryKey(entry: StoredWatchlistEntry): string {
  return marketIdentityKey({
    provider: entry.provider,
    marketType: entry.provider === "BINANCE" ? "CRYPTO" : "FOREX",
    symbol: entry.symbol,
  });
}

function readRaw(): StoredWatchlistEntry[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const modern = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (Array.isArray(modern)) {
      return modern
        .filter((item): item is StoredWatchlistEntry =>
          Boolean(item)
          && typeof item === "object"
          && (item as StoredWatchlistEntry).provider != null
          && typeof (item as StoredWatchlistEntry).symbol === "string")
        .slice(0, MAX_ENTRIES);
    }

    // Migrate legacy Binance-only string list without destroying it.
    const legacy = JSON.parse(sessionStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(legacy)) return [];
    const migrated = legacy
      .filter((item): item is string => typeof item === "string" && /^[A-Z0-9]{4,30}$/.test(item))
      .slice(0, MAX_ENTRIES)
      .map((symbol): StoredWatchlistEntry => ({
        provider: "BINANCE",
        venue: "binance-spot",
        symbol,
        displaySymbol: toDisplaySymbol(symbol),
      }));
    if (migrated.length) {
      writeRaw(migrated);
    }
    return migrated;
  } catch {
    return [];
  }
}

function writeRaw(entries: StoredWatchlistEntry[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
}

export function listSessionWatchlist(): SelectedMarket[] {
  return readRaw().map(fromStored);
}

/** Promote a market to the front of the session watchlist (provider-aware). */
export function rememberSessionWatchlist(market: SelectedMarket | null): SelectedMarket[] {
  const stored = market ? toStored(market) : null;
  if (!stored) return listSessionWatchlist();
  const key = entryKey(stored);
  const next = [stored, ...readRaw().filter((item) => entryKey(item) !== key)].slice(0, MAX_ENTRIES);
  writeRaw(next);
  return next.map(fromStored);
}

export function removeSessionWatchlistSymbol(symbol: string, provider?: "BINANCE" | "FXCM" | "FOREXCONNECT"): SelectedMarket[] {
  const compact = symbol.replace(/[/_-]/g, "").toUpperCase();
  writeRaw(readRaw().filter((item) => {
    const itemCompact = item.symbol.replace(/[/_-]/g, "").toUpperCase();
    if (provider) {
      // Keep entries that are a different provider or a different symbol.
      return item.provider !== provider || itemCompact !== compact;
    }
    // Legacy: remove matching Binance compact symbols only.
    return !(item.provider === "BINANCE" && itemCompact === compact);
  }));
  return listSessionWatchlist();
}
