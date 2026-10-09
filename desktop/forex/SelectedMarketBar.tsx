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
        ? `${selected.displaySymbol} · FXCM`
        : `${selected.displaySymbol} · not connected`
    : "No market selected";
  return (
    <div
      className="fx-selected-market"
      data-selected-market={selected?.symbol ?? ""}
      data-selected-venue={selected?.venue ?? "none"}
      data-selected-provider={selected?.provider ?? (selected?.venue === "fxcm" ? "FXCM" : selected?.venue === "binance-spot" ? "BINANCE" : "")}
    >
      <p>
        <span className="fx-eyebrow">Selected market</span>
        <strong>{label}</strong>
      </p>
      {selected?.venue === "binance-spot" ? (
        <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selected.symbol} />
      ) : selected?.venue === "fxcm" ? (
        <p className="fx-panel-meta">
          Provider FXCM · FOREX · mid candles via unified Market Data. LIVE only after authenticated stream + valid quotes.
        </p>
      ) : (
        <p className="fx-panel-meta">
          {selected
            ? "Live market data unavailable for this selection."
            : "Select a BINANCE or FXCM instrument from Markets to start live data."}
        </p>
      )}
      <button type="button" className="fx-text-button" onClick={() => onOpenMarkets("markets")}>
        Browse Markets
      </button>
    </div>
  );
}
