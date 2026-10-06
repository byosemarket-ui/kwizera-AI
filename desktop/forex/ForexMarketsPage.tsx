import { useMemo, useState } from "react";
import { filterBinanceMarkets } from "../../ai/market-data/binance/adapter";
import type { NormalizedMarket } from "../../ai/market-data/binance/types";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { ForexEmptyState } from "./components/ForexEmptyState";
import { useBinanceMarkets } from "./market-data/use-binance-markets";
import type { SelectedMarket } from "./market-data/selected-market";

const PAGE_SIZE = 50;
const QUOTE_FILTERS = ["ALL", "USDT", "USDC", "BTC", "ETH", "BNB"] as const;

function statusTone(market: NormalizedMarket): "future" | "offline" {
  return market.tradable ? "future" : "offline";
}

export function ForexMarketsPage({
  selected,
  onSelect,
  onOpenCharts,
}: {
  selected: SelectedMarket | null;
  onSelect: (market: SelectedMarket) => void;
  onOpenCharts: () => void;
}) {
  const { result, refresh } = useBinanceMarkets();
  const [query, setQuery] = useState("");
  const [quote, setQuote] = useState<(typeof QUOTE_FILTERS)[number]>("ALL");
  const [tradable, setTradable] = useState<"all" | "trading" | "not-trading">("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () => filterBinanceMarkets(result.markets, {
      query,
      quoteAsset: quote === "ALL" ? "" : quote,
      tradable,
    }),
    [result.markets, query, quote, tradable],
  );

  const page = filtered.slice(0, visible);
  const selectedSymbol = selected?.venue === "binance-spot" ? selected.symbol : null;

  return (
    <section className="fx-markets-page" data-forex-page="markets" data-forex-markets="true">
      <ForexSectionHeader
        eyebrow="Market"
        title="Binance Markets"
        description="Spot market discovery from Binance exchange information. This list is market identity only — it is not a live price board."
      />

      <p className="fx-panel-meta" role="note">
        Market type in this phase: Spot. Open a tradable symbol to stream live prices and candles in Charts.
      </p>

      <div className="fx-markets-toolbar">
        <label className="fx-markets-search">
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="BTC, ETH, SOL, USDT, BTCUSDT"
            aria-label="Search Binance markets"
          />
        </label>
        <label>
          Quote
          <select
            aria-label="Filter by quote asset"
            value={quote}
            onChange={(event) => {
              setQuote(event.target.value as (typeof QUOTE_FILTERS)[number]);
              setVisible(PAGE_SIZE);
            }}
          >
            {QUOTE_FILTERS.map((item) => (
              <option key={item} value={item}>{item === "ALL" ? "All quotes" : item}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Filter by market status"
            value={tradable}
            onChange={(event) => {
              setTradable(event.target.value as "all" | "trading" | "not-trading");
              setVisible(PAGE_SIZE);
            }}
          >
            <option value="all">All statuses</option>
            <option value="trading">Trading</option>
            <option value="not-trading">Not trading</option>
          </select>
        </label>
        <button type="button" className="fx-text-button" onClick={refresh}>Refresh</button>
      </div>

      {result.state === "loading" ? (
        <p className="fx-page-desc" role="status">Loading Binance markets...</p>
      ) : null}
      {result.state === "disconnected" ? (
        <ForexEmptyState title="Binance market service unavailable." description={result.message} actionLabel="Retry" onAction={refresh} />
      ) : null}
      {result.state === "error" ? (
        <ForexEmptyState title="Unable to load Binance markets." description={result.message} actionLabel="Retry" onAction={refresh} />
      ) : null}
      {result.state === "empty" ? (
        <ForexEmptyState title="No Binance markets available." description="Binance returned no Spot symbols." actionLabel="Retry" onAction={refresh} />
      ) : null}
      {result.state === "ready" && filtered.length === 0 ? (
        <ForexEmptyState title="No markets match your search." description="Try another symbol, base asset, or quote filter." />
      ) : null}

      {result.state === "ready" && page.length > 0 ? (
        <>
          <p className="fx-panel-meta">
            Showing {page.length} of {filtered.length} Spot markets
            {result.restBaseHost ? ` · ${result.restBaseHost}` : ""} · no live prices
          </p>
          <div className="fx-markets-table-wrap">
            <table className="fx-markets-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Base</th>
                  <th>Quote</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {page.map((market) => {
                  const active = market.symbol === selectedSymbol;
                  return (
                    <tr key={market.symbol} data-selected={active ? "true" : "false"}>
                      <td>
                        <strong>{market.symbol}</strong>
                        <span className="fx-panel-meta"> {market.displaySymbol}</span>
                      </td>
                      <td>{market.baseAsset}</td>
                      <td>{market.quoteAsset}</td>
                      <td>Spot</td>
                      <td>
                        <ForexStatusBadge tone={statusTone(market)}>
                          {market.status}
                        </ForexStatusBadge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="fx-text-button"
                          aria-pressed={active}
                          onClick={() => onSelect({
                            venue: "binance-spot",
                            symbol: market.symbol,
                            displaySymbol: market.displaySymbol,
                          })}
                        >
                          {active ? "Selected" : "Select"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visible < filtered.length ? (
            <button type="button" className="fx-text-button" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Show more markets
            </button>
          ) : null}
          {selectedSymbol ? (
            <p className="fx-panel-meta">
              Selected {selectedSymbol}.{" "}
              <button type="button" className="fx-text-button" onClick={onOpenCharts}>Open Charts</button>
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
