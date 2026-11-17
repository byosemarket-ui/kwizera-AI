import { useEffect, useMemo, useState } from "react";
import { HFM_MT5_MARKET_WATCH_PATH, pushForexUrl } from "../forex-routes";
import {
  retainHfmRealtimeStore,
  restartHfmRealtimeStore,
  useHfmRealtimeStore,
} from "./hfm-realtime-store";
import {
  HFM_CHART_SYMBOLS,
  type HfmCandleTf,
  type HfmChartSymbol,
} from "./types";
import { formatUtcClock } from "./format";
import { HfmCandlestickChart } from "./components/HfmCandlestickChart";
import {
  HfmAccountOverview,
  HfmAiAnalysisPanel,
  HfmDataStatusBar,
  HfmFreshnessBadge,
  HfmMarketIntelligence,
  HfmMarketWatch,
  HfmOrdersPositions,
  HfmSystemHealth,
} from "./components/HfmPanels";
import { HfmMarketWatchPage } from "./market-watch/HfmMarketWatchPage";
import { HfmProviderStatus } from "./market-watch/components/HfmProviderStatus";
import type { HfmMwRealtimeHints, HfmMarketWatchViewId } from "./market-watch/types";
import "./hfm-dashboard.css";
import "./market-watch/hfm-market-watch.css";

type NavId =
  | "dashboard"
  | "market-watch"
  | "charts"
  | "signals"
  | "orders"
  | "risk"
  | "system"
  | "settings";

const NAV: Array<{ id: NavId; label: string; locked: boolean }> = [
  { id: "dashboard", label: "Dashboard", locked: false },
  { id: "market-watch", label: "Market Watch", locked: false },
  { id: "charts", label: "Charts & Analysis", locked: true },
  { id: "signals", label: "Signals & AI", locked: true },
  { id: "orders", label: "Orders & Positions", locked: true },
  { id: "risk", label: "Risk Management", locked: true },
  { id: "system", label: "System & Data", locked: true },
  { id: "settings", label: "Settings", locked: true },
];

function isChartSymbol(s: string): s is HfmChartSymbol {
  return (HFM_CHART_SYMBOLS as readonly string[]).includes(s);
}

function viewFromPath(pathname: string): HfmMarketWatchViewId {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === HFM_MT5_MARKET_WATCH_PATH || path.endsWith("/hfm/market-watch")) {
    return "market-watch";
  }
  return "dashboard";
}

export function HfmDashboardPage({
  initialView,
}: {
  initialView?: HfmMarketWatchViewId;
} = {}) {
  const state = useHfmRealtimeStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clock, setClock] = useState(() => formatUtcClock());
  const [symbol, setSymbol] = useState<HfmChartSymbol>("EURUSD");
  const [timeframe, setTimeframe] = useState<HfmCandleTf>("M15");
  const [view, setView] = useState<HfmMarketWatchViewId>(
    () => initialView ?? viewFromPath(typeof window !== "undefined" ? window.location.pathname : ""),
  );

  useEffect(() => retainHfmRealtimeStore(), []);

  useEffect(() => {
    const t = setInterval(() => setClock(formatUtcClock()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 820) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const sync = () => setView(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);

  const bars = useMemo(() => {
    const tfs = state.candles[symbol];
    const list = tfs?.[timeframe];
    return Array.isArray(list) ? list : [];
  }, [state.candles, symbol, timeframe]);

  const quoteDigits = state.quotes[symbol]?.digits ?? null;

  const realtimeHints: HfmMwRealtimeHints = useMemo(
    () => ({
      sseStatus: state.sseStatus,
      connectionState: state.connectionState,
      freshness: state.freshness,
      terminalRunning: state.terminalRunning,
      authenticated: state.authenticated,
      lastEventAt: state.lastEventAt,
      lastError: state.lastError,
      accountLogin: state.account?.loginExact ?? state.account?.loginHint ?? null,
      accountServer: state.account?.server ?? null,
      accountCurrency: state.account?.currency ?? null,
    }),
    [
      state.sseStatus,
      state.connectionState,
      state.freshness,
      state.terminalRunning,
      state.authenticated,
      state.lastEventAt,
      state.lastError,
      state.account?.loginExact,
      state.account?.loginHint,
      state.account?.server,
      state.account?.currency,
    ],
  );

  const sideTerm =
    state.terminalRunning === true ? (
      <span className="hfm-ok">Online</span>
    ) : (
      <span className="hfm-bad">Offline</span>
    );
  // Agent auth ≠ SSE client socket. Keep them separate so a connected browser
  // cannot paint the broker/agent as healthy while the terminal is down.
  const sideAgent =
    state.authenticated === true ? (
      <span className="hfm-ok">Authenticated</span>
    ) : state.terminalRunning === true ? (
      <span className="hfm-warn">Terminal up / auth unknown</span>
    ) : (
      <span className="hfm-bad">Unauthenticated</span>
    );
  const sideSse =
    state.sseStatus === "connected" ? (
      <span className="hfm-ok">Connected</span>
    ) : (
      <span className="hfm-warn">{state.sseStatus}</span>
    );
  const sideConn =
    state.terminalRunning === true && state.authenticated === true && state.connectionState === "connected" ? (
      <span className="hfm-ok">Connected</span>
    ) : state.terminalRunning === false ? (
      <span className="hfm-bad">Terminal offline</span>
    ) : (
      <span className="hfm-warn">{state.connectionState}</span>
    );

  const activeNav: NavId = view === "market-watch" ? "market-watch" : "dashboard";

  function navigateHfm(next: NavId) {
    if (next === "dashboard") {
      setView("dashboard");
      pushForexUrl("hfm-mt5-dashboard");
      setSidebarOpen(false);
      return;
    }
    if (next === "market-watch") {
      setView("market-watch");
      pushForexUrl("hfm-mt5-market-watch");
      setSidebarOpen(false);
    }
  }

  return (
    <div
      data-hfm-dashboard
      data-sidebar={sidebarOpen ? "open" : "closed"}
      data-broker="HFM_MT5"
      data-environment="demo"
      data-readonly="true"
      data-hfm-view={view}
    >
      <div className="hfm-shell">
        <aside className="hfm-sidebar" aria-label="HFM navigation">
          <div className="hfm-brand">
            <div className="hfm-brand-name">KWIZERA AI STUDIO</div>
            <div className="hfm-brand-sub">Forex Automated Trading</div>
          </div>

          <HfmProviderStatus realtime={realtimeHints} />

          <nav className="hfm-nav" aria-label="Modules">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className="hfm-nav-btn"
                data-active={item.id === activeNav}
                data-locked={item.locked}
                aria-disabled={item.locked}
                aria-current={item.id === activeNav ? "page" : undefined}
                title={
                  item.locked
                    ? "Module locked — destination not connected yet"
                    : item.label
                }
                onClick={() => {
                  if (item.locked) return;
                  navigateHfm(item.id);
                }}
              >
                <span>{item.label}</span>
                {item.locked ? <span className="hfm-lock">Lock</span> : null}
              </button>
            ))}
          </nav>

          <div className="hfm-side-status">
            <h3>HFM MT5 Status</h3>
            <div className="hfm-side-row">
              <span>Terminal (Wine)</span>
              {sideTerm}
            </div>
            <div className="hfm-side-row">
              <span>MT5 Agent auth</span>
              {sideAgent}
            </div>
            <div className="hfm-side-row">
              <span>SSE client</span>
              {sideSse}
            </div>
            <div className="hfm-side-row">
              <span>Broker connection</span>
              {sideConn}
            </div>
            <HfmProviderStatus realtime={realtimeHints} compact />
          </div>
        </aside>

        <button
          type="button"
          className="hfm-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />

        <div className="hfm-main">
          {view === "market-watch" ? (
            <>
              <header className="hfm-topbar">
                <div className="hfm-topbar-left">
                  <button
                    type="button"
                    className="hfm-menu-toggle"
                    aria-label="Open navigation"
                    onClick={() => setSidebarOpen(true)}
                  >
                    Menu
                  </button>
                  <div className="hfm-topbar-titles">
                    <h1 className="hfm-title">Market Watch — HFM MT5</h1>
                    <p className="hfm-subtitle">HFM MT5 (Demo) · Read-Only · Catalog + provider status</p>
                  </div>
                </div>
                <div className="hfm-topbar-right">
                  <HfmFreshnessBadge freshness={state.freshness} />
                  <span className="hfm-clock">{clock}</span>
                </div>
              </header>

              {state.sseStatus === "auth_required" ? (
                <div className="hfm-auth-banner" role="status">
                  Admin API token required for HFM data. Configure it at{" "}
                  <a href="/forex/admin-access">/forex/admin-access</a>.
                  {state.lastError ? ` (${state.lastError})` : ""}
                </div>
              ) : null}

              <div className="hfm-content">
                <HfmAccountOverview account={state.account} freshness={state.freshness} />
                <HfmMarketWatchPage realtime={realtimeHints} />
              </div>
              <HfmDataStatusBar state={state} />
            </>
          ) : (
            <>
              <header className="hfm-topbar">
                <div className="hfm-topbar-left">
                  <button
                    type="button"
                    className="hfm-menu-toggle"
                    aria-label="Open navigation"
                    onClick={() => setSidebarOpen(true)}
                  >
                    Menu
                  </button>
                  <div className="hfm-topbar-titles">
                    <h1 className="hfm-title">HFM MT5 Dashboard</h1>
                    <p className="hfm-subtitle">HFM MT5 (Demo) · Read-Only · No Trading</p>
                  </div>
                </div>
                <div className="hfm-topbar-right">
                  <HfmFreshnessBadge freshness={state.freshness} />
                  <span className="hfm-clock">{clock}</span>
                  {(state.sseStatus === "reconnecting" || state.sseStatus === "error") && (
                    <button type="button" className="hfm-menu-toggle" onClick={() => restartHfmRealtimeStore()}>
                      Reconnect
                    </button>
                  )}
                </div>
              </header>

              {state.sseStatus === "auth_required" ? (
                <div className="hfm-auth-banner" role="status">
                  Admin API token required for the HFM SSE feed. Configure it at{" "}
                  <a href="/forex/admin-access">/forex/admin-access</a>, then reopen this dashboard.
                  {state.lastError ? ` (${state.lastError})` : ""}
                </div>
              ) : null}

              <div className="hfm-content">
                <HfmAccountOverview account={state.account} freshness={state.freshness} />

                <div className="hfm-mid">
                  <HfmCandlestickChart
                    symbol={symbol}
                    timeframe={timeframe}
                    bars={bars}
                    freshness={state.freshness}
                    digits={quoteDigits}
                    onSymbolChange={setSymbol}
                    onTimeframeChange={setTimeframe}
                  />
                  <HfmMarketWatch
                    quotes={state.quotes}
                    activeSymbol={symbol}
                    onSelect={(s) => {
                      if (isChartSymbol(s)) setSymbol(s);
                    }}
                  />
                </div>

                <div className="hfm-bottom">
                  <HfmMarketIntelligence />
                  <HfmAiAnalysisPanel />
                  <HfmOrdersPositions account={state.account} />
                  <HfmSystemHealth state={state} />
                </div>
              </div>

              <HfmDataStatusBar state={state} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
