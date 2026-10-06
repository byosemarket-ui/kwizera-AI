import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { resolveForexIcon } from "./forex-icons";
import type { ForexNavItem } from "./forex-routes";
import type { SelectedMarket } from "./market-data/selected-market";

export function ForexModulePage({
  item,
  selectedMarket,
}: {
  item: ForexNavItem;
  selectedMarket?: SelectedMarket | null;
}) {
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
          This module is reserved in the Forex navigation. Live market data is not connected.
          No broker connections, signals, or trading actions are available here.
        </p>
        {item.id === "watchlist" ? (
          <p className="fx-panel-meta" data-watchlist-selected-symbol={selectedMarket?.symbol ?? ""}>
            {selectedMarket?.venue === "binance-spot"
              ? `Selected Binance Spot symbol ${selectedMarket.symbol} is compatible with a future watchlist. Persistence is not implemented yet.`
              : "Select a Binance Spot symbol from Markets to prepare it for a future watchlist. No fabricated prices are stored."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
