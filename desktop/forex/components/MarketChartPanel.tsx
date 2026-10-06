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
      <div className="fx-chart-toolbar" aria-label="Chart controls unavailable">
        <span className="fx-chart-chip">Instrument: {instrument.symbol}</span>
        <span className="fx-chart-chip">Timeframe: not connected</span>
      </div>
      <div className="fx-chart-stage" role="img" aria-label="Chart data not connected">
        <LineChart size={28} aria-hidden="true" />
        <p>Interactive market charts will be connected in a future phase.</p>
        <ForexStatusBadge tone="offline">Chart data not connected</ForexStatusBadge>
      </div>
    </section>
  );
}
