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
        : selected.venue === "forexconnect"
          ? `${selected.displaySymbol} · ForexConnect`
          : `${selected.displaySymbol} · not connected`
    : "No market selected";
  const providerLabel = selected?.provider
    ?? (selected?.venue === "fxcm"
      ? "FXCM"
      : selected?.venue === "forexconnect"
        ? "FOREXCONNECT"
        : selected?.venue === "binance-spot"
          ? "BINANCE"
          : "");
  return (
    <div
      className="fx-selected-market"
      data-selected-market={selected?.symbol ?? ""}
      data-selected-venue={selected?.venue ?? "none"}
      data-selected-provider={providerLabel}
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
      ) : selected?.venue === "forexconnect" ? (
        <p className="fx-panel-meta">
          Provider FOREXCONNECT · FOREX · bid OHLC via unified Market Data. LIVE only after Offers quote events.
        </p>
      ) : (
        <p className="fx-panel-meta">
          {selected
            ? "Live market data unavailable for this selection."
            : "Select a BINANCE, FXCM, or ForexConnect instrument from Markets to start live data."}
        </p>
      )}
      <button type="button" className="fx-text-button" onClick={() => onOpenMarkets("markets")}>
        Browse Markets
      </button>
    </div>
  );
}
