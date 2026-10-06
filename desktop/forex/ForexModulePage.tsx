import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { resolveForexIcon } from "./forex-icons";
import type { ForexNavItem } from "./forex-routes";

export function ForexModulePage({ item }: { item: ForexNavItem }) {
  const Icon = resolveForexIcon(item.icon);
  return (
    <section
      className="fx-placeholder fx-module-page"
      data-forex-page={item.id}
      data-forex-placeholder={item.id}
      aria-labelledby={`fx-page-${item.id}`}
    >
      <ForexSectionHeader
        eyebrow={item.groupLabel}
        title={item.label}
        description={item.description}
      />
      <h2 id={`fx-page-${item.id}`} className="fx-sr-only">{item.label}</h2>
      <div className="fx-placeholder-panel">
        <div className="fx-module-page-icon" aria-hidden="true">
          <Icon size={28} />
        </div>
        <ForexStatusBadge tone="future">{item.phaseNote}</ForexStatusBadge>
        <p>
          This module is reserved in the Forex navigation. No live prices, signals, broker
          connections, or trading actions are available in this phase.
        </p>
      </div>
    </section>
  );
}
