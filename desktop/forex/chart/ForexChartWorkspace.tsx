import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { FOREX_INSTRUMENTS } from "../dashboard-data";
import { ForexStatusBadge } from "../components/ForexStatusBadge";
import { ForexSectionHeader } from "../components/ForexSectionHeader";
import { ForexPriceChart, type ForexPriceChartHandle, type OverlaySeries } from "./ForexPriceChart";
import { calculateBollingerBands, calculateEMA, calculateMACD, calculateRSI, calculateSMA, lastValue } from "./indicators";
import { fetchMarketSeries, readChartQuery, writeChartQuery } from "./market-data";
import {
  CHART_TIMEFRAMES,
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
  if (value === null || !Number.isFinite(value)) return "Price unavailable";
  const digits = symbol.includes("JPY") ? 3 : symbol.startsWith("XAU") ? 2 : 5;
  return value.toFixed(digits);
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

export function ForexChartWorkspace({ mode }: { mode: "charts" | "analysis" }) {
  const initial = readChartQuery();
  const [symbol, setSymbol] = useState(initial.symbol);
  const [timeframe, setTimeframe] = useState<ChartTimeframeId>(initial.timeframe);
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
    writeChartQuery(symbol, timeframe);
  }, [symbol, timeframe]);

  useEffect(() => {
    setLevels([]);
    setNotes("");
  }, [symbol, timeframe]);

  const result = useMemo(() => fetchMarketSeries(symbol, timeframe), [symbol, timeframe]);
  const candles = result.series?.candles ?? [];

  const overlayData = useMemo((): OverlaySeries[] => {
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
  }, [candles, indicators]);

  const rsiPoints = useMemo(() => {
    const rsi = indicators.find((item) => item.kind === "rsi");
    return rsi ? calculateRSI(candles, rsi.period ?? 14) : [];
  }, [candles, indicators]);

  const macdData = useMemo(() => {
    const macd = indicators.find((item) => item.kind === "macd");
    return macd ? calculateMACD(candles, macd.fastPeriod ?? 12, macd.slowPeriod ?? 26, macd.signalPeriod ?? 9) : null;
  }, [candles, indicators]);

  const onCandleFocus = useCallback((candle: Candle | null) => {
    setFocused(candle);
  }, []);

  const last = candles[candles.length - 1] ?? null;
  const display = focused ?? last;
  const sma20 = lastValue(calculateSMA(candles, 20));
  const sma50 = lastValue(calculateSMA(candles, 50));
  const rsiLast = lastValue(rsiPoints);
  const bb = calculateBollingerBands(candles, 20, 2);
  const bbWidth = bb.middle.length
    ? ((bb.upper[bb.upper.length - 1].value - bb.lower[bb.lower.length - 1].value) / bb.middle[bb.middle.length - 1].value) * 100
    : null;

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
    if (indicators.some((item) => item.kind === addKind) && (addKind === "rsi" || addKind === "macd")) return;
    if (addKind === "sma") setIndicators((current) => [...current, { id: nextId("sma"), kind: "sma", period: 20 }]);
    else if (addKind === "ema") setIndicators((current) => [...current, { id: nextId("ema"), kind: "ema", period: 50 }]);
    else if (addKind === "bollinger") setIndicators((current) => [...current, { id: nextId("bb"), kind: "bollinger", period: 20, deviation: 2 }]);
    else if (addKind === "rsi") setIndicators((current) => [...current, { id: nextId("rsi"), kind: "rsi", period: 14 }]);
    else setIndicators((current) => [...current, { id: nextId("macd"), kind: "macd", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }]);
  };

  const addLevel = (kind: PriceLevel["kind"]) => {
    const price = Number(levelPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    setLevels((current) => [...current, { id: nextId(kind), kind, price }]);
    setLevelPrice("");
  };

  const instrument = FOREX_INSTRUMENTS.find((item) => item.symbol === symbol);
  const analysis = mode === "analysis";

  return (
    <section
      ref={workspaceRef}
      className={`fx-chart-workspace ${analysis ? "is-analysis" : ""}`}
      data-forex-chart-workspace={mode}
      data-forex-page={mode === "charts" ? "charts" : "technical-analysis"}
    >
      <ForexSectionHeader
        eyebrow={analysis ? "Analysis" : "Market"}
        title={analysis ? "Technical Analysis" : "Charts"}
        description={analysis
          ? "Candlesticks, indicators, and analysis tools share one chart engine. This is not a trading signal."
          : "Interactive candlestick workspace. Development data is shown until a live market provider is connected."}
      />

      <div className="fx-chart-controls" role="toolbar" aria-label="Chart controls">
        <label>
          Instrument
          <select aria-label="Instrument" value={symbol} onChange={(event) => setSymbol(event.target.value)}>
            {FOREX_INSTRUMENTS.map((item) => (
              <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
            ))}
          </select>
        </label>
        <label>
          Timeframe
          <select aria-label="Timeframe" value={timeframe} onChange={(event) => setTimeframe(event.target.value as ChartTimeframeId)}>
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
          <p className="fx-eyebrow">{instrument?.symbol}</p>
          <p className="fx-chart-price">{formatPrice(symbol, last?.close ?? null)}</p>
          <p className="fx-panel-meta">{instrument?.name} · {CHART_TIMEFRAMES.find((item) => item.id === timeframe)?.label} · timezone UTC</p>
        </div>
        <div className="fx-status-stack">
          <ForexStatusBadge tone="offline">Development data</ForexStatusBadge>
          <ForexStatusBadge tone="future">Live market data not connected</ForexStatusBadge>
        </div>
      </div>

      {result.state === "ready" && result.series ? (
        <ForexPriceChart
          ref={chartRef}
          candles={candles}
          chartType={chartType}
          overlays={overlayData}
          rsi={rsiPoints}
          macd={macdData}
          levels={levels}
          onCandleFocus={onCandleFocus}
        />
      ) : (
        <div className="fx-chart-state" role="status">
          <h2>{result.state === "unavailable" ? "Unable to load market data." : "No chart data"}</h2>
          <p>{result.message}</p>
        </div>
      )}

      <dl className="fx-ohlc" data-forex-ohlc="true">
        <div><dt>Open</dt><dd>{formatPrice(symbol, display?.open ?? null)}</dd></div>
        <div><dt>High</dt><dd>{formatPrice(symbol, display?.high ?? null)}</dd></div>
        <div><dt>Low</dt><dd>{formatPrice(symbol, display?.low ?? null)}</dd></div>
        <div><dt>Close</dt><dd>{formatPrice(symbol, display?.close ?? null)}</dd></div>
        <div><dt>Time</dt><dd>{display ? formatUtc(display.time) : "—"}</dd></div>
        <div><dt>Volume</dt><dd>—</dd></div>
      </dl>

      <div className={`fx-chart-side ${analysis ? "is-wide" : ""}`}>
        <section className="fx-indicator-manager" aria-labelledby="fx-ind-title">
          <h2 id="fx-ind-title">Indicators</h2>
          <div className="fx-indicator-add">
            <select aria-label="Add indicator type" value={addKind} onChange={(event) => setAddKind(event.target.value as IndicatorKind)}>
              <option value="sma">SMA</option>
              <option value="ema">EMA</option>
              <option value="rsi">RSI</option>
              <option value="macd">MACD</option>
              <option value="bollinger">Bollinger Bands</option>
            </select>
            <button type="button" className="fx-text-button" onClick={addIndicator}>Add indicator</button>
          </div>
          <ul className="fx-indicator-list">
            {indicators.map((item) => (
              <li key={item.id}>
                <span>{item.kind.toUpperCase()}{item.period ? ` ${item.period}` : ""}</span>
                {item.period ? (
                  <input
                    aria-label={`${item.kind} period`}
                    type="number"
                    min={2}
                    max={200}
                    value={item.period}
                    onChange={(event) => setIndicators((current) => current.map((row) => row.id === item.id ? { ...row, period: Number(event.target.value) || row.period } : row))}
                  />
                ) : null}
                <button type="button" className="fx-text-button" onClick={() => setIndicators((current) => current.filter((row) => row.id !== item.id))}>Remove</button>
              </li>
            ))}
          </ul>
        </section>

        {analysis ? (
          <>
            <section aria-labelledby="fx-summary-title">
              <h2 id="fx-summary-title">Analysis summary</h2>
              <p className="fx-panel-meta">Descriptive measurements only. No buy or sell recommendation.</p>
              <dl className="fx-analysis-dl">
                <div><dt>Trend</dt><dd>{sma20 !== null && sma50 !== null ? (sma20 > sma50 ? "SMA 20 is above SMA 50" : "SMA 20 is below SMA 50") : "SMA structure unavailable"}</dd></div>
                <div><dt>Momentum</dt><dd>{rsiLast !== null ? `RSI 14 is ${rsiLast.toFixed(1)}` : "RSI not active"}</dd></div>
                <div><dt>Volatility</dt><dd>{bbWidth !== null ? `Bollinger width ${bbWidth.toFixed(2)}%` : "Bollinger width unavailable"}</dd></div>
                <div><dt>Structure</dt><dd>Automatic market-structure detection is not implemented.</dd></div>
              </dl>
            </section>
            <section aria-labelledby="fx-levels-title">
              <h2 id="fx-levels-title">Support / Resistance</h2>
              <div className="fx-indicator-add">
                <input aria-label="Price level" inputMode="decimal" value={levelPrice} onChange={(event) => setLevelPrice(event.target.value)} placeholder="Price" />
                <button type="button" className="fx-text-button" onClick={() => addLevel("support")}>Add support</button>
                <button type="button" className="fx-text-button" onClick={() => addLevel("resistance")}>Add resistance</button>
              </div>
              <ul className="fx-indicator-list">
                {levels.map((level) => (
                  <li key={level.id}>
                    <span>{level.kind} {formatPrice(symbol, level.price)}</span>
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
        {CHART_TIMEFRAMES.find((item) => item.id === timeframe)?.label} · {result.message} · Last candle {last ? formatUtc(last.time) : "unavailable"} · Connection: not live
      </p>
    </section>
  );
}
