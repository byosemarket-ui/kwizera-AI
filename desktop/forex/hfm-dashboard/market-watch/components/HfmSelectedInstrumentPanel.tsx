import { formatPrice } from "../../format";
import type { HfmCatalogInstrument } from "../../../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmCanonicalQuote } from "../../../../../ai/market-data/mt5-hfm/quote-types";
import type { HfmSubscriptionRecord } from "../../../../../ai/market-data/mt5-hfm/subscription-types";
import type { HfmMwWatchlist } from "../watchlists-store";

export function HfmSelectedInstrumentPanel({
  symbol,
  instrument,
  quote,
  subscription,
  favorite,
  watchlists,
  activeWatchlistId,
  busy,
  actionMessage,
  onToggleFavorite,
  onSubscribe,
  onUnsubscribe,
  onPause,
  onResume,
  onAddToWatchlist,
  onCreateWatchlist,
}: {
  symbol: string | null;
  instrument: HfmCatalogInstrument | null;
  quote: HfmCanonicalQuote | null;
  subscription: HfmSubscriptionRecord | null;
  favorite: boolean;
  watchlists: HfmMwWatchlist[];
  activeWatchlistId: string | null;
  busy: boolean;
  actionMessage: string | null;
  onToggleFavorite: () => void;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  onPause: () => void;
  onResume: () => void;
  onAddToWatchlist: (watchlistId: string) => void;
  onCreateWatchlist: () => void;
}) {
  if (!symbol) {
    return (
      <section className="hfm-mw-side-panel" aria-label="Selected instrument">
        <h2>Selected Instrument</h2>
        <div className="hfm-mw-selected-empty" role="status">
          <strong>No instrument selected</strong>
          <p>Select a row in the HFM instruments table. No sample symbol is pre-selected.</p>
        </div>
      </section>
    );
  }

  if (!instrument) {
    return (
      <section className="hfm-mw-side-panel" aria-label="Selected instrument">
        <h2>Selected Instrument</h2>
        <div className="hfm-mw-selected-empty" role="status">
          <strong>{symbol}</strong>
          <p>Instrument metadata unavailable or not found in the HFM catalog.</p>
        </div>
      </section>
    );
  }

  const digits = quote?.digits ?? instrument.digits;
  const mid =
    quote?.bid != null &&
    quote?.ask != null &&
    Number.isFinite(quote.bid) &&
    Number.isFinite(quote.ask)
      ? (quote.bid + quote.ask) / 2
      : quote?.last ?? quote?.bid ?? quote?.ask ?? null;

  return (
    <section className="hfm-mw-side-panel" aria-label="Selected instrument">
      <h2>Selected Instrument</h2>
      <div className="hfm-mw-selected-title">
        <strong>{instrument.symbol}</strong>
        <em>{instrument.description ?? "Description unavailable"}</em>
      </div>

      <div className="hfm-mw-selected-actions">
        <button type="button" className="hfm-mw-retry" onClick={onToggleFavorite} disabled={busy}>
          {favorite ? "★ Favorited" : "☆ Favorite"}
        </button>
        <button type="button" className="hfm-mw-retry" onClick={onSubscribe} disabled={busy}>
          Subscribe
        </button>
        <button type="button" className="hfm-mw-retry" onClick={onUnsubscribe} disabled={busy}>
          Unsubscribe
        </button>
        <button type="button" className="hfm-mw-retry" onClick={onPause} disabled={busy}>
          Pause
        </button>
        <button type="button" className="hfm-mw-retry" onClick={onResume} disabled={busy}>
          Resume
        </button>
      </div>

      <div className="hfm-mw-watchlist-box">
        <label>
          <span>Add to watchlist</span>
          <select
            value={activeWatchlistId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id) onAddToWatchlist(id);
            }}
            disabled={busy || watchlists.length === 0}
            aria-label="Add selected symbol to watchlist"
          >
            <option value="">{watchlists.length ? "Choose watchlist…" : "No watchlists yet"}</option>
            {watchlists.map((wl) => (
              <option key={wl.id} value={wl.id}>
                {wl.name} ({wl.symbols.length})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="hfm-mw-retry" onClick={onCreateWatchlist} disabled={busy}>
          New watchlist
        </button>
      </div>

      {actionMessage ? (
        <p className="hfm-mw-tool-note" role="status">
          {actionMessage}
        </p>
      ) : null}

      <div className="hfm-mw-meta-list">
        <div>
          <span>Provider</span>
          <strong>
            {instrument.provider} · {instrument.environment}
          </strong>
        </div>
        <div>
          <span>Category</span>
          <strong>{instrument.classification?.category ?? "—"}</strong>
        </div>
        <div>
          <span>Subcategory</span>
          <strong>{instrument.classification?.subcategory ?? "—"}</strong>
        </div>
        <div>
          <span>Mid / Last</span>
          <strong>{formatPrice(mid, digits)}</strong>
        </div>
        <div>
          <span>Bid</span>
          <strong>{formatPrice(quote?.bid ?? null, digits)}</strong>
        </div>
        <div>
          <span>Ask</span>
          <strong>{formatPrice(quote?.ask ?? null, digits)}</strong>
        </div>
        <div>
          <span>Spread</span>
          <strong>
            {quote?.spread != null && Number.isFinite(quote.spread)
              ? formatPrice(quote.spread, digits)
              : "—"}
          </strong>
        </div>
        <div>
          <span>Spread pts</span>
          <strong>
            {quote?.spreadPoints != null && Number.isFinite(quote.spreadPoints)
              ? quote.spreadPoints.toFixed(1)
              : "—"}
          </strong>
        </div>
        <div>
          <span>Change</span>
          <strong>Unavailable</strong>
        </div>
        <div>
          <span>Change %</span>
          <strong>Unavailable</strong>
        </div>
        <div>
          <span>High</span>
          <strong>Unavailable</strong>
        </div>
        <div>
          <span>Low</span>
          <strong>Unavailable</strong>
        </div>
        <div>
          <span>Quote status</span>
          <strong>{quote?.status ?? "NO_QUOTE"}</strong>
        </div>
        <div>
          <span>Quote time</span>
          <strong>
            {quote?.quoteTimestamp
              ? new Date(
                  (quote.quoteTimestampMs ?? quote.quoteTimestamp * 1000) as number,
                ).toISOString()
              : "—"}
          </strong>
        </div>
        <div>
          <span>Subscription</span>
          <strong>{subscription?.status ?? "UNSUBSCRIBED"}</strong>
        </div>
        <div>
          <span>Digits</span>
          <strong>{instrument.digits ?? "—"}</strong>
        </div>
        <div>
          <span>Point</span>
          <strong>{instrument.point ?? "—"}</strong>
        </div>
        <div>
          <span>Tick size</span>
          <strong>{instrument.tickSize ?? "—"}</strong>
        </div>
        <div>
          <span>Contract size</span>
          <strong>{instrument.contractSize ?? "—"}</strong>
        </div>
        <div>
          <span>Base / Profit / Margin</span>
          <strong>
            {instrument.currencyBase ?? "—"} / {instrument.currencyProfit ?? "—"} /{" "}
            {instrument.currencyMargin ?? "—"}
          </strong>
        </div>
        <div>
          <span>Volume min/max/step</span>
          <strong>
            {instrument.volumeMin ?? "—"} / {instrument.volumeMax ?? "—"} / {instrument.volumeStep ?? "—"}
          </strong>
        </div>
        <div>
          <span>Trade / calc mode</span>
          <strong>
            {instrument.tradeMode ?? "—"} / {instrument.tradeCalcMode ?? "—"}
          </strong>
        </div>
        <div>
          <span>Metadata</span>
          <strong>
            {instrument.metadataCompleteness != null
              ? `${Math.round(instrument.metadataCompleteness * 100)}%`
              : "—"}
          </strong>
        </div>
      </div>

      <button
        type="button"
        className="hfm-mw-cta"
        disabled
        title="Chart handoff remains informational — read-only Market Watch"
      >
        Open Chart
      </button>
    </section>
  );
}
