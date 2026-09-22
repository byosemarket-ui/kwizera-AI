import type { KeyboardEvent, ReactNode } from "react";
import type { CustomerCategory, CustomerService, CustomerServiceStatus } from "../types";
import { resolveCustomerIcon } from "../icons";

export function CustomerPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`cp-page ${className}`.trim()}>{children}</div>;
}

export function ResponsiveContainer({ children }: { children: ReactNode }) {
  return <div className="cp-container">{children}</div>;
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="cp-section-header">
      <div>
        <h2 className="cp-section-title">{title}</h2>
        {description ? <p className="cp-body">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function StatusBadge({ status }: { status: CustomerServiceStatus }) {
  const label = status === "AVAILABLE" ? "Available" : status === "COMING_SOON" ? "Coming soon" : "Unavailable";
  const tone = status === "AVAILABLE" ? "available" : status === "COMING_SOON" ? "coming-soon" : "disabled";
  return <span className={`cp-status ${tone}`}>{label}</span>;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} className="cp-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="cp-button-secondary" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="cp-icon-button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search services…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="cp-search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="cp-empty" role="status">
      <strong className="cp-card-title">{title}</strong>
      {detail ? <p className="cp-body">{detail}</p> : null}
      {action ? <div className="cp-empty-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="cp-loading" role="status" aria-live="polite">
      <span className="cp-sr-only">{label}</span>
      <p className="cp-body">{label}</p>
    </div>
  );
}

export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="cp-error" role="alert">
      <strong className="cp-card-title">{title}</strong>
      {detail ? <p className="cp-body">{detail}</p> : null}
      {onRetry ? <PrimaryButton onClick={onRetry}>Retry</PrimaryButton> : null}
    </div>
  );
}

export function QuickAction({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  return (
    <button type="button" className="cp-quick-action" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

export function ProjectCard({
  title,
  detail,
  updatedAt,
  status,
  thumbnail,
  onOpen,
}: {
  title: string;
  detail?: string;
  updatedAt?: string;
  status?: string;
  thumbnail?: string;
  onOpen?: () => void;
}) {
  return (
    <article className="cp-project-card">
      <div className="cp-project-thumb" aria-hidden={thumbnail ? undefined : true}>
        {thumbnail ? (
          <img src={thumbnail} alt="" />
        ) : (
          <span className="cp-project-thumb-fallback" aria-hidden="true" />
        )}
      </div>
      <div className="cp-project-body">
        <strong className="cp-card-title">{title}</strong>
        {detail ? <p className="cp-body">{detail}</p> : null}
        <div className="cp-project-meta">
          {updatedAt ? <span className="cp-caption">Updated {updatedAt}</span> : null}
          {status ? <span className="cp-caption">{status}</span> : null}
        </div>
      </div>
      <PrimaryButton onClick={onOpen} disabled={!onOpen}>
        Open
      </PrimaryButton>
    </article>
  );
}

function actionLabel(status: CustomerServiceStatus): string {
  if (status === "AVAILABLE") return "Start";
  if (status === "COMING_SOON") return "Coming soon";
  return "Unavailable";
}

export function ServiceCard({
  service,
  onStart,
}: {
  service: CustomerService;
  onStart?: (service: CustomerService) => void;
}) {
  const Icon = resolveCustomerIcon(service.icon);
  const available = service.status === "AVAILABLE" && service.enabled;
  const className = [
    "cp-service-card",
    service.status === "COMING_SOON" ? "is-soon" : "",
    service.status === "DISABLED" ? "is-disabled" : "",
  ].filter(Boolean).join(" ");

  const activate = () => {
    if (available) onStart?.(service);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };

  return (
    <article
      className={className}
      tabIndex={available ? 0 : -1}
      role="button"
      aria-label={`${service.title}. ${actionLabel(service.status)}`}
      aria-disabled={!available}
      data-service-key={service.key}
      data-service-status={service.status}
      onClick={activate}
      onKeyDown={available ? onKeyDown : undefined}
    >
      <span className="cp-service-icon" aria-hidden="true"><Icon size={18} /></span>
      <StatusBadge status={service.status} />
      <h3 className="cp-card-title">{service.title}</h3>
      <p className="cp-body">{service.description}</p>
      <span className="cp-caption">{actionLabel(service.status)}</span>
    </article>
  );
}

export function ServiceCategory({
  category,
  children,
}: {
  category: CustomerCategory;
  children: ReactNode;
}) {
  return (
    <section className="cp-page" data-category={category.key} aria-labelledby={`cp-cat-${category.key}`}>
      <h2 className="cp-section-title" id={`cp-cat-${category.key}`}>{category.title}</h2>
      <p className="cp-body">{category.description}</p>
      {children}
    </section>
  );
}

/** Compact category tile for Home Explore — not a duplicate service card. */
export function CategoryCard({
  category,
  onOpen,
  status = "AVAILABLE",
}: {
  category: CustomerCategory;
  onOpen?: (category: CustomerCategory) => void;
  status?: CustomerServiceStatus;
}) {
  const Icon = resolveCustomerIcon(category.icon);
  const title = category.title === "Design Studio" ? "Design" : category.title;
  const available = status === "AVAILABLE";
  const className = [
    "cp-category-card",
    status === "COMING_SOON" ? "is-soon" : "",
    status === "DISABLED" ? "is-disabled" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={className}
      data-category-key={category.key}
      data-category-status={status}
      aria-label={`Explore ${title}${available ? "" : `. ${status === "COMING_SOON" ? "Coming soon" : "Unavailable"}`}`}
      aria-disabled={!available}
      disabled={!available}
      onClick={() => {
        if (available) onOpen?.(category);
      }}
    >
      <span className="cp-service-icon" aria-hidden="true"><Icon size={18} /></span>
      <StatusBadge status={status} />
      <strong className="cp-card-title">{title}</strong>
      <span className="cp-caption">{category.description}</span>
    </button>
  );
}

export function ServiceGrid({
  services,
  onStart,
  emptyTitle = "No services in this category",
}: {
  services: CustomerService[];
  onStart?: (service: CustomerService) => void;
  emptyTitle?: string;
}) {
  if (services.length === 0) return <EmptyState title={emptyTitle} />;
  return (
    <div className="cp-service-grid" role="list">
      {services.map((service) => (
        <div key={service.key} role="listitem">
          <ServiceCard service={service} onStart={onStart} />
        </div>
      ))}
    </div>
  );
}
