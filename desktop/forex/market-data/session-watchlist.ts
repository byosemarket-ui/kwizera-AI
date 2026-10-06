/**
 * Session-local Binance watchlist (no persistence backend).
 * Stores selected Spot symbols for the current browser session only.
 */
import type { SelectedMarket } from "./selected-market";

const STORAGE_KEY = "kwizera-forex-binance-watchlist";
const MAX_ENTRIES = 8;

function readRaw(): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && /^[A-Z0-9]{4,30}$/.test(item))
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeRaw(symbols: string[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(symbols.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
}

export function listSessionWatchlist(): SelectedMarket[] {
  return readRaw().map((symbol) => ({
    venue: "binance-spot" as const,
    symbol,
    displaySymbol: symbol,
  }));
}

/** Promote a Binance Spot symbol to the front of the session watchlist. */
export function rememberSessionWatchlist(market: SelectedMarket | null): SelectedMarket[] {
  if (!market || market.venue !== "binance-spot") return listSessionWatchlist();
  const next = [market.symbol, ...readRaw().filter((item) => item !== market.symbol)].slice(0, MAX_ENTRIES);
  writeRaw(next);
  return next.map((symbol) => ({
    venue: "binance-spot" as const,
    symbol,
    displaySymbol: symbol,
  }));
}

export function removeSessionWatchlistSymbol(symbol: string): SelectedMarket[] {
  const compact = symbol.replace(/[/_-]/g, "").toUpperCase();
  writeRaw(readRaw().filter((item) => item !== compact));
  return listSessionWatchlist();
}
