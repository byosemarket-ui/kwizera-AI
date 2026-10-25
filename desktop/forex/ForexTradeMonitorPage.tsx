/**
 * Phase 60.0.1–60.0.4 — Trade Monitor (read-only).
 * Broker RO tables, durable history, Offers marks, verified performance analytics.
 * Does not place, modify, cancel, or close broker orders.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  formatMetricCount,
  formatMetricCurrency,
  formatMetricPercent,
  formatMetricRatio,
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

const FOREX_ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";
const POLL_MS = 12_000;
const HISTORY_PAGE_SIZE = 25;

function readAdminToken(): string {
  try {
    return sessionStorage.getItem(FOREX_ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeAdminToken(token: string) {
  try {
    const trimmed = token.trim();
    if (trimmed) sessionStorage.setItem(FOREX_ADMIN_TOKEN_STORAGE_KEY, trimmed);
    else sessionStorage.removeItem(FOREX_ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function adminHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-kwizera-admin-token": token,
  };
}

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

function MetricCard({
  label,
  text,
  tone,
  note,
  availability,
  title,
}: {
  label: string;
  text: string;
  tone: "positive" | "negative" | "neutral" | "unknown";
  note: string;
  availability?: string;
  title?: string;
}) {
  return (
    <article className="fx-tm-card" data-availability={availability ?? ""} title={title}>
      <h3 className="fx-tm-card-label">{label}</h3>
      <MetricValue text={text} tone={tone} />
      {availability && availability !== "AVAILABLE" ? (
        <span className="fx-tm-avail-chip" data-availability={availability}>{availability}</span>
      ) : null}
      <p className="fx-tm-card-note">{note}</p>
    </article>
  );
}

export function ForexTradeMonitorPage(_props: {
  selectedMarket: SelectedMarket | null;
  timeframe: ChartTimeframeId;
}) {
  const [token, setToken] = useState(readAdminToken);
  const [tokenDraft, setTokenDraft] = useState(token);
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
  const [perfState, setPerfState] = useState<TradeMonitorLoadState>("idle");
  const [perfError, setPerfError] = useState<string | null>(null);

  const tablesAbortRef = useRef<AbortController | null>(null);
  const historyAbortRef = useRef<AbortController | null>(null);
  const perfAbortRef = useRef<AbortController | null>(null);
  const tablesReqId = useRef(0);
  const historyReqId = useRef(0);
  const perfReqId = useRef(0);

  const applyToken = useCallback(() => {
    writeAdminToken(tokenDraft);
    setToken(tokenDraft.trim());
  }, [tokenDraft]);

  const loadConnection = useCallback(async () => {
    // allSettled: status and stream are separate layers — one failure must not wipe the other.
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
      const res = await fetch("/api/forex/automated-trading/broker-ro-tables", {
        headers: adminHeaders(token),
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

      const res = await fetch(
        `/api/forex/automated-trading/trade-history?${params.toString()}`,
        { headers: adminHeaders(token), signal: ac.signal },
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
      setPerfState("auth_required");
      setPerfError("Admin API token required for trade performance.");
      return;
    }
    perfAbortRef.current?.abort();
    const ac = new AbortController();
    perfAbortRef.current = ac;
    const reqId = ++perfReqId.current;
    setPerfState((prev) => (prev === "ready" || prev === "empty" ? prev : "loading"));
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

      const res = await fetch(
        `/api/forex/automated-trading/trade-performance?${params.toString()}`,
        { headers: adminHeaders(token), signal: ac.signal },
      );
      if (reqId !== perfReqId.current) return;
      const body = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (reqId !== perfReqId.current) return;
      if (res.status === 401 || res.status === 403) {
        setPerf(null);
        setPerfState("forbidden");
        setPerfError("Admin authorization failed for trade performance.");
        return;
      }
      if (!res.ok || !body) {
        setPerfState("error");
        setPerfError(`trade-performance HTTP ${res.status}`);
        return;
      }
      const parsed = parseTradePerformance(body);
      if (!parsed) {
        setPerfState("error");
        setPerfError("Unrecognized trade-performance payload.");
        return;
      }
      setPerf(parsed);
      setPerfError(null);
      setPerfState("ready");
    } catch (error) {
      if (ac.signal.aborted || reqId !== perfReqId.current) return;
      setPerfState("error");
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

  const primaryAccount = tables?.accounts.accounts[0] ?? null;
  const currency = primaryAccount?.accountCurrency ?? null;
  const closedCapability = tables?.closedTrades.capabilityStatus ?? "MISSING";
  const historyAvailableFrom =
    perf?.performance.historyAvailableFromUtc
    ?? history?.historyAvailableFromUtc
    ?? tables?.historyAvailableFromUtc
    ?? null;
  const summaryRows = tables?.instrumentSummaries?.summaries ?? [];
  const summaryCapability = tables?.instrumentSummaries?.capabilityStatus ?? "MISSING";
  const p = perf?.performance;
  const floatingFmt = useMemo(
    () => formatMetricCurrency(p?.floatingPl, currency),
    [p?.floatingPl, currency],
  );
  const realizedFmt = useMemo(
    () => formatMetricCurrency(p?.realizedGrossPl, currency),
    [p?.realizedGrossPl, currency],
  );
  const winFmt = useMemo(() => formatMetricRatio(p?.winRate), [p?.winRate]);
  const plPctFmt = useMemo(() => formatMetricPercent(p?.plPercentOfEquity), [p?.plPercentOfEquity]);
  const openFmt = useMemo(() => formatMetricCount(p?.openTradeCount), [p?.openTradeCount]);
  const orderFmt = useMemo(() => formatMetricCount(p?.activeOrderCount), [p?.activeOrderCount]);
  const closedFmt = useMemo(() => formatMetricCount(p?.closedTradeCount), [p?.closedTradeCount]);
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

  return (
    <section
      className="fx-trade-monitor"
      data-forex-page="trade-monitor"
      data-places-orders="false"
      data-accepts-for-execution="false"
      data-mutates-broker="false"
      data-phase="60.0.6"
      data-tables-stale={tablesStale ? "true" : "false"}
      data-session-disconnected={sessionDisconnected ? "true" : "false"}
      data-may-label-mark-live={observability.mayLabelMarkLive ? "true" : "false"}
      data-quote-layer={observability.quote}
      data-poller-layer={observability.poller}
    >
      <header className="fx-trade-monitor-header">
        <div>
          <h1 className="fx-trade-monitor-title">Trade Monitor</h1>
          <p className="fx-trade-monitor-subtitle">
            Live Positions · Active Orders · Performance · History
          </p>
        </div>
        <div className="fx-trade-monitor-header-meta" aria-live="polite">
          <span className="fx-tm-chip" data-chip="ro">Read-only</span>
          <span className="fx-tm-chip" data-chip="safety">placesOrders=false</span>
          <span
            className="fx-tm-chip"
            data-chip="session"
            data-state={sessionDisconnected ? "disconnected" : "connected"}
          >
            {connection?.sessionStatus ?? "UNKNOWN"}
          </span>
          <span className="fx-tm-chip" data-chip="poller" title={observability.note}>
            poller={observability.poller}
          </span>
          <span className="fx-tm-chip" data-chip="quote" title={observability.note}>
            quote={observability.quote}
          </span>
          {connection?.trading ? (
            <span className="fx-tm-chip" data-chip="trading">{connection.trading}</span>
          ) : null}
          {tablesStale ? (
            <span className="fx-tm-chip" data-chip="stale">Showing last known tables</span>
          ) : null}
        </div>
      </header>

      <section className="fx-tm-panel fx-tm-auth" aria-label="Admin authorization">
        <h2 className="fx-tm-section-title">Admin authorization</h2>
        <p className="fx-tm-muted">
          Broker tables require the Studio admin token ({FOREX_ADMIN_TOKEN_STORAGE_KEY}).
          Connection and quote freshness below use public ForexConnect status routes.
        </p>
        <div className="fx-tm-auth-row">
          <label className="fx-tm-label" htmlFor="fx-tm-admin-token">
            Admin API token
          </label>
          <input
            id="fx-tm-admin-token"
            className="fx-tm-input"
            type="password"
            autoComplete="off"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder="Paste token — session only"
          />
          <button type="button" className="fx-btn fx-tm-btn" onClick={applyToken}>
            Apply
          </button>
          <button
            type="button"
            className="fx-btn fx-tm-btn is-secondary"
            onClick={() => {
              void loadConnection();
              void loadTables();
              void loadHistory();
              void loadPerformance();
            }}
          >
            Refresh
          </button>
        </div>
        {tablesError ? (
          <p className="fx-tm-banner is-warn" role="status">{tablesError}</p>
        ) : null}
        {historyError ? (
          <p className="fx-tm-banner is-warn" role="status">{historyError}</p>
        ) : null}
        {perfError ? (
          <p className="fx-tm-banner is-warn" role="status">{perfError}</p>
        ) : null}
      </section>

      <section className="fx-tm-panel fx-tm-period" aria-label="Performance period">
        <div className="fx-tm-section-head">
          <h2 className="fx-tm-section-title">Performance period</h2>
          <span className="fx-tm-muted">
            Realized metrics use persisted CLOSED trades — floating is a separate current snapshot
          </span>
        </div>
        <div className="fx-tm-period-row" role="group" aria-label="Period preset">
          <button
            type="button"
            className={`fx-btn fx-tm-btn ${periodPreset === "today" ? "" : "is-secondary"}`}
            aria-pressed={periodPreset === "today"}
            onClick={() => setPeriodPreset("today")}
          >
            Today (UTC)
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
            Custom (history filters)
          </button>
          <span className="fx-tm-muted">
            Updated {formatTimestamp(p?.evaluatedAtUtc ?? lastFetchedAt)}
          </span>
        </div>
        {p?.coverage.partial ? (
          <p className="fx-tm-banner is-partial" role="status" data-coverage="partial">
            Partial history: {p.coverage.note}
          </p>
        ) : null}
      </section>

      <section className="fx-tm-summary" aria-label="Performance summary" data-perf-state={perfState}>
        <MetricCard
          label="Open trades"
          text={openFmt.text}
          tone={openFmt.tone}
          availability={openFmt.availability}
          note="Executed open broker trades — not working orders"
          title={p?.openTradeCount.definition}
        />
        <MetricCard
          label="Active orders"
          text={orderFmt.text}
          tone={orderFmt.tone}
          availability={orderFmt.availability}
          note="Pending/unfilled ORDERS only"
          title={p?.activeOrderCount.definition}
        />
        <MetricCard
          label="Floating P/L"
          text={floatingFmt.text}
          tone={floatingFmt.tone}
          availability={floatingFmt.availability}
          note="Current snapshot · Trades.gross_pl · not + Summary NetPL"
          title={p?.floatingPl.definition}
        />
        <MetricCard
          label="Realized P/L (period)"
          text={realizedFmt.text}
          tone={realizedFmt.tone}
          availability={realizedFmt.availability}
          note={`Selected period · ${p?.period.label ?? periodPreset} · gross`}
          title={p?.realizedGrossPl.definition}
        />
        <MetricCard
          label="Win rate"
          text={winFmt.text}
          tone={winFmt.tone}
          availability={winFmt.availability}
          note="wins/(wins+losses); zeros excluded · partial if incomplete"
          title={p?.winRate.definition}
        />
        <MetricCard
          label="P/L % of equity"
          text={plPctFmt.text}
          tone={plPctFmt.tone}
          availability={plPctFmt.availability}
          note="Realized gross ÷ current equity · equity may include floating"
          title={p?.plPercentOfEquity.definition}
        />
        <MetricCard
          label="Closed (period)"
          text={closedFmt.text}
          tone={closedFmt.tone}
          availability={closedFmt.availability}
          note={
            p
              ? `W ${p.profitableCount.value ?? "—"} / L ${p.losingCount.value ?? "—"} / Z ${p.zeroResultCount.value ?? "—"}`
              : "Closed trades in selected period"
          }
          title={p?.closedTradeCount.definition}
        />
        <MetricCard
          label="History coverage"
          text={historyAvailableFrom ? formatTimestamp(historyAvailableFrom) : formatUnavailable()}
          tone="neutral"
          availability={p?.coverage.availability}
          note="Earliest local observation — not broker account birth"
        />
        <MetricCard
          label="Quote freshness"
          text={connection?.quoteFreshnessLabel ?? formatUnavailable()}
          tone="neutral"
          note={connection?.streamState ? `stream=${connection.streamState}` : "Offers evidence"}
        />
      </section>

      <section className="fx-tm-panel" aria-label="Market and connection status">
        <h2 className="fx-tm-section-title">Market &amp; connection</h2>
        <dl className="fx-tm-dl">
          <div>
            <dt>Session</dt>
            <dd>{connection?.sessionStatus ?? formatUnavailable()}</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>{connection?.environment ?? formatUnavailable()}</dd>
          </div>
          <div>
            <dt>Stream</dt>
            <dd>{connection?.streamState ?? formatUnavailable()}</dd>
          </div>
          <div>
            <dt>Offers listener</dt>
            <dd>
              {connection?.offersListenerActive == null
                ? formatUnavailable()
                : connection.offersListenerActive
                  ? "active"
                  : "inactive"}
            </dd>
          </div>
          <div>
            <dt>Subscriptions</dt>
            <dd>
              {connection?.subscriptionCount == null
                ? formatUnavailable()
                : String(connection.subscriptionCount)}
            </dd>
          </div>
          <div>
            <dt>Last quote at</dt>
            <dd>{formatTimestamp(connection?.lastQuoteAt)}</dd>
          </div>
          <div>
            <dt>Quote status</dt>
            <dd data-quote-freshness={connection?.quoteFreshnessLabel ?? ""}>
              {connection?.quoteFreshnessLabel ?? formatUnavailable()}
            </dd>
          </div>
          <div>
            <dt>Tables fetched</dt>
            <dd>{formatTimestamp(lastFetchedAt)}</dd>
          </div>
        </dl>
        <p className="fx-tm-muted">
          Connection alone is not live-price proof. Quote status reflects Offers update evidence.
        </p>
      </section>

      <section className="fx-tm-panel" aria-label="Account snapshot">
        <h2 className="fx-tm-section-title">Account snapshot</h2>
        {tablesState === "auth_required" || tablesState === "forbidden" ? (
          <p className="fx-tm-empty" data-state={tablesState}>
            Authorize with an admin token to load masked account rows.
          </p>
        ) : tablesState === "loading" && !primaryAccount ? (
          <p className="fx-tm-empty" data-state="loading">Loading account snapshot…</p>
        ) : !primaryAccount ? (
          <p className="fx-tm-empty" data-state="empty">
            No account rows returned (disconnected or empty Accounts table).
          </p>
        ) : (
          <dl className="fx-tm-dl">
            <div>
              <dt>Account</dt>
              <dd>{primaryAccount.accountIdMasked ?? formatUnavailable()}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{primaryAccount.accountCurrency ?? formatUnavailable()}</dd>
            </div>
            <div>
              <dt>Equity</dt>
              <dd>{formatOptionalNumber(primaryAccount.equity)}</dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>{formatOptionalNumber(primaryAccount.balance)}</dd>
            </div>
            <div>
              <dt>Used margin</dt>
              <dd>{formatOptionalNumber(primaryAccount.usedMargin)}</dd>
            </div>
            <div>
              <dt>Usable margin</dt>
              <dd>{formatOptionalNumber(primaryAccount.usableMargin)}</dd>
            </div>
            <div>
              <dt>Account day P/L</dt>
              <dd>
                <MetricValue {...formatSignedPl(primaryAccount.dayPl, currency)} />
              </dd>
            </div>
            <div>
              <dt>Account gross P/L</dt>
              <dd>
                <MetricValue {...formatSignedPl(primaryAccount.grossPl, currency)} />
              </dd>
            </div>
          </dl>
        )}
        {primaryAccount?.equityIncludesFloatingPl ? (
          <p className="fx-tm-muted">
            Equity/NAV already includes floating P/L when provided by the broker — trade floating P/L is not added again.
          </p>
        ) : null}
      </section>

      <section className="fx-tm-panel" aria-label="Instrument summary NetPL" data-section="instrument-summary">
        <div className="fx-tm-section-head">
          <h2 className="fx-tm-section-title">Instrument Summary (NetPL)</h2>
          <span className="fx-tm-muted">
            Instrument-scoped · source=forexconnect-summary · not per-trade · not account-wide
          </span>
        </div>
        {tablesState === "auth_required" || tablesState === "forbidden" ? (
          <p className="fx-tm-empty" data-state={tablesState}>Admin token required.</p>
        ) : summaryCapability === "UNSUPPORTED" || summaryCapability === "MISSING" ? (
          <p className="fx-tm-empty" data-state="missing" data-summary-capability={summaryCapability}>
            {tables?.instrumentSummaries?.note
              ?? `Summary table unavailable (${summaryCapability}).`}
          </p>
        ) : !summaryRows.length ? (
          <p className="fx-tm-empty" data-state="empty">
            No instrument summary rows reported.
          </p>
        ) : (
          <div className="fx-tm-table-wrap">
            <table className="fx-tm-table">
              <thead>
                <tr>
                  <th scope="col">Instrument</th>
                  <th scope="col">NetPL</th>
                  <th scope="col">GrossPL</th>
                  <th scope="col">Scope</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, idx) => {
                  const net = formatSignedPl(row.netPl, currency);
                  const gross = formatSignedPl(row.grossPl, currency);
                  return (
                    <tr key={row.offerId ?? row.instrument ?? `sum-${idx}`} data-row-source={row.source}>
                      <td>{row.instrument ?? formatUnavailable()}</td>
                      <td><MetricValue text={net.text} tone={net.tone} /></td>
                      <td><MetricValue text={gross.text} tone={gross.tone} /></td>
                      <td>{row.metricScope}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fx-tm-panel" aria-label="Live positions" data-section="live-positions">
        <div className="fx-tm-section-head">
          <h2 className="fx-tm-section-title">Live Positions</h2>
          <span className="fx-tm-muted">
            Broker TRADES · Offers mark (BUY→bid / SELL→ask) · floating P/L = Trades.gross_pl
          </span>
        </div>
        {tablesState === "auth_required" || tablesState === "forbidden" ? (
          <p className="fx-tm-empty" data-state={tablesState}>Admin token required.</p>
        ) : tablesState === "loading" && !tables ? (
          <p className="fx-tm-empty" data-state="loading">Loading open positions…</p>
        ) : tablesState === "error" ? (
          <p className="fx-tm-empty" data-state="error">{tablesError ?? "Error"}</p>
        ) : !tables?.openPositions.trades.length ? (
          <p className="fx-tm-empty" data-state="empty">
            No open broker trades reported.
            {tables?.openPositions.note ? ` ${tables.openPositions.note}` : ""}
          </p>
        ) : (
          <div className="fx-tm-table-wrap">
            <table className="fx-tm-table">
              <thead>
                <tr>
                  <th scope="col">Trade ID</th>
                  <th scope="col">Instrument</th>
                  <th scope="col">Side</th>
                  <th scope="col">Size</th>
                  <th scope="col">Open</th>
                  <th scope="col">Mark</th>
                  <th scope="col">Quote</th>
                  <th scope="col">SL</th>
                  <th scope="col">TP</th>
                  <th scope="col">Float P/L</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {tables.openPositions.trades.map((row, idx) => {
                  const pl = formatSignedPl(row.floatingPl, currency);
                  const freshness = row.markQuoteFreshness ?? "QUOTE_NOT_RECEIVED";
                  const markText = row.currentPrice != null
                    ? formatOptionalNumber(row.currentPrice, { digits: 5 })
                    : formatUnavailable();
                  const sideHint = row.markPriceSide ? ` (${row.markPriceSide})` : "";
                  return (
                    <tr key={row.tradeId ?? `trade-${idx}`} data-row-source={row.source}>
                      <td>{row.tradeId ?? formatUnavailable()}</td>
                      <td>{row.instrument ?? formatUnavailable()}</td>
                      <td>{formatSide(row.side)}</td>
                      <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                      <td>{formatOptionalNumber(row.openRate, { digits: 5 })}</td>
                      <td>
                        <span
                          className={`fx-tm-mark ${markPriceClass(freshness)}`}
                          data-mark-freshness={freshness}
                          title={row.currentPriceSource ?? freshness}
                        >
                          {markText}{row.currentPrice != null ? sideHint : ""}
                        </span>
                      </td>
                      <td>
                        <span className={`fx-tm-quote-chip ${markPriceClass(freshness)}`}>
                          {freshness}
                        </span>
                      </td>
                      <td>{formatOptionalNumber(row.stopLoss, { digits: 5 })}</td>
                      <td>{formatOptionalNumber(row.takeProfit, { digits: 5 })}</td>
                      <td>
                        <MetricValue text={pl.text} tone={pl.tone} />
                        {row.floatingPlProvenance ? (
                          <span className="fx-tm-pl-source">{row.floatingPlProvenance}</span>
                        ) : null}
                      </td>
                      <td>{formatTimestamp(row.updatedAt)}</td>
                      <td>{row.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fx-tm-panel" aria-label="Active orders" data-section="active-orders">
        <div className="fx-tm-section-head">
          <h2 className="fx-tm-section-title">Active Orders</h2>
          <span className="fx-tm-muted">
            Broker ORDERS · Order ID (not Trade ID) · source=forexconnect-orders
          </span>
        </div>
        {tablesState === "auth_required" || tablesState === "forbidden" ? (
          <p className="fx-tm-empty" data-state={tablesState}>Admin token required.</p>
        ) : tablesState === "loading" && !tables ? (
          <p className="fx-tm-empty" data-state="loading">Loading working orders…</p>
        ) : !tables?.openWorkingOrders.orders.length ? (
          <p className="fx-tm-empty" data-state="empty">
            No working orders reported.
            {tables?.openWorkingOrders.note ? ` ${tables.openWorkingOrders.note}` : ""}
          </p>
        ) : (
          <div className="fx-tm-table-wrap">
            <table className="fx-tm-table">
              <thead>
                <tr>
                  <th scope="col">Order ID</th>
                  <th scope="col">Instrument</th>
                  <th scope="col">Side</th>
                  <th scope="col">Size</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {tables.openWorkingOrders.orders.map((row, idx) => (
                  <tr key={row.orderId ?? `order-${idx}`} data-row-source={row.source}>
                    <td>{row.orderId ?? formatUnavailable()}</td>
                    <td>{row.instrument ?? formatUnavailable()}</td>
                    <td>{formatSide(row.side)}</td>
                    <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                    <td>{formatOptionalNumber(row.rate, { digits: 5 })}</td>
                    <td>{row.status ?? formatUnavailable()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fx-tm-panel" aria-label="Closed trades day preview" data-section="closed-trades">
        <div className="fx-tm-section-head">
          <h2 className="fx-tm-section-title">Closed Trades (trading day)</h2>
          <span className="fx-tm-muted">
            Current trading day only · source=forexconnect-closed-trades · not an all-time ledger
          </span>
        </div>
        {tablesState === "auth_required" || tablesState === "forbidden" ? (
          <p className="fx-tm-empty" data-state={tablesState}>Admin token required.</p>
        ) : tablesState === "loading" && !tables ? (
          <p className="fx-tm-empty" data-state="loading">Loading closed trades…</p>
        ) : closedCapability === "UNSUPPORTED" || closedCapability === "MISSING" ? (
          <p
            className="fx-tm-empty"
            data-state="missing"
            data-closed-capability={closedCapability}
          >
            {tables?.closedTrades.note
              ?? `ClosedTrades unavailable (${closedCapability}).`}
          </p>
        ) : !tables?.closedTrades.closedTrades.length ? (
          <p
            className="fx-tm-empty"
            data-state="empty"
            data-closed-capability={closedCapability}
          >
            No closed trades for the current trading day.
            {tables?.closedTrades.note ? ` ${tables.closedTrades.note}` : ""}
          </p>
        ) : (
          <div className="fx-tm-table-wrap">
            <table className="fx-tm-table">
              <thead>
                <tr>
                  <th scope="col">Trade ID</th>
                  <th scope="col">Instrument</th>
                  <th scope="col">Side</th>
                  <th scope="col">Size</th>
                  <th scope="col">Open</th>
                  <th scope="col">Close</th>
                  <th scope="col">Gross P/L</th>
                  <th scope="col">Commission</th>
                  <th scope="col">Rollover</th>
                  <th scope="col">Net P/L</th>
                  <th scope="col">Closed at</th>
                </tr>
              </thead>
              <tbody>
                {tables.closedTrades.closedTrades.map((row, idx) => {
                  const gross = formatSignedPl(row.grossPl, currency);
                  const net = formatSignedPl(row.netPl, currency);
                  return (
                    <tr key={row.tradeId ?? `closed-${idx}`} data-row-source={row.source}>
                      <td>{row.tradeId ?? formatUnavailable()}</td>
                      <td>{row.instrument ?? formatUnavailable()}</td>
                      <td>{formatSide(row.side)}</td>
                      <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                      <td>{formatOptionalNumber(row.openRate, { digits: 5 })}</td>
                      <td>{formatOptionalNumber(row.closeRate, { digits: 5 })}</td>
                      <td><MetricValue text={gross.text} tone={gross.tone} /></td>
                      <td>{formatOptionalNumber(row.commission)}</td>
                      <td>{formatOptionalNumber(row.rolloverInterest)}</td>
                      <td><MetricValue text={net.text} tone={net.tone} /></td>
                      <td>{formatTimestamp(row.closeTime)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fx-tm-panel" aria-label="Persisted trade history" data-section="trade-history">
        <div className="fx-tm-section-head">
          <h2 className="fx-tm-section-title">Trade History (persisted)</h2>
          <span className="fx-tm-muted">
            Durable local ledger · incomplete before first observation · not all-time broker history
          </span>
        </div>
        <p className="fx-tm-muted" data-history-coverage="true">
          {history?.coverageNote
            ?? "Persisted history starts at first local observation. Earlier broker closes may be missing."}
          {" "}
          Available from: {historyAvailableFrom ? formatTimestamp(historyAvailableFrom) : formatUnavailable()}.
        </p>
        <div className="fx-tm-history-filters" role="group" aria-label="History filters">
          <label className="fx-tm-label" htmlFor="fx-tm-hist-from">From</label>
          <input
            id="fx-tm-hist-from"
            className="fx-tm-input"
            type="datetime-local"
            value={historyFrom}
            onChange={(e) => {
              setHistoryOffset(0);
              setHistoryFrom(e.target.value);
            }}
          />
          <label className="fx-tm-label" htmlFor="fx-tm-hist-to">To</label>
          <input
            id="fx-tm-hist-to"
            className="fx-tm-input"
            type="datetime-local"
            value={historyTo}
            onChange={(e) => {
              setHistoryOffset(0);
              setHistoryTo(e.target.value);
            }}
          />
          <label className="fx-tm-label" htmlFor="fx-tm-hist-inst">Instrument</label>
          <input
            id="fx-tm-hist-inst"
            className="fx-tm-input"
            value={historyInstrument}
            onChange={(e) => {
              setHistoryOffset(0);
              setHistoryInstrument(e.target.value);
            }}
            placeholder="e.g. XAU/USD"
          />
          <label className="fx-tm-label" htmlFor="fx-tm-hist-dir">Direction</label>
          <select
            id="fx-tm-hist-dir"
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
          <label className="fx-tm-label" htmlFor="fx-tm-hist-status">Status</label>
          <select
            id="fx-tm-hist-status"
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
        </div>
        {historyState === "auth_required" || historyState === "forbidden" ? (
          <p className="fx-tm-empty" data-state={historyState}>Admin token required.</p>
        ) : historyState === "loading" && !history ? (
          <p className="fx-tm-empty" data-state="loading">Loading persisted history…</p>
        ) : historyState === "error" ? (
          <p className="fx-tm-empty" data-state="error">{historyError ?? "Error"}</p>
        ) : !history?.records.length ? (
          <p className="fx-tm-empty" data-state="empty">
            No persisted trade-history rows for the selected filters.
          </p>
        ) : (
          <>
            <div className="fx-tm-table-wrap">
              <table className="fx-tm-table">
                <thead>
                  <tr>
                    <th scope="col">Trade ID</th>
                    <th scope="col">Instrument</th>
                    <th scope="col">Side</th>
                    <th scope="col">Size</th>
                    <th scope="col">Open</th>
                    <th scope="col">Close</th>
                    <th scope="col">Opened</th>
                    <th scope="col">Closed</th>
                    <th scope="col">Gross P/L</th>
                    <th scope="col">Charges</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.records.map((row) => {
                    const gross = formatSignedPl(row.grossPl, currency);
                    const charges =
                      row.commission != null || row.rolloverInterest != null
                        ? `${formatOptionalNumber(row.commission)} / ${formatOptionalNumber(row.rolloverInterest)}`
                        : formatUnavailable();
                    return (
                      <tr key={row.recordKey} data-row-source={row.source} data-lifecycle={row.lifecycleStatus}>
                        <td>{row.tradeId}</td>
                        <td>{row.instrument ?? formatUnavailable()}</td>
                        <td>{formatSide(row.side)}</td>
                        <td>{formatOptionalNumber(row.amount, { digits: 2 })}</td>
                        <td>{formatOptionalNumber(row.openRate, { digits: 5 })}</td>
                        <td>{formatOptionalNumber(row.closeRate, { digits: 5 })}</td>
                        <td>{formatTimestamp(row.openTime)}</td>
                        <td>{formatTimestamp(row.closeTime)}</td>
                        <td><MetricValue text={gross.text} tone={gross.tone} /></td>
                        <td>{charges}</td>
                        <td>{row.lifecycleStatus}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="fx-tm-pager">
              <button
                type="button"
                className="fx-btn fx-tm-btn is-secondary"
                disabled={historyOffset <= 0}
                onClick={() => setHistoryOffset((o) => Math.max(0, o - HISTORY_PAGE_SIZE))}
              >
                Previous
              </button>
              <span className="fx-tm-muted">
                {history.offset + 1}–{Math.min(history.offset + history.records.length, history.total)}
                {" of "}
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
      </section>
    </section>
  );
}
