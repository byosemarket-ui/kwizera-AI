import { DEFAULT_CHART_TIMEFRAME, type ChartTimeframeId } from "../chart/types";
import { parseChartTimeframe } from "../chart/market-data";
import { toDisplaySymbol } from "../../../ai/market-data/binance/adapter";

export type MarketVenue = "binance-spot" | "unsupported";

export interface SelectedMarket {
  venue: MarketVenue;
  symbol: string;
  displaySymbol: string;
}

export function compactMarketSymbol(symbol: string): string {
  return symbol.replace(/[/_-]/g, "").trim().toUpperCase();
}

/**
 * Parse a market from URL/query.
 * Traditional FX labels (EUR/USD) are not Binance Spot instruments — they are unsupported
 * for live market data (Phase 11). Only compact Binance-style symbols become binance-spot.
 */
export function parseSelectedMarket(raw: string | null | undefined): SelectedMarket | null {
  if (!raw) return null;
  const compact = compactMarketSymbol(raw);
  if (!compact) return null;
  // Slash form like EUR/USD is never treated as a live Binance Spot chart symbol.
  if (raw.includes("/") || raw.includes("-")) {
    const looksLikeFx = /^[A-Z]{3}\/[A-Z]{3}$/i.test(raw.trim()) || /^XAU\/[A-Z]{3}$/i.test(raw.trim());
    if (looksLikeFx) {
      return {
        venue: "unsupported",
        symbol: raw.trim().toUpperCase(),
        displaySymbol: raw.trim().toUpperCase(),
      };
    }
  }
  if (!/^[A-Z0-9]{4,30}$/.test(compact)) return null;
  return {
    venue: "binance-spot",
    symbol: compact,
    displaySymbol: toDisplaySymbol(compact),
  };
}

/** No silent EUR/USD default — caller must select a Binance Spot market. */
export function defaultSelectedMarket(): SelectedMarket | null {
  return null;
}

export function isBinanceSpotSelection(market: SelectedMarket | null | undefined): market is SelectedMarket {
  return market?.venue === "binance-spot";
}

export function readMarketQuery(search = typeof window !== "undefined" ? window.location.search : ""): {
  selected: SelectedMarket | null;
  timeframe: ChartTimeframeId;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    selected: parseSelectedMarket(params.get("symbol")),
    timeframe: parseChartTimeframe(params.get("timeframe")),
  };
}

export function writeMarketQuery(selected: SelectedMarket | null, timeframe: ChartTimeframeId = DEFAULT_CHART_TIMEFRAME): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (selected?.venue === "binance-spot") {
    url.searchParams.set("symbol", compactMarketSymbol(selected.symbol));
  } else if (selected) {
    url.searchParams.set("symbol", compactMarketSymbol(selected.symbol));
  } else {
    url.searchParams.delete("symbol");
  }
  url.searchParams.set("timeframe", timeframe);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}
