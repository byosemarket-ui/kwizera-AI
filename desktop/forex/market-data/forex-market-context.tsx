/**
 * Central Forex market workspace state — single source of truth owned by ForexShell.
 * Modules consume this context; they must not invent parallel selected-symbol or ticker state.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { ChartTimeframeId } from "../chart/types";
import type { LiveTickerSnapshot, MarketConnectionSnapshot } from "../../../ai/market-data/binance/types";
import type { SelectedMarket } from "./selected-market";

export interface ForexMarketWorkspaceState {
  selectedMarket: SelectedMarket | null;
  timeframe: ChartTimeframeId;
  liveTicker: LiveTickerSnapshot;
  binanceConnection: MarketConnectionSnapshot;
  selectMarket: (market: SelectedMarket) => void;
  selectTimeframe: (timeframe: ChartTimeframeId) => void;
  retryBinance: () => void;
  dataSource: "binance-spot-public";
}

const ForexMarketContext = createContext<ForexMarketWorkspaceState | null>(null);

export function ForexMarketProvider({
  value,
  children,
}: {
  value: ForexMarketWorkspaceState;
  children: ReactNode;
}) {
  return <ForexMarketContext.Provider value={value}>{children}</ForexMarketContext.Provider>;
}

export function useForexMarketWorkspace(): ForexMarketWorkspaceState {
  const value = useContext(ForexMarketContext);
  if (!value) {
    throw new Error("useForexMarketWorkspace must be used within ForexMarketProvider");
  }
  return value;
}

/** Optional access when a leaf may render outside the Forex shell (tests). */
export function useForexMarketWorkspaceOptional(): ForexMarketWorkspaceState | null {
  return useContext(ForexMarketContext);
}
