import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { ForexDashboard } from "./ForexDashboard";
import { ForexMarketsPage } from "./ForexMarketsPage";
import { ForexAiAnalysisPage } from "./ForexAiAnalysisPage";
import { SelectedMarketBar } from "./SelectedMarketBar";
import { ForexHeader } from "./ForexHeader";
import { ForexModulePage } from "./ForexModulePage";
import { ForexNotFound } from "./ForexNotFound";
import { ForexSidebar } from "./ForexSidebar";
import {
  getForexDocumentTitle,
  getForexNavItem,
  parseForexRouteFromLocation,
  pushForexUrl,
  STUDIO_HOME_PATH,
  syncForexUrl,
  type ForexRouteId,
  type ForexViewId,
} from "./forex-routes";
import type { DesktopPreferences } from "../desktop-polish/types";
import { useBinanceConnectionStatus } from "./market-data/use-binance-status";
import { useBinanceLiveTicker } from "./market-data/use-binance-live-ticker";
import {
  readMarketQuery,
  writeMarketQuery,
  type SelectedMarket,
} from "./market-data/selected-market";
import { rememberSessionWatchlist } from "./market-data/session-watchlist";
import { ForexMarketProvider, type ForexMarketWorkspaceState } from "./market-data/forex-market-context";
import { DEFAULT_CHART_TIMEFRAME, type ChartTimeframeId } from "./chart/types";
import "./forex.css";

const ForexChartWorkspace = lazy(async () => {
  const module = await import("./chart/ForexChartWorkspace");
  return { default: module.ForexChartWorkspace };
});

class ForexPageBoundary extends Component<{ children: ReactNode; route: ForexViewId }, { failed: string | null; route: ForexViewId }> {
  state = { failed: null as string | null, route: this.props.route };

  static getDerivedStateFromError(err: unknown) {
    return { failed: err instanceof Error ? err.message.slice(0, 200) : "Unknown rendering error" };
  }

  static getDerivedStateFromProps(
    props: { route: ForexViewId },
    state: { failed: string | null; route: ForexViewId },
  ) {
    if (props.route !== state.route) {
      return { failed: null, route: props.route };
    }
    return null;
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.error("[KWIZERA] Forex page render failed:", err, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="fx-placeholder" role="alert">
        <h1 className="fx-page-title">This Forex view could not be displayed</h1>
        <p className="fx-page-desc">{this.state.failed}</p>
        <button type="button" className="fx-studio-link" onClick={() => this.setState({ failed: null })}>
          Try again
        </button>
      </section>
    );
  }
}

interface ForexShellProps {
  preferences: DesktopPreferences;
  onThemeCycle: () => void;
  onBackToStudio: () => void;
  onNotificationsToggle: () => void;
  notificationsOpen: boolean;
  unreadCount: number;
}

export function ForexShell({
  preferences,
  onThemeCycle,
  onBackToStudio,
  onNotificationsToggle,
  notificationsOpen,
  unreadCount,
}: ForexShellProps) {
  const [route, setRoute] = useState<ForexViewId>(() => parseForexRouteFromLocation());
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window !== "undefined" ? window.innerWidth > 820 : true
  ));
  const { snapshot: binanceConnection, retry: retryBinance } = useBinanceConnectionStatus();
  const [selectedMarket, setSelectedMarket] = useState<SelectedMarket | null>(() => readMarketQuery().selected);
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframeId>(
    () => readMarketQuery().timeframe || DEFAULT_CHART_TIMEFRAME,
  );
  const liveTicker = useBinanceLiveTicker(
    selectedMarket?.venue === "binance-spot" ? selectedMarket.symbol : null,
  );

  const selectMarket = (market: SelectedMarket) => {
    setSelectedMarket(market);
    rememberSessionWatchlist(market);
    writeMarketQuery(market, chartTimeframe);
  };

  const selectTimeframe = (timeframe: ChartTimeframeId) => {
    setChartTimeframe(timeframe);
    writeMarketQuery(selectedMarket, timeframe);
  };

  const marketWorkspace: ForexMarketWorkspaceState = {
    selectedMarket,
    timeframe: chartTimeframe,
    liveTicker,
    binanceConnection,
    selectMarket,
    selectTimeframe,
    retryBinance,
    dataSource: "binance-spot-public",
  };

  useEffect(() => {
    syncForexUrl(route);
    document.title = getForexDocumentTitle(route);
    return () => {
      document.title = "KWIZERA AI STUDIO";
    };
  }, [route]);

  useEffect(() => {
    const onPop = () => {
      setRoute(parseForexRouteFromLocation());
      const query = readMarketQuery();
      setSelectedMarket(query.selected);
      setChartTimeframe(query.timeframe || DEFAULT_CHART_TIMEFRAME);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setSidebarOpen(window.innerWidth > 820);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const navigate = (id: ForexRouteId) => {
    setRoute(id);
    pushForexUrl(id);
    if (window.innerWidth <= 820) setSidebarOpen(false);
  };

  let content: ReactNode;
  if (route === "not-found") {
    content = <ForexNotFound onBackToDashboard={() => navigate("dashboard")} />;
  } else if (route === "dashboard") {
    content = (
      <ForexDashboard
        onOpenModule={navigate}
        binanceConnection={binanceConnection}
        onRetryBinance={retryBinance}
        selectedMarket={selectedMarket}
        timeframe={chartTimeframe}
        liveTicker={liveTicker}
        onSelectMarket={selectMarket}
      />
    );
  } else if (route === "markets") {
    content = (
      <ForexMarketsPage
        selected={selectedMarket}
        onSelect={selectMarket}
        liveTicker={liveTicker}
        onOpenCharts={() => navigate("charts")}
      />
    );
  } else if (route === "charts" || route === "technical-analysis") {
    content = (
      <Suspense fallback={<p className="fx-page-desc">Loading chart workspace…</p>}>
        <ForexChartWorkspace
          mode={route === "charts" ? "charts" : "analysis"}
          onOpenModule={navigate}
          selectedMarket={selectedMarket}
          onSelectMarket={selectMarket}
          timeframe={chartTimeframe}
          onTimeframeChange={selectTimeframe}
          liveTicker={liveTicker}
        />
      </Suspense>
    );
  } else if (route === "ai-analysis") {
    content = (
      <ForexAiAnalysisPage
        selectedMarket={selectedMarket}
        liveTicker={liveTicker}
      />
    );
  } else {
    content = (
      <ForexModulePage
        item={getForexNavItem(route)}
        selectedMarket={selectedMarket}
        liveTicker={liveTicker}
        onSelectMarket={selectMarket}
      />
    );
  }

  return (
    <ForexMarketProvider value={marketWorkspace}>
      <div
        className="fx-root"
        data-app-surface="forex"
        data-forex-route={route}
        data-market-symbol={selectedMarket?.venue === "binance-spot" ? selectedMarket.symbol : ""}
        data-market-timeframe={chartTimeframe}
        data-market-source="binance-spot-public"
      >
        <div className={`fx-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
          <ForexHeader
            route={route}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            onBackToStudio={onBackToStudio}
            onNavigate={navigate}
            onNotificationsToggle={onNotificationsToggle}
            notificationsOpen={notificationsOpen}
            unreadCount={unreadCount}
            preferences={preferences}
            onThemeCycle={onThemeCycle}
            binanceConnection={binanceConnection}
            selectedMarket={selectedMarket}
            liveTicker={liveTicker}
          />
          <div className="fx-body">
            <ForexSidebar route={route} open={sidebarOpen} onNavigate={navigate} />
            {sidebarOpen ? (
              <button
                type="button"
                className="fx-sidebar-scrim"
                aria-label="Close Forex navigation"
                onClick={() => setSidebarOpen(false)}
              />
            ) : null}
            <main className="fx-main" id="forex-main">
              <SelectedMarketBar selected={selectedMarket} onOpenMarkets={navigate} liveTicker={liveTicker} />
              <ForexPageBoundary route={route}>
                {content}
              </ForexPageBoundary>
            </main>
          </div>
        </div>
      </div>
    </ForexMarketProvider>
  );
}

export function exitForexToStudio() {
  window.location.assign(STUDIO_HOME_PATH);
}
