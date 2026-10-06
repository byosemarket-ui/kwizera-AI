export function ForexEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="fx-empty-state" role="status">
      <p className="fx-empty-title">{title}</p>
      <p className="fx-empty-desc">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="fx-text-button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
