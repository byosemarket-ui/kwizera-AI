import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchHfmAllSymbols,
  fetchHfmMarketWatchCatalog,
} from "../market-watch/api";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import { useHfmRealtimeStore } from "../hfm-realtime-store";
import { HfmChartEngine, type HfmChartEngineHandle, type HfmCrosshairInfo } from "./HfmChartEngine";
import { useHfmChartData } from "./use-hfm-chart-data";
import {
  HFM_CHART_TIMEFRAMES,
  isVerifiedHfmChartTf,
  type HfmChartTimeframe,
  type HfmChartTypeId,
  type HfmDrawing,
  type HfmDrawingToolId,
  type HfmIndicatorConfig,
  type HfmIndicatorKind,
} from "./types";
import { buildHfmChartsAnalysisSnapshot } from "../../../../ai/market-data/mt5-hfm/charts-analysis-contract";

const DRAW_TOOLS: Array<{ id: HfmDrawingToolId; label: string }> = [
  { id: "cursor", label: "Cursor" },
  { id: "hline", label: "H-Line" },
  { id: "vline", label: "V-Line" },
  { id: "trendline", label: "Trend" },
  { id: "rectangle", label: "Rect" },
  { id: "text", label: "Text" },
  { id: "channel", label: "Channel" },
  { id: "fib_retracement", label: "Fib" },
  { id: "fib_extension", label: "FibExt" },
];

let indSeq = 1;
function nextIndId(kind: string): string {
  indSeq += 1;
  return `${kind}-${indSeq}`;
}

function formatPrice(value: number | null, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function HfmChartsWorkspace() {
  const realtime = useHfmRealtimeStore();
  const [symbol, setSymbol] = useState("XAUUSD");
  const [description, setDescription] = useState<string | null>("Gold vs US Dollar");
  const [timeframe, setTimeframe] = useState<HfmChartTimeframe>("H4");
  const [chartType, setChartType] = useState<HfmChartTypeId>("candlestick");
  const [catalog, setCatalog] = useState<HfmCatalogInstrument[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<HfmDrawingToolId>("cursor");
  const [drawings, setDrawings] = useState<HfmDrawing[]>([]);
  const [undoStack, setUndoStack] = useState<HfmDrawing[][]>([]);
  const [redoStack, setRedoStack] = useState<HfmDrawing[][]>([]);
  const [indicators, setIndicators] = useState<HfmIndicatorConfig[]>([
    { id: "ema-50", kind: "ema", period: 50, visible: true, color: "#60a5fa" },
    { id: "ema-200", kind: "ema", period: 200, visible: true, color: "#e879f9" },
    { id: "rsi-14", kind: "rsi", period: 14, visible: true, color: "#c084fc" },
  ]);
  const [addKind, setAddKind] = useState<HfmIndicatorKind>("sma");
  const [showGrid, setShowGrid] = useState(true);
  const [crosshair, setCrosshair] = useState<HfmCrosshairInfo | null>(null);
  const chartRef = useRef<HfmChartEngineHandle>(null);

  const series = useHfmChartData(symbol, timeframe);
  const digits = series.quote.digits ?? (symbol.includes("XAU") || symbol.includes("XAG") ? 2 : 5);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchHfmMarketWatchCatalog();
        const all = await fetchHfmAllSymbols();
        if (!cancelled) setCatalog(all.symbols ?? []);
      } catch {
        if (!cancelled) setCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog.slice(0, 80);
    return catalog
      .filter((row) => {
        const sym = row.symbol.toLowerCase();
        const desc = (row.description ?? "").toLowerCase();
        return sym.includes(q) || desc.includes(q);
      })
      .slice(0, 80);
  }, [catalog, search]);

  const pushDrawings = useCallback((next: HfmDrawing[]) => {
    setUndoStack((u) => [...u.slice(-30), drawings]);
    setRedoStack([]);
    setDrawings(next);
  }, [drawings]);

  const commitDrawing = useCallback((d: HfmDrawing) => {
    pushDrawings([...drawings, d]);
  }, [drawings, pushDrawings]);

  const visibleDrawings = useMemo(
    () => drawings.filter((d) => d.symbol === symbol && d.timeframe === timeframe),
    [drawings, symbol, timeframe],
  );

  const analysisBoundary = useMemo(() => buildHfmChartsAnalysisSnapshot({
    symbol,
    instrumentDescription: description,
    timeframe,
    historicalCandles: series.bars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      tickVolume: b.tickVolume,
      realVolume: b.realVolume,
      spread: b.spread,
      closed: b.closed !== false,
      provenance: b.closed === false ? "live_aggregate" : "native",
    })),
    currentCandle: series.forming
      ? {
          time: series.forming.time,
          open: series.forming.open,
          high: series.forming.high,
          low: series.forming.low,
          close: series.forming.close,
          tickVolume: series.forming.tickVolume,
          realVolume: series.forming.realVolume,
          spread: series.forming.spread,
          closed: false,
          provenance: "live_aggregate",
        }
      : null,
    bid: series.quote.bid,
    ask: series.quote.ask,
    freshness: series.freshness === "LIVE" ? "LIVE"
      : series.freshness === "STALE" ? "STALE"
        : series.status === "DISCONNECTED" ? "DISCONNECTED"
          : series.status === "EMPTY" || series.status === "UNAVAILABLE" ? "NO_HISTORY"
            : "WAITING_FOR_DATA",
    validationStatus: series.bars.length ? "ok" : "unavailable",
    sourceProvenance: series.source ?? "HFM_MT5",
    indicatorDefinitions: indicators.map((i) => ({
      id: i.id,
      name: i.kind.toUpperCase(),
      parameters: {
        period: i.period ?? 0,
        period2: i.period2 ?? 0,
        period3: i.period3 ?? 0,
        deviation: i.deviation ?? 0,
        visible: i.visible,
      },
    })),
  }), [symbol, description, timeframe, series, indicators]);

  const login = realtime.account?.loginExact ?? realtime.account?.loginHint ?? "—";
  const connLabel =
    series.status === "CONNECTED" ? "Connected"
      : series.status === "STALE" ? "Stale"
        : series.status === "RECONNECTING" ? "Reconnecting"
          : series.status === "DISCONNECTED" ? "Disconnected"
            : series.status === "LOADING" ? "Loading"
              : series.status;

  const dayHigh = series.bars.length ? Math.max(...series.bars.map((b) => b.high)) : null;
  const dayLow = series.bars.length ? Math.min(...series.bars.map((b) => b.low)) : null;
  const open = series.bars[0]?.open ?? null;
  const prevClose = series.bars.length >= 2 ? series.bars[series.bars.length - 2]!.close : null;

  return (
    <div className="hfm-charts-workspace" data-hfm-charts="true" data-provider="HFM_MT5" data-readonly="true">
      <header className="hfm-charts-page-head">
        <div>
          <h1>Charts &amp; Analysis – HFM MT5</h1>
          <p className="hfm-charts-sub">
            Historical + live HFM Demo data · placesOrders=false · Analysis reserved below
          </p>
        </div>
        <div className="hfm-charts-head-meta">
          <span>Account (Demo) {login}</span>
          <span className="hfm-charts-pill" data-tone={series.status === "CONNECTED" ? "ok" : "warn"}>
            {connLabel}
          </span>
        </div>
      </header>

      <section className="hfm-charts-instrument" aria-label="Selected instrument">
        <div className="hfm-charts-symbol-block">
          <button type="button" className="hfm-charts-symbol-btn" onClick={() => setPickerOpen((v) => !v)}>
            <strong>{symbol}</strong>
            <span>{description ?? "Select instrument"}</span>
          </button>
          {pickerOpen ? (
            <div className="hfm-charts-picker" role="listbox" aria-label="HFM symbol catalog">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol or description…"
                aria-label="Search HFM symbols"
              />
              <ul>
                {filtered.map((row) => (
                  <li key={row.symbol}>
                    <button
                      type="button"
                      onClick={() => {
                        setSymbol(row.symbol);
                        setDescription(row.description ?? null);
                        setPickerOpen(false);
                        setSearch("");
                      }}
                    >
                      <strong>{row.symbol}</strong>
                      <span>{row.description ?? row.path ?? ""}</span>
                    </button>
                  </li>
                ))}
                {!filtered.length ? <li className="hfm-charts-muted">No catalog matches</li> : null}
              </ul>
              <p className="hfm-charts-muted">{catalog.length} HFM instruments loaded</p>
            </div>
          ) : null}
        </div>
        <dl className="hfm-charts-quote-strip">
          <div><dt>Bid</dt><dd data-tone="up">{formatPrice(series.quote.bid, digits)}</dd></div>
          <div><dt>Ask</dt><dd data-tone="down">{formatPrice(series.quote.ask, digits)}</dd></div>
          <div><dt>Spread</dt><dd>{series.quote.spread == null ? "—" : series.quote.spread.toFixed(Math.min(digits, 2))}</dd></div>
          <div>
            <dt>Change</dt>
            <dd data-tone={(series.quote.change ?? 0) >= 0 ? "up" : "down"}>
              {series.quote.change == null
                ? "—"
                : `${series.quote.change >= 0 ? "+" : ""}${series.quote.change.toFixed(digits)} (${series.quote.changePct == null ? "—" : `${series.quote.changePct >= 0 ? "+" : ""}${series.quote.changePct.toFixed(2)}%`})`}
            </dd>
          </div>
          <div><dt>Freshness</dt><dd>{series.freshness ?? series.status}</dd></div>
          <div><dt>Updated</dt><dd>{series.quote.receivedAt ? new Date(series.quote.receivedAt).toLocaleTimeString() : "—"}</dd></div>
        </dl>
      </section>

      <div className="hfm-charts-toolbar" role="toolbar" aria-label="Chart toolbar">
        <div className="hfm-charts-tf" role="group" aria-label="Timeframes">
          {HFM_CHART_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              data-active={timeframe === tf}
              data-verified={isVerifiedHfmChartTf(tf) ? "true" : "false"}
              title={isVerifiedHfmChartTf(tf) ? "STEP 2 verified" : "Request from HFM — may be unavailable"}
              onClick={() => setTimeframe(tf)}
            >
              {tf === "MN1" ? "MN" : tf}
            </button>
          ))}
        </div>
        <label>
          Type
          <select value={chartType} onChange={(e) => setChartType(e.target.value as HfmChartTypeId)} aria-label="Chart type">
            <option value="candlestick">Candlestick</option>
            <option value="ohlc">OHLC</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
          </select>
        </label>
        <label>
          Add indicator
          <select value={addKind} onChange={(e) => setAddKind(e.target.value as HfmIndicatorKind)} aria-label="Add indicator">
            <option value="sma">SMA</option>
            <option value="ema">EMA</option>
            <option value="rsi">RSI</option>
            <option value="macd">MACD</option>
            <option value="stoch">Stochastic</option>
            <option value="cci">CCI</option>
            <option value="atr">ATR</option>
            <option value="bollinger">Bollinger</option>
            <option value="adx">ADX</option>
            <option value="tick_volume">Tick Volume</option>
            <option value="real_volume">Real Volume</option>
          </select>
        </label>
        <button
          type="button"
          className="hfm-charts-action"
          onClick={() => {
            const defaults: Partial<HfmIndicatorConfig> = {
              sma: { period: 20, color: "#b9f2cc" },
              ema: { period: 20, color: "#60a5fa" },
              rsi: { period: 14, color: "#c084fc" },
              macd: { period: 12, period2: 26, period3: 9 },
              stoch: { period: 14, period2: 3 },
              cci: { period: 20 },
              atr: { period: 14 },
              bollinger: { period: 20, deviation: 2 },
              adx: { period: 14 },
              tick_volume: {},
              real_volume: {},
            }[addKind];
            setIndicators((cur) => [...cur, { id: nextIndId(addKind), kind: addKind, visible: true, ...defaults }]);
          }}
        >
          Add
        </button>
        <button type="button" className="hfm-charts-action" onClick={() => chartRef.current?.zoom(1)}>Zoom+</button>
        <button type="button" className="hfm-charts-action" onClick={() => chartRef.current?.zoom(-1)}>Zoom−</button>
        <button type="button" className="hfm-charts-action" onClick={() => chartRef.current?.fitContent()}>Fit</button>
        <button type="button" className="hfm-charts-action" onClick={() => chartRef.current?.resetView()}>Reset</button>
        <button type="button" className="hfm-charts-action" onClick={() => chartRef.current?.requestFullscreen()}>Fullscreen</button>
        <button type="button" className="hfm-charts-action" data-active={showGrid} onClick={() => setShowGrid((v) => !v)}>Grid</button>
        <button
          type="button"
          className="hfm-charts-action"
          onClick={() => {
            if (!undoStack.length) return;
            const prev = undoStack[undoStack.length - 1]!;
            setRedoStack((r) => [...r, drawings]);
            setUndoStack((u) => u.slice(0, -1));
            setDrawings(prev);
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="hfm-charts-action"
          onClick={() => {
            if (!redoStack.length) return;
            const next = redoStack[redoStack.length - 1]!;
            setUndoStack((u) => [...u, drawings]);
            setRedoStack((r) => r.slice(0, -1));
            setDrawings(next);
          }}
        >
          Redo
        </button>
        <button type="button" className="hfm-charts-action" onClick={() => series.refresh()}>Refresh</button>
      </div>

      <div className="hfm-charts-body">
        <aside className="hfm-charts-draw-rail" aria-label="Drawing tools">
          {DRAW_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-active={activeTool === t.id}
              title={t.label}
              onClick={() => setActiveTool(t.id)}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            title="Clear drawings"
            onClick={() => {
              if (!window.confirm("Clear drawings for this symbol/timeframe?")) return;
              pushDrawings(drawings.filter((d) => !(d.symbol === symbol && d.timeframe === timeframe)));
            }}
          >
            Clear
          </button>
        </aside>

        <div className="hfm-charts-stage">
          {series.status === "LOADING" ? <p className="hfm-charts-state" role="status">Loading HFM {symbol} {timeframe}…</p> : null}
          {series.error && !series.bars.length ? (
            <p className="hfm-charts-state" role="alert" data-tone="bad">{series.error}</p>
          ) : null}
          {series.bars.length ? (
            <HfmChartEngine
              ref={chartRef}
              symbol={symbol}
              timeframe={timeframe}
              bars={series.bars}
              chartType={chartType}
              digits={digits}
              indicators={indicators}
              drawings={visibleDrawings}
              activeTool={activeTool}
              showGrid={showGrid}
              onCrosshair={setCrosshair}
              onDrawingCommit={commitDrawing}
              onLoadOlder={series.hasMore ? series.loadOlder : undefined}
            />
          ) : series.status !== "LOADING" ? (
            <p className="hfm-charts-state">No HFM candles for {symbol} · {timeframe}. No synthetic data.</p>
          ) : null}
          {crosshair ? (
            <dl className="hfm-charts-ohlc" aria-label="Crosshair OHLC">
              <div><dt>O</dt><dd>{formatPrice(crosshair.open, digits)}</dd></div>
              <div><dt>H</dt><dd>{formatPrice(crosshair.high, digits)}</dd></div>
              <div><dt>L</dt><dd>{formatPrice(crosshair.low, digits)}</dd></div>
              <div><dt>C</dt><dd>{formatPrice(crosshair.close, digits)}</dd></div>
              <div><dt>TickVol</dt><dd>{crosshair.tickVolume ?? "—"}</dd></div>
              <div><dt>RealVol</dt><dd>{crosshair.realVolume ?? "—"}</dd></div>
              <div><dt>Spread</dt><dd>{crosshair.spread ?? "—"}</dd></div>
              <div><dt>Time</dt><dd>{new Date(crosshair.time * 1000).toISOString().replace(".000Z", "Z")}</dd></div>
            </dl>
          ) : null}
        </div>

        <aside className="hfm-charts-side" aria-label="Price summary">
          <h2>Price summary</h2>
          <dl>
            <div><dt>Bid</dt><dd>{formatPrice(series.quote.bid, digits)}</dd></div>
            <div><dt>Ask</dt><dd>{formatPrice(series.quote.ask, digits)}</dd></div>
            <div><dt>Spread</dt><dd>{series.quote.spread ?? "—"}</dd></div>
            <div><dt>High</dt><dd>{formatPrice(dayHigh, digits)}</dd></div>
            <div><dt>Low</dt><dd>{formatPrice(dayLow, digits)}</dd></div>
            <div><dt>Open</dt><dd>{formatPrice(open, digits)}</dd></div>
            <div><dt>Prev close</dt><dd>{formatPrice(prevClose, digits)}</dd></div>
            <div><dt>Source</dt><dd>{series.source ?? "—"}</dd></div>
            <div><dt>Live</dt><dd>{series.liveStatus}{timeframe === "M1" ? " · M1 forming" : " · hist native"}</dd></div>
          </dl>
          <h2>Indicators</h2>
          <ul className="hfm-charts-ind-list">
            {indicators.map((ind) => (
              <li key={ind.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={ind.visible}
                    onChange={() => setIndicators((cur) => cur.map((x) => x.id === ind.id ? { ...x, visible: !x.visible } : x))}
                  />
                  {ind.kind.toUpperCase()}{ind.period ? ` ${ind.period}` : ""}
                </label>
                <button type="button" onClick={() => setIndicators((cur) => cur.filter((x) => x.id !== ind.id))}>Remove</button>
              </li>
            ))}
          </ul>
          <h2>Drawings</h2>
          <ul className="hfm-charts-ind-list">
            {visibleDrawings.map((d) => (
              <li key={d.id}>
                <span>{d.tool}</span>
                <button type="button" onClick={() => pushDrawings(drawings.filter((x) => x.id !== d.id))}>Delete</button>
              </li>
            ))}
            {!visibleDrawings.length ? <li className="hfm-charts-muted">None on {symbol} {timeframe}</li> : null}
          </ul>
        </aside>
      </div>

      {/* Reserved STEP 4 / Analysis boundary — no AI signals in STEP 3 */}
      <section
        className="hfm-charts-analysis-boundary"
        data-hfm-analysis-boundary="true"
        data-analysis-implemented="false"
        aria-label="AI Analysis reserved section"
      >
        <header>
          <h2>AI Analysis</h2>
          <span className="hfm-charts-pill" data-tone="muted">Reserved — not implemented in STEP 3</span>
        </header>
        <p>
          Charts expose a structured HFM market context for a future Analysis module
          ({analysisBoundary.historicalCandles.length} candles · {analysisBoundary.timeframe} · provider {analysisBoundary.provider}).
          No BUY/SELL signals, confidence scores, entries, or broker mutations are generated here.
        </p>
        <pre className="hfm-charts-contract-preview" hidden>
          {JSON.stringify({
            provider: analysisBoundary.provider,
            symbol: analysisBoundary.symbol,
            timeframe: analysisBoundary.timeframe,
            candleCount: analysisBoundary.historicalCandles.length,
            freshness: analysisBoundary.freshness,
            placesOrders: analysisBoundary.placesOrders,
          })}
        </pre>
      </section>
    </div>
  );
}
