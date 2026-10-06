import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { ForexNavItem } from "./forex-routes";

export function ForexPlaceholder({ item }: { item: ForexNavItem }) {
  return (
    <section className="fx-placeholder" data-forex-placeholder={item.id} aria-labelledby={`fx-ph-${item.id}`}>
      <ForexSectionHeader
        eyebrow={item.groupLabel}
        title={item.label}
        description={item.description}
      />
      <h2 id={`fx-ph-${item.id}`} className="fx-sr-only">{item.label}</h2>
      <div className="fx-placeholder-panel">
        <ForexStatusBadge tone="future">{item.phaseNote}</ForexStatusBadge>
        <p>
          This module is reserved in the Forex shell so future phases can attach here without
          changing the application architecture. No live prices, signals, or trading actions
          are available in this phase.
        </p>
      </div>
    </section>
  );
}
