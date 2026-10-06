import type { LucideIcon } from "lucide-react";
import { ForexStatusBadge } from "./ForexStatusBadge";

export function ForexModuleCard({
  title,
  description,
  icon: Icon,
  available,
  statusLabel,
  onOpen,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  available: boolean;
  statusLabel: string;
  onOpen: () => void;
}) {
  return (
    <article className={`fx-module-card ${available ? "" : "is-future"}`}>
      <div className="fx-module-card-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <div className="fx-module-card-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="fx-module-card-footer">
        <ForexStatusBadge tone={available ? "live" : "future"}>{statusLabel}</ForexStatusBadge>
        <button
          type="button"
          className="fx-text-button"
          onClick={onOpen}
        >
          {available ? "Open" : "View placeholder"}
        </button>
      </div>
    </article>
  );
}
