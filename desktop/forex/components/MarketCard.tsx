import { ForexStatusBadge } from "./ForexStatusBadge";
import { overviewPriceLabel, type BinanceOverviewEntry } from "../market-data/binance-overview";
import { liveMarketStatusLabel } from "../market-data/live-market-status";
import { quoteStatusLabel } from "../dashboard-data";

export function MarketCard({
  entry,
  onSelect,
}: {
  entry: BinanceOverviewEntry;
  onSelect?: (market: BinanceOverviewEntry["market"]) => void;
}) {
  const { quote, market, active, liveStatus } = entry;
  const connected = quote.status === "ready" && quote.price !== null;
  const price = overviewPriceLabel(quote);
  const statusLabel = connected
    ? "LIVE"
    : active && liveStatus !== "SESSION"
      ? liveMarketStatusLabel(liveStatus)
      : active
        ? quoteStatusLabel(quote.status)
        : "Session";

  return (
    <article
      className={`fx-market-card ${active ? "is-active" : ""}`}
      data-forex-market-card={market.symbol}
      data-forex-display-symbol={market.displaySymbol}
      data-quote-status={quote.status}
      data-overview-active={active ? "true" : "false"}
      data-live-market={connected ? "true" : "false"}
    >
      <header className="fx-market-card-head">
        <h3>{market.displaySymbol}</h3>
        <p>{market.symbol} · Binance Spot</p>
      </header>
      <dl className="fx-market-metrics">
        <div>
          <dt>Price</dt>
          <dd data-forex-quote-price={connected ? "ready" : "unavailable"}>{price}</dd>
        </div>
        <div>
          <dt>Change</dt>
          <dd>—</dd>
        </div>
      </dl>
      <div className="fx-market-card-actions">
        <ForexStatusBadge tone={connected ? "live" : "offline"}>
          {statusLabel}
        </ForexStatusBadge>
        {onSelect ? (
          <button
            type="button"
            className="fx-text-button"
            aria-pressed={active}
            onClick={() => onSelect(market)}
          >
            {active ? "Active" : "Select"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
