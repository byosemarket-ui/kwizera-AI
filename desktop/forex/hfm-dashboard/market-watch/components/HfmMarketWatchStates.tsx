export function HfmMarketWatchLoadingState({ label = "Loading HFM catalog…" }: { label?: string }) {
  return (
    <div className="hfm-mw-state" data-kind="loading" role="status" aria-live="polite">
      <strong>{label}</strong>
      <div className="hfm-mw-skeleton" aria-hidden="true">
        <div className="hfm-mw-skel-line" data-w="lg" />
        <div className="hfm-mw-skel-line" data-w="md" />
        <div className="hfm-mw-skel-line" data-w="sm" />
      </div>
    </div>
  );
}

export function HfmMarketWatchEmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="hfm-mw-state" data-kind="empty" role="status">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function HfmMarketWatchErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: (() => void) | null;
}) {
  return (
    <div className="hfm-mw-state" data-kind="error" role="alert">
      <strong>{title}</strong>
      <p>{detail}</p>
      {onRetry ? (
        <button type="button" className="hfm-mw-retry" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
