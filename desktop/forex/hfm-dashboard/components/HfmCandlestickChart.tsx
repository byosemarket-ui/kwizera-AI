import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { HfmCandleBar, HfmCandleTf, HfmChartSymbol, HfmFreshness } from "../types";
import { HFM_CANDLE_TFS, HFM_CHART_SYMBOLS } from "../types";
import { freshnessLabel } from "../format";

const BG = "#0a0f1a";
const GRID = "#1f2937";
const MUTED = "#93a0b8";
const BULL = "#34d399";
const BEAR = "#f87171";

export function HfmCandlestickChart(props: {
  symbol: HfmChartSymbol;
  timeframe: HfmCandleTf;
  bars: HfmCandleBar[];
  freshness: HfmFreshness;
  digits?: number | null;
  onSymbolChange: (s: HfmChartSymbol) => void;
  onTimeframeChange: (tf: HfmCandleTf) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      width: host.clientWidth || 640,
      height: host.clientHeight || 280,
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: MUTED,
        fontFamily: "Segoe UI, Manrope, sans-serif",
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID, timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;
    const precision = Math.min(5, Math.max(2, Math.round(props.digits ?? (props.symbol === "XAUUSD" ? 2 : 5))));
    const series = chart.addCandlestickSeries({
      upColor: BULL,
      downColor: BEAR,
      wickUpColor: BULL,
      wickDownColor: BEAR,
      borderVisible: false,
      priceFormat: {
        type: "price",
        precision,
        minMove: Number((10 ** -precision).toFixed(precision)),
      },
    });
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight,
      });
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      seriesRef.current = null;
      try {
        chart.remove();
      } catch {
        /* disposed */
      }
      chartRef.current = null;
    };
    // Recreate only when symbol/digits change precision needs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.symbol, props.digits]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    if (!props.bars.length) {
      series.setData([]);
      return;
    }
    const data = props.bars
      .filter((b) => Number.isFinite(b.time) && b.time > 0)
      .map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));
    series.setData(data);
    chart.timeScale().fitContent();
  }, [props.bars, props.timeframe, props.symbol]);

  return (
    <section className="hfm-card hfm-chart" aria-label="Candlestick chart">
      <h2>
        {props.symbol} · {props.timeframe} · {freshnessLabel(props.freshness)}
      </h2>
      <div className="hfm-chart-toolbar">
        <div className="hfm-seg" role="group" aria-label="Symbol">
          {HFM_CHART_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              data-active={props.symbol === s}
              onClick={() => props.onSymbolChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="hfm-seg" role="group" aria-label="Timeframe">
          {HFM_CANDLE_TFS.map((tf) => (
            <button
              key={tf}
              type="button"
              data-active={props.timeframe === tf}
              onClick={() => props.onTimeframeChange(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="hfm-chart-host" ref={hostRef}>
        {!props.bars.length ? (
          <div className="hfm-chart-empty">
            Candle data unavailable for {props.symbol} {props.timeframe}. Waiting for broker
            CopyRates snapshot — no synthetic candles.
          </div>
        ) : null}
      </div>
    </section>
  );
}
