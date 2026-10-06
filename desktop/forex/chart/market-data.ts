import { CHART_TIMEFRAMES, DEFAULT_CHART_TIMEFRAME, type ChartTimeframeId, type MarketDataResult } from "./types";
import { getDevelopmentSeries, isSupportedChartSymbol } from "./development-provider";
import {
  allowDevelopmentMarketData,
  LIVE_MARKET_UNAVAILABLE,
} from "../market-data/allow-development-market-data";

/**
 * Legacy FX/dev helper. Production shell URL parsing uses parseSelectedMarket.
 * Never invent EUR/USD for unrecognized Binance compact symbols.
 */
export function parseChartSymbol(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.replace("_", "/").trim().toUpperCase();
  if (trimmed.includes("/")) {
    return isSupportedChartSymbol(trimmed) ? trimmed : "";
  }
  const compact = trimmed.replace(/[/-]/g, "");
  if (compact.length === 6) {
    const slashed = `${compact.slice(0, 3)}/${compact.slice(3)}`;
    if (isSupportedChartSymbol(slashed)) return slashed;
  }
  // Preserve compact Binance-style symbols (BTCUSDT, EURUSDC, …).
  if (/^[A-Z0-9]{4,30}$/.test(compact)) return compact;
  return "";
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

/** @deprecated Prefer shell writeMarketQuery — kept for tests/compat only. */
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
