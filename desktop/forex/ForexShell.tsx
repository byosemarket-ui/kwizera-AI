import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { ForexDashboard } from "./ForexDashboard";
import { ForexHeader } from "./ForexHeader";
import { ForexPlaceholder } from "./ForexPlaceholder";
import { ForexSidebar } from "./ForexSidebar";
import {
  FOREX_NAV,
  getForexNavItem,
  parseForexRouteFromLocation,
  pushForexUrl,
  STUDIO_HOME_PATH,
  syncForexUrl,
  type ForexRouteId,
} from "./forex-routes";
import type { DesktopPreferences } from "../desktop-polish/types";
import "./forex.css";

class ForexPageBoundary extends Component<{ children: ReactNode; route: ForexRouteId }, { failed: string | null }> {
  state = { failed: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { failed: err instanceof Error ? err.message.slice(0, 200) : "Unknown rendering error" };
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.error("[KWIZERA] Forex page render failed:", err, info.componentStack);
  }

  componentDidUpdate(prevProps: { route: ForexRouteId }) {
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
  const [route, setRoute] = useState<ForexRouteId>(() => parseForexRouteFromLocation());
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window !== "undefined" ? window.innerWidth > 820 : true
  ));

  useEffect(() => {
    syncForexUrl(route);
    document.title = `KWIZERA AI STUDIO — Forex ${getForexNavItem(route).label}`;
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

  const current = FOREX_NAV.find((item) => item.id === route) ?? FOREX_NAV[0];
  const content = current.implemented
    ? <ForexDashboard onOpenModule={navigate} />
    : <ForexPlaceholder item={current} />;

  return (
    <div className="fx-root" data-app-surface="forex" data-forex-route={route}>
      <div className={`fx-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
        <ForexHeader
          route={route}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onBackToStudio={onBackToStudio}
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
