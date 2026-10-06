import { LineChart } from "lucide-react";
import { ForexStatusBadge } from "./ForexStatusBadge";
import type { ForexInstrument } from "../dashboard-data";

export function MarketChartPanel({
  instrument,
  onOpenCharts,
}: {
  instrument: ForexInstrument;
  onOpenCharts: () => void;
}) {
  return (
    <section className="fx-chart-panel" data-forex-chart-panel="true" aria-labelledby="fx-chart-title">
      <header className="fx-panel-header">
        <div>
          <p className="fx-eyebrow">Market Chart</p>
          <h2 id="fx-chart-title">{instrument.symbol}</h2>
          <p className="fx-panel-meta">{instrument.name}</p>
        </div>
        <button type="button" className="fx-text-button" onClick={onOpenCharts}>
          Open Charts
        </button>
      </header>
      <div className="fx-chart-toolbar" aria-label="Chart workspace shortcuts">
        <span className="fx-chart-chip">Instrument: {instrument.symbol}</span>
        <span className="fx-chart-chip">Open Charts for timeframes and candles</span>
      </div>
      <div className="fx-chart-stage" role="img" aria-label="Open the Charts workspace">
        <LineChart size={28} aria-hidden="true" />
        <p>Interactive candlesticks are available in the Charts workspace. Live market data is not connected.</p>
        <ForexStatusBadge tone="offline">Development chart data · not live</ForexStatusBadge>
      </div>
    </section>
  );
}
