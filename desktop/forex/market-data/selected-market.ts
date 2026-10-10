import { FOREX_INSTRUMENTS } from "../dashboard-data";
import { DEFAULT_CHART_TIMEFRAME, type ChartTimeframeId } from "../chart/types";
import { parseChartTimeframe } from "../chart/market-data";
import { toDisplaySymbol } from "../../../ai/market-data/binance/adapter";
import type { MarketProviderId } from "../../../ai/market-data/providers/types";

export type MarketVenue = "binance-spot" | "fxcm" | "forexconnect" | "unsupported";

export interface SelectedMarket {
  venue: MarketVenue;
  symbol: string;
  displaySymbol: string;
  /** Explicit provider when set. */
  provider?: MarketProviderId;
}

const TRADITIONAL_FX_COMPACT = new Set(
  FOREX_INSTRUMENTS.map((item) => item.symbol.replace(/[/_-]/g, "").toUpperCase()),
);

export function compactMarketSymbol(symbol: string): string {
  return symbol.replace(/[/_-]/g, "").trim().toUpperCase();
}

function traditionalFxDisplay(compact: string): string {
  const match = FOREX_INSTRUMENTS.find(
    (item) => item.symbol.replace(/[/_-]/g, "").toUpperCase() === compact,
  );
  return match?.symbol ?? compact;
}

/**
 * Parse a market from URL/query.
 * Traditional FX labels (EUR/USD, EURUSD) are not Binance Spot instruments.
 * Explicit provider=FXCM | FOREXCONNECT selects the matching Forex venue.
 */
export function parseSelectedMarket(
  raw: string | null | undefined,
  explicitProvider?: string | null,
): SelectedMarket | null {
  if (!raw) return null;
  const compact = compactMarketSymbol(raw);
  if (!compact) return null;
  const provider = String(explicitProvider ?? "").trim().toUpperCase();

  // ForexConnect multi-asset symbols (AAPL.us, US30, 10USNote, EUR/USD) must keep
  // the exact providerSymbol — never collapse dots or invent a traditional FX label.
  if (provider === "FOREXCONNECT") {
    const symbol = raw.trim();
    if (!symbol) return null;
    return {
      venue: "forexconnect",
      symbol,
      displaySymbol: symbol,
      provider: "FOREXCONNECT",
    };
  }

  const looksLikeFxSlash = /^[A-Z]{3}\/[A-Z]{3}$/i.test(raw.trim()) || /^XAU\/[A-Z]{3}$/i.test(raw.trim());
  if (
    provider === "FXCM"
    || looksLikeFxSlash
    || TRADITIONAL_FX_COMPACT.has(compact)
  ) {
    const display = looksLikeFxSlash
      ? raw.trim().toUpperCase()
      : (raw.includes("/") ? raw.trim().toUpperCase() : traditionalFxDisplay(compact));
    // Only treat as FXCM historical when explicitly requested — avoids accidental FXCM calls.
    if (provider === "FXCM") {
      return {
        venue: "fxcm",
        symbol: display,
        displaySymbol: display,
        provider: "FXCM",
      };
    }
    return {
      venue: "unsupported",
      symbol: display,
      displaySymbol: display,
    };
  }

  if (!/^[A-Z0-9]{4,30}$/.test(compact)) return null;
  return {
    venue: "binance-spot",
    symbol: compact,
    displaySymbol: toDisplaySymbol(compact),
    provider: "BINANCE",
  };
}

/** No silent EUR/USD default — caller must select a Binance Spot market. */
export function defaultSelectedMarket(): SelectedMarket | null {
  return null;
}

export function isBinanceSpotSelection(market: SelectedMarket | null | undefined): market is SelectedMarket {
  return market?.venue === "binance-spot";
}

export function isFxcmSelection(market: SelectedMarket | null | undefined): market is SelectedMarket {
  return market?.venue === "fxcm";
}

export function isForexConnectSelection(market: SelectedMarket | null | undefined): market is SelectedMarket {
  return market?.venue === "forexconnect";
}

export function readMarketQuery(search = typeof window !== "undefined" ? window.location.search : ""): {
  selected: SelectedMarket | null;
  timeframe: ChartTimeframeId;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    selected: parseSelectedMarket(params.get("symbol"), params.get("provider")),
    timeframe: parseChartTimeframe(params.get("timeframe")),
  };
}

export function writeMarketQuery(selected: SelectedMarket | null, timeframe: ChartTimeframeId = DEFAULT_CHART_TIMEFRAME): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (selected?.venue === "fxcm") {
    url.searchParams.set("symbol", selected.symbol);
    url.searchParams.set("provider", "FXCM");
    url.searchParams.set("timeframe", timeframe);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    return;
  }
  if (selected?.venue === "forexconnect") {
    url.searchParams.set("symbol", selected.symbol);
    url.searchParams.set("provider", "FOREXCONNECT");
    url.searchParams.set("timeframe", timeframe);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    return;
  }
  url.searchParams.delete("provider");
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
