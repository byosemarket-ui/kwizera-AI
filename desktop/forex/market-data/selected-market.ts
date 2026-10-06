import { FOREX_INSTRUMENTS } from "../dashboard-data";
import { DEFAULT_CHART_SYMBOL, DEFAULT_CHART_TIMEFRAME, type ChartTimeframeId } from "../chart/types";
import { parseChartTimeframe } from "../chart/market-data";

export type MarketVenue = "binance-spot" | "development-forex";

export interface SelectedMarket {
  venue: MarketVenue;
  symbol: string;
  displaySymbol: string;
}

const FOREX_BY_COMPACT = new Map(
  FOREX_INSTRUMENTS.map((item) => [item.symbol.replace("/", ""), item.symbol]),
);

export function compactMarketSymbol(symbol: string): string {
  return symbol.replace(/[/_-]/g, "").trim().toUpperCase();
}

export function parseSelectedMarket(raw: string | null | undefined): SelectedMarket | null {
  if (!raw) return null;
  const compact = compactMarketSymbol(raw);
  if (!compact) return null;
  const forex = FOREX_BY_COMPACT.get(compact);
  if (forex) {
    return { venue: "development-forex", symbol: forex, displaySymbol: forex };
  }
  if (!/^[A-Z0-9]{4,30}$/.test(compact)) return null;
  return { venue: "binance-spot", symbol: compact, displaySymbol: compact };
}

export function defaultSelectedMarket(): SelectedMarket {
  return { venue: "development-forex", symbol: DEFAULT_CHART_SYMBOL, displaySymbol: DEFAULT_CHART_SYMBOL };
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
  if (selected) url.searchParams.set("symbol", compactMarketSymbol(selected.symbol));
  else url.searchParams.delete("symbol");
  url.searchParams.set("timeframe", timeframe);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}
