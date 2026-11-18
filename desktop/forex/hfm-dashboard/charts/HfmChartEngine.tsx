import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  calculateADX,
  calculateATR,
  calculateBollingerBands,
  calculateCCI,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  lastValue,
} from "../../chart/indicators";
import { fibExtensionLevels, fibRetracementLevels } from "./fibonacci";
import type {
  HfmChartCandle,
  HfmChartTypeId,
  HfmDrawing,
  HfmDrawingToolId,
  HfmIndicatorConfig,
} from "./types";

const BG = "#0b0e14";
const GRID = "rgba(148,163,184,0.12)";
const MUTED = "#93a0b8";
const BULL = "#34d399";
const BEAR = "#f87171";
const ACCENT = "#8b5cf6";

export interface HfmChartEngineHandle {
  fitContent: () => void;
  zoom: (dir: 1 | -1) => void;
  resetView: () => void;
  requestFullscreen: () => void;
}

export interface HfmCrosshairInfo {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
}

export const HfmChartEngine = forwardRef<HfmChartEngineHandle, {
  symbol: string;
  timeframe: string;
  bars: HfmChartCandle[];
  chartType: HfmChartTypeId;
  digits: number;
  indicators: HfmIndicatorConfig[];
  drawings: HfmDrawing[];
  activeTool: HfmDrawingToolId;
  showGrid: boolean;
  onCrosshair: (info: HfmCrosshairInfo | null) => void;
  onDrawingCommit: (drawing: HfmDrawing) => void;
  onLoadOlder?: () => void;
}>(function HfmChartEngine(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const paneChartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Bar"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>(null);
  const overlayRefs = useRef<ISeriesApi<"Line">[]>([]);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const draftRef = useRef<HfmPriceDraft | null>(null);
  const [draftPreview, setDraftPreview] = useState<HfmDrawing | null>(null);

  const precision = Math.min(5, Math.max(0, Math.round(props.digits)));
  const minMove = Number((10 ** -precision).toFixed(precision));

  useImperativeHandle(ref, () => ({
    fitContent: () => chartRef.current?.timeScale().fitContent(),
    zoom: (dir) => {
      const ts = chartRef.current?.timeScale();
      if (!ts) return;
      const range = ts.getVisibleLogicalRange();
      if (!range) return;
      const span = range.to - range.from;
      const delta = span * 0.15 * dir;
      ts.setVisibleLogicalRange({ from: range.from - delta, to: range.to + delta });
    },
    resetView: () => chartRef.current?.timeScale().fitContent(),
    requestFullscreen: () => {
      const node = hostRef.current?.closest(".hfm-charts-stage") as HTMLElement | null;
      if (!node) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void node.requestFullscreen();
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    const pane = paneRef.current;
    if (!host || !pane) return;

    const chart = createChart(host, {
      width: host.clientWidth || 640,
      height: Math.max(220, host.clientHeight || 360),
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: MUTED,
        fontFamily: "Segoe UI, Manrope, sans-serif",
      },
      grid: {
        vertLines: { color: props.showGrid ? GRID : "transparent" },
        horzLines: { color: props.showGrid ? GRID : "transparent" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID, timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const paneChart = createChart(pane, {
      width: pane.clientWidth || 640,
      height: Math.max(100, pane.clientHeight || 120),
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: MUTED,
        fontFamily: "Segoe UI, Manrope, sans-serif",
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      rightPriceScale: { borderColor: GRID },
      timeScale: { visible: false },
    });
    paneChartRef.current = paneChart;

    const sync = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) paneChart.timeScale().setVisibleLogicalRange(range);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(sync);

    const ro = new ResizeObserver(() => {
      if (hostRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: hostRef.current.clientWidth,
          height: hostRef.current.clientHeight,
        });
      }
      if (paneRef.current && paneChartRef.current) {
        paneChartRef.current.applyOptions({
          width: paneRef.current.clientWidth,
          height: paneRef.current.clientHeight,
        });
      }
    });
    ro.observe(host);
    ro.observe(pane);

    return () => {
      ro.disconnect();
      try {
        chart.remove();
      } catch { /* */ }
      try {
        paneChart.remove();
      } catch { /* */ }
      chartRef.current = null;
      paneChartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.symbol, props.digits, props.chartType]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      grid: {
        vertLines: { color: props.showGrid ? GRID : "transparent" },
        horzLines: { color: props.showGrid ? GRID : "transparent" },
      },
    });
  }, [props.showGrid]);

  // Main series recreate on chart type
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (seriesRef.current) {
      try {
        chart.removeSeries(seriesRef.current);
      } catch { /* */ }
      seriesRef.current = null;
    }
    const fmt = { type: "price" as const, precision, minMove };
    if (props.chartType === "candlestick") {
      seriesRef.current = chart.addCandlestickSeries({
        upColor: BULL,
        downColor: BEAR,
        wickUpColor: BULL,
        wickDownColor: BEAR,
        borderVisible: false,
        priceFormat: fmt,
      });
    } else if (props.chartType === "ohlc") {
      seriesRef.current = chart.addBarSeries({
        upColor: BULL,
        downColor: BEAR,
        thinBars: false,
        priceFormat: fmt,
      });
    } else if (props.chartType === "line") {
      seriesRef.current = chart.addLineSeries({
        color: ACCENT,
        lineWidth: 2,
        priceFormat: fmt,
      });
    } else {
      seriesRef.current = chart.addAreaSeries({
        lineColor: ACCENT,
        topColor: "rgba(139,92,246,0.35)",
        bottomColor: "rgba(139,92,246,0.02)",
        lineWidth: 2,
        priceFormat: fmt,
      });
    }
  }, [props.chartType, props.symbol, props.digits, precision, minMove]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    const bars = props.bars;
    if (!bars.length) {
      // @ts-expect-error setData union
      series.setData([]);
      return;
    }
    if (props.chartType === "candlestick" || props.chartType === "ohlc") {
      // @ts-expect-error union
      series.setData(bars.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })));
    } else {
      // @ts-expect-error union
      series.setData(bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })));
    }
  }, [props.bars, props.chartType]);

  // Overlays + oscillator pane
  useEffect(() => {
    const chart = chartRef.current;
    const paneChart = paneChartRef.current;
    if (!chart || !paneChart || !props.bars.length) return;

    for (const s of overlayRefs.current) {
      try {
        chart.removeSeries(s);
      } catch { /* */ }
    }
    overlayRefs.current = [];

    // Clear pane by replacing with empty line then remove — keep one disposable approach:
    const paneSeriesBag: Array<ISeriesApi<"Line"> | ISeriesApi<"Histogram">> = [];
    const addPaneLine = (color: string) => {
      const s = paneChart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
      paneSeriesBag.push(s);
      return s;
    };

    for (const ind of props.indicators) {
      if (!ind.visible) continue;
      if (ind.kind === "sma") {
        const pts = calculateSMA(props.bars, ind.period ?? 20);
        const s = chart.addLineSeries({ color: ind.color ?? "#b9f2cc", lineWidth: 1, priceLineVisible: false });
        s.setData(pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        overlayRefs.current.push(s);
      } else if (ind.kind === "ema") {
        const pts = calculateEMA(props.bars, ind.period ?? 20);
        const s = chart.addLineSeries({ color: ind.color ?? "#60a5fa", lineWidth: 1, priceLineVisible: false });
        s.setData(pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        overlayRefs.current.push(s);
      } else if (ind.kind === "bollinger") {
        const bb = calculateBollingerBands(props.bars, ind.period ?? 20, ind.deviation ?? 2);
        for (const [pts, color] of [
          [bb.upper, "#6f8f7c"],
          [bb.middle, ind.color ?? "#8a94a0"],
          [bb.lower, "#6f8f7c"],
        ] as const) {
          const s = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false });
          s.setData(pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
          overlayRefs.current.push(s);
        }
      } else if (ind.kind === "rsi") {
        const pts = calculateRSI(props.bars, ind.period ?? 14);
        const s = addPaneLine(ind.color ?? "#c084fc");
        s.setData(pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      } else if (ind.kind === "macd") {
        const macd = calculateMACD(props.bars, ind.period ?? 12, ind.period2 ?? 26, ind.period3 ?? 9);
        const m = addPaneLine("#60a5fa");
        m.setData(macd.macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        const sig = addPaneLine("#f472b6");
        sig.setData(macd.signal.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        const hist = paneChart.addHistogramSeries({ color: "#34d399" });
        hist.setData(macd.histogram.map((p) => ({
          time: p.time as UTCTimestamp,
          value: p.value,
          color: p.value >= 0 ? "#34d39988" : "#f8717188",
        })));
        paneSeriesBag.push(hist);
      } else if (ind.kind === "stoch") {
        const st = calculateStochastic(props.bars, ind.period ?? 14, ind.period2 ?? 3);
        addPaneLine("#fbbf24").setData(st.k.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        addPaneLine("#38bdf8").setData(st.d.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      } else if (ind.kind === "cci") {
        const pts = calculateCCI(props.bars, ind.period ?? 20);
        addPaneLine("#a78bfa").setData(pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      } else if (ind.kind === "atr") {
        const pts = calculateATR(props.bars, ind.period ?? 14);
        addPaneLine("#fb7185").setData(pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      } else if (ind.kind === "adx") {
        const adx = calculateADX(props.bars, ind.period ?? 14);
        addPaneLine("#e2e8f0").setData(adx.adx.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        addPaneLine("#34d399").setData(adx.plusDi.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        addPaneLine("#f87171").setData(adx.minusDi.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      } else if (ind.kind === "tick_volume") {
        const has = props.bars.some((b) => b.tickVolume != null && b.tickVolume > 0);
        if (has) {
          const hist = paneChart.addHistogramSeries({ color: "#64748b" });
          hist.setData(props.bars
            .filter((b) => b.tickVolume != null)
            .map((b) => ({ time: b.time as UTCTimestamp, value: b.tickVolume as number })));
          paneSeriesBag.push(hist);
        }
      } else if (ind.kind === "real_volume") {
        const has = props.bars.some((b) => b.realVolume != null && b.realVolume > 0);
        if (has) {
          const hist = paneChart.addHistogramSeries({ color: "#94a3b8" });
          hist.setData(props.bars
            .filter((b) => b.realVolume != null)
            .map((b) => ({ time: b.time as UTCTimestamp, value: b.realVolume as number })));
          paneSeriesBag.push(hist);
        }
      }
    }

    return () => {
      for (const s of paneSeriesBag) {
        try {
          paneChart.removeSeries(s);
        } catch { /* */ }
      }
    };
  }, [props.bars, props.indicators, props.symbol, props.timeframe]);

  // Horizontal price lines from drawings
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const pl of priceLinesRef.current) {
      try {
        series.removePriceLine(pl);
      } catch { /* */ }
    }
    priceLinesRef.current = [];
    for (const d of props.drawings) {
      if (!d.visible || d.symbol !== props.symbol || d.timeframe !== props.timeframe) continue;
      if (d.tool === "hline") {
        const pl = series.createPriceLine({
          price: d.price,
          color: d.color,
          lineWidth: d.lineWidth as 1 | 2 | 3 | 4,
          lineStyle: d.lineStyle === "dashed" ? LineStyle.Dashed : d.lineStyle === "dotted" ? LineStyle.Dotted : LineStyle.Solid,
          axisLabelVisible: true,
          title: d.label ?? "H",
        });
        priceLinesRef.current.push(pl);
      }
      if (d.tool === "fib_retracement") {
        const levels = fibRetracementLevels(d.a.price, d.b.price);
        for (const lv of levels) {
          const pl = series.createPriceLine({
            price: lv.price,
            color: d.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `${(lv.ratio * 100).toFixed(1)}%`,
          });
          priceLinesRef.current.push(pl);
        }
      }
      if (d.tool === "fib_extension") {
        const levels = fibExtensionLevels(d.a.price, d.b.price, d.c.price);
        for (const lv of levels) {
          const pl = series.createPriceLine({
            price: lv.price,
            color: d.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `ext ${(lv.ratio).toFixed(3)}`,
          });
          priceLinesRef.current.push(pl);
        }
      }
    }
  }, [props.drawings, props.symbol, props.timeframe, props.bars, props.chartType]);

  // Crosshair + drawing clicks
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onMove = (param: MouseEventParams) => {
      if (!param.time || !props.bars.length) {
        props.onCrosshair(null);
        return;
      }
      const t = Number(param.time);
      const bar = props.bars.find((b) => b.time === t) ?? null;
      if (!bar) {
        props.onCrosshair(null);
        return;
      }
      props.onCrosshair({
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        tickVolume: bar.tickVolume,
        realVolume: bar.realVolume,
        spread: bar.spread,
      });
    };
    chart.subscribeCrosshairMove(onMove);

    const onClick = (param: MouseEventParams) => {
      if (props.activeTool === "cursor") return;
      if (param.time == null || param.point == null) return;
      const series = seriesRef.current;
      if (!series) return;
      const price = series.coordinateToPrice(param.point.y);
      if (price == null || !Number.isFinite(price)) return;
      const time = Number(param.time);
      const point = { time, price: Number(price) };
      const tool = props.activeTool;
      const base = {
        id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        symbol: props.symbol,
        timeframe: props.timeframe,
        color: ACCENT,
        lineWidth: 1 as number,
        lineStyle: "solid" as const,
        visible: true,
      };

      if (tool === "hline") {
        props.onDrawingCommit({ ...base, tool: "hline", price: point.price });
        return;
      }
      if (tool === "vline") {
        props.onDrawingCommit({ ...base, tool: "vline", time: point.time });
        return;
      }
      if (tool === "text") {
        const text = window.prompt("Annotation text", "Note");
        if (!text) return;
        props.onDrawingCommit({ ...base, tool: "text", point, text });
        return;
      }

      const draft = draftRef.current;
      if (!draft) {
        draftRef.current = { tool, points: [point] };
        setDraftPreview(null);
        return;
      }
      draft.points.push(point);
      const need = tool === "fib_extension" ? 3 : tool === "channel" || tool === "trendline" || tool === "rectangle" || tool === "fib_retracement" ? 2 : 1;
      if (draft.points.length < need) {
        draftRef.current = draft;
        return;
      }
      const [a, b, c] = draft.points;
      draftRef.current = null;
      setDraftPreview(null);
      if (tool === "trendline" && a && b) props.onDrawingCommit({ ...base, tool: "trendline", a, b });
      else if (tool === "rectangle" && a && b) props.onDrawingCommit({ ...base, tool: "rectangle", a, b });
      else if (tool === "channel" && a && b) {
        props.onDrawingCommit({ ...base, tool: "channel", a, b, offsetPrice: (b.price - a.price) * 0.35 });
      } else if (tool === "fib_retracement" && a && b) props.onDrawingCommit({ ...base, tool: "fib_retracement", a, b });
      else if (tool === "fib_extension" && a && b && c) props.onDrawingCommit({ ...base, tool: "fib_extension", a, b, c });
    };
    chart.subscribeClick(onClick);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.unsubscribeClick(onClick);
    };
  }, [props.activeTool, props.bars, props.symbol, props.timeframe, props.onCrosshair, props.onDrawingCommit]);

  // Load older when scrolled left
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !props.onLoadOlder) return;
    const handler = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      if (range.from < 5) props.onLoadOlder?.();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
  }, [props.onLoadOlder]);

  const indicatorReadouts = useMemo(() => {
    return props.indicators.filter((i) => i.visible).map((ind) => {
      let value: number | null = null;
      if (ind.kind === "sma") value = lastValue(calculateSMA(props.bars, ind.period ?? 20));
      else if (ind.kind === "ema") value = lastValue(calculateEMA(props.bars, ind.period ?? 20));
      else if (ind.kind === "rsi") value = lastValue(calculateRSI(props.bars, ind.period ?? 14));
      else if (ind.kind === "atr") value = lastValue(calculateATR(props.bars, ind.period ?? 14));
      else if (ind.kind === "cci") value = lastValue(calculateCCI(props.bars, ind.period ?? 20));
      else if (ind.kind === "adx") value = lastValue(calculateADX(props.bars, ind.period ?? 14).adx);
      else if (ind.kind === "bollinger") value = lastValue(calculateBollingerBands(props.bars, ind.period ?? 20, ind.deviation ?? 2).middle);
      else if (ind.kind === "macd") value = lastValue(calculateMACD(props.bars).macd);
      else if (ind.kind === "stoch") value = lastValue(calculateStochastic(props.bars).k);
      return { ...ind, value };
    });
  }, [props.indicators, props.bars]);

  const overlayDrawings = props.drawings.filter(
    (d) => d.visible && d.symbol === props.symbol && d.timeframe === props.timeframe
      && (d.tool === "trendline" || d.tool === "rectangle" || d.tool === "channel" || d.tool === "vline" || d.tool === "text"),
  );

  return (
    <div className="hfm-chart-engine" data-hfm-chart-engine="true">
      <div className="hfm-chart-main-host" ref={hostRef} data-chart-host="main" />
      <DrawingSvgOverlay
        chart={chartRef}
        series={seriesRef}
        drawings={overlayDrawings}
        draft={draftPreview}
      />
      <div className="hfm-chart-pane-host" ref={paneRef} data-chart-host="pane" aria-label="Indicator pane" />
      <ul className="hfm-chart-ind-readout" aria-label="Indicator values">
        {indicatorReadouts.map((ind) => (
          <li key={ind.id}>
            <span>{ind.kind.toUpperCase()}{ind.period ? ` ${ind.period}` : ""}</span>
            <strong>{ind.value == null ? "—" : ind.value.toFixed(ind.kind === "rsi" || ind.kind === "stoch" || ind.kind === "adx" ? 2 : precision)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
});

interface HfmPriceDraft {
  tool: HfmDrawingToolId;
  points: Array<{ time: number; price: number }>;
}

function DrawingSvgOverlay(props: {
  chart: MutableRefObject<IChartApi | null>;
  series: MutableRefObject<ISeriesApi<"Candlestick"> | ISeriesApi<"Bar"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>;
  drawings: HfmDrawing[];
  draft: HfmDrawing | null;
}) {
  const [, bump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => bump((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);
  const chart = props.chart.current;
  const series = props.series.current;
  if (!chart || !series) return null;

  const toXY = (time: number, price: number) => {
    const x = chart.timeScale().timeToCoordinate(time as UTCTimestamp);
    const y = series.priceToCoordinate(price);
    if (x == null || y == null) return null;
    return { x, y };
  };

  const items = [...props.drawings, ...(props.draft ? [props.draft] : [])];
  return (
    <svg className="hfm-chart-draw-layer" aria-hidden="true">
      {items.map((d) => {
        if (d.tool === "vline") {
          const p = toXY(d.time, 0);
          // vline: use time coordinate only
          const x = chart.timeScale().timeToCoordinate(d.time as UTCTimestamp);
          if (x == null) return null;
          return <line key={d.id} x1={x} x2={x} y1={0} y2="100%" stroke={d.color} strokeWidth={d.lineWidth} strokeDasharray={d.lineStyle === "dashed" ? "6 4" : undefined} />;
        }
        if (d.tool === "trendline" || d.tool === "channel") {
          const a = toXY(d.a.time, d.a.price);
          const b = toXY(d.b.time, d.b.price);
          if (!a || !b) return null;
          return (
            <g key={d.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={d.color} strokeWidth={d.lineWidth} />
              {d.tool === "channel" ? (
                <line
                  x1={a.x}
                  y1={(toXY(d.a.time, d.a.price + d.offsetPrice)?.y) ?? a.y}
                  x2={b.x}
                  y2={(toXY(d.b.time, d.b.price + d.offsetPrice)?.y) ?? b.y}
                  stroke={d.color}
                  strokeWidth={d.lineWidth}
                  strokeDasharray="4 3"
                />
              ) : null}
            </g>
          );
        }
        if (d.tool === "rectangle") {
          const a = toXY(d.a.time, d.a.price);
          const b = toXY(d.b.time, d.b.price);
          if (!a || !b) return null;
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          return (
            <rect
              key={d.id}
              x={x}
              y={y}
              width={Math.abs(b.x - a.x)}
              height={Math.abs(b.y - a.y)}
              fill={`${d.color}22`}
              stroke={d.color}
              strokeWidth={d.lineWidth}
            />
          );
        }
        if (d.tool === "text") {
          const p = toXY(d.point.time, d.point.price);
          if (!p) return null;
          return (
            <text key={d.id} x={p.x} y={p.y} fill={d.color} fontSize="11">
              {d.text}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}
