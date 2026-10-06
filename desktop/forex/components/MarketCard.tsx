import { ForexStatusBadge } from "./ForexStatusBadge";
import {
  formatQuoteValue,
  quoteStatusLabel,
  type MarketQuote,
} from "../dashboard-data";

export function MarketCard({ quote }: { quote: MarketQuote }) {
  const price = formatQuoteValue(quote.price, "Not connected");
  const change = formatQuoteValue(quote.change, "—");
  const connected = quote.status === "ready" && quote.price !== null;

  return (
    <article
      className="fx-market-card"
      data-forex-market-card={quote.instrument.symbol}
      data-quote-status={quote.status}
    >
      <header className="fx-market-card-head">
        <h3>{quote.instrument.symbol}</h3>
        <p>{quote.instrument.name}</p>
      </header>
      <dl className="fx-market-metrics">
        <div>
          <dt>Price</dt>
          <dd data-forex-quote-price={connected ? "ready" : "unavailable"}>{price}</dd>
        </div>
        <div>
          <dt>Change</dt>
          <dd>{change}</dd>
        </div>
      </dl>
      <ForexStatusBadge tone={connected ? "live" : "offline"}>
        {quoteStatusLabel(quote.status)}
      </ForexStatusBadge>
    </article>
  );
}
