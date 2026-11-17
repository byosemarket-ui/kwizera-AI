import type { HfmMwQuoteStatusCounts } from "../sse-quote-bridge";

export function HfmQuoteStatusStrip({
  catalogTotal,
  counts,
  ready,
}: {
  catalogTotal: number | null;
  counts: HfmMwQuoteStatusCounts;
  ready: boolean;
}) {
  if (!ready) return null;
  return (
    <div className="hfm-mw-status-strip" role="status" aria-label="HFM quote and subscription counts">
      <span>
        Catalog <strong>{catalogTotal != null ? catalogTotal.toLocaleString("en-US") : "—"}</strong>
      </span>
      <span>
        Subscribed <strong>{counts.activeSubscriptions}</strong>
      </span>
      <span data-tone="live">
        LIVE <strong>{counts.live}</strong>
      </span>
      <span data-tone="stale">
        STALE <strong>{counts.stale}</strong>
      </span>
      <span>
        MARKET_CLOSED <strong>{counts.marketClosed}</strong>
      </span>
      <span>
        NO_QUOTE <strong>{counts.noQuote}</strong>
      </span>
      <span>
        INVALID <strong>{counts.invalid}</strong>
      </span>
      <span>
        Unquoted <strong>{counts.unquoted}</strong>
      </span>
    </div>
  );
}
