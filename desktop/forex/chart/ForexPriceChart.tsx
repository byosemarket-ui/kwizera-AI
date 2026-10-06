import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, ChartTypeId, HistogramPoint, LinePoint, PriceLevel } from "./types";

const BG = "#0a0e14";
const GRID = "#262b33";
const MUTED = "#8a94a0";
const BULL = "#b9f2cc";
const BEAR = "#e08b8b";

export interface OverlaySeries {
  id: string;
  color: string;
  points: LinePoint[];
}

export interface ForexPriceChartHandle {
  fitContent: () => void;
  zoom: (direction: 1 | -1) => void;
}

interface ForexPriceChartProps {
  candles: Candle[];
  chartType: ChartTypeId;
  overlays: OverlaySeries[];
  rsi: LinePoint[];
  macd: { macd: LinePoint[]; signal: LinePoint[]; histogram: HistogramPoint[] } | null;
  levels: PriceLevel[];
  onCandleFocus: (candle: Candle | null) => void;
}

function asTime(time: number): UTCTimestamp {
  return time as UTCTimestamp;
}

function chartOptions(height: number) {
  return {
    height,
    layout: { background: { type: ColorType.Solid, color: BG }, textColor: MUTED, fontFamily: "Manrope, Segoe UI, sans-serif" },
    grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: GRID },
    timeScale: { borderColor: GRID, timeVisible: true, secondsVisible: false },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
  };
}

function setLine(series: ISeriesApi<"Line">, points: LinePoint[]): void {
  series.setData(points.map((item) => ({ time: asTime(item.time), value: item.value })));
}

export const ForexPriceChart = forwardRef<ForexPriceChartHandle, ForexPriceChartProps>(function ForexPriceChart(
  { candles, chartType, overlays, rsi, macd, levels, onCandleFocus },
  ref,
) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const mainApi = useRef<IChartApi | null>(null);

  useImperativeHandle(ref, () => ({
    fitContent: () => {
      mainApi.current?.timeScale().fitContent();
    },
    zoom: (direction) => {
      const scale = mainApi.current?.timeScale();
      if (!scale) return;
      const spacing = scale.options().barSpacing ?? 8;
      scale.applyOptions({ barSpacing: Math.min(36, Math.max(3, spacing + direction * 2)) });
    },
  }));

  useEffect(() => {
    const host = mainRef.current;
    if (!host) return;
    const width = host.clientWidth || 640;
    const main = createChart(host, { width, ...chartOptions(rsi.length || macd ? 380 : 440) });
    mainApi.current = main;
    const candleSeries = main.addCandlestickSeries({
      upColor: BULL,
      downColor: BEAR,
      wickUpColor: BULL,
      wickDownColor: BEAR,
      borderVisible: false,
    });
    const closeSeries = main.addLineSeries({ color: BULL, lineWidth: 2 });
    candleSeries.setData(chartType === "candlestick"
      ? candles.map((item) => ({ time: asTime(item.time), open: item.open, high: item.high, low: item.low, close: item.close }))
      : []);
    closeSeries.setData(chartType === "line"
      ? candles.map((item) => ({ time: asTime(item.time), value: item.close }))
      : []);
    candleSeries.applyOptions({ visible: chartType === "candlestick" });
    closeSeries.applyOptions({ visible: chartType === "line" });

    for (const overlay of overlays) {
      setLine(main.addLineSeries({ color: overlay.color, lineWidth: 2, title: overlay.id }), overlay.points);
    }

    const priceHost = chartType === "candlestick" ? candleSeries : closeSeries;
    for (const level of levels) {
      priceHost.createPriceLine({
        price: level.price,
        color: level.kind === "support" ? BULL : BEAR,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        title: level.kind === "support" ? "Support" : "Resistance",
        axisLabelVisible: true,
      });
    }

    const byTime = new Map(candles.map((item) => [item.time, item]));
    main.subscribeCrosshairMove((param) => {
      const time = typeof param.time === "number" ? param.time : null;
      onCandleFocus(time ? byTime.get(time) ?? null : candles[candles.length - 1] ?? null);
    });
    main.timeScale().fitContent();

    let rsiChart: IChartApi | undefined;
    if (rsi.length && rsiRef.current) {
      rsiChart = createChart(rsiRef.current, { width, ...chartOptions(120) });
      const rsiSeries = rsiChart.addLineSeries({ color: "#d7c38a", lineWidth: 2 });
      setLine(rsiSeries, rsi);
      rsiSeries.createPriceLine({ price: 70, color: BEAR, lineStyle: LineStyle.Dotted, title: "Overbought" });
      rsiSeries.createPriceLine({ price: 30, color: BULL, lineStyle: LineStyle.Dotted, title: "Oversold" });
    }

    let macdChart: IChartApi | undefined;
    if (macd && macdRef.current) {
      macdChart = createChart(macdRef.current, { width, ...chartOptions(130) });
      macdChart.addHistogramSeries({ color: MUTED }).setData(macd.histogram.map((item) => ({
        time: asTime(item.time),
        value: item.value,
        color: item.value >= 0 ? BULL : BEAR,
      })));
      setLine(macdChart.addLineSeries({ color: BULL, lineWidth: 2 }), macd.macd);
      setLine(macdChart.addLineSeries({ color: "#9db7e8", lineWidth: 2 }), macd.signal);
    }

    const sync = () => {
      const range = main.timeScale().getVisibleLogicalRange();
      if (!range) return;
      rsiChart?.timeScale().setVisibleLogicalRange(range);
      macdChart?.timeScale().setVisibleLogicalRange(range);
    };
    main.timeScale().subscribeVisibleLogicalRangeChange(sync);
    const observer = new ResizeObserver(() => {
      const nextWidth = host.clientWidth;
      main.applyOptions({ width: nextWidth });
      rsiChart?.applyOptions({ width: nextWidth });
      macdChart?.applyOptions({ width: nextWidth });
    });
    observer.observe(host);
    onCandleFocus(candles[candles.length - 1] ?? null);

    return () => {
      observer.disconnect();
      mainApi.current = null;
      main.remove();
      rsiChart?.remove();
      macdChart?.remove();
    };
  }, [candles, chartType, overlays, rsi, macd, levels, onCandleFocus]);

  return (
    <div className="fx-price-charts">
      <div ref={mainRef} className="fx-price-chart-main" data-forex-price-chart="true" />
      {rsi.length ? (
        <div className="fx-indicator-pane">
          <p className="fx-pane-label">RSI · Overbought 70 · Oversold 30</p>
          <div ref={rsiRef} />
        </div>
      ) : null}
      {macd ? (
        <div className="fx-indicator-pane">
          <p className="fx-pane-label">MACD</p>
          <div ref={macdRef} />
        </div>
      ) : null}
    </div>
  );
});
