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
  seriesKey?: string;
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
  { seriesKey = "", candles, chartType, overlays, rsi, macd, levels, onCandleFocus },
  ref,
) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const mainApi = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const closeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lastMeta = useRef<{ key: string; time: number; length: number } | null>(null);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const onFocusRef = useRef(onCandleFocus);
  onFocusRef.current = onCandleFocus;
  const showRsi = rsi.length > 0;
  const showMacd = Boolean(macd);

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
    const main = createChart(host, { width, ...chartOptions(showRsi || showMacd ? 380 : 440) });
    mainApi.current = main;
    const candleSeries = main.addCandlestickSeries({
      upColor: BULL,
      downColor: BEAR,
      wickUpColor: BULL,
      wickDownColor: BEAR,
      borderVisible: false,
    });
    const closeSeries = main.addLineSeries({ color: BULL, lineWidth: 2 });
    candleSeriesRef.current = candleSeries;
    closeSeriesRef.current = closeSeries;
    candleSeries.applyOptions({ visible: chartType === "candlestick" });
    closeSeries.applyOptions({ visible: chartType === "line" });
    lastMeta.current = null;

    main.subscribeCrosshairMove((param) => {
      const latest = candlesRef.current;
      const time = typeof param.time === "number" ? param.time : null;
      const match = time ? latest.find((item) => item.time === time) : latest[latest.length - 1];
      onFocusRef.current(match ?? null);
    });

    const observer = new ResizeObserver(() => {
      const nextWidth = host.clientWidth;
      main.applyOptions({ width: nextWidth });
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      mainApi.current = null;
      candleSeriesRef.current = null;
      closeSeriesRef.current = null;
      main.remove();
    };
  }, [chartType, showRsi, showMacd, seriesKey]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const closeSeries = closeSeriesRef.current;
    if (!candleSeries || !closeSeries) return;
    const last = candles[candles.length - 1];
    const prev = lastMeta.current;
    const canUpdate = Boolean(
      last
      && prev
      && prev.key === seriesKey
      && (prev.length === candles.length || prev.length + 1 === candles.length)
      && last.time >= prev.time,
    );
    if (canUpdate && last) {
      if (chartType === "candlestick") {
        candleSeries.update({ time: asTime(last.time), open: last.open, high: last.high, low: last.low, close: last.close });
      } else {
        closeSeries.update({ time: asTime(last.time), value: last.close });
      }
    } else {
      candleSeries.setData(chartType === "candlestick"
        ? candles.map((item) => ({ time: asTime(item.time), open: item.open, high: item.high, low: item.low, close: item.close }))
        : []);
      closeSeries.setData(chartType === "line"
        ? candles.map((item) => ({ time: asTime(item.time), value: item.close }))
        : []);
      mainApi.current?.timeScale().fitContent();
    }
    lastMeta.current = { key: seriesKey, time: last?.time ?? 0, length: candles.length };
    onFocusRef.current(last ?? null);
  }, [candles, chartType, seriesKey]);

  useEffect(() => {
    const main = mainApi.current;
    if (!main) return;
    const overlaySeries: ISeriesApi<"Line">[] = [];
    for (const overlay of overlays) {
      const series = main.addLineSeries({ color: overlay.color, lineWidth: 2, title: overlay.id });
      setLine(series, overlay.points);
      overlaySeries.push(series);
    }
    const priceHost = chartType === "candlestick" ? candleSeriesRef.current : closeSeriesRef.current;
    const created = levels.map((level) => priceHost?.createPriceLine({
      price: level.price,
      color: level.kind === "support" ? BULL : BEAR,
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      title: level.kind === "support" ? "Support" : "Resistance",
      axisLabelVisible: true,
    }));
    return () => {
      for (const series of overlaySeries) main.removeSeries(series);
      for (const line of created) {
        if (line && priceHost) priceHost.removePriceLine(line);
      }
    };
  }, [overlays, levels, chartType, seriesKey]);

  useEffect(() => {
    const host = rsiRef.current;
    if (!host || !rsi.length) return;
    const width = host.clientWidth || mainRef.current?.clientWidth || 640;
    const chart = createChart(host, { width, ...chartOptions(120) });
    const rsiSeries = chart.addLineSeries({ color: "#d7c38a", lineWidth: 2 });
    setLine(rsiSeries, rsi);
    rsiSeries.createPriceLine({ price: 70, color: BEAR, lineStyle: LineStyle.Dotted, title: "Overbought" });
    rsiSeries.createPriceLine({ price: 30, color: BULL, lineStyle: LineStyle.Dotted, title: "Oversold" });
    return () => {
      chart.remove();
    };
  }, [rsi, seriesKey]);

  useEffect(() => {
    const host = macdRef.current;
    if (!host || !macd) return;
    const width = host.clientWidth || mainRef.current?.clientWidth || 640;
    const chart = createChart(host, { width, ...chartOptions(130) });
    chart.addHistogramSeries({ color: MUTED }).setData(macd.histogram.map((item) => ({
      time: asTime(item.time),
      value: item.value,
      color: item.value >= 0 ? BULL : BEAR,
    })));
    setLine(chart.addLineSeries({ color: BULL, lineWidth: 2 }), macd.macd);
    setLine(chart.addLineSeries({ color: "#9db7e8", lineWidth: 2 }), macd.signal);
    return () => {
      chart.remove();
    };
  }, [macd, seriesKey]);

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
