import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { ForexStatusBadge } from "../components/ForexStatusBadge";
import { ForexSectionHeader } from "../components/ForexSectionHeader";
import { ForexPriceChart, type ForexPriceChartHandle, type OverlaySeries } from "./ForexPriceChart";
import { calculateBollingerBands, calculateEMA, calculateMACD, calculateRSI, calculateSMA, lastValue } from "./indicators";
import { isBinanceSpotSelection, isFxcmSelection, type SelectedMarket } from "../market-data/selected-market";
import { useBinanceKlines } from "../market-data/use-binance-klines";
import { useBinanceLiveKline } from "../market-data/use-binance-live-kline";
import { useFxcmHistoricalKlines } from "../market-data/use-fxcm-historical-klines";
import { applyLiveKline } from "../../../ai/market-data/binance/adapter";
import { buildForexMarketState } from "../../../ai/forex-market-state";
import {
  liveTickerPriceLabel,
  type LiveTickerSnapshot,
} from "../../../ai/market-data/binance/live-ticker";
import {
  formatLastUpdateUtc,
  liveMarketStatusLabel,
  liveMarketStatusTone,
  resolveKlineUiStatus,
  resolveTickerUiStatus,
} from "../market-data/live-market-status";
import { LIVE_MARKET_UNAVAILABLE, LIVE_PRICE_UNAVAILABLE } from "../market-data/allow-development-market-data";
import { sanitizeCandles } from "./validate-candles";
import {
  CHART_TIMEFRAMES,
  DEFAULT_CHART_TIMEFRAME,
  type Candle,
  type ChartTimeframeId,
  type ChartTypeId,
  type IndicatorConfig,
  type IndicatorKind,
  type PriceLevel,
} from "./types";

const OVERLAY_COLORS: Record<string, string> = {
  sma: "#b9f2cc",
  ema: "#9db7e8",
  bollinger: "#8a94a0",
};

let indicatorSeq = 1;

function nextId(kind: string): string {
  indicatorSeq += 1;
  return `${kind}-${indicatorSeq}`;
}

function formatUtc(time: number): string {
  return `${new Date(time * 1000).toISOString().replace(".000Z", "Z")} UTC`;
}

function formatPrice(symbol: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return LIVE_PRICE_UNAVAILABLE;
  const digits = symbol.includes("JPY") ? 3 : symbol.startsWith("XAU") ? 2 : 2;
  return value.toFixed(digits);
}

function indicatorLatestValue(
  kind: IndicatorKind,
  candles: Candle[],
  config: IndicatorConfig,
): number | null {
  if (candles.length === 0) return null;
  if (kind === "sma") return lastValue(calculateSMA(candles, config.period ?? 20));
  if (kind === "ema") return lastValue(calculateEMA(candles, config.period ?? 20));
  if (kind === "rsi") return lastValue(calculateRSI(candles, config.period ?? 14));
  if (kind === "macd") return lastValue(calculateMACD(candles, config.fastPeriod ?? 12, config.slowPeriod ?? 26, config.signalPeriod ?? 9).macd);
  if (kind === "bollinger") return lastValue(calculateBollingerBands(candles, config.period ?? 20, config.deviation ?? 2).middle);
  return null;
}

function formatIndicatorReadout(kind: IndicatorKind, value: number | null, symbol: string): string {
  if (value === null || !Number.isFinite(value)) return "Insufficient data";
  if (kind === "rsi") return value.toFixed(1);
  if (kind === "macd") return value.toFixed(4);
  return formatPrice(symbol, value);
}

function defaultIndicators(mode: "charts" | "analysis"): IndicatorConfig[] {
  if (mode === "charts") return [];
  return [
    { id: "sma-20", kind: "sma", period: 20 },
    { id: "ema-50", kind: "ema", period: 50 },
    { id: "rsi-14", kind: "rsi", period: 14 },
    { id: "macd-std", kind: "macd", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  ];
}

export function ForexChartWorkspace({
  mode,
  onOpenModule,
  selectedMarket,
  timeframe: controlledTimeframe,
  onTimeframeChange,
  liveTicker,
}: {
  mode: "charts" | "analysis";
  onOpenModule?: (id: "charts" | "technical-analysis" | "markets") => void;
  selectedMarket?: SelectedMarket | null;
  onSelectMarket?: (market: SelectedMarket) => void;
  timeframe?: ChartTimeframeId;
  onTimeframeChange?: (timeframe: ChartTimeframeId) => void;
  liveTicker?: LiveTickerSnapshot | null;
}) {
  // Controlled by ForexShell — do not mirror selection locally or rewrite URL independently.
  const selected = selectedMarket ?? null;
  const [localTimeframe, setLocalTimeframe] = useState<ChartTimeframeId>(
    controlledTimeframe ?? DEFAULT_CHART_TIMEFRAME,
  );
  const timeframe = controlledTimeframe ?? localTimeframe;
  const [chartType, setChartType] = useState<ChartTypeId>("candlestick");
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(() => defaultIndicators(mode));
  const [addKind, setAddKind] = useState<IndicatorKind>("sma");
  const [levels, setLevels] = useState<PriceLevel[]>([]);
  const [levelPrice, setLevelPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [focused, setFocused] = useState<Candle | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const chartRef = useRef<ForexPriceChartHandle>(null);
  const workspaceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (controlledTimeframe && controlledTimeframe !== localTimeframe) {
      setLocalTimeframe(controlledTimeframe);
    }
  }, [controlledTimeframe, localTimeframe]);

  useEffect(() => {
    setIndicators(defaultIndicators(mode));
  }, [mode]);

  const applyTimeframe = (next: ChartTimeframeId) => {
    setLocalTimeframe(next);
    onTimeframeChange?.(next);
  };

  useEffect(() => {
    setLevels([]);
    setNotes("");
    setFocused(null);
  }, [selected?.symbol, timeframe]);

  const binanceSelected = isBinanceSpotSelection(selected);
  const fxcmSelected = isFxcmSelection(selected);
  const history = useBinanceKlines(binanceSelected ? selected.symbol : null, timeframe);
  const liveKline = useBinanceLiveKline(binanceSelected ? selected.symbol : null, timeframe);
  const fxcmHistory = useFxcmHistoricalKlines(fxcmSelected ? selected.symbol : null, timeframe);
  const wasLiveRef = useRef(false);
  const lastClosedRef = useRef<number | null>(null);

  const candles = useMemo(() => {
    if (fxcmSelected) {
      if (fxcmHistory.state !== "ready") return [];
      return sanitizeCandles(fxcmHistory.candles.map((candle) => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        closed: candle.closed,
      })));
    }
    if (!binanceSelected || history.state !== "ready") return [];
    if (history.symbol !== selected.symbol || history.timeframe !== timeframe) return [];
    const base = sanitizeCandles(history.candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      closed: candle.closed,
    })));
    const live = liveKline.kline;
    if (
      !live
      || live.symbol !== selected.symbol
      || live.timeframe !== timeframe
      || liveKline.subscribedSymbol !== selected.symbol
      || liveKline.timeframe !== timeframe
    ) {
      return base;
    }
    return sanitizeCandles(applyLiveKline(base, live.candle));
  }, [binanceSelected, fxcmSelected, fxcmHistory, history, liveKline.kline, liveKline.subscribedSymbol, liveKline.timeframe, selected, timeframe]);

  // After reconnect becomes LIVE, softly resync REST history so gaps are filled without inventing candles.
  // When a forming candle closes, refresh once so the closed series matches Binance REST.
  useEffect(() => {
    if (!binanceSelected) {
      wasLiveRef.current = false;
      lastClosedRef.current = null;
      return;
    }
    const live = Boolean(
      liveKline.liveMarketData
      && liveKline.kline?.symbol === selected.symbol
      && liveKline.kline.timeframe === timeframe,
    );
    if (live && !wasLiveRef.current) {
      history.refresh();
    }
    wasLiveRef.current = live;
    const closedTime = liveKline.kline?.candle.closed ? liveKline.kline.candle.time : null;
    if (closedTime != null && closedTime !== lastClosedRef.current) {
      lastClosedRef.current = closedTime;
      history.refresh();
    }
  }, [
    binanceSelected,
    history.refresh,
    liveKline.liveMarketData,
    liveKline.kline,
    selected,
    timeframe,
  ]);

  const providerReady = (binanceSelected || fxcmSelected) && candles.length > 0;

  const overlayData = useMemo((): OverlaySeries[] => {
    if (!providerReady) return [];
    const series: OverlaySeries[] = [];
    for (const item of indicators) {
      if (item.kind === "sma") {
        series.push({ id: `SMA ${item.period}`, color: OVERLAY_COLORS.sma, points: calculateSMA(candles, item.period ?? 20) });
      } else if (item.kind === "ema") {
        series.push({ id: `EMA ${item.period}`, color: OVERLAY_COLORS.ema, points: calculateEMA(candles, item.period ?? 20) });
      } else if (item.kind === "bollinger") {
        const bands = calculateBollingerBands(candles, item.period ?? 20, item.deviation ?? 2);
        series.push({ id: `BB mid ${item.period}`, color: OVERLAY_COLORS.bollinger, points: bands.middle });
        series.push({ id: `BB up ${item.period}`, color: "#6f8f7c", points: bands.upper });
        series.push({ id: `BB low ${item.period}`, color: "#6f8f7c", points: bands.lower });
      }
    }
    return series;
  }, [providerReady, candles, indicators]);

  const rsiPoints = useMemo(() => {
    if (!providerReady) return [];
    const rsi = indicators.find((item) => item.kind === "rsi");
    return rsi ? calculateRSI(candles, rsi.period ?? 14) : [];
  }, [providerReady, candles, indicators]);

  const macdData = useMemo(() => {
    if (!providerReady) return null;
    const macd = indicators.find((item) => item.kind === "macd");
    return macd ? calculateMACD(candles, macd.fastPeriod ?? 12, macd.slowPeriod ?? 26, macd.signalPeriod ?? 9) : null;
  }, [providerReady, candles, indicators]);

  const onCandleFocus = useCallback((candle: Candle | null) => {
    setFocused(candle);
  }, []);

  const last = candles[candles.length - 1] ?? null;
  const display = focused ?? last;
  const canAnalyze = providerReady;
  const sma20 = useMemo(() => (canAnalyze ? lastValue(calculateSMA(candles, 20)) : null), [canAnalyze, candles]);
  const sma50 = useMemo(() => (canAnalyze ? lastValue(calculateSMA(candles, 50)) : null), [canAnalyze, candles]);
  const ema50 = useMemo(() => (canAnalyze ? lastValue(calculateEMA(candles, 50)) : null), [canAnalyze, candles]);
  const rsiLast = useMemo(() => (canAnalyze ? lastValue(rsiPoints) : null), [canAnalyze, rsiPoints]);
  const macdLast = useMemo(() => (canAnalyze && macdData ? lastValue(macdData.macd) : null), [canAnalyze, macdData]);
  const macdSignalLast = useMemo(() => (canAnalyze && macdData ? lastValue(macdData.signal) : null), [canAnalyze, macdData]);
  const bb = useMemo(() => (
    canAnalyze
      ? calculateBollingerBands(candles, 20, 2)
      : { middle: [] as Array<{ time: number; value: number }>, upper: [] as Array<{ time: number; value: number }>, lower: [] as Array<{ time: number; value: number }> }
  ), [canAnalyze, candles]);
  const bbWidth = bb.middle.length
    ? ((bb.upper[bb.upper.length - 1].value - bb.lower[bb.lower.length - 1].value) / bb.middle[bb.middle.length - 1].value) * 100
    : null;
  const bbMid = bb.middle.length ? bb.middle[bb.middle.length - 1].value : null;

  const toggleFullscreen = async () => {
    const node = workspaceRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setFullscreen(false);
      return;
    }
    await node.requestFullscreen();
    setFullscreen(true);
  };

  const addIndicator = () => {
    if (!canAnalyze) return;
    if (indicators.some((item) => item.kind === addKind) && (addKind === "rsi" || addKind === "macd")) return;
    if (addKind === "sma") setIndicators((current) => [...current, { id: nextId("sma"), kind: "sma", period: 20 }]);
    else if (addKind === "ema") setIndicators((current) => [...current, { id: nextId("ema"), kind: "ema", period: 50 }]);
    else if (addKind === "bollinger") setIndicators((current) => [...current, { id: nextId("bb"), kind: "bollinger", period: 20, deviation: 2 }]);
    else if (addKind === "rsi") setIndicators((current) => [...current, { id: nextId("rsi"), kind: "rsi", period: 14 }]);
    else setIndicators((current) => [...current, { id: nextId("macd"), kind: "macd", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }]);
  };

  const addLevel = (kind: PriceLevel["kind"]) => {
    if (!canAnalyze) return;
    const price = Number(levelPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    setLevels((current) => [...current, { id: nextId(kind), kind, price }]);
    setLevelPrice("");
  };

  const analysis = mode === "analysis";
  const fxcmHistoryReady = Boolean(
    fxcmSelected
    && fxcmHistory.state === "ready"
    && candles.length > 0,
  );
  const historyReady = Boolean(
    (binanceSelected
      && history.state === "ready"
      && history.symbol === selected.symbol
      && history.timeframe === timeframe
      && candles.length > 0)
    || fxcmHistoryReady,
  );
  const historyPending = Boolean(
    (binanceSelected && (
      history.state === "loading"
      || history.symbol !== selected.symbol
      || history.timeframe !== timeframe
    ))
    || (fxcmSelected && fxcmHistory.state === "loading"),
  );
  const klineStatus = resolveKlineUiStatus(
    liveKline,
    binanceSelected ? selected.symbol : null,
    timeframe,
    historyReady && binanceSelected,
  );
  const chartLive = !fxcmSelected && klineStatus === "LIVE";
  const tickerStatus = liveTicker && binanceSelected
    ? resolveTickerUiStatus(liveTicker, selected.symbol)
    : null;
  const tickerLive = !fxcmSelected && tickerStatus === "LIVE";
  // Only mark the headline price LIVE when the displayed figure is the matching miniTicker.
  const priceKind = tickerLive ? "live" : "unavailable";
  const headlinePrice = fxcmSelected
    ? (last ? formatPrice(selected.symbol, last.close) : LIVE_PRICE_UNAVAILABLE)
    : !binanceSelected
      ? LIVE_PRICE_UNAVAILABLE
      : tickerLive && liveTicker
        ? liveTickerPriceLabel(liveTicker)
        : last
          ? formatPrice(selected.symbol, last.close)
          : (liveTicker ? liveTickerPriceLabel(liveTicker) : "Waiting for live Binance data...");
  const chartState = fxcmSelected
    ? (fxcmHistory.state === "loading" ? "loading"
      : fxcmHistory.state === "error" || fxcmHistory.state === "unavailable" ? "error"
        : fxcmHistory.state === "empty" ? "empty"
          : fxcmHistoryReady ? "ready" : "unavailable")
    : !binanceSelected
      ? "unavailable"
      : historyPending
        ? (klineStatus === "RECONNECTING" ? "reconnecting" : "loading")
        : history.state === "error"
          ? "error"
          : history.state === "disconnected"
            ? "disconnected"
            : history.state === "empty"
              ? "empty"
              : klineStatus === "RECONNECTING"
                ? "reconnecting"
                : klineStatus === "CONNECTING" || klineStatus === "CONNECTED"
                  ? "connecting"
                  : chartLive
                    ? "live"
                    : "ready";
  const chartMessage = fxcmSelected
    ? (fxcmHistory.state === "loading" ? "Loading FXCM historical candles…"
      : fxcmHistory.state === "error" || fxcmHistory.state === "unavailable" ? fxcmHistory.message
        : fxcmHistory.state === "empty" ? "No FXCM historical candles."
          : `HISTORICAL · SOURCE: ${fxcmHistory.source ?? "FXCM"} (not LIVE)`)
    : !binanceSelected
      ? (selected ? LIVE_MARKET_UNAVAILABLE : "Select a Binance Spot symbol from Markets.")
      : historyPending
        ? (klineStatus === "RECONNECTING" ? "Reconnecting to Binance..." : "Loading Binance market data...")
        : history.state === "error"
          ? "Unable to load Binance market data."
          : history.state === "disconnected"
            ? "Binance live data unavailable."
            : history.state === "empty"
              ? "No Binance candle data available."
              : chartLive
                ? "Live Binance data"
                : liveMarketStatusLabel(klineStatus);
  const analysisUnavailableReason = fxcmSelected
    ? (fxcmHistory.state === "loading" ? "Loading FXCM historical candles for technical analysis…"
      : fxcmHistory.message || "Waiting for FXCM historical candles…")
    : !binanceSelected
      ? (selected ? LIVE_MARKET_UNAVAILABLE : "Select a Binance Spot symbol from Markets.")
      : historyPending
        ? "Loading Binance candle data for technical analysis..."
        : history.state === "error"
          ? "Unable to load Binance market data."
          : history.state === "disconnected"
            ? "Binance live data unavailable."
            : history.state === "empty"
              ? "No Binance candle data available."
              : "Waiting for Binance candle data...";
  const showChart = historyReady;

  const marketState = useMemo(() => {
    // Phase 28: do not invent LIVE Market State for FXCM historical.
    if (!binanceSelected || !selected || candles.length === 0) return null;
    return buildForexMarketState({
      symbol: selected.symbol,
      timeframe,
      candles,
      connection: klineStatus,
      lastMarketUpdateMs: liveKline.kline?.eventTimeUtc ?? (last ? last.time * 1000 : null),
    });
  }, [binanceSelected, selected, candles, timeframe, klineStatus, liveKline.kline?.eventTimeUtc, last]);

  return (
    <section
      ref={workspaceRef}
      className={`fx-chart-workspace ${analysis ? "is-analysis" : ""}`}
      data-forex-chart-workspace={mode}
      data-forex-page={mode === "charts" ? "charts" : "technical-analysis"}
      data-chart-state={chartState}
      data-chart-live={chartLive ? "true" : "false"}
      data-chart-symbol={selected?.symbol ?? ""}
      data-chart-timeframe={timeframe}
      data-market-venue={selected?.venue ?? "none"}
      data-fx-source={binanceSelected ? "binance-spot" : "none"}
      data-fx-symbol={binanceSelected ? selected.symbol : ""}
      data-fx-timeframe={timeframe}
      data-fx-candle-count={canAnalyze ? String(candles.length) : "0"}
      data-fx-last-time={canAnalyze && last ? String(last.time) : ""}
      data-fx-open={canAnalyze && last ? String(last.open) : ""}
      data-fx-high={canAnalyze && last ? String(last.high) : ""}
      data-fx-low={canAnalyze && last ? String(last.low) : ""}
      data-fx-close={canAnalyze && last ? String(last.close) : ""}
      data-fx-volume={canAnalyze && last && last.volume != null ? String(last.volume) : ""}
      data-fx-connection={chartLive ? "LIVE" : klineStatus}
      data-fx-forming={canAnalyze && last && last.closed === false ? "true" : "false"}
      data-ms-version={marketState?.version ?? ""}
      data-ms-symbol={marketState?.symbol ?? ""}
      data-ms-timeframe={marketState?.timeframe ?? ""}
      data-ms-close={marketState?.price?.close != null ? String(marketState.price.close) : ""}
      data-ms-open-time={marketState?.candleOpenTime != null ? String(marketState.candleOpenTime) : ""}
      data-ms-trend={marketState?.trend?.direction ?? ""}
      data-ms-rsi={marketState?.momentum?.rsi != null ? String(marketState.momentum.rsi) : ""}
      data-ms-connection={marketState?.dataQuality.connection ?? ""}
      data-ms-valid={marketState?.dataQuality.valid ? "true" : "false"}
      data-ms-candle-count={marketState ? String(marketState.dataQuality.candleCount) : "0"}
      data-ta-source={binanceSelected ? "binance-spot" : "none"}
      data-ta-candle-count={canAnalyze ? String(candles.length) : "0"}
      data-ta-last-close={canAnalyze && last ? String(last.close) : ""}
      data-ta-last-time={canAnalyze && last ? String(last.time) : ""}
      data-ta-sma20={sma20 == null ? "" : String(sma20)}
      data-ta-sma50={sma50 == null ? "" : String(sma50)}
      data-ta-ema50={ema50 == null ? "" : String(ema50)}
      data-ta-rsi14={rsiLast == null ? "" : String(rsiLast)}
      data-ta-macd={macdLast == null ? "" : String(macdLast)}
    >
      <ForexSectionHeader
        eyebrow={analysis ? "Analysis" : "Market"}
        title={analysis ? "Technical Analysis" : "Charts"}
        description={analysis
          ? "Indicators use the same Binance Spot candle series as Charts. This is not a trading signal."
          : "Interactive candlestick workspace for Binance Spot OHLCV. Non-Binance symbols are not charted."}
      />

      <div className="fx-chart-controls" role="toolbar" aria-label="Chart controls">
        <label>
          Instrument
          <select aria-label="Instrument" value={binanceSelected ? selected.symbol : ""} disabled>
            {binanceSelected ? (
              <option value={selected.symbol}>{selected.displaySymbol} · Binance Spot</option>
            ) : (
              <option value="">Select a Binance Spot symbol…</option>
            )}
          </select>
        </label>
        <label>
          Timeframe
          <select aria-label="Timeframe" value={timeframe} onChange={(event) => applyTimeframe(event.target.value as ChartTimeframeId)}>
            {CHART_TIMEFRAMES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          Chart type
          <select aria-label="Chart type" value={chartType} onChange={(event) => setChartType(event.target.value as ChartTypeId)}>
            <option value="candlestick">Candlestick</option>
            <option value="line">Line</option>
          </select>
        </label>
        <div className="fx-chart-control-buttons">
          {onOpenModule ? (
            <>
              <button type="button" className="fx-text-button" onClick={() => onOpenModule("markets")}>
                Open Markets
              </button>
              <button
                type="button"
                className="fx-text-button"
                onClick={() => onOpenModule(analysis ? "charts" : "technical-analysis")}
              >
                {analysis ? "Open Charts" : "Open Technical Analysis"}
              </button>
            </>
          ) : null}
          <button type="button" className="fx-icon-button" aria-label="Zoom in" onClick={() => chartRef.current?.zoom(1)}><ZoomIn size={16} /></button>
          <button type="button" className="fx-icon-button" aria-label="Zoom out" onClick={() => chartRef.current?.zoom(-1)}><ZoomOut size={16} /></button>
          <button type="button" className="fx-icon-button" aria-label="Fit content" onClick={() => chartRef.current?.fitContent()}><RotateCcw size={16} /></button>
          <button type="button" className="fx-icon-button" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div className="fx-chart-summary">
        <div>
          <p className="fx-eyebrow">{selected?.displaySymbol ?? "No market selected"}</p>
          <p className="fx-chart-price" data-price-kind={priceKind}>
            {headlinePrice}
          </p>
          <p className="fx-panel-meta">
            {binanceSelected
              ? `${selected.displaySymbol} · ${CHART_TIMEFRAMES.find((item) => item.id === timeframe)?.label} · Binance Spot klines`
              : LIVE_MARKET_UNAVAILABLE}
          </p>
        </div>
        <div className="fx-status-stack">
          {binanceSelected ? (
            <>
              <ForexStatusBadge tone={liveMarketStatusTone(historyPending ? "CONNECTING" : klineStatus)}>
                {historyPending ? "Loading Binance market data..." : liveMarketStatusLabel(klineStatus)}
              </ForexStatusBadge>
              {tickerLive ? (
                <ForexStatusBadge tone="live">Price LIVE</ForexStatusBadge>
              ) : null}
            </>
          ) : (
            <ForexStatusBadge tone="offline">Live market data unavailable</ForexStatusBadge>
          )}
        </div>
      </div>

      {showChart ? (
        <ForexPriceChart
          ref={chartRef}
          seriesKey={`${selected!.symbol}:${timeframe}`}
          candles={candles}
          chartType={chartType}
          overlays={overlayData}
          rsi={rsiPoints}
          macd={macdData}
          levels={levels}
          onCandleFocus={onCandleFocus}
        />
      ) : (
        <div className="fx-chart-state" role="status" data-chart-unavailable="true">
          <h2>{chartMessage}</h2>
          <p>
            {binanceSelected
              ? chartMessage
              : "Open Markets, select a Binance Spot symbol, then return here for genuine OHLCV. Development candles are not shown in production."}
          </p>
        </div>
      )}

      <dl className="fx-ohlc" data-forex-ohlc="true" aria-label={binanceSelected ? "Binance OHLC" : "OHLC unavailable"}>
        <div><dt>Open</dt><dd>{binanceSelected ? formatPrice(selected.symbol, display?.open ?? null) : LIVE_PRICE_UNAVAILABLE}</dd></div>
        <div><dt>High</dt><dd>{binanceSelected ? formatPrice(selected.symbol, display?.high ?? null) : LIVE_PRICE_UNAVAILABLE}</dd></div>
        <div><dt>Low</dt><dd>{binanceSelected ? formatPrice(selected.symbol, display?.low ?? null) : LIVE_PRICE_UNAVAILABLE}</dd></div>
        <div><dt>Close</dt><dd>{binanceSelected ? formatPrice(selected.symbol, display?.close ?? null) : LIVE_PRICE_UNAVAILABLE}</dd></div>
        <div><dt>Time</dt><dd>{display && binanceSelected ? formatUtc(display.time) : "—"}</dd></div>
        <div><dt>Volume</dt><dd>{binanceSelected && display?.volume != null ? display.volume.toFixed(4) : "—"}</dd></div>
      </dl>

      <div className={`fx-chart-side ${analysis ? "is-wide" : ""}`}>
        <section className="fx-indicator-manager" aria-labelledby="fx-ind-title">
          <h2 id="fx-ind-title">Indicators</h2>
          <p className="fx-panel-meta" data-ta-indicator-source="binance-spot">
            Calculated from Binance Spot OHLCV — the same candle series as Charts.
          </p>
          {!canAnalyze ? <p className="fx-panel-meta" data-analysis-unavailable="true">{analysisUnavailableReason}</p> : null}
          <div className="fx-indicator-add">
            <select aria-label="Add indicator type" value={addKind} onChange={(event) => setAddKind(event.target.value as IndicatorKind)} disabled={!canAnalyze}>
              <option value="sma">SMA</option>
              <option value="ema">EMA</option>
              <option value="rsi">RSI</option>
              <option value="macd">MACD</option>
              <option value="bollinger">Bollinger Bands</option>
            </select>
            <button type="button" className="fx-text-button" onClick={addIndicator} disabled={!canAnalyze}>Add indicator</button>
          </div>
          <ul className="fx-indicator-list">
            {indicators.map((item) => {
              const latest = canAnalyze && selected
                ? indicatorLatestValue(item.kind, candles, item)
                : null;
              const readout = selected
                ? formatIndicatorReadout(item.kind, latest, selected.symbol)
                : "Insufficient data";
              return (
                <li key={item.id} data-ta-indicator={item.kind} data-ta-indicator-value={latest == null ? "" : String(latest)}>
                  <span>
                    {item.kind.toUpperCase()}{item.period ? ` ${item.period}` : item.kind === "macd" ? " 12/26/9" : ""}
                    {" · "}
                    <strong data-ta-indicator-readout="true">{readout}</strong>
                  </span>
                  {item.period ? (
                    <input
                      aria-label={`${item.kind} period`}
                      type="number"
                      min={2}
                      max={200}
                      value={item.period}
                      disabled={!canAnalyze}
                      onChange={(event) => setIndicators((current) => current.map((row) => row.id === item.id ? { ...row, period: Number(event.target.value) || row.period } : row))}
                    />
                  ) : null}
                  <button type="button" className="fx-text-button" onClick={() => setIndicators((current) => current.filter((row) => row.id !== item.id))}>Remove</button>
                </li>
              );
            })}
          </ul>
        </section>

        {analysis ? (
          <>
            <section aria-labelledby="fx-summary-title" data-ta-analysis-summary="true">
              <h2 id="fx-summary-title">Analysis summary</h2>
              <p className="fx-panel-meta">Descriptive measurements from Binance Spot candles only. No buy or sell recommendation.</p>
              {!canAnalyze ? (
                <p className="fx-panel-meta" data-analysis-unavailable="true">{analysisUnavailableReason}</p>
              ) : (
                <dl className="fx-analysis-dl">
                  <div>
                    <dt>Trend</dt>
                    <dd data-ta-trend="true">
                      {sma20 !== null && sma50 !== null
                        ? `SMA 20 (${formatPrice(selected!.symbol, sma20)}) is ${sma20 > sma50 ? "above" : "below"} SMA 50 (${formatPrice(selected!.symbol, sma50)})`
                        : "Insufficient data for SMA 20 / SMA 50"}
                    </dd>
                  </div>
                  <div>
                    <dt>EMA</dt>
                    <dd data-ta-ema="true">
                      {ema50 !== null ? `EMA 50 is ${formatPrice(selected!.symbol, ema50)}` : "Insufficient data for EMA 50"}
                    </dd>
                  </div>
                  <div>
                    <dt>Momentum</dt>
                    <dd data-ta-momentum="true">
                      {rsiLast !== null
                        ? `RSI 14 is ${rsiLast.toFixed(1)}${rsiLast >= 70 ? " (above 70 reference)" : rsiLast <= 30 ? " (below 30 reference)" : ""}`
                        : indicators.some((item) => item.kind === "rsi")
                          ? "Insufficient data for RSI 14"
                          : "RSI not active"}
                    </dd>
                  </div>
                  <div>
                    <dt>MACD</dt>
                    <dd data-ta-macd-summary="true">
                      {macdLast !== null && macdSignalLast !== null
                        ? `MACD ${macdLast.toFixed(4)} · signal ${macdSignalLast.toFixed(4)}`
                        : indicators.some((item) => item.kind === "macd")
                          ? "Insufficient data for MACD"
                          : "MACD not active"}
                    </dd>
                  </div>
                  <div>
                    <dt>Volatility</dt>
                    <dd data-ta-volatility="true">
                      {bbWidth !== null && bbMid !== null
                        ? `Bollinger mid ${formatPrice(selected!.symbol, bbMid)} · width ${bbWidth.toFixed(2)}%`
                        : "Insufficient data for Bollinger Bands"}
                    </dd>
                  </div>
                  <div><dt>Structure</dt><dd>Automatic market-structure detection is not implemented.</dd></div>
                  <div>
                    <dt>Series</dt>
                    <dd data-ta-series="true">
                      {selected!.symbol} · {timeframe} · {candles.length} Binance candles
                      {last ? ` · last close ${formatPrice(selected!.symbol, last.close)}` : ""}
                    </dd>
                  </div>
                </dl>
              )}
            </section>
            <section aria-labelledby="fx-levels-title">
              <h2 id="fx-levels-title">Support / Resistance</h2>
              <div className="fx-indicator-add">
                <input aria-label="Price level" inputMode="decimal" value={levelPrice} onChange={(event) => setLevelPrice(event.target.value)} placeholder="Price" disabled={!canAnalyze} />
                <button type="button" className="fx-text-button" onClick={() => addLevel("support")} disabled={!canAnalyze}>Add support</button>
                <button type="button" className="fx-text-button" onClick={() => addLevel("resistance")} disabled={!canAnalyze}>Add resistance</button>
              </div>
              <ul className="fx-indicator-list">
                {levels.map((level) => (
                  <li key={level.id}>
                    <span>{level.kind} {selected ? formatPrice(selected.symbol, level.price) : LIVE_PRICE_UNAVAILABLE}</span>
                    <button type="button" className="fx-text-button" onClick={() => setLevels((current) => current.filter((row) => row.id !== level.id))}>Remove</button>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="fx-notes-title">
              <h2 id="fx-notes-title">Analysis notes</h2>
              <textarea
                aria-label="Analysis notes"
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Session-local notes. Not generated by AI."
              />
            </section>
          </>
        ) : null}
      </div>

      <p className="fx-panel-meta" data-forex-chart-status="true">
        {CHART_TIMEFRAMES.find((item) => item.id === timeframe)?.label}
        {" · "}
        {chartMessage}
        {" · Last candle "}
        {last && binanceSelected ? formatUtc(last.time) : "unavailable"}
        {chartLive && liveKline.kline ? ` · Last update ${formatLastUpdateUtc(liveKline.kline.eventTimeUtc)}` : ""}
        {" · Connection: "}
        {chartLive ? "LIVE" : "not live"}
        {last && binanceSelected && last.closed === false ? " · Forming candle" : ""}
        {last && binanceSelected && last.closed === true ? " · Candle closed" : ""}
      </p>
    </section>
  );
}
