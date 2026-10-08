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
      : selected.venue === "fxcm"
        ? `${selected.displaySymbol} · FXCM HISTORICAL`
        : `${selected.displaySymbol} · not connected`
    : "No Binance market selected";
  return (
    <div className="fx-selected-market" data-selected-market={selected?.symbol ?? ""} data-selected-venue={selected?.venue ?? "none"}>
      <p>
        <span className="fx-eyebrow">Selected market</span>
        <strong>{label}</strong>
      </p>
      {selected?.venue === "binance-spot" ? (
        <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selected.symbol} />
      ) : selected?.venue === "fxcm" ? (
        <p className="fx-panel-meta">
          HISTORICAL · SOURCE: FXCM — not LIVE. Streaming is not enabled in this phase.
          Configure server-side FXCM credentials to load candles.
        </p>
      ) : (
        <p className="fx-panel-meta">
          {selected
            ? "Live market data unavailable. This symbol is not a connected Binance Spot market."
            : "Select a Binance Spot symbol from Markets to start live data."}
        </p>
      )}
      <button type="button" className="fx-text-button" onClick={() => onOpenMarkets("markets")}>
        Browse Binance markets
      </button>
    </div>
  );
}
