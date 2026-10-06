import { CHART_TIMEFRAMES, DEFAULT_CHART_SYMBOL, DEFAULT_CHART_TIMEFRAME, type ChartTimeframeId, type MarketDataResult } from "./types";
import { getDevelopmentSeries, isSupportedChartSymbol } from "./development-provider";
import {
  allowDevelopmentMarketData,
  LIVE_MARKET_UNAVAILABLE,
} from "../market-data/allow-development-market-data";

export function parseChartSymbol(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_CHART_SYMBOL;
  const compact = raw.replace("_", "/").trim().toUpperCase();
  if (compact.includes("/")) return isSupportedChartSymbol(compact) ? compact : DEFAULT_CHART_SYMBOL;
  if (compact.length === 6) {
    const slashed = `${compact.slice(0, 3)}/${compact.slice(3)}`;
    return isSupportedChartSymbol(slashed) ? slashed : DEFAULT_CHART_SYMBOL;
  }
  return DEFAULT_CHART_SYMBOL;
}

export function parseChartTimeframe(raw: string | null | undefined): ChartTimeframeId {
  const value = (raw ?? "").toLowerCase() as ChartTimeframeId;
  return CHART_TIMEFRAMES.some((item) => item.id === value) ? value : DEFAULT_CHART_TIMEFRAME;
}

export function symbolQueryValue(symbol: string): string {
  return symbol.replace("/", "");
}

export function readChartQuery(search = typeof window !== "undefined" ? window.location.search : ""): {
  symbol: string;
  timeframe: ChartTimeframeId;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    symbol: parseChartSymbol(params.get("symbol")),
    timeframe: parseChartTimeframe(params.get("timeframe")),
  };
}

export function writeChartQuery(symbol: string, timeframe: ChartTimeframeId): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("symbol", symbolQueryValue(symbol));
  url.searchParams.set("timeframe", timeframe);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

/**
 * Chart series loader.
 * Production: never returns fabricated candles — only an unavailable state.
 * Development series remain available only when allowDevelopmentMarketData() is true (tests).
 */
export function fetchMarketSeries(symbol: string, timeframe: ChartTimeframeId): MarketDataResult {
  if (!allowDevelopmentMarketData()) {
    return { state: "unavailable", series: null, message: LIVE_MARKET_UNAVAILABLE };
  }
  if (!CHART_TIMEFRAMES.some((item) => item.id === timeframe)) {
    return { state: "unavailable", series: null, message: "Data unavailable for this timeframe." };
  }
  if (!isSupportedChartSymbol(symbol)) {
    return { state: "unavailable", series: null, message: LIVE_MARKET_UNAVAILABLE };
  }
  const series = getDevelopmentSeries(symbol, timeframe);
  if (!series || series.candles.length === 0) {
    return { state: "empty", series: null, message: "No chart data is available for this selection." };
  }
  return { state: "ready", series, message: series.statusLabel };
}
