import { ArrowLeft, Bell, Menu, Moon, Search, Sun, User, X } from "lucide-react";
import type { DesktopPreferences } from "../desktop-polish/types";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import {
  getForexBreadcrumbs,
  getForexNavItem,
  type ForexRouteId,
  type ForexViewId,
} from "./forex-routes";
import type { MarketConnectionSnapshot } from "../../ai/market-data/binance/types";
import { connectionBadgeTone, publicConnectionLabel } from "../../ai/market-data/binance/connection";
import type { SelectedMarket } from "./market-data/selected-market";

export function ForexHeader({
  route,
  sidebarOpen,
  onToggleSidebar,
  onBackToStudio,
  onNavigate,
  onNotificationsToggle,
  notificationsOpen,
  unreadCount,
  preferences,
  onThemeCycle,
  binanceConnection,
  selectedMarket,
}: {
  route: ForexViewId;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onBackToStudio: () => void;
  onNavigate: (id: ForexRouteId) => void;
  onNotificationsToggle: () => void;
  notificationsOpen: boolean;
  unreadCount: number;
  preferences: DesktopPreferences;
  onThemeCycle: () => void;
  binanceConnection: MarketConnectionSnapshot;
  selectedMarket: SelectedMarket | null;
}) {
  const item = getForexNavItem(route);
  const crumbs = getForexBreadcrumbs(route);
  const themeLabel = preferences.theme === "light" ? "Light theme" : preferences.theme === "system" ? "System theme" : "Dark theme";

  return (
    <header className="fx-header" role="banner" data-forex-header="true">
      <div className="fx-header-left">
        <button
          type="button"
          className="fx-icon-button fx-mobile-nav-toggle"
          aria-label={sidebarOpen ? "Close Forex navigation" : "Open Forex navigation"}
          aria-expanded={sidebarOpen}
          aria-controls="forex-sidebar"
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="fx-title-block">
          <nav className="fx-breadcrumb" aria-label="Breadcrumb" data-forex-breadcrumb="true">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="fx-breadcrumb-item">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {crumb.route ? (
                  <button type="button" className="fx-breadcrumb-link" onClick={() => onNavigate(crumb.route!)}>
                    {crumb.label}
                  </button>
                ) : (
                  <span aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
          <h1>{item.label}</h1>
        </div>
      </div>

      <label className="fx-search" title="Search is not available yet">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search Forex modules…"
          aria-label="Search Forex modules (coming later)"
          disabled
        />
      </label>

      <div className="fx-header-right">
        <div
          className="fx-session-status"
          role="status"
          aria-live="polite"
          data-binance-connection={binanceConnection.state}
          data-live-market={binanceConnection.liveMarketData ? "true" : "false"}
        >
          <ForexStatusBadge tone={connectionBadgeTone(binanceConnection)}>
            {publicConnectionLabel(binanceConnection)}
          </ForexStatusBadge>
          <span className="fx-panel-meta" data-header-selected-symbol={selectedMarket?.symbol ?? ""}>
            {selectedMarket ? selectedMarket.displaySymbol : "No market selected"}
          </span>
        </div>
        <button
          type="button"
          className="fx-icon-button"
          title={themeLabel}
          aria-label={`Theme: ${themeLabel}. Click to change.`}
          onClick={onThemeCycle}
        >
          {preferences.theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          className={`fx-icon-button ${notificationsOpen ? "is-active" : ""}`}
          title="Notifications"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          aria-expanded={notificationsOpen}
          onClick={onNotificationsToggle}
        >
          <Bell size={16} />
          {unreadCount > 0 ? <span className="fx-unread" aria-hidden="true" /> : null}
        </button>
        <span className="fx-profile" title="Studio session">
          <User size={14} aria-hidden="true" />
          <span>Studio session</span>
        </span>
        <button
          type="button"
          className="fx-studio-link"
          onClick={onBackToStudio}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Studio
        </button>
      </div>
    </header>
  );
}
