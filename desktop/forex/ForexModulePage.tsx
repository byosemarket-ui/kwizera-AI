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
      data-market-symbol={selectedMarket?.venue === "binance-spot" ? selectedMarket.symbol : ""}
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
              Session watchlist is provider-aware (BINANCE + FXCM). Entries never collide across providers.
              Persistence is session-local. No fabricated prices are stored.
            </p>
            {selectedMarket?.venue === "binance-spot" && liveTicker ? (
              <div data-watchlist-selected-symbol={selectedMarket.symbol} data-watchlist-provider="BINANCE">
                <p className="fx-panel-meta">Active market · BINANCE · {selectedMarket.symbol}</p>
                <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedMarket.symbol} />
              </div>
            ) : selectedMarket?.venue === "fxcm" ? (
              <div data-watchlist-selected-symbol={selectedMarket.symbol} data-watchlist-provider="FXCM">
                <p className="fx-panel-meta">Active market · FXCM · {selectedMarket.displaySymbol}</p>
              </div>
            ) : (
              <p className="fx-panel-meta" data-watchlist-selected-symbol="">
                Select a BINANCE or FXCM instrument from Markets.
              </p>
            )}
            {watchlist.length === 0 ? (
              <p className="fx-panel-meta">No session symbols yet. Browse Markets and select an instrument.</p>
            ) : (
              <ul className="fx-watchlist-rows" data-session-watchlist="true">
                {watchlist.map((entry) => {
                  const entryProvider = entry.provider ?? (entry.venue === "fxcm" ? "FXCM" : "BINANCE");
                  const active = selectedMarket?.symbol === entry.symbol
                    && (selectedMarket.provider ?? (selectedMarket.venue === "fxcm" ? "FXCM" : "BINANCE")) === entryProvider;
                  return (
                    <li key={`${entryProvider}:${entry.symbol}`} data-watchlist-provider={entryProvider}>
                      <span>{entryProvider} · {entry.displaySymbol}</span>
                      <span>{active && entryProvider === "BINANCE" && liveTicker?.liveMarketData && liveTicker.ticker?.symbol === entry.symbol
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
                          removeSessionWatchlistSymbol(entry.symbol, entryProvider);
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
