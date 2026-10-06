import type { ForexRouteId } from "./forex-routes";
import type { SelectedMarket } from "./market-data/selected-market";
import type { LiveTickerSnapshot } from "../../ai/market-data/binance/types";
import { LiveTickerPanel } from "./LiveTickerPanel";

export function SelectedMarketBar({
  selected,
  onOpenMarkets,
  liveTicker,
}: {
  selected: SelectedMarket | null;
  onOpenMarkets: (id: ForexRouteId) => void;
  liveTicker: LiveTickerSnapshot;
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
      {selected?.venue === "binance-spot" ? (
        <LiveTickerPanel snapshot={liveTicker} />
      ) : (
        <p className="fx-panel-meta">
          {selected
            ? "Development Forex pairs do not use the Binance live stream."
            : "Select a Binance Spot symbol from Markets to start live data."}
        </p>
      )}
      <button type="button" className="fx-text-button" onClick={() => onOpenMarkets("markets")}>
        Browse Binance markets
      </button>
    </div>
  );
}
