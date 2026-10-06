import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { ForexDashboard } from "./ForexDashboard";
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
import "./forex.css";

const ForexChartWorkspace = lazy(async () => {
  const module = await import("./chart/ForexChartWorkspace");
  return { default: module.ForexChartWorkspace };
});

class ForexPageBoundary extends Component<{ children: ReactNode; route: ForexViewId }, { failed: string | null }> {
  state = { failed: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { failed: err instanceof Error ? err.message.slice(0, 200) : "Unknown rendering error" };
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.error("[KWIZERA] Forex page render failed:", err, info.componentStack);
  }

  componentDidUpdate(prevProps: { route: ForexViewId }) {
    if (prevProps.route !== this.props.route && this.state.failed) {
      this.setState({ failed: null });
    }
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

  useEffect(() => {
    syncForexUrl(route);
    document.title = getForexDocumentTitle(route);
    return () => {
      document.title = "KWIZERA AI STUDIO";
    };
  }, [route]);

  useEffect(() => {
    const onPop = () => setRoute(parseForexRouteFromLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 820) setSidebarOpen(true);
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
    content = <ForexDashboard onOpenModule={navigate} />;
  } else if (route === "charts" || route === "technical-analysis") {
    content = (
      <Suspense fallback={<p className="fx-page-desc">Loading chart workspace…</p>}>
        <ForexChartWorkspace
          key={route}
          mode={route === "charts" ? "charts" : "analysis"}
          onOpenModule={navigate}
        />
      </Suspense>
    );
  } else {
    content = <ForexModulePage item={getForexNavItem(route)} />;
  }

  return (
    <div className="fx-root" data-app-surface="forex" data-forex-route={route}>
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
            <ForexPageBoundary route={route}>
              {content}
            </ForexPageBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}

export function exitForexToStudio() {
  window.location.assign(STUDIO_HOME_PATH);
}
