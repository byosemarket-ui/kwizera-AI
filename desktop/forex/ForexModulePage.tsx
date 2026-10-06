import { useMemo, useState } from "react";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { resolveForexIcon } from "./forex-icons";
import type { ForexNavItem } from "./forex-routes";
import type { SelectedMarket } from "./market-data/selected-market";
import type { LiveTickerSnapshot } from "../../ai/market-data/binance/types";
import { LiveTickerPanel } from "./LiveTickerPanel";
import { listSessionWatchlist, removeSessionWatchlistSymbol } from "./market-data/session-watchlist";

export function ForexModulePage({
  item,
  selectedMarket,
  liveTicker,
  onSelectMarket,
}: {
  item: ForexNavItem;
  selectedMarket?: SelectedMarket | null;
  liveTicker?: LiveTickerSnapshot | null;
  onSelectMarket?: (market: SelectedMarket) => void;
}) {
  const Icon = resolveForexIcon(item.icon);
  const [watchlistTick, setWatchlistTick] = useState(0);
  const watchlist = useMemo(() => listSessionWatchlist(), [watchlistTick, selectedMarket?.symbol]);

  return (
    <section
      className="fx-placeholder fx-module-page"
      data-forex-page={item.id}
      data-forex-placeholder={item.id}
      aria-labelledby={`fx-page-${item.id}`}
    >
      <ForexSectionHeader
        eyebrow={item.groupLabel}
        title={item.label}
        description={item.description}
      />
      <h2 id={`fx-page-${item.id}`} className="fx-sr-only">{item.label}</h2>
      <div className="fx-placeholder-panel">
        <div className="fx-module-page-icon" aria-hidden="true">
          <Icon size={28} />
        </div>
        <ForexStatusBadge tone="future">{item.phaseNote}</ForexStatusBadge>
        {item.id === "watchlist" ? (
          <>
            <p>
              Session watchlist lists Binance Spot symbols you selected this browser session.
              Persistence is not implemented. No fabricated prices are stored.
            </p>
            {selectedMarket?.venue === "binance-spot" && liveTicker ? (
              <div data-watchlist-selected-symbol={selectedMarket.symbol}>
                <p className="fx-panel-meta">Active market · {selectedMarket.symbol}</p>
                <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedMarket.symbol} />
              </div>
            ) : (
              <p className="fx-panel-meta" data-watchlist-selected-symbol="">
                Select a Binance Spot symbol from Markets to start live data.
              </p>
            )}
            {watchlist.length === 0 ? (
              <p className="fx-panel-meta">No session symbols yet. Browse Markets and select a Spot pair.</p>
            ) : (
              <ul className="fx-watchlist-rows" data-session-watchlist="true">
                {watchlist.map((entry) => {
                  const active = selectedMarket?.symbol === entry.symbol;
                  return (
                    <li key={entry.symbol}>
                      <span>{entry.symbol}</span>
                      <span>{active && liveTicker?.liveMarketData && liveTicker.ticker?.symbol === entry.symbol
                        ? "LIVE"
                        : active
                          ? "Selected"
                          : "Session"}</span>
                      <button
                        type="button"
                        className="fx-text-button"
                        onClick={() => onSelectMarket?.(entry)}
                      >
                        {active ? "Active" : "Select"}
                      </button>
                      <button
                        type="button"
                        className="fx-text-button"
                        onClick={() => {
                          removeSessionWatchlistSymbol(entry.symbol);
                          setWatchlistTick((value) => value + 1);
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <p>
            This module is reserved in the Forex navigation.
            No broker connections, signals, or trading actions are available here.
          </p>
        )}
      </div>
    </section>
  );
}
