/**
 * Dashboard Market Overview entries derived from the central Binance session state.
 * Live price is only attached for the active selected symbol (shared miniTicker).
 */
import { formatLivePrice } from "../../../ai/market-data/binance/live-ticker";
import type { LiveTickerSnapshot } from "../../../ai/market-data/binance/types";
import type { MarketQuote } from "../dashboard-data";
import { resolveTickerUiStatus, tickerMatchesSelection } from "./live-market-status";
import type { SelectedMarket } from "./selected-market";
import { listSessionWatchlist } from "./session-watchlist";

export interface BinanceOverviewEntry {
  market: SelectedMarket;
  quote: MarketQuote;
  active: boolean;
  liveStatus: ReturnType<typeof resolveTickerUiStatus> | "SESSION";
}

function toQuote(
  market: SelectedMarket,
  liveTicker: LiveTickerSnapshot | null,
  active: boolean,
): { quote: MarketQuote; liveStatus: BinanceOverviewEntry["liveStatus"] } {
  if (!active || !liveTicker) {
    return {
      liveStatus: "SESSION",
      quote: {
        instrument: {
          symbol: market.displaySymbol,
          name: `${market.symbol} · Binance Spot`,
        },
        price: null,
        change: null,
        changePercent: null,
        high: null,
        low: null,
        spread: null,
        volume: null,
        status: "not-connected",
        dataSource: null,
      },
    };
  }

  const liveStatus = resolveTickerUiStatus(liveTicker, market.symbol);
  const live = liveStatus === "LIVE" && tickerMatchesSelection(liveTicker, market.symbol);
  if (live && liveTicker.ticker) {
    return {
      liveStatus,
      quote: {
        instrument: {
          symbol: market.displaySymbol,
          name: `${market.symbol} · Binance Spot`,
        },
        price: liveTicker.ticker.price,
        change: null,
        changePercent: null,
        high: liveTicker.ticker.high,
        low: liveTicker.ticker.low,
        spread: null,
        volume: null,
        status: "ready",
        dataSource: "binance-spot-public",
      },
    };
  }

  return {
    liveStatus,
    quote: {
      instrument: {
        symbol: market.displaySymbol,
        name: `${market.symbol} · Binance Spot`,
      },
      price: null,
      change: null,
      changePercent: null,
      high: null,
      low: null,
      spread: null,
      volume: null,
      status: liveStatus === "ERROR" ? "error" : "unavailable",
      dataSource: "binance-spot-public",
    },
  };
}

/** Merge selected market + session watchlist into unique Binance Spot overview rows. */
export function buildBinanceOverviewEntries(
  selectedMarket: SelectedMarket | null,
  liveTicker: LiveTickerSnapshot,
): BinanceOverviewEntry[] {
  const session = listSessionWatchlist();
  const bySymbol = new Map<string, SelectedMarket>();
  for (const entry of session) {
    bySymbol.set(entry.symbol, entry);
  }
  if (selectedMarket?.venue === "binance-spot") {
    bySymbol.set(selectedMarket.symbol, selectedMarket);
  }

  const ordered: SelectedMarket[] = [];
  if (selectedMarket?.venue === "binance-spot") {
    ordered.push(selectedMarket);
  }
  for (const entry of session) {
    if (entry.symbol !== selectedMarket?.symbol) ordered.push(entry);
  }

  return ordered.map((market) => {
    const active = selectedMarket?.venue === "binance-spot" && selectedMarket.symbol === market.symbol;
    const { quote, liveStatus } = toQuote(market, liveTicker, active);
    return { market, quote, active, liveStatus };
  });
}

export function overviewPriceLabel(quote: MarketQuote): string {
  if (quote.price !== null && Number.isFinite(quote.price)) return formatLivePrice(quote.price);
  if (quote.status === "error") return "Unable to load Binance market data.";
  if (quote.status === "unavailable") return "Waiting for live Binance data...";
  return "Select for live price";
}
