import { formatPrice } from "../../format";
import type { HfmMwSelectedInstrument } from "../types";

export function HfmSelectedInstrumentPanel({
  selected,
}: {
  selected: HfmMwSelectedInstrument | null;
}) {
  if (!selected) {
    return (
      <section className="hfm-mw-side-panel" aria-label="Selected instrument">
        <h2>Selected Instrument</h2>
        <div className="hfm-mw-selected-empty" role="status">
          <strong>No instrument selected</strong>
          <p>
            Selection and quote detail interactions are completed in STEP 3B. No sample symbol is
            pre-selected.
          </p>
        </div>
      </section>
    );
  }

  const mid =
    selected.bid != null && selected.ask != null && Number.isFinite(selected.bid) && Number.isFinite(selected.ask)
      ? (selected.bid + selected.ask) / 2
      : selected.bid ?? selected.ask;

  return (
    <section className="hfm-mw-side-panel" aria-label="Selected instrument">
      <h2>Selected Instrument</h2>
      <div className="hfm-mw-selected-title">
        <strong>{selected.symbol}</strong>
        <em>{selected.description ?? "Description unavailable"}</em>
      </div>
      <div className="hfm-mw-meta-list">
        <div>
          <span>Category</span>
          <strong>{selected.category ?? "—"}</strong>
        </div>
        <div>
          <span>Mid / Last</span>
          <strong>{formatPrice(mid, selected.digits)}</strong>
        </div>
        <div>
          <span>Bid</span>
          <strong>{formatPrice(selected.bid, selected.digits)}</strong>
        </div>
        <div>
          <span>Ask</span>
          <strong>{formatPrice(selected.ask, selected.digits)}</strong>
        </div>
        <div>
          <span>Spread</span>
          <strong>
            {selected.spread != null && Number.isFinite(selected.spread)
              ? formatPrice(selected.spread, selected.digits)
              : "—"}
          </strong>
        </div>
        <div>
          <span>Change</span>
          <strong>
            {selected.change != null && Number.isFinite(selected.change)
              ? formatPrice(selected.change, selected.digits)
              : "Unavailable"}
          </strong>
        </div>
        <div>
          <span>Change %</span>
          <strong>
            {selected.changePercent != null && Number.isFinite(selected.changePercent)
              ? `${selected.changePercent.toFixed(2)}%`
              : "Unavailable"}
          </strong>
        </div>
        <div>
          <span>High</span>
          <strong>
            {selected.high != null ? formatPrice(selected.high, selected.digits) : "Unavailable"}
          </strong>
        </div>
        <div>
          <span>Low</span>
          <strong>
            {selected.low != null ? formatPrice(selected.low, selected.digits) : "Unavailable"}
          </strong>
        </div>
        <div>
          <span>Quote status</span>
          <strong>{selected.quoteStatus ?? "—"}</strong>
        </div>
        <div>
          <span>Subscription</span>
          <strong>{selected.subscriptionStatus ?? "—"}</strong>
        </div>
        <div>
          <span>Metadata</span>
          <strong>
            {selected.metadataCompleteness != null
              ? `${Math.round(selected.metadataCompleteness * 100)}%`
              : "—"}
          </strong>
        </div>
      </div>
      <button type="button" className="hfm-mw-cta" disabled title="Charts interaction ships in STEP 3B">
        Open Chart
      </button>
    </section>
  );
}
