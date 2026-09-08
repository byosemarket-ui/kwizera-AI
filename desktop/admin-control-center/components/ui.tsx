import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; onClick?: () => void }>;
}) {
  return (
    <header className="acc-page-header">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="acc-breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="acc-breadcrumb-item">
              {index > 0 && <span className="acc-breadcrumb-sep" aria-hidden>/</span>}
              {crumb.onClick ? (
                <button type="button" className="acc-link-button" onClick={crumb.onClick}>{crumb.label}</button>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="acc-page-header-row">
        <div>
          <h1 className="acc-page-title">{title}</h1>
          {description ? <p className="acc-page-desc">{description}</p> : null}
        </div>
        {actions ? <div className="acc-page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <article className="acc-stat-card">
      <span className="acc-stat-label">{label}</span>
      <strong className="acc-stat-value">{value}</strong>
      {hint ? <span className="acc-stat-hint">{hint}</span> : null}
    </article>
  );
}

export function SectionCard({ title, description, actions, children }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="acc-section-card">
      <div className="acc-section-card-head">
        <div>
          <h2 className="acc-section-title">{title}</h2>
          {description ? <p className="acc-section-desc">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="acc-section-card-body">{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = /healthy|active|online|ok|enabled|succeeded|operational/i.test(status)
    ? "ok"
    : /degraded|warning|inactive|unchecked|pending/i.test(status)
      ? "warn"
      : /error|unhealthy|failed|denied|offline/i.test(status)
        ? "bad"
        : "neutral";
  return <span className={`acc-status-badge tone-${tone}`}>{status}</span>;
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="acc-empty-state" role="status">
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="acc-loading-state" role="status" aria-live="polite">
      <div className="acc-skeleton-block" />
      <div className="acc-skeleton-block short" />
      <span className="acc-sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="acc-error-state" role="alert">
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
      {onRetry ? <button type="button" className="acc-button" onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="acc-search-input">
      <span className="acc-sr-only">Search</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="acc-filter-bar">{children}</div>;
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="acc-form-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`acc-toggle ${disabled ? "disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="acc-toggle-track" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="acc-form-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="acc-pagination">
      <button type="button" className="acc-button ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span>Page {page} of {pages} · {total} total</span>
      <button type="button" className="acc-button ghost" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="acc-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`acc-tab ${active === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyTitle = "No records",
}: {
  columns: Array<{ key: string; label: string; className?: string }>;
  rows: Array<{ id: string; cells: Record<string, ReactNode> }>;
  emptyTitle?: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} />;
  return (
    <div className="acc-table-wrap">
      <table className="acc-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key} className={column.className} data-label={column.label}>
                  {row.cells[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="acc-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="acc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acc-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="acc-modal-head">
          <h2 id="acc-modal-title">{title}</h2>
          <button type="button" className="acc-icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="acc-modal-body">{children}</div>
        {footer ? <div className="acc-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="acc-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="acc-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="acc-drawer-head">
          <h2>{title}</h2>
          <button type="button" className="acc-icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="acc-drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="acc-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div className="acc-modal compact" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{detail}</p>
        <div className="acc-modal-footer">
          <button type="button" className="acc-button ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="acc-button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message, tone = "info" }: { message: string | null; tone?: "info" | "success" | "error" }) {
  if (!message) return null;
  return <div className={`acc-toast tone-${tone}`} role="status">{message}</div>;
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <EmptyState
      title={`${title} — coming soon`}
      detail="This Admin section is reserved in the control plane navigation. It is not implemented in Stage 1."
    />
  );
}
