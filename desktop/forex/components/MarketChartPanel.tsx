import { LineChart } from "lucide-react";
import { ForexStatusBadge } from "./ForexStatusBadge";
import type { ForexInstrument } from "../dashboard-data";
import type { SelectedMarket } from "../market-data/selected-market";
import type { LiveTickerSnapshot } from "../../../ai/market-data/binance/types";
import { LiveTickerPanel } from "../LiveTickerPanel";

export function MarketChartPanel({
  instrument,
  selectedMarket,
  liveTicker,
  onOpenCharts,
}: {
  instrument: ForexInstrument;
  selectedMarket?: SelectedMarket | null;
  liveTicker?: LiveTickerSnapshot | null;
  onOpenCharts: () => void;
}) {
  const binance = selectedMarket?.venue === "binance-spot";
  return (
    <section className="fx-chart-panel" data-forex-chart-panel="true" aria-labelledby="fx-chart-title">
      <header className="fx-panel-header">
        <div>
          <p className="fx-eyebrow">Market Chart</p>
          <h2 id="fx-chart-title">{binance ? selectedMarket.displaySymbol : instrument.symbol}</h2>
          <p className="fx-panel-meta">
            {binance ? "Binance Spot · open Charts for live OHLCV" : instrument.name}
          </p>
        </div>
        <button type="button" className="fx-text-button" onClick={onOpenCharts}>
          Open Charts
        </button>
      </header>
      <div className="fx-chart-toolbar" aria-label="Chart workspace shortcuts">
        <span className="fx-chart-chip">
          Instrument: {binance ? selectedMarket.symbol : instrument.symbol}
        </span>
        <span className="fx-chart-chip">Open Charts for timeframes and candles</span>
      </div>
      <div className="fx-chart-stage" role="img" aria-label="Open the Charts workspace">
        <LineChart size={28} aria-hidden="true" />
        {binance && liveTicker ? (
          <>
            <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedMarket.symbol} compact />
            <p>Live price above. Candlesticks and indicators are in the Charts workspace.</p>
          </>
        ) : (
          <>
            <p>Open Charts for candlesticks. Binance Spot symbols use live OHLCV; other pairs use development series.</p>
            <ForexStatusBadge tone="offline">Dashboard preview is not the live chart</ForexStatusBadge>
          </>
        )}
      </div>
    </section>
  );
}
