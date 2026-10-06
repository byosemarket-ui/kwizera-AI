import { ArrowLeft, Bell, Menu, Moon, Search, Sun, User, X } from "lucide-react";
import type { DesktopPreferences } from "../desktop-polish/types";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { STUDIO_HOME_PATH, getForexNavItem, type ForexRouteId } from "./forex-routes";

export function ForexHeader({
  route,
  sidebarOpen,
  onToggleSidebar,
  onBackToStudio,
  onNotificationsToggle,
  notificationsOpen,
  unreadCount,
  preferences,
  onThemeCycle,
}: {
  route: ForexRouteId;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onBackToStudio: () => void;
  onNotificationsToggle: () => void;
  notificationsOpen: boolean;
  unreadCount: number;
  preferences: DesktopPreferences;
  onThemeCycle: () => void;
}) {
  const item = getForexNavItem(route);
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
          <nav className="fx-breadcrumb" aria-label="Breadcrumb">
            <span>KWIZERA AI STUDIO</span>
            <span aria-hidden="true">/</span>
            <span>Forex</span>
            <span aria-hidden="true">/</span>
            <span>{item.label}</span>
          </nav>
          <h1>{item.label}</h1>
        </div>
      </div>

      <label className="fx-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search Forex modules…"
          aria-label="Search Forex modules"
          disabled
        />
      </label>

      <div className="fx-header-right">
        <div className="fx-session-status" role="status" aria-live="polite">
          <ForexStatusBadge tone="offline">Not connected</ForexStatusBadge>
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
