import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchHfmAllSymbols,
  fetchHfmMarketWatchCatalog,
} from "../market-watch/api";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import { useHfmRealtimeStore } from "../hfm-realtime-store";
import { HfmChartEngine, type HfmChartEngineHandle, type HfmCrosshairInfo } from "./HfmChartEngine";
import { useHfmChartData } from "./use-hfm-chart-data";
import { formatHfmSpread, isLiveFormingTimeframe } from "./live-forming";
import {
  clearHfmChartDrawings,
  deleteHfmChartTemplate,
  fetchHfmChartDrawings,
  fetchHfmChartPreferences,
  fetchHfmChartTemplates,
  renameHfmChartTemplate,
  saveHfmChartDrawings,
  saveHfmChartPreferences,
  saveHfmChartTemplate,
  setDefaultHfmChartTemplate,
  prepareHfmAnalysisContextRequest,
  runHfmAiReasoningRequest,
} from "./api";
import {
  HFM_CHART_TIMEFRAMES,
  isVerifiedHfmChartTf,
  type HfmChartTemplate,
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
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<HfmIndicatorConfig[]>([
    { id: "ema-50", kind: "ema", period: 50, visible: true, color: "#60a5fa" },
    { id: "ema-200", kind: "ema", period: 200, visible: true, color: "#e879f9" },
    { id: "rsi-14", kind: "rsi", period: 14, visible: true, color: "#c084fc" },
  ]);
  const [addKind, setAddKind] = useState<HfmIndicatorKind>("sma");
  const [showGrid, setShowGrid] = useState(true);
  const [crosshair, setCrosshair] = useState<HfmCrosshairInfo | null>(null);
  const [phase2Busy, setPhase2Busy] = useState(false);
  const [phase2Status, setPhase2Status] = useState<string>("Idle — Phase 2 context prep available");
  const [phase2Detail, setPhase2Detail] = useState<string>("");
  const [preparedContextId, setPreparedContextId] = useState<string | null>(null);
  const [preparedContextSymbol, setPreparedContextSymbol] = useState<string | null>(null);
  const [preparedQuality, setPreparedQuality] = useState<string | null>(null);
  const [preparedImageTfs, setPreparedImageTfs] = useState<string>("");
  const [phase3Busy, setPhase3Busy] = useState(false);
  const [phase3Status, setPhase3Status] = useState<string>("AI Analysis not started");
  const [phase3Summary, setPhase3Summary] = useState<string>("");
  const [phase3Result, setPhase3Result] = useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = useState<HfmChartTemplate[]>([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [persistNote, setPersistNote] = useState<string | null>(null);
  const chartRef = useRef<HfmChartEngineHandle>(null);
  const persistTimer = useRef<number | null>(null);
  const prefsTimer = useRef<number | null>(null);
  const drawingsHydrated = useRef(false);
  const prefsHydrated = useRef(false);
  const drawingRevisionRef = useRef(0);
  const prefsRevisionRef = useRef(0);

  const series = useHfmChartData(symbol, timeframe);
  const digits = series.quote.digits ?? (symbol.includes("XAU") || symbol.includes("XAG") ? 2 : 5);
  const liveCapable = isLiveFormingTimeframe(timeframe);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pack, prefs] = await Promise.all([
        fetchHfmChartTemplates(),
        fetchHfmChartPreferences(),
      ]);
      if (cancelled) return;
      setTemplates(pack.templates);
      setDefaultTemplateId(pack.defaultTemplateId);
      if (prefs) {
        prefsRevisionRef.current = prefs.revision ?? 0;
        setChartType(prefs.chartType);
        setShowGrid(prefs.showGrid);
        if (prefs.defaultTimeframe) setTimeframe(prefs.defaultTimeframe as HfmChartTimeframe);
        if (prefs.lastSymbol) setSymbol(prefs.lastSymbol);
        if (prefs.indicators?.length) {
          setIndicators(prefs.indicators as HfmIndicatorConfig[]);
        }
        prefsHydrated.current = true;
      } else {
        const def = pack.templates.find((t) => t.id === pack.defaultTemplateId);
        if (def) {
          setChartType(def.chartType);
          setShowGrid(def.showGrid);
          if (def.indicators?.length) setIndicators(def.indicators);
        }
        prefsHydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    drawingsHydrated.current = false;
    setSelectedDrawingId(null);
    (async () => {
      const pack = await fetchHfmChartDrawings(symbol, timeframe);
      if (cancelled) return;
      drawingRevisionRef.current = pack.revision;
      setDrawings((prev) => {
        const others = prev.filter((d) => !(d.symbol === symbol && d.timeframe === timeframe));
        return [...others, ...pack.drawings];
      });
      drawingsHydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  const schedulePersistDrawings = useCallback((next: HfmDrawing[]) => {
    if (!drawingsHydrated.current) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      const scope = next.filter((d) => d.symbol === symbol && d.timeframe === timeframe);
      void saveHfmChartDrawings(symbol, timeframe, scope, drawingRevisionRef.current)
        .then((res) => {
          if (res.conflict) {
            setPersistNote("Drawing save conflict — reloaded");
            drawingRevisionRef.current = res.revision;
            setDrawings((prev) => {
              const others = prev.filter((d) => !(d.symbol === symbol && d.timeframe === timeframe));
              return [...others, ...res.drawings];
            });
            return;
          }
          drawingRevisionRef.current = res.revision;
          setPersistNote("Drawings saved");
        })
        .catch(() => setPersistNote("Drawing save failed"));
    }, 450);
  }, [symbol, timeframe]);

  // Debounced chart preferences (not every tick).
  useEffect(() => {
    if (!prefsHydrated.current) return;
    if (prefsTimer.current) window.clearTimeout(prefsTimer.current);
    prefsTimer.current = window.setTimeout(() => {
      void saveHfmChartPreferences(
        {
          chartType,
          showGrid,
          defaultTimeframe: timeframe,
          lastSymbol: symbol,
          indicators: indicators as unknown as Array<Record<string, unknown>>,
        },
        prefsRevisionRef.current,
      ).then((res) => {
        if (res.conflict && res.preferences) {
          prefsRevisionRef.current = res.preferences.revision ?? prefsRevisionRef.current;
          setPersistNote("Preferences conflict — kept server copy");
          return;
        }
        if (res.preferences?.revision != null) prefsRevisionRef.current = res.preferences.revision;
      });
    }, 1200);
  }, [chartType, showGrid, timeframe, symbol, indicators]);

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
    schedulePersistDrawings(next);
  }, [drawings, schedulePersistDrawings]);

  const commitDrawing = useCallback((d: HfmDrawing) => {
    pushDrawings([...drawings, d]);
    setSelectedDrawingId(d.id);
    setActiveTool("cursor");
  }, [drawings, pushDrawings]);

  const updateDrawing = useCallback((d: HfmDrawing) => {
    setDrawings((cur) => {
      const next = cur.map((x) => (x.id === d.id ? d : x));
      schedulePersistDrawings(next);
      return next;
    });
  }, [schedulePersistDrawings]);

  const visibleDrawings = useMemo(
    () => drawings.filter((d) => d.symbol === symbol && d.timeframe === timeframe),
    [drawings, symbol, timeframe],
  );

  const selected = visibleDrawings.find((d) => d.id === selectedDrawingId) ?? null;

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
    connectionStatus: series.status,
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

  const applyTemplate = (tpl: HfmChartTemplate) => {
    setChartType(tpl.chartType);
    setShowGrid(tpl.showGrid);
    if (tpl.indicators?.length) setIndicators(tpl.indicators);
    setPersistNote(`Applied template “${tpl.name}”`);
  };

  const saveCurrentTemplate = async () => {
    const name = window.prompt("Template name", `Template ${templates.length + 1}`);
    if (!name) return;
    const tpl: HfmChartTemplate = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim().slice(0, 80),
      chartType,
      showGrid,
      indicators,
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveHfmChartTemplate(tpl);
    if (!saved) {
      setPersistNote("Template save failed");
      return;
    }
    const pack = await fetchHfmChartTemplates();
    setTemplates(pack.templates);
    setDefaultTemplateId(pack.defaultTemplateId);
    setPersistNote(`Saved template “${saved.name}”`);
  };

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
          {persistNote ? <span className="hfm-charts-muted">{persistNote}</span> : null}
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
          <div><dt>Spread</dt><dd>{formatHfmSpread(series.quote.spread, digits)}</dd></div>
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
              title={isVerifiedHfmChartTf(tf) ? "STEP 2 verified · live forming" : "Request from HFM — may be unavailable"}
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
            schedulePersistDrawings(prev);
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
            schedulePersistDrawings(next);
          }}
        >
          Redo
        </button>
        <button type="button" className="hfm-charts-action" onClick={() => void saveCurrentTemplate()}>Save template</button>
        <label>
          Templates
          <select
            aria-label="Chart templates"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              const tpl = templates.find((t) => t.id === id);
              if (tpl) applyTemplate(tpl);
            }}
          >
            <option value="">Load…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.id === defaultTemplateId ? " ★" : ""}
              </option>
            ))}
          </select>
        </label>
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
              const next = drawings.filter((d) => !(d.symbol === symbol && d.timeframe === timeframe));
              pushDrawings(next);
              void clearHfmChartDrawings(symbol, timeframe);
              setSelectedDrawingId(null);
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
              selectedDrawingId={selectedDrawingId}
              onSelectDrawing={setSelectedDrawingId}
              onCrosshair={setCrosshair}
              onDrawingCommit={commitDrawing}
              onDrawingUpdate={updateDrawing}
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
              <div><dt>Spread</dt><dd>{formatHfmSpread(crosshair.spread, digits)}</dd></div>
              <div><dt>Time</dt><dd>{new Date(crosshair.time * 1000).toISOString().replace(".000Z", "Z")}</dd></div>
            </dl>
          ) : null}
        </div>

        <aside className="hfm-charts-side" aria-label="Price summary">
          <h2>Price summary</h2>
          <dl>
            <div><dt>Bid</dt><dd>{formatPrice(series.quote.bid, digits)}</dd></div>
            <div><dt>Ask</dt><dd>{formatPrice(series.quote.ask, digits)}</dd></div>
            <div><dt>Spread</dt><dd>{formatHfmSpread(series.quote.spread, digits)}</dd></div>
            <div><dt>High</dt><dd>{formatPrice(dayHigh, digits)}</dd></div>
            <div><dt>Low</dt><dd>{formatPrice(dayLow, digits)}</dd></div>
            <div><dt>Open</dt><dd>{formatPrice(open, digits)}</dd></div>
            <div><dt>Prev close</dt><dd>{formatPrice(prevClose, digits)}</dd></div>
            <div><dt>Forming</dt><dd>
              {series.forming
                ? `${formatPrice(series.forming.open, digits)} / ${formatPrice(series.forming.high, digits)} / ${formatPrice(series.forming.low, digits)} / ${formatPrice(series.forming.close, digits)}`
                : "—"}
            </dd></div>
            <div><dt>Source</dt><dd>{series.source ?? "—"}</dd></div>
            <div><dt>Live</dt><dd>
              {series.liveStatus}
              {liveCapable ? ` · ${timeframe} forming` : " · hist only (TF not live-verified)"}
            </dd></div>
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
                <button type="button" className="hfm-charts-action" data-active={selectedDrawingId === d.id} onClick={() => setSelectedDrawingId(d.id)}>
                  {d.tool}{d.locked ? " 🔒" : ""}
                </button>
                <button type="button" onClick={() => pushDrawings(drawings.filter((x) => x.id !== d.id))}>Delete</button>
              </li>
            ))}
            {!visibleDrawings.length ? <li className="hfm-charts-muted">None on {symbol} {timeframe}</li> : null}
          </ul>
          {selected ? (
            <div className="hfm-charts-drawing-props" aria-label="Selected drawing properties">
              <h2>Selected drawing</h2>
              <label>
                Color
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(selected.color) ? selected.color : "#8b5cf6"}
                  disabled={selected.locked}
                  onChange={(e) => updateDrawing({ ...selected, color: e.target.value })}
                />
              </label>
              <label>
                Style
                <select
                  value={selected.lineStyle}
                  disabled={selected.locked}
                  onChange={(e) => updateDrawing({
                    ...selected,
                    lineStyle: e.target.value as HfmDrawing["lineStyle"],
                  })}
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
              <label>
                Width
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={selected.lineWidth}
                  disabled={selected.locked}
                  onChange={(e) => updateDrawing({ ...selected, lineWidth: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={selected.visible}
                  onChange={() => updateDrawing({ ...selected, visible: !selected.visible })}
                />
                Visible
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(selected.locked)}
                  onChange={() => updateDrawing({ ...selected, locked: !selected.locked })}
                />
                Locked
              </label>
            </div>
          ) : null}
          <h2>Templates</h2>
          <ul className="hfm-charts-ind-list">
            {templates.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => applyTemplate(t)}>{t.name}</button>
                <button
                  type="button"
                  title="Set default"
                  onClick={async () => {
                    await setDefaultHfmChartTemplate(t.id);
                    setDefaultTemplateId(t.id);
                  }}
                >
                  ★
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const name = window.prompt("Rename template", t.name);
                    if (!name) return;
                    await renameHfmChartTemplate(t.id, name);
                    const pack = await fetchHfmChartTemplates();
                    setTemplates(pack.templates);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete template “${t.name}”?`)) return;
                    await deleteHfmChartTemplate(t.id);
                    const pack = await fetchHfmChartTemplates();
                    setTemplates(pack.templates);
                    setDefaultTemplateId(pack.defaultTemplateId);
                  }}
                >
                  Del
                </button>
              </li>
            ))}
            {!templates.length ? <li className="hfm-charts-muted">No saved templates</li> : null}
          </ul>
        </aside>
      </div>

      <section
        className="hfm-charts-analysis-boundary"
        data-hfm-analysis-boundary="true"
        data-analysis-implemented="false"
        data-phase2-context="true"
        data-phase3-reasoning="true"
        aria-label="AI Analysis reserved section"
      >
        <header>
          <h2>AI Analysis</h2>
          <span className="hfm-charts-pill" data-tone="muted">HFM MT5 · Manual reasoning</span>
        </header>
        <p data-analysis-safety="true">
          AI ANALYSIS ONLY — NO BROKER ORDERS ARE PLACED. No BUY/SELL signals authorize execution
          (placesOrders=false). Chart symbol now: {symbol}.
        </p>
        <div className="hfm-charts-phase2-row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={phase2Busy || phase3Busy}
            data-phase2-prepare="true"
            onClick={async () => {
              setPhase2Busy(true);
              setPhase2Status("Preparing HFM multi-TF context…");
              setPhase2Detail("");
              setPhase3Result(null);
              setPhase3Summary("");
              setPhase3Status("AI Analysis not started");
              try {
                const body = await prepareHfmAnalysisContextRequest({
                  symbol,
                  chartTimeframe: timeframe,
                });
                const state = String(body.state ?? "");
                const snap = body.snapshot as {
                  snapshotId?: string;
                  symbol?: string;
                  dataQuality?: { status?: string };
                  synchronization?: { status?: string };
                } | null;
                const quality = snap?.dataQuality?.status ?? null;
                const images = body.chartImages && typeof body.chartImages === "object"
                  ? Object.keys(body.chartImages as object).join(",")
                  : "";
                const ctxId = snap?.snapshotId ?? null;
                setPreparedContextId(ctxId);
                setPreparedContextSymbol(snap?.symbol ?? symbol);
                setPreparedQuality(quality);
                setPreparedImageTfs(images);
                setPhase2Status(`${state}${quality ? ` · quality ${quality}` : ""}`);
                setPhase2Detail(
                  `context=${ctxId ?? "—"} · sync=${snap?.synchronization?.status ?? "—"} · images=${images || "none"}`,
                );
              } catch (err) {
                setPreparedContextId(null);
                setPhase2Status("FAILED");
                setPhase2Detail(err instanceof Error ? err.message : String(err));
              } finally {
                setPhase2Busy(false);
              }
            }}
          >
            {phase2Busy ? "Preparing…" : "Prepare HFM Analysis Context"}
          </button>
          <button
            type="button"
            disabled={phase3Busy || phase2Busy || !preparedContextId || preparedQuality !== "VALID"}
            data-phase3-reason="true"
            onClick={async () => {
              if (!preparedContextId) return;
              setPhase3Busy(true);
              setPhase3Status("Running AI analysis…");
              setPhase3Summary("");
              setPhase3Result(null);
              try {
                const body = await runHfmAiReasoningRequest({ contextId: preparedContextId });
                const analysis = (body.analysis as Record<string, unknown> | undefined) ?? null;
                const status = String(analysis?.status ?? body.state ?? "UNKNOWN");
                setPhase3Status(status);
                setPhase3Result(analysis);
                const result = analysis?.result as {
                  decision?: { action?: string; confidence?: number; summary?: string };
                  model?: string;
                } | null;
                setPhase3Summary(
                  [
                    `symbol=${String(analysis?.symbol ?? preparedContextSymbol ?? "")}`,
                    `action=${result?.decision?.action ?? "—"}`,
                    `confidence=${result?.decision?.confidence ?? "—"}`,
                    `model=${result?.model ?? analysis?.model ?? "—"}`,
                    `analysisId=${String(analysis?.analysisId ?? "—")}`,
                    result?.decision?.summary ?? String(analysis?.errorMessage ?? ""),
                  ].filter(Boolean).join(" · "),
                );
              } catch (err) {
                setPhase3Status("FAILED");
                setPhase3Summary(err instanceof Error ? err.message : String(err));
              } finally {
                setPhase3Busy(false);
              }
            }}
          >
            {phase3Busy ? "Analyzing…" : "Run AI Analysis"}
          </button>
          <span className="hfm-charts-muted" data-phase2-status="true">{phase2Status}</span>
        </div>
        {phase2Detail ? <p className="hfm-charts-muted" data-phase2-detail="true">{phase2Detail}</p> : null}
        <p className="hfm-charts-muted" data-phase3-status="true">
          Reasoning: {phase3Status}
          {preparedContextSymbol && preparedContextSymbol !== symbol
            ? ` · result bound to ${preparedContextSymbol} (chart now ${symbol})`
            : ""}
        </p>
        {phase3Summary ? <p data-phase3-summary="true">{phase3Summary}</p> : null}
        {phase3Result?.result ? (
          <div data-phase3-result="true" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>
            <div>Images: {preparedImageTfs || "—"} · TFs H1/M30/M15/M5</div>
            <div>
              Decision: {String((phase3Result.result as { decision?: { action?: string } }).decision?.action ?? "—")}
              {" · "}
              Confidence is model-reported analytical confidence (not profit probability).
            </div>
            {(() => {
              const r = phase3Result.result as {
                analysisStatus?: string;
                completeness?: { status?: string; missingSections?: string[]; notes?: string[] };
                marketOverview?: { sectionStatus?: string };
                riskAssessment?: { sectionStatus?: string; riskLevel?: string };
                timeframeAnalysis?: Record<string, { sectionStatus?: string }>;
                pricePrecision?: { verified?: boolean; reason?: string | null };
              };
              const missing = r.completeness?.missingSections ?? [];
              const tfStatuses = ["H1", "M30", "M15", "M5"].map((tf) => {
                const st = r.timeframeAnalysis?.[tf]?.sectionStatus;
                return `${tf}:${st === "NOT_PROVIDED" ? "Not provided by AI" : st === "PROVIDED" ? "provided" : "—"}`;
              });
              return (
                <div data-phase3-completeness="true" style={{ marginTop: 6 }}>
                  <div>
                    Completeness: {r.completeness?.status ?? "—"}
                    {r.analysisStatus === "COMPLETED_WITH_GAPS" ? " · AI analysis incomplete" : ""}
                  </div>
                  <div>Timeframes: {tfStatuses.join(" · ")}</div>
                  <div>
                    Market overview: {r.marketOverview?.sectionStatus === "NOT_PROVIDED"
                      ? "Not provided by AI"
                      : r.marketOverview?.sectionStatus === "PROVIDED"
                        ? "provided"
                        : "—"}
                    {" · "}
                    Risk: {r.riskAssessment?.sectionStatus === "NOT_PROVIDED"
                      ? "Not provided by AI"
                      : (r.riskAssessment?.riskLevel ?? "—")}
                  </div>
                  {missing.length ? (
                    <div data-phase3-missing="true">Missing evidence: {missing.join(", ")}</div>
                  ) : null}
                  {r.pricePrecision?.verified === false && r.pricePrecision.reason ? (
                    <div>Price precision: {r.pricePrecision.reason}</div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : null}
        <pre className="hfm-charts-contract-preview" hidden>
          {JSON.stringify({
            provider: analysisBoundary.provider,
            symbol: analysisBoundary.symbol,
            timeframe: analysisBoundary.timeframe,
            candleCount: analysisBoundary.historicalCandles.length,
            freshness: analysisBoundary.freshness,
            placesOrders: analysisBoundary.placesOrders,
            preparedContextId,
            phase3Status,
          })}
        </pre>
      </section>
    </div>
  );
}
