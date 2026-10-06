import type { LucideIcon } from "lucide-react";
import { ForexStatusBadge } from "./ForexStatusBadge";

export function ForexOverviewCard({
  title,
  description,
  status,
  actionLabel,
  onOpen,
  icon: Icon,
  testId,
}: {
  title: string;
  description: string;
  status: string;
  actionLabel: string;
  onOpen: () => void;
  icon: LucideIcon;
  testId: string;
}) {
  return (
    <article className="fx-overview-card" data-forex-overview={testId}>
      <div className="fx-module-card-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="fx-module-card-footer">
        <ForexStatusBadge tone="offline">{status}</ForexStatusBadge>
        <button type="button" className="fx-text-button" onClick={onOpen}>
          {actionLabel}
        </button>
      </div>
    </article>
  );
}
