/**
 * Phase 60.0.1–60.0.14 — Trade Monitor (read-only), compact responsive UI.
 * Does not place, modify, cancel, or close broker orders.
 * Admin auth uses the shared Forex Admin Access service.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ForexAdminAccessLink } from "./admin-access/ForexAdminAccessCard";
import { buildForexAdminHeaders } from "./admin-access/forex-admin-token";
import { useForexAdminToken } from "./admin-access/use-forex-admin-token";
import type { ChartTimeframeId } from "./chart/types";
import type { SelectedMarket } from "./market-data/selected-market";
import {
  formatOptionalNumber,
  formatSide,
  formatSignedPl,
  formatTimestamp,
  formatUnavailable,
  resolveQuoteFreshnessLabel,
} from "./trade-monitor/format";
import {
  parseBrokerRoTables,
  parseTradeHistory,
} from "./trade-monitor/parse-broker-tables";
import {
  formatMetricCurrency,
  parseTradePerformance,
  type PerformancePeriodPreset,
  type TradeMonitorPerformancePayload,
} from "./trade-monitor/performance-view";
import {
  buildRuntimeObservability,
  shouldMarkLastKnownStale,
} from "./trade-monitor/runtime-observability";
import type {
  TradeMonitorConnectionSnapshot,
  TradeMonitorHistoryPayload,
  TradeMonitorLoadState,
  TradeMonitorTablesPayload,
} from "./trade-monitor/types";
import {
  TRADE_MONITOR_VIEWS,
  buildAllViewRows,
  buildClosed24hBundle,
  type TradeMonitorViewId,
} from "./trade-monitor/view-filter";

const POLL_MS = 12_000;
const HISTORY_PAGE_SIZE = 25;

function MetricValue({
  text,
  tone = "unknown",
}: {
  text: string;
  tone?: "positive" | "negative" | "neutral" | "unknown";
}) {
  return (
    <span className={`fx-tm-metric-value is-${tone}`} data-tone={tone}>
      {text}
    </span>
  );
}

function markPriceClass(freshness: string | null | undefined): string {
  const f = String(freshness ?? "");
  if (f === "QUOTE_RECEIVED") return "is-verified";
  if (f === "QUOTE_STALE" || f === "BROKER_CLOSE_ONLY") return "is-stale";
  return "is-unavailable";
}

function envChip(environment: string | null | undefined): string {
  const e = String(environment ?? "").toLowerCase();
  if (e === "demo") return "DEMO";
  if (e === "real" || e === "live") return "LIVE";
  return environment ? environment.toUpperCase() : "—";
}

export function ForexTradeMonitorPage(_props: {
  selectedMarket: SelectedMarket | null;
  timeframe: ChartTimeframeId;
}) {
  const { token, snapshot: adminSnap } = useForexAdminToken();
  const [tables, setTables] = useState<TradeMonitorTablesPayload | null>(null);
  const [tablesState, setTablesState] = useState<TradeMonitorLoadState>("idle");
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [tablesStale, setTablesStale] = useState(false);
  const [connection, setConnection] = useState<TradeMonitorConnectionSnapshot | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<TradeMonitorHistoryPayload | null>(null);
  const [historyState, setHistoryState] = useState<TradeMonitorLoadState>("idle");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyInstrument, setHistoryInstrument] = useState("");
  const [historyDirection, setHistoryDirection] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [historyStatus, setHistoryStatus] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [historyOffset, setHistoryOffset] = useState(0);
  const [periodPreset, setPeriodPreset] = useState<PerformancePeriodPreset>("today");
  const [perf, setPerf] = useState<TradeMonitorPerformancePayload | null>(null);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [view, setView] = useState<TradeMonitorViewId>("live");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const tablesAbortRef = useRef<AbortController | null>(null);
  const historyAbortRef = useRef<AbortController | null>(null);
  const perfAbortRef = useRef<AbortController | null>(null);
  const tablesReqId = useRef(0);
  const historyReqId = useRef(0);
  const perfReqId = useRef(0);
  const authGenRef = useRef(adminSnap.generation);

  const loadConnection = useCallback(async () => {
    try {
      const [statusSettled, streamSettled] = await Promise.allSettled([
        fetch("/api/forex/providers/forexconnect/status", { headers: { Accept: "application/json" } }),
        fetch("/api/forex/providers/forexconnect/stream/status", { headers: { Accept: "application/json" } }),
      ]);
      const statusRes = statusSettled.status === "fulfilled" ? statusSettled.value : null;
      const streamRes = streamSettled.status === "fulfilled" ? streamSettled.value : null;
      const status = statusRes?.ok ? await statusRes.json() as Record<string, unknown> : null;
      const stream = streamRes?.ok ? await streamRes.json() as Record<string, unknown> : null;
      const sessionStatus = String(stream?.sessionStatus ?? status?.status ?? "") || null;
      const streamState = String(stream?.streamState ?? "") || null;
      const lastQuoteAt = stream?.lastQuoteAt != null ? String(stream.lastQuoteAt) : null;
      const lastQuoteAgeMs = typeof stream?.lastQuoteAgeMs === "number" ? stream.lastQuoteAgeMs : null;
      const updateCount = typeof stream?.updateCount === "number" ? stream.updateCount : null;
      const offersSnapshotPresent = typeof stream?.offersSnapshotPresent === "boolean"
        ? stream.offersSnapshotPresent
        : null;
      const quoteFreshnessLabel = resolveQuoteFreshnessLabel({
        sessionStatus,
        streamState,
        lastQuoteAt,
        lastQuoteAgeMs,
        updateCount,
      });
      setConnection({
        sessionStatus,
        environment: status?.environment != null ? String(status.environment) : null,
        trading: status?.trading != null ? String(status.trading) : "DISABLED",
        streamState,
        offersListenerActive: typeof stream?.offersListenerActive === "boolean"
          ? stream.offersListenerActive
          : null,
        subscriptionCount: typeof stream?.subscriptionCount === "number"
          ? stream.subscriptionCount
          : null,
        lastQuoteAt,
        lastQuoteAgeMs,
        updateCount,
        offersSnapshotPresent,
        quoteFreshnessLabel,
      });
    } catch {
      setConnection((prev) => prev ?? {
        sessionStatus: "ERROR",
        environment: null,
        trading: "DISABLED",
        streamState: null,
        offersListenerActive: null,
        subscriptionCount: null,
        lastQuoteAt: null,
        lastQuoteAgeMs: null,
        updateCount: null,
        offersSnapshotPresent: null,
        quoteFreshnessLabel: "SESSION_DISCONNECTED",
      });
    }
  }, []);

  const loadTables = useCallback(async () => {
    if (!token.trim()) {
      setTables(null);
      setTablesState("auth_required");
      setTablesError("Admin API token required for broker-ro-tables.");
      return;
    }
    tablesAbortRef.current?.abort();
    const ac = new AbortController();
    tablesAbortRef.current = ac;
    const reqId = ++tablesReqId.current;
    setTablesState((prev) => (prev === "ready" || prev === "empty" ? prev : "loading"));
    try {
      const tablesPath = "/api/forex/automated-trading/broker-ro-tables";
      const res = await fetch(tablesPath, {
        headers: buildForexAdminHeaders(tablesPath, { includeJsonContentType: true }),
        signal: ac.signal,
      });
      if (reqId !== tablesReqId.current) return;
      const body = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (reqId !== tablesReqId.current) return;
      if (res.status === 401 || res.status === 403) {
        const code = String((body?.error as { code?: string } | undefined)?.code ?? "ADMIN_FORBIDDEN");
        setTables(null);
        setTablesState(code.includes("MISSING") ? "auth_required" : "forbidden");
        setTablesError(
          String((body?.error as { message?: string } | undefined)?.message
            ?? "Admin authorization failed for broker read-only tables."),
        );
        return;
      }
      if (!res.ok || !body) {
        setTablesState("error");
        setTablesError(`broker-ro-tables HTTP ${res.status}`);
        setTables((prev) => {
          setTablesStale(shouldMarkLastKnownStale(Boolean(prev), true));
          return prev;
        });
        return;
      }
      const parsed = parseBrokerRoTables(body);
      if (!parsed) {
        setTablesState("error");
        setTablesError("Unrecognized broker-ro-tables payload.");
        setTables((prev) => {
          setTablesStale(shouldMarkLastKnownStale(Boolean(prev), true));
          return prev;
        });
        return;
      }
      setTables(parsed);
      setTablesStale(false);
      setTablesError(null);
      setLastFetchedAt(new Date().toISOString());
      const empty =
        parsed.openPositions.count === 0
        && parsed.openWorkingOrders.count === 0
        && parsed.accounts.accounts.length === 0;
      setTablesState(empty ? "empty" : "ready");
    } catch (error) {
      if (ac.signal.aborted || reqId !== tablesReqId.current) return;
      setTablesState("error");
      setTablesError(error instanceof Error ? error.message : "Failed to load broker tables.");
      setTables((prev) => {
        setTablesStale(shouldMarkLastKnownStale(Boolean(prev), true));
        return prev;
      });
    }
  }, [token]);

  const primaryAccountMasked = tables?.accounts.accounts[0]?.accountIdMasked ?? null;

  const loadHistory = useCallback(async () => {
    if (!token.trim()) {
      setHistory(null);
      setHistoryState("auth_required");
      setHistoryError("Admin API token required for trade history.");
      return;
    }
    historyAbortRef.current?.abort();
    const ac = new AbortController();
    historyAbortRef.current = ac;
    const reqId = ++historyReqId.current;
    setHistoryState((prev) => (prev === "ready" || prev === "empty" ? prev : "loading"));
    try {
      const params = new URLSearchParams();
      params.set("limit", String(HISTORY_PAGE_SIZE));
      params.set("offset", String(historyOffset));
      if (historyFrom.trim()) params.set("from", new Date(historyFrom).toISOString());
      if (historyTo.trim()) params.set("to", new Date(historyTo).toISOString());
      if (historyInstrument.trim()) params.set("instrument", historyInstrument.trim());
      if (historyDirection !== "ALL") params.set("direction", historyDirection);
      if (historyStatus !== "ALL") params.set("status", historyStatus);
      if (primaryAccountMasked) params.set("accountIdMasked", primaryAccountMasked);

      const historyPath = `/api/forex/automated-trading/trade-history?${params.toString()}`;
      const res = await fetch(
        historyPath,
        {
          headers: buildForexAdminHeaders(historyPath, { includeJsonContentType: true }),
          signal: ac.signal,
        },
      );
      if (reqId !== historyReqId.current) return;
      const body = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (reqId !== historyReqId.current) return;
      if (res.status === 401 || res.status === 403) {
        setHistory(null);
        setHistoryState("forbidden");
        setHistoryError("Admin authorization failed for trade history.");
        return;
      }
      if (!res.ok || !body) {
        setHistoryState("error");
        setHistoryError(`trade-history HTTP ${res.status}`);
        return;
      }
      const parsed = parseTradeHistory(body);
      if (!parsed) {
        setHistoryState("error");
        setHistoryError("Unrecognized trade-history payload.");
        return;
      }
      setHistory(parsed);
      setHistoryError(null);
      setHistoryState(parsed.records.length === 0 ? "empty" : "ready");
    } catch (error) {
      if (ac.signal.aborted || reqId !== historyReqId.current) return;
      setHistoryState("error");
      setHistoryError(error instanceof Error ? error.message : "Failed to load trade history.");
    }
  }, [
    token,
    historyOffset,
    historyFrom,
    historyTo,
    historyInstrument,
    historyDirection,
    historyStatus,
    primaryAccountMasked,
  ]);

  const loadPerformance = useCallback(async () => {
    if (!token.trim()) {
      setPerf(null);
      setPerfError("Admin API token required for trade performance.");
      return;
    }
    perfAbortRef.current?.abort();
    const ac = new AbortController();
    perfAbortRef.current = ac;
    const reqId = ++perfReqId.current;
    try {
      const params = new URLSearchParams();
      if (periodPreset === "today") params.set("preset", "today");
      else if (periodPreset === "all") params.set("preset", "all");
      else {
        if (historyFrom.trim()) params.set("from", new Date(historyFrom).toISOString());
        if (historyTo.trim()) params.set("to", new Date(historyTo).toISOString());
      }
      if (historyInstrument.trim()) params.set("instrument", historyInstrument.trim());
      if (historyDirection !== "ALL") params.set("direction", historyDirection);
      if (primaryAccountMasked) params.set("accountIdMasked", primaryAccountMasked);

      const perfPath = `/api/forex/automated-trading/trade-performance?${params.toString()}`;
      const res = await fetch(
        perfPath,
        {
          headers: buildForexAdminHeaders(perfPath, { includeJsonContentType: true }),
          signal: ac.signal,
        },
      );
      if (reqId !== perfReqId.current) return;
      const body = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (reqId !== perfReqId.current) return;
      if (res.status === 401 || res.status === 403) {
        setPerf(null);
        setPerfError("Admin authorization failed for trade performance.");
        return;
      }
      if (!res.ok || !body) {
        setPerfError(`trade-performance HTTP ${res.status}`);
        return;
      }
      const parsed = parseTradePerformance(body);
      if (!parsed) {
        setPerfError("Unrecognized trade-performance payload.");
        return;
      }
      setPerf(parsed);
      setPerfError(null);
    } catch (error) {
      if (ac.signal.aborted || reqId !== perfReqId.current) return;
      setPerfError(error instanceof Error ? error.message : "Failed to load performance.");
    }
  }, [
    token,
    periodPreset,
    historyFrom,
    historyTo,
    historyInstrument,
    historyDirection,
    primaryAccountMasked,
  ]);

  useEffect(() => {
    void loadConnection();
    void loadTables();
    const id = window.setInterval(() => {
      setNowMs(Date.now());
      void loadConnection();
      void loadTables();
      void loadPerformance();
    }, POLL_MS);
    return () => {
      window.clearInterval(id);
      tablesAbortRef.current?.abort();
      historyAbortRef.current?.abort();
      perfAbortRef.current?.abort();
    };
  }, [loadConnection, loadTables, loadPerformance]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  useEffect(() => {
    if (authGenRef.current === adminSnap.generation) return;
    authGenRef.current = adminSnap.generation;
    setTables(null);
    setHistory(null);
    setPerf(null);
    setTablesError(null);
    setHistoryError(null);
    setPerfError(null);
    setTablesStale(false);
    void loadTables();
    void loadHistory();
    void loadPerformance();
  }, [adminSnap.generation, loadTables, loadHistory, loadPerformance]);

  const primaryAccount = tables?.accounts.accounts[0] ?? null;
  const currency = primaryAccount?.accountCurrency ?? null;
  const historyAvailableFrom =
    perf?.performance.historyAvailableFromUtc
    ?? history?.historyAvailableFromUtc
    ?? tables?.historyAvailableFromUtc
    ?? null;
  const p = perf?.performance;
  const floatingFmt = useMemo(
    () => formatMetricCurrency(p?.floatingPl, currency),
    [p?.floatingPl, currency],
  );

  const openTrades = tables?.openPositions.trades ?? [];
  const workingOrders = tables?.openWorkingOrders.orders ?? [];
  const dayClosed = tables?.closedTrades.closedTrades ?? [];
  const historyRecords = history?.records ?? [];

  const closed24h = useMemo(
    () => buildClosed24hBundle({
      dayClosed,
      historyRecords,
      nowMs,
      historyAvailableFromUtc: historyAvailableFrom,
    }),
    [dayClosed, historyRecords, nowMs, historyAvailableFrom],
  );

  const allRows = useMemo(
    () => buildAllViewRows({
      openTrades,
      dayClosed,
      historyRecords,
    }),
    [openTrades, dayClosed, historyRecords],
  );

  const viewCounts = useMemo(() => ({
    live: openTrades.length,
    closed_24h: closed24h.tradeIds.length,
    history: history?.total ?? historyRecords.length,
    all: allRows.length,
  }), [openTrades.length, closed24h.tradeIds.length, history?.total, historyRecords.length, allRows.length]);

  const sessionDisconnected = ["DISCONNECTED", "DISABLED", "ERROR", ""].includes(
    String(connection?.sessionStatus ?? "").toUpperCase(),
  );
  const observability = useMemo(
    () => buildRuntimeObservability({
      sidecarReachable: null,
      sessionStatus: connection?.sessionStatus,
      streamState: connection?.streamState,
      offersListenerActive: connection?.offersListenerActive,
      subscriptionCount: connection?.subscriptionCount,
      quoteFreshnessLabel: connection?.quoteFreshnessLabel,
      lastQuoteAt: connection?.lastQuoteAt,
      lastQuoteAgeMs: connection?.lastQuoteAgeMs,
      updateCount: connection?.updateCount,
    }),
    [connection],
  );

  const quoteLine = connection?.quoteFreshnessLabel
    ?? (connection?.streamState ? String(connection.streamState) : formatUnavailable());

  const needsAuth = tablesState === "auth_required" || tablesState === "forbidden"
    || historyState === "auth_required" || historyState === "forbidden";

  return (
    <section
      className="fx-trade-monitor"
      data-forex-page="trade-monitor"
      data-places-orders="false"
      data-accepts-for-execution="false"
      data-mutates-broker="false"
      data-phase="60.0.10"
      data-tm-view={view}
      data-tables-stale={tablesStale ? "true" : "false"}
      data-session-disconnected={sessionDisconnected ? "true" : "false"}
      data-may-label-mark-live={observability.mayLabelMarkLive ? "true" : "false"}
      data-quote-layer={observability.quote}
      data-poller-layer={observability.poller}
    >
      {/* A+B Compact account / connection strip */}
      <header className="fx-tm-strip" aria-label="Trade Monitor account summary">
        <div className="fx-tm-strip-id">
          <h1 className="fx-tm-strip-title">Trade Monitor</h1>
          <span className="fx-tm-acct" title="Masked account">
            {primaryAccount?.accountIdMasked ?? formatUnavailable()}
          </span>
          <span
            className="fx-tm-env"
            data-env={String(connection?.environment ?? "").toLowerCase() || "unknown"}
          >
            {envChip(connection?.environment)}
          </span>
          <span className="fx-tm-chip" data-chip="ro" title="placesOrders=false · acceptsForExecution=false">
            READ-ONLY
          </span>
        </div>
        <dl className="fx-tm-strip-metrics">
          <div>
            <dt>Equity</dt>
            <dd>{formatOptionalNumber(primaryAccount?.equity ?? null)}</dd>
          </div>
          <div>
            <dt>Balance</dt>
            <dd>{formatOptionalNumber(primaryAccount?.balance ?? null)}</dd>
          </div>
          <div>
            <dt>Used</dt>
            <dd>{formatOptionalNumber(primaryAccount?.usedMargin ?? null)}</dd>
          </div>
          <div>
            <dt>Usable</dt>
            <dd>{formatOptionalNumber(primaryAccount?.usableMargin ?? null)}</dd>
          </div>
          {currency ? (
            <div>
              <dt>Ccy</dt>
              <dd>{currency}</dd>
            </div>
          ) : null}
        </dl>
        <div className="fx-tm-strip-status" aria-live="polite">
          <span
            className="fx-tm-conn"
            data-state={sessionDisconnected ? "disconnected" : "connected"}
          >
            {connection?.sessionStatus ?? "UNKNOWN"}
          </span>
          <span
            className="fx-tm-quote-line"
            title={observability.note}
            data-quote-layer={observability.quote}
            data-offers-snapshot={
              connection?.offersSnapshotPresent == null
                ? "unknown"
                : connection.offersSnapshotPresent
                  ? "present"
                  : "absent"
            }
          >
            {quoteLine}
            {connection?.offersSnapshotPresent === true
              && connection.quoteFreshnessLabel === "MARKET_INACTIVE"
              ? " · snapshot"
              : ""}
          </span>
          <button
            type="button"
            className="fx-btn fx-tm-btn is-secondary fx-tm-refresh"
            onClick={() => {
              setNowMs(Date.now());
              void loadConnection();
              void loadTables();
              void loadHistory();
              void loadPerformance();
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      {(tablesError || historyError || perfError) ? (
        <p className="fx-tm-banner is-warn" role="status" title={[tablesError, historyError, perfError].filter(Boolean).join(" · ")}>
          {needsAuth
            ? "Admin token required for broker tables / history / performance."
            : [tablesError, historyError, perfError].filter(Boolean).join(" · ")}
          {tablesStale ? " · Last-known tables" : ""}
        </p>
      ) : null}

      {(needsAuth || !token) ? (
        <ForexAdminAccessLink
          reason="Admin token required for broker tables, history, and performance."
        />
      ) : null}

      {/* C View selector */}
      <div
        className="fx-tm-view-scroll"
        role="tablist"
        aria-label="Trade Monitor views"
      >
        {TRADE_MONITOR_VIEWS.map((item) => {
          const count = viewCounts[item.id];
          const selected = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`fx-tm-view-tab${selected ? " is-active" : ""}`}
              data-view={item.id}
              onClick={() => setView(item.id)}
            >
              <span className="fx-tm-view-label">{item.label}</span>
              <span className="fx-tm-view-count">({count})</span>
            </button>
          );
        })}
      </div>

      {/* D Compact filters for HISTORY / ALL */}
      {(view === "history" || view === "all") ? (
        <div className="fx-tm-filters" role="group" aria-label="History filters">
          <label className="fx-tm-field">
            <span>Instrument</span>
            <input
              className="fx-tm-input"
              value={historyInstrument}
              onChange={(e) => {
                setHistoryOffset(0);
                setHistoryInstrument(e.target.value);
              }}
              placeholder="e.g. XAU/USD"
            />
          </label>
          <label className="fx-tm-field">
            <span>Direction</span>
            <select
              className="fx-tm-input"
              value={historyDirection}
              onChange={(e) => {
                setHistoryOffset(0);
                setHistoryDirection(e.target.value as "ALL" | "BUY" | "SELL");
              }}
            >
              <option value="ALL">All</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          {view === "history" ? (
            <label className="fx-tm-field">
              <span>Status</span>
              <select
                className="fx-tm-input"
                value={historyStatus}
                onChange={(e) => {
                  setHistoryOffset(0);
                  setHistoryStatus(e.target.value as "ALL" | "OPEN" | "CLOSED");
                }}
              >
                <option value="ALL">All</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </label>
          ) : null}
          <label className="fx-tm-field">
            <span>From</span>
            <input
              className="fx-tm-input"
              type="datetime-local"
              value={historyFrom}
              onChange={(e) => {
                setHistoryOffset(0);
                setHistoryFrom(e.target.value);
              }}
            />
          </label>
          <label className="fx-tm-field">
            <span>To</span>
            <input
              className="fx-tm-input"
              type="datetime-local"
              value={historyTo}
              onChange={(e) => {
                setHistoryOffset(0);
                setHistoryTo(e.target.value);
              }}
            />
          </label>
        </div>
      ) : null}

      {view === "closed_24h" ? (
        <p className="fx-tm-coverage" data-coverage="closed-24h" role="status">
          {closed24h.coverageNote}
        </p>
      ) : null}
      {view === "history" || view === "all" ? (
        <p className="fx-tm-coverage" data-history-coverage="true" role="status">
          {history?.coverageNote
            ?? "Persisted history starts at first local observation — not all-time broker history."}
          {" "}
          From: {historyAvailableFrom ? formatTimestamp(historyAvailableFrom) : formatUnavailable()}.
        </p>
      ) : null}

      {/* E Main content by view */}
      <div className="fx-tm-main" data-section={`view-${view}`}>
        {needsAuth && !token ? (
          <p className="fx-tm-empty" data-state="auth_required">Admin token required.</p>
        ) : null}

        {view === "live" ? (
          <>
            {tablesState === "loading" && !tables ? (
              <p className="fx-tm-empty" data-state="loading">Loading…</p>
            ) : !openTrades.length ? (
              <p className="fx-tm-empty" data-state="empty">No open positions.</p>
            ) : (
              <>
                <div className="fx-tm-table-wrap fx-tm-desktop-only">
                  <table className="fx-tm-table fx-tm-table-dense">
                    <thead>
                      <tr>
                        <th scope="col">Instrument</th>
                        <th scope="col">Dir</th>
                        <th scope="col">Size</th>
                        <th scope="col">Open</th>
                        <th scope="col">Mark</th>
                        <th scope="col">Float P/L</th>
                        <th scope="col">Status</th>
                        <th scope="col">Opened</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openTrades.map((row, idx) => {
                        const pl = formatSignedPl(row.floatingPl, currency);
                        const freshness = row.markQuoteFreshness ?? "QUOTE_NOT_RECEIVED";
                        const markText = row.currentPrice != null
                          ? formatOptionalNumber(row.currentPrice, { digits: 5 })
                          : formatUnavailable();
                        return (
                          <tr key={row.tradeId ?? `live-${idx}`} data-row-source={row.source}>
                            <td>{row.instrument ?? formatUnavailable()}</td>
                            <td>
                              <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                                {formatSide(row.side)}
                              </span>
                            </td>
                            <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                            <td>{formatOptionalNumber(row.openRate, { digits: 5 })}</td>
                            <td>
                              <span
                                className={`fx-tm-mark ${markPriceClass(freshness)}`}
                                data-mark-freshness={freshness}
                                title={row.currentPriceSource ?? freshness}
                              >
                                {markText}
                              </span>
                            </td>
                            <td><MetricValue text={pl.text} tone={pl.tone} /></td>
                            <td>
                              <span className="fx-tm-status is-open">{row.status}</span>
                            </td>
                            <td>{formatTimestamp(row.openTime ?? row.updatedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="fx-tm-cards fx-tm-mobile-only">
                  {openTrades.map((row, idx) => {
                    const pl = formatSignedPl(row.floatingPl, currency);
                    const freshness = row.markQuoteFreshness ?? "QUOTE_NOT_RECEIVED";
                    return (
                      <li key={row.tradeId ?? `m-live-${idx}`} className="fx-tm-trade-card" data-row-source={row.source}>
                        <div className="fx-tm-trade-card-top">
                          <strong>{row.instrument ?? formatUnavailable()}</strong>
                          <MetricValue text={pl.text} tone={pl.tone} />
                        </div>
                        <div className="fx-tm-trade-card-mid">
                          <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                            {formatSide(row.side)}
                          </span>
                          <span>Sz {formatOptionalNumber(row.amount, { digits: 2 })}</span>
                          <span>Open {formatOptionalNumber(row.openRate, { digits: 5 })}</span>
                          <span
                            className={`fx-tm-mark ${markPriceClass(freshness)}`}
                            data-mark-freshness={freshness}
                          >
                            Mk {row.currentPrice != null
                              ? formatOptionalNumber(row.currentPrice, { digits: 5 })
                              : formatUnavailable()}
                          </span>
                        </div>
                        <div className="fx-tm-trade-card-bot">
                          <span className="fx-tm-status is-open">{row.status}</span>
                          <span>{formatTimestamp(row.openTime ?? row.updatedAt)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {workingOrders.length > 0 ? (
              <p className="fx-tm-muted fx-tm-orders-hint">
                Active working orders: {workingOrders.length} (see Details)
              </p>
            ) : null}
          </>
        ) : null}

        {view === "closed_24h" ? (
          <>
            {!closed24h.fromDayTable.length && !closed24h.fromHistory.length ? (
              <p className="fx-tm-empty" data-state="empty">No closed trades in the last 24 hours.</p>
            ) : (
              <>
                <div className="fx-tm-table-wrap fx-tm-desktop-only">
                  <table className="fx-tm-table fx-tm-table-dense">
                    <thead>
                      <tr>
                        <th scope="col">Instrument</th>
                        <th scope="col">Dir</th>
                        <th scope="col">Size</th>
                        <th scope="col">Open</th>
                        <th scope="col">Close</th>
                        <th scope="col">P/L</th>
                        <th scope="col">Closed</th>
                        <th scope="col">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closed24h.fromHistory.map((row) => {
                        const pl = formatSignedPl(row.grossPl, currency);
                        return (
                          <tr key={`h24-${row.recordKey}`} data-row-source={row.source} data-lifecycle="CLOSED">
                            <td>{row.instrument ?? formatUnavailable()}</td>
                            <td>
                              <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                                {formatSide(row.side)}
                              </span>
                            </td>
                            <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                            <td>{formatOptionalNumber(row.openRate, { digits: 5 })}</td>
                            <td>{formatOptionalNumber(row.closeRate, { digits: 5 })}</td>
                            <td><MetricValue text={pl.text} tone={pl.tone} /></td>
                            <td>{formatTimestamp(row.closeTime)}</td>
                            <td>history</td>
                          </tr>
                        );
                      })}
                      {closed24h.fromDayTable
                        .filter((r) => !closed24h.fromHistory.some((h) => h.tradeId && h.tradeId === r.tradeId))
                        .map((row, idx) => {
                          const pl = formatSignedPl(row.grossPl ?? row.netPl, currency);
                          return (
                            <tr key={`d24-${row.tradeId ?? idx}`} data-row-source={row.source}>
                              <td>{row.instrument ?? formatUnavailable()}</td>
                              <td>
                                <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                                  {formatSide(row.side)}
                                </span>
                              </td>
                              <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                              <td>{formatOptionalNumber(row.openRate, { digits: 5 })}</td>
                              <td>{formatOptionalNumber(row.closeRate, { digits: 5 })}</td>
                              <td><MetricValue text={pl.text} tone={pl.tone} /></td>
                              <td>{formatTimestamp(row.closeTime)}</td>
                              <td>day-table</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <ul className="fx-tm-cards fx-tm-mobile-only">
                  {[
                    ...closed24h.fromHistory.map((row) => ({
                      key: `mh-${row.recordKey}`,
                      instrument: row.instrument,
                      side: row.side,
                      amount: row.amount,
                      pl: row.grossPl,
                      closeTime: row.closeTime,
                      source: row.source,
                    })),
                    ...closed24h.fromDayTable
                      .filter((r) => !closed24h.fromHistory.some((h) => h.tradeId && h.tradeId === r.tradeId))
                      .map((row, idx) => ({
                        key: `md-${row.tradeId ?? idx}`,
                        instrument: row.instrument,
                        side: row.side,
                        amount: row.amount,
                        pl: row.grossPl ?? row.netPl,
                        closeTime: row.closeTime,
                        source: row.source,
                      })),
                  ].map((row) => {
                    const pl = formatSignedPl(row.pl, currency);
                    return (
                      <li key={row.key} className="fx-tm-trade-card" data-row-source={row.source}>
                        <div className="fx-tm-trade-card-top">
                          <strong>{row.instrument ?? formatUnavailable()}</strong>
                          <MetricValue text={pl.text} tone={pl.tone} />
                        </div>
                        <div className="fx-tm-trade-card-mid">
                          <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                            {formatSide(row.side)}
                          </span>
                          <span>Sz {formatOptionalNumber(row.amount, { digits: 2 })}</span>
                        </div>
                        <div className="fx-tm-trade-card-bot">
                          <span className="fx-tm-status is-closed">CLOSED</span>
                          <span>{formatTimestamp(row.closeTime)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        ) : null}

        {view === "history" ? (
          <>
            {historyState === "loading" && !history ? (
              <p className="fx-tm-empty" data-state="loading">Loading history…</p>
            ) : historyState === "error" ? (
              <p className="fx-tm-empty" data-state="error">{historyError ?? "Error"}</p>
            ) : !history?.records.length ? (
              <p className="fx-tm-empty" data-state="empty">No history rows for filters.</p>
            ) : (
              <>
                <div className="fx-tm-table-wrap fx-tm-desktop-only">
                  <table className="fx-tm-table fx-tm-table-dense">
                    <thead>
                      <tr>
                        <th scope="col">Instrument</th>
                        <th scope="col">Dir</th>
                        <th scope="col">Size</th>
                        <th scope="col">Open</th>
                        <th scope="col">Close</th>
                        <th scope="col">Gross P/L</th>
                        <th scope="col">Status</th>
                        <th scope="col">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.records.map((row) => {
                        const pl = formatSignedPl(row.grossPl, currency);
                        return (
                          <tr key={row.recordKey} data-row-source={row.source} data-lifecycle={row.lifecycleStatus}>
                            <td>{row.instrument ?? formatUnavailable()}</td>
                            <td>
                              <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                                {formatSide(row.side)}
                              </span>
                            </td>
                            <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                            <td>{formatOptionalNumber(row.openRate, { digits: 5 })}</td>
                            <td>{formatOptionalNumber(row.closeRate, { digits: 5 })}</td>
                            <td><MetricValue text={pl.text} tone={pl.tone} /></td>
                            <td>
                              <span className={`fx-tm-status is-${row.lifecycleStatus.toLowerCase()}`}>
                                {row.lifecycleStatus}
                              </span>
                            </td>
                            <td>{formatTimestamp(row.closeTime ?? row.openTime)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="fx-tm-cards fx-tm-mobile-only">
                  {history.records.map((row) => {
                    const pl = formatSignedPl(row.grossPl, currency);
                    return (
                      <li key={`mh-${row.recordKey}`} className="fx-tm-trade-card" data-lifecycle={row.lifecycleStatus}>
                        <div className="fx-tm-trade-card-top">
                          <strong>{row.instrument ?? formatUnavailable()}</strong>
                          <MetricValue text={pl.text} tone={pl.tone} />
                        </div>
                        <div className="fx-tm-trade-card-mid">
                          <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                            {formatSide(row.side)}
                          </span>
                          <span>Sz {formatOptionalNumber(row.amount, { digits: 2 })}</span>
                        </div>
                        <div className="fx-tm-trade-card-bot">
                          <span className={`fx-tm-status is-${row.lifecycleStatus.toLowerCase()}`}>
                            {row.lifecycleStatus}
                          </span>
                          <span>{formatTimestamp(row.closeTime ?? row.openTime)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="fx-tm-pager">
                  <button
                    type="button"
                    className="fx-btn fx-tm-btn is-secondary"
                    disabled={historyOffset <= 0}
                    onClick={() => setHistoryOffset((o) => Math.max(0, o - HISTORY_PAGE_SIZE))}
                  >
                    Prev
                  </button>
                  <span className="fx-tm-muted">
                    {history.offset + 1}–{Math.min(history.offset + history.records.length, history.total)}
                    {" / "}
                    {history.total}
                  </span>
                  <button
                    type="button"
                    className="fx-btn fx-tm-btn is-secondary"
                    disabled={history.offset + history.records.length >= history.total}
                    onClick={() => setHistoryOffset((o) => o + HISTORY_PAGE_SIZE)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </>
        ) : null}

        {view === "all" ? (
          <>
            {!allRows.length ? (
              <p className="fx-tm-empty" data-state="empty">No trades in combined view.</p>
            ) : (
              <>
                <div className="fx-tm-table-wrap fx-tm-desktop-only">
                  <table className="fx-tm-table fx-tm-table-dense">
                    <thead>
                      <tr>
                        <th scope="col">Instrument</th>
                        <th scope="col">Dir</th>
                        <th scope="col">Size</th>
                        <th scope="col">Open</th>
                        <th scope="col">Mark/Close</th>
                        <th scope="col">P/L</th>
                        <th scope="col">Status</th>
                        <th scope="col">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map((row) => {
                        const pl = formatSignedPl(row.pl, currency);
                        const price = row.lifecycle === "OPEN"
                          ? (row.currentPrice != null
                            ? formatOptionalNumber(row.currentPrice, { digits: 5 })
                            : formatUnavailable())
                          : formatOptionalNumber(row.closeRate, { digits: 5 });
                        return (
                          <tr key={row.key} data-row-source={row.source} data-lifecycle={row.lifecycle}>
                            <td>{row.instrument ?? formatUnavailable()}</td>
                            <td>
                              <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                                {formatSide(row.side)}
                              </span>
                            </td>
                            <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                            <td>{formatOptionalNumber(row.openRate, { digits: 5 })}</td>
                            <td>
                              <span className={row.lifecycle === "OPEN"
                                ? `fx-tm-mark ${markPriceClass(row.markFreshness)}`
                                : undefined}
                              >
                                {price}
                              </span>
                            </td>
                            <td><MetricValue text={pl.text} tone={pl.tone} /></td>
                            <td>
                              <span className={`fx-tm-status is-${row.lifecycle.toLowerCase()}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>{formatTimestamp(row.timeIso)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="fx-tm-cards fx-tm-mobile-only">
                  {allRows.map((row) => {
                    const pl = formatSignedPl(row.pl, currency);
                    return (
                      <li key={`ma-${row.key}`} className="fx-tm-trade-card" data-lifecycle={row.lifecycle}>
                        <div className="fx-tm-trade-card-top">
                          <strong>{row.instrument ?? formatUnavailable()}</strong>
                          <MetricValue text={pl.text} tone={pl.tone} />
                        </div>
                        <div className="fx-tm-trade-card-mid">
                          <span className={`fx-tm-side is-${formatSide(row.side).toLowerCase()}`}>
                            {formatSide(row.side)}
                          </span>
                          <span>Sz {formatOptionalNumber(row.amount, { digits: 2 })}</span>
                        </div>
                        <div className="fx-tm-trade-card-bot">
                          <span className={`fx-tm-status is-${row.lifecycle.toLowerCase()}`}>
                            {row.status}
                          </span>
                          <span>{formatTimestamp(row.timeIso)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        ) : null}
      </div>

      {/* F Collapsible diagnostics */}
      <details
        className="fx-tm-details"
        open={detailsOpen}
        onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="fx-tm-details-summary">
          Details · performance · connection · orders
        </summary>
        <div className="fx-tm-details-body">
          <div className="fx-tm-mini-metrics">
            <div>
              <span className="fx-tm-label">Float P/L</span>
              <MetricValue text={floatingFmt.text} tone={floatingFmt.tone} />
            </div>
            <div>
              <span className="fx-tm-label">Fetched</span>
              <span>{formatTimestamp(lastFetchedAt)}</span>
            </div>
            <div>
              <span className="fx-tm-label">Snapshot</span>
              <span data-offers-snapshot={
                connection?.offersSnapshotPresent == null
                  ? "unknown"
                  : connection.offersSnapshotPresent ? "present" : "absent"
              }
              >
                {connection?.offersSnapshotPresent == null
                  ? formatUnavailable()
                  : connection.offersSnapshotPresent ? "present (not LIVE proof)" : "absent"}
              </span>
            </div>
            <div>
              <span className="fx-tm-label">Listener</span>
              <span>
                {connection?.offersListenerActive == null
                  ? formatUnavailable()
                  : connection.offersListenerActive ? "active" : "inactive"}
              </span>
            </div>
          </div>
          <div className="fx-tm-period-row" role="group" aria-label="Performance period">
            <button
              type="button"
              className={`fx-btn fx-tm-btn ${periodPreset === "today" ? "" : "is-secondary"}`}
              aria-pressed={periodPreset === "today"}
              onClick={() => setPeriodPreset("today")}
            >
              Today UTC
            </button>
            <button
              type="button"
              className={`fx-btn fx-tm-btn ${periodPreset === "all" ? "" : "is-secondary"}`}
              aria-pressed={periodPreset === "all"}
              onClick={() => setPeriodPreset("all")}
            >
              All persisted
            </button>
            <button
              type="button"
              className={`fx-btn fx-tm-btn ${periodPreset === "custom" ? "" : "is-secondary"}`}
              aria-pressed={periodPreset === "custom"}
              onClick={() => setPeriodPreset("custom")}
            >
              Custom
            </button>
          </div>
          {p?.coverage.partial ? (
            <p className="fx-tm-banner is-partial" role="status" data-coverage="partial">
              Partial history: {p.coverage.note}
            </p>
          ) : null}
          <p
            className="fx-tm-avail-chip"
            data-summary-source="forexconnect-summary"
            data-metric-scope={
              tables?.instrumentSummaries?.metricScope ?? "INSTRUMENT_SUMMARY"
            }
            title="Broker Instrument Summary NetPL is not account equity"
          >
            Summary source forexconnect-summary · metricScope{" "}
            {tables?.instrumentSummaries?.metricScope ?? "INSTRUMENT_SUMMARY"}
            {historyAvailableFrom
              ? ` · history from ${formatTimestamp(historyAvailableFrom)}`
              : ""}
          </p>
          {primaryAccount?.equityIncludesFloatingPl ? (
            <p className="fx-tm-muted">
              Equity may already include floating P/L — float is not added again.
            </p>
          ) : null}
          {workingOrders.length ? (
            <div className="fx-tm-table-wrap">
              <table className="fx-tm-table fx-tm-table-dense">
                <caption className="fx-tm-caption">Active working orders</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Instrument</th>
                    <th scope="col">Dir</th>
                    <th scope="col">Size</th>
                    <th scope="col">Rate</th>
                    <th scope="col">Status</th>
                    <th scope="col">Mapped</th>
                    <th scope="col">TIF</th>
                  </tr>
                </thead>
                <tbody>
                  {workingOrders.map((row, idx) => (
                    <tr
                      key={row.orderId ?? `ord-${idx}`}
                      data-row-source={row.source}
                      data-order-status-normalized={row.normalizedStatus}
                    >
                      <td>{row.orderId ?? formatUnavailable()}</td>
                      <td>{row.instrument ?? formatUnavailable()}</td>
                      <td>{formatSide(row.side)}</td>
                      <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                      <td>{formatOptionalNumber(row.rate, { digits: 5 })}</td>
                      <td>{row.status ?? formatUnavailable()}</td>
                      <td title={row.statusLabel}>{row.normalizedStatus}</td>
                      <td>{row.timeInForce ?? formatUnavailable()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="fx-tm-muted">No working orders.</p>
          )}
        </div>
      </details>
    </section>
  );
}
