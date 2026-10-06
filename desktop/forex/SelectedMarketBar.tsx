import type { ForexRouteId } from "./forex-routes";
import type { SelectedMarket } from "./market-data/selected-market";

export function SelectedMarketBar({
  selected,
  onOpenMarkets,
}: {
  selected: SelectedMarket | null;
  onOpenMarkets: (id: ForexRouteId) => void;
}) {
  const label = selected
    ? selected.venue === "binance-spot"
      ? `${selected.displaySymbol} · Binance Spot`
      : `${selected.displaySymbol} · development Forex`
    : "No Binance market selected";
  return (
    <div className="fx-selected-market" data-selected-market={selected?.symbol ?? ""} data-selected-venue={selected?.venue ?? "none"}>
      <p>
        <span className="fx-eyebrow">Selected market</span>
        <strong>{label}</strong>
      </p>
      <p className="fx-panel-meta">Live market data will be connected in the next phase.</p>
      <button type="button" className="fx-text-button" onClick={() => onOpenMarkets("markets")}>
        Browse Binance markets
      </button>
    </div>
  );
}
