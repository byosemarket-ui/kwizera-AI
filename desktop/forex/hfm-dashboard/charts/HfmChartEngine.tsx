import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
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
import type { HfmAnalyticalOverlay } from "./analysis/analytical-overlays";
import {
  chartTimeDomainLabel,
  type HfmChartTimeDomain,
} from "./chart-time-domain";

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
  /** Series coordinate time in the active chart domain. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
  brokerOpenTime?: number;
  openTimeUtc?: number | null;
  brokerUtcOffsetSec?: number | null;
  timestampNormalizationStatus?: string | null;
  timestampNormalizationReason?: string | null;
  timestampSource?: string | null;
  receiveTimestamp?: string | null;
  timeDomain: HfmChartTimeDomain;
}

export const HfmChartEngine = forwardRef<HfmChartEngineHandle, {
  symbol: string;
  timeframe: string;
  bars: HfmChartCandle[];
  /** Coordinate domain for `bars[].time` — must be uniform across the series. */
  timeDomain: HfmChartTimeDomain;
  chartType: HfmChartTypeId;
  digits: number;
  indicators: HfmIndicatorConfig[];
  drawings: HfmDrawing[];
  analyticalOverlays?: HfmAnalyticalOverlay[];
  activeTool: HfmDrawingToolId;
  showGrid: boolean;
  onCrosshair: (info: HfmCrosshairInfo | null) => void;
  onDrawingCommit: (drawing: HfmDrawing) => void;
  onDrawingUpdate?: (drawing: HfmDrawing) => void;
  selectedDrawingId?: string | null;
  onSelectDrawing?: (id: string | null) => void;
  onLoadOlder?: () => void;
}>(function HfmChartEngine(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const paneChartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Bar"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>(null);
  const overlayRefs = useRef<ISeriesApi<"Line">[]>([]);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const analyticalLinesRef = useRef<IPriceLine[]>([]);
  const draftRef = useRef<HfmPriceDraft | null>(null);
  const [draftPreview, setDraftPreview] = useState<HfmDrawing | null>(null);
  const barsFingerprintRef = useRef<string>("");
  const lastBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

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
      timeScale: {
        borderColor: GRID,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const d = new Date(Number(time) * 1000);
          const pad = (n: number) => String(n).padStart(2, "0");
          const label = chartTimeDomainLabel(props.timeDomain);
          return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} ${label}`;
        },
      },
      localization: {
        timeFormatter: (time: number) => {
          const d = new Date(Number(time) * 1000);
          const pad = (n: number) => String(n).padStart(2, "0");
          const label = chartTimeDomainLabel(props.timeDomain);
          return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} (${label})`;
        },
      },
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
    // Recreate when domain changes so axis formatter labels stay honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.symbol, props.digits, props.chartType, props.timeDomain]);

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
      barsFingerprintRef.current = "";
      lastBarRef.current = null;
      return;
    }
    const tip = bars[bars.length - 1]!;
    const histKey = `${bars.length}|${bars[0]!.time}|${bars.length > 1 ? bars[bars.length - 2]!.time : 0}`;
    const ohlc = props.chartType === "candlestick" || props.chartType === "ohlc";
    const canIncremental =
      barsFingerprintRef.current === histKey &&
      lastBarRef.current != null &&
      (lastBarRef.current.time === tip.time || lastBarRef.current.time < tip.time);

    if (canIncremental) {
      try {
        if (ohlc) {
          // @ts-expect-error union
          series.update({
            time: tip.time as UTCTimestamp,
            open: tip.open,
            high: tip.high,
            low: tip.low,
            close: tip.close,
          });
        } else {
          // @ts-expect-error union
          series.update({ time: tip.time as UTCTimestamp, value: tip.close });
        }
        lastBarRef.current = {
          time: tip.time,
          open: tip.open,
          high: tip.high,
          low: tip.low,
          close: tip.close,
        };
        return;
      } catch {
        // Fall through to full setData if update rejected (e.g. time went backwards).
      }
    }

    if (ohlc) {
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
    barsFingerprintRef.current = histKey;
    lastBarRef.current = {
      time: tip.time,
      open: tip.open,
      high: tip.high,
      low: tip.low,
      close: tip.close,
    };
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

  // Phase 6 — source-backed analytical overlays (opt-in; never mutates user drawings)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const pl of analyticalLinesRef.current) {
      try {
        series.removePriceLine(pl);
      } catch { /* */ }
    }
    analyticalLinesRef.current = [];
    const overlays = props.analyticalOverlays ?? [];
    for (const ov of overlays) {
      if (!Number.isFinite(ov.price)) continue;
      const pl = series.createPriceLine({
        price: ov.price,
        color: ov.color,
        lineWidth: 1,
        lineStyle:
          ov.lineStyle === "dashed"
            ? LineStyle.Dashed
            : ov.lineStyle === "dotted"
              ? LineStyle.Dotted
              : LineStyle.Solid,
        axisLabelVisible: true,
        title: ov.title.slice(0, 16),
      });
      analyticalLinesRef.current.push(pl);
    }
  }, [props.analyticalOverlays, props.bars, props.chartType, props.symbol, props.timeframe]);

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
        brokerOpenTime: bar.brokerOpenTime ?? bar.time,
        openTimeUtc: bar.openTimeUtc ?? null,
        brokerUtcOffsetSec: bar.brokerUtcOffsetSec ?? null,
        timestampNormalizationStatus: bar.timestampNormalizationStatus ?? null,
        timestampNormalizationReason: bar.timestampNormalizationReason ?? null,
        timestampSource: bar.timestampSource ?? null,
        receiveTimestamp: bar.receiveTimestamp ?? null,
        timeDomain: props.timeDomain,
      });
    };
    chart.subscribeCrosshairMove(onMove);

    const onClick = (param: MouseEventParams) => {
      if (props.activeTool === "cursor") {
        // Deselect when clicking empty chart in cursor mode (selection handled in SVG).
        props.onSelectDrawing?.(null);
        return;
      }
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
        locked: false,
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
  }, [props.activeTool, props.bars, props.symbol, props.timeframe, props.timeDomain, props.onCrosshair, props.onDrawingCommit, props.onSelectDrawing]);

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
      && (d.tool === "trendline" || d.tool === "rectangle" || d.tool === "channel" || d.tool === "vline" || d.tool === "text" || d.tool === "hline" || d.tool === "fib_retracement" || d.tool === "fib_extension"),
  );

  return (
    <div className="hfm-chart-engine" data-hfm-chart-engine="true">
      <div className="hfm-chart-main-host" ref={hostRef} data-chart-host="main" />
      <DrawingSvgOverlay
        chart={chartRef}
        series={seriesRef}
        drawings={overlayDrawings}
        draft={draftPreview}
        selectedId={props.selectedDrawingId ?? null}
        activeTool={props.activeTool}
        onSelect={props.onSelectDrawing}
        onUpdate={props.onDrawingUpdate}
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

type AnchorId = "a" | "b" | "c" | "price" | "time" | "point" | "offset";
type DragMode =
  | { id: string; kind: "body"; startX: number; startY: number; origin: HfmDrawing }
  | { id: string; kind: "anchor"; anchor: AnchorId; startX: number; startY: number; origin: HfmDrawing };

function DrawingSvgOverlay(props: {
  chart: MutableRefObject<IChartApi | null>;
  series: MutableRefObject<ISeriesApi<"Candlestick"> | ISeriesApi<"Bar"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>;
  drawings: HfmDrawing[];
  draft: HfmDrawing | null;
  selectedId: string | null;
  activeTool: HfmDrawingToolId;
  onSelect?: (id: string | null) => void;
  onUpdate?: (drawing: HfmDrawing) => void;
}) {
  const [, bump] = useState(0);
  const dragRef = useRef<DragMode | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => bump((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      const chart = props.chart.current;
      const series = props.series.current;
      if (!drag || !chart || !series || !props.onUpdate) return;
      const origin = drag.origin;
      if (origin.locked) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      const midTime = (() => {
        if ("a" in origin) return origin.a.time;
        if ("point" in origin) return origin.point.time;
        if ("time" in origin) return origin.time;
        const lr = chart.timeScale().getVisibleLogicalRange();
        if (!lr) return Date.now() / 1000;
        const t = chart.timeScale().coordinateToTime((lr.from + lr.to) / 2);
        return typeof t === "number" ? t : Date.now() / 1000;
      })();
      const midPrice = (() => {
        if ("a" in origin) return origin.a.price;
        if ("point" in origin) return origin.point.price;
        if ("price" in origin) return origin.price;
        return series.coordinateToPrice(100) ?? 0;
      })();
      const x0 = chart.timeScale().timeToCoordinate(midTime as UTCTimestamp) ?? 0;
      const y0 = series.priceToCoordinate(midPrice) ?? 0;
      const t1 = chart.timeScale().coordinateToTime((x0 + dx) as number);
      const p1 = series.coordinateToPrice(y0 + dy);
      if (t1 == null || p1 == null) return;
      const dTime = Number(t1) - midTime;
      const dPrice = Number(p1) - midPrice;

      const shiftPoint = (pt: { time: number; price: number }) => ({
        time: pt.time + dTime,
        price: pt.price + dPrice,
      });

      let next: HfmDrawing = origin;
      if (drag.kind === "body") {
        if (origin.tool === "hline") next = { ...origin, price: origin.price + dPrice };
        else if (origin.tool === "vline") next = { ...origin, time: origin.time + dTime };
        else if (origin.tool === "text") next = { ...origin, point: shiftPoint(origin.point) };
        else if (origin.tool === "trendline" || origin.tool === "rectangle" || origin.tool === "fib_retracement") {
          next = { ...origin, a: shiftPoint(origin.a), b: shiftPoint(origin.b) };
        } else if (origin.tool === "channel") {
          next = { ...origin, a: shiftPoint(origin.a), b: shiftPoint(origin.b) };
        } else if (origin.tool === "fib_extension") {
          next = { ...origin, a: shiftPoint(origin.a), b: shiftPoint(origin.b), c: shiftPoint(origin.c) };
        }
      } else {
        const ax = drag.anchor;
        if (origin.tool === "hline" && ax === "price") next = { ...origin, price: origin.price + dPrice };
        else if (origin.tool === "vline" && ax === "time") next = { ...origin, time: origin.time + dTime };
        else if (origin.tool === "text" && ax === "point") next = { ...origin, point: shiftPoint(origin.point) };
        else if (
          (origin.tool === "trendline" || origin.tool === "rectangle" || origin.tool === "fib_retracement" || origin.tool === "channel")
          && (ax === "a" || ax === "b")
        ) {
          next = { ...origin, [ax]: shiftPoint(origin[ax]) };
        } else if (origin.tool === "channel" && ax === "offset") {
          next = { ...origin, offsetPrice: origin.offsetPrice + dPrice };
        } else if (origin.tool === "fib_extension" && (ax === "a" || ax === "b" || ax === "c")) {
          next = { ...origin, [ax]: shiftPoint(origin[ax]) };
        }
      }
      // Reset drag origin baseline each move for smooth incremental updates
      dragRef.current = {
        ...drag,
        startX: ev.clientX,
        startY: ev.clientY,
        origin: next,
      };
      props.onUpdate(next);
      bump((n) => n + 1);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [props]);

  const chart = props.chart.current;
  const series = props.series.current;
  if (!chart || !series) return null;

  const toXY = (time: number, price: number) => {
    const x = chart.timeScale().timeToCoordinate(time as UTCTimestamp);
    const y = series.priceToCoordinate(price);
    if (x == null || y == null) return null;
    return { x, y };
  };

  const beginDrag = (
    ev: ReactPointerEvent,
    drawing: HfmDrawing,
    kind: DragMode["kind"],
    anchor?: AnchorId,
  ) => {
    if (props.activeTool !== "cursor") return;
    if (drawing.locked) {
      props.onSelect?.(drawing.id);
      return;
    }
    ev.stopPropagation();
    ev.preventDefault();
    props.onSelect?.(drawing.id);
    if (kind === "body") {
      dragRef.current = {
        id: drawing.id,
        kind: "body",
        startX: ev.clientX,
        startY: ev.clientY,
        origin: drawing,
      };
    } else {
      dragRef.current = {
        id: drawing.id,
        kind: "anchor",
        anchor: anchor ?? "a",
        startX: ev.clientX,
        startY: ev.clientY,
        origin: drawing,
      };
    }
  };

  const handle = (x: number, y: number, drawing: HfmDrawing, anchor: AnchorId) => (
    <circle
      key={`${drawing.id}-${anchor}`}
      cx={x}
      cy={y}
      r={5}
      className="hfm-draw-handle"
      fill="#f8fafc"
      stroke={drawing.color}
      strokeWidth={2}
      onPointerDown={(ev) => beginDrag(ev, drawing, "anchor", anchor)}
    />
  );

  const items = [...props.drawings, ...(props.draft ? [props.draft] : [])];
  const editing = props.activeTool === "cursor";

  return (
    <svg
      ref={svgRef}
      className={`hfm-chart-draw-layer${editing ? " is-editing" : ""}`}
      aria-hidden="true"
    >
      {items.map((d) => {
        const selected = props.selectedId === d.id;
        if (d.tool === "vline") {
          const x = chart.timeScale().timeToCoordinate(d.time as UTCTimestamp);
          if (x == null) return null;
          return (
            <g key={d.id} className={selected ? "is-selected" : undefined}>
              <line
                x1={x}
                x2={x}
                y1={0}
                y2="100%"
                stroke={d.color}
                strokeWidth={d.lineWidth + (selected ? 1 : 0)}
                strokeDasharray={d.lineStyle === "dashed" ? "6 4" : d.lineStyle === "dotted" ? "2 3" : undefined}
                onPointerDown={(ev) => beginDrag(ev, d, "body")}
              />
              {selected && editing ? handle(x, 24, d, "time") : null}
            </g>
          );
        }
        if (d.tool === "hline") {
          const y = series.priceToCoordinate(d.price);
          if (y == null) return null;
          return (
            <g key={d.id} className={selected ? "is-selected" : undefined}>
              <line
                x1={0}
                x2="100%"
                y1={y}
                y2={y}
                stroke={d.color}
                strokeWidth={d.lineWidth + (selected ? 1 : 0)}
                strokeDasharray={d.lineStyle === "dashed" ? "6 4" : undefined}
                onPointerDown={(ev) => beginDrag(ev, d, "body")}
              />
              {selected && editing ? handle(40, y, d, "price") : null}
            </g>
          );
        }
        if (d.tool === "trendline" || d.tool === "channel" || d.tool === "fib_retracement") {
          const a = toXY(d.a.time, d.a.price);
          const b = toXY(d.b.time, d.b.price);
          if (!a || !b) return null;
          return (
            <g key={d.id} className={selected ? "is-selected" : undefined}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={d.color}
                strokeWidth={d.lineWidth + (selected ? 1 : 0)}
                onPointerDown={(ev) => beginDrag(ev, d, "body")}
              />
              {d.tool === "channel" ? (
                <line
                  x1={a.x}
                  y1={(toXY(d.a.time, d.a.price + d.offsetPrice)?.y) ?? a.y}
                  x2={b.x}
                  y2={(toXY(d.b.time, d.b.price + d.offsetPrice)?.y) ?? b.y}
                  stroke={d.color}
                  strokeWidth={d.lineWidth}
                  strokeDasharray="4 3"
                  onPointerDown={(ev) => beginDrag(ev, d, "anchor", "offset")}
                />
              ) : null}
              {selected && editing ? (
                <>
                  {handle(a.x, a.y, d, "a")}
                  {handle(b.x, b.y, d, "b")}
                </>
              ) : null}
            </g>
          );
        }
        if (d.tool === "fib_extension") {
          const a = toXY(d.a.time, d.a.price);
          const b = toXY(d.b.time, d.b.price);
          const c = toXY(d.c.time, d.c.price);
          if (!a || !b || !c) return null;
          return (
            <g key={d.id} className={selected ? "is-selected" : undefined}>
              <polyline
                points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`}
                fill="none"
                stroke={d.color}
                strokeWidth={d.lineWidth + (selected ? 1 : 0)}
                onPointerDown={(ev) => beginDrag(ev, d, "body")}
              />
              {selected && editing ? (
                <>
                  {handle(a.x, a.y, d, "a")}
                  {handle(b.x, b.y, d, "b")}
                  {handle(c.x, c.y, d, "c")}
                </>
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
            <g key={d.id} className={selected ? "is-selected" : undefined}>
              <rect
                x={x}
                y={y}
                width={Math.abs(b.x - a.x)}
                height={Math.abs(b.y - a.y)}
                fill={`${d.color}22`}
                stroke={d.color}
                strokeWidth={d.lineWidth + (selected ? 1 : 0)}
                onPointerDown={(ev) => beginDrag(ev, d, "body")}
              />
              {selected && editing ? (
                <>
                  {handle(a.x, a.y, d, "a")}
                  {handle(b.x, b.y, d, "b")}
                </>
              ) : null}
            </g>
          );
        }
        if (d.tool === "text") {
          const p = toXY(d.point.time, d.point.price);
          if (!p) return null;
          return (
            <g key={d.id} className={selected ? "is-selected" : undefined}>
              <text
                x={p.x}
                y={p.y}
                fill={d.color}
                fontSize="11"
                onPointerDown={(ev) => beginDrag(ev, d, "body")}
                onDoubleClick={() => {
                  if (d.locked || !props.onUpdate) return;
                  const text = window.prompt("Annotation text", d.text);
                  if (text == null) return;
                  props.onUpdate({ ...d, text: text.slice(0, 500) });
                }}
              >
                {d.text}
              </text>
              {selected && editing ? handle(p.x, p.y, d, "point") : null}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}
