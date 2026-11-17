import {
  HFM_MW_SORT_OPTIONS,
  type HfmMwQuoteStatusFilter,
  type HfmMwSortId,
  type HfmMwSubscriptionFilter,
} from "../instrument-query";

export function HfmMarketToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  quoteStatus,
  onQuoteStatusChange,
  subscription,
  onSubscriptionChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  pageSize,
  onPageSizeChange,
  resultCount,
  onClearFilters,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  sort: HfmMwSortId;
  onSortChange: (v: HfmMwSortId) => void;
  quoteStatus: HfmMwQuoteStatusFilter;
  onQuoteStatusChange: (v: HfmMwQuoteStatusFilter) => void;
  subscription: HfmMwSubscriptionFilter;
  onSubscriptionChange: (v: HfmMwSubscriptionFilter) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (v: boolean) => void;
  pageSize: number;
  onPageSizeChange: (v: number) => void;
  resultCount: number;
  onClearFilters: () => void;
}) {
  return (
    <div className="hfm-mw-tools hfm-mw-tools-3b">
      <label className="hfm-mw-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search symbol, description, currency…"
          aria-label="Search HFM instruments"
        />
        {search ? (
          <button
            type="button"
            className="hfm-mw-clear-search"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
          >
            ×
          </button>
        ) : null}
      </label>

      <label className="hfm-mw-select">
        <span className="hfm-sr-only">Sort</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as HfmMwSortId)}
          aria-label="Sort instruments"
        >
          {HFM_MW_SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="hfm-mw-select">
        <span className="hfm-sr-only">Quote status filter</span>
        <select
          value={quoteStatus}
          onChange={(e) => onQuoteStatusChange(e.target.value as HfmMwQuoteStatusFilter)}
          aria-label="Filter by quote status"
        >
          <option value="ALL">All quote statuses</option>
          <option value="LIVE">LIVE</option>
          <option value="STALE">STALE</option>
          <option value="MARKET_CLOSED">MARKET_CLOSED</option>
          <option value="NO_QUOTE">NO_QUOTE</option>
          <option value="UNQUOTED">No quote row</option>
          <option value="INVALID">INVALID</option>
          <option value="INCOMPLETE">INCOMPLETE</option>
          <option value="DELAYED">DELAYED</option>
          <option value="ERROR">ERROR</option>
        </select>
      </label>

      <label className="hfm-mw-select">
        <span className="hfm-sr-only">Subscription filter</span>
        <select
          value={subscription}
          onChange={(e) => onSubscriptionChange(e.target.value as HfmMwSubscriptionFilter)}
          aria-label="Filter by subscription status"
        >
          <option value="ALL">All subscriptions</option>
          <option value="SUBSCRIBED">Subscribed</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PAUSED">PAUSED</option>
          <option value="FAILED">FAILED</option>
          <option value="RECOVERING">RECOVERING</option>
          <option value="PENDING">PENDING</option>
        </select>
      </label>

      <label className="hfm-mw-check">
        <input
          type="checkbox"
          checked={favoritesOnly}
          onChange={(e) => onFavoritesOnlyChange(e.target.checked)}
        />
        Favorites
      </label>

      <label className="hfm-mw-select">
        <span className="hfm-sr-only">Page size</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Page size"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="hfm-mw-retry" onClick={onClearFilters}>
        Clear filters
      </button>

      <p className="hfm-mw-tool-note" role="status">
        {resultCount.toLocaleString("en-US")} matching HFM instruments
      </p>
    </div>
  );
}

export function HfmMarketPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="hfm-mw-pager" role="navigation" aria-label="Instrument pages">
      <span>
        Showing {start.toLocaleString("en-US")} – {end.toLocaleString("en-US")} of{" "}
        {total.toLocaleString("en-US")}
      </span>
      <div className="hfm-mw-pager-btns">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label="First page">
          «
        </button>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span aria-live="polite">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
