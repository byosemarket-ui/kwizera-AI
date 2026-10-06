import { LineChart } from "lucide-react";
import { ForexStatusBadge } from "./ForexStatusBadge";
import type { SelectedMarket } from "../market-data/selected-market";
import type { ChartTimeframeId } from "../chart/types";
import { timeframeLabel } from "../chart/types";
import type { LiveTickerSnapshot } from "../../../ai/market-data/binance/types";
import { LiveTickerPanel } from "../LiveTickerPanel";

export function MarketChartPanel({
  selectedMarket,
  timeframe,
  liveTicker,
  onOpenCharts,
}: {
  selectedMarket?: SelectedMarket | null;
  timeframe?: ChartTimeframeId;
  liveTicker?: LiveTickerSnapshot | null;
  onOpenCharts: () => void;
}) {
  const binance = selectedMarket?.venue === "binance-spot";
  return (
    <section className="fx-chart-panel" data-forex-chart-panel="true" aria-labelledby="fx-chart-title">
      <header className="fx-panel-header">
        <div>
          <p className="fx-eyebrow">Market Chart</p>
          <h2 id="fx-chart-title">{binance ? selectedMarket.displaySymbol : "No Binance market selected"}</h2>
          <p className="fx-panel-meta">
            {binance
              ? `Binance Spot · ${timeframe ? timeframeLabel(timeframe) : "chart"} · open Charts for live OHLCV`
              : "Select a Binance Spot symbol from Markets"}
          </p>
        </div>
        <button type="button" className="fx-text-button" onClick={onOpenCharts}>
          Open Charts
        </button>
      </header>
      <div className="fx-chart-toolbar" aria-label="Chart workspace shortcuts">
        <span className="fx-chart-chip">
          Instrument: {binance ? selectedMarket.symbol : "—"}
        </span>
        <span className="fx-chart-chip">
          Timeframe: {timeframe ? timeframeLabel(timeframe) : "—"}
        </span>
      </div>
      <div className="fx-chart-stage" role="img" aria-label="Open the Charts workspace">
        <LineChart size={28} aria-hidden="true" />
        {binance && liveTicker ? (
          <>
            <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedMarket.symbol} compact />
            <p>Same live ticker as the workspace bar. Candlesticks live in Charts / Technical Analysis.</p>
          </>
        ) : (
          <>
            <p>Live market data unavailable. Select a Binance Spot symbol from Markets, then open Charts.</p>
            <ForexStatusBadge tone="offline">Not connected</ForexStatusBadge>
          </>
        )}
      </div>
    </section>
  );
}
