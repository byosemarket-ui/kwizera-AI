export type ForexRouteId =
  | "dashboard"
  | "markets"
  | "watchlist"
  | "charts"
  | "technical-analysis"
  | "fundamental-analysis"
  | "market-intelligence"
  | "ai-analysis"
  | "signals"
  | "strategies"
  | "trade-journal"
  | "risk-management"
  | "performance"
  | "backtesting"
  | "settings";

export type ForexViewId = ForexRouteId | "not-found";

export type ForexNavGroupId =
  | "overview"
  | "market"
  | "analysis"
  | "ai"
  | "trading"
  | "system";

export type ForexNavIconId =
  | "layout-dashboard"
  | "globe"
  | "star"
  | "candlestick"
  | "activity"
  | "book-open"
  | "radar"
  | "brain"
  | "zap"
  | "waypoints"
  | "notebook"
  | "shield"
  | "bar-chart"
  | "history"
  | "settings";

export interface ForexNavItem {
  id: ForexRouteId;
  label: string;
  path: string;
  implemented: boolean;
  inSidebar: boolean;
  group: ForexNavGroupId;
  groupLabel: string;
  icon: ForexNavIconId;
  description: string;
  phaseNote: string;
}

export interface ForexLocation {
  view: ForexViewId;
  canonicalPath: string | null;
  shouldCanonicalize: boolean;
}

export interface ForexBreadcrumb {
  label: string;
  route?: ForexRouteId;
}

export const FOREX_ROOT_PATH = "/forex";
export const FOREX_DASHBOARD_PATH = "/forex/dashboard";
export const STUDIO_HOME_PATH = "/";

export const FOREX_NAV: ForexNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/forex/dashboard",
    implemented: true,
    inSidebar: true,
    group: "overview",
    groupLabel: "Overview",
    icon: "layout-dashboard",
    description: "Forex workspace home and module map.",
    phaseNote: "Available",
  },
  {
    id: "markets",
    label: "Markets",
    path: "/forex/markets",
    implemented: true,
    inSidebar: true,
    group: "market",
    groupLabel: "Market",
    icon: "globe",
    description: "Discover Binance Spot markets, search symbols, and select an active market.",
    phaseNote: "Available",
  },
  {
    id: "watchlist",
    label: "Watchlist",
    path: "/forex/watchlist",
    implemented: false,
    inSidebar: true,
    group: "market",
    groupLabel: "Market",
    icon: "star",
    description: "Watchlist persistence is not implemented yet. Selected Binance Spot symbols remain compatible with this route.",
    phaseNote: "Coming Soon",
  },
  {
    id: "charts",
    label: "Charts",
    path: "/forex/charts",
    implemented: true,
    inSidebar: true,
    group: "market",
    groupLabel: "Market",
    icon: "candlestick",
    description: "Interactive candlestick charts with instrument and timeframe controls.",
    phaseNote: "Available",
  },
  {
    id: "technical-analysis",
    label: "Technical Analysis",
    path: "/forex/technical-analysis",
    implemented: true,
    inSidebar: true,
    group: "analysis",
    groupLabel: "Analysis",
    icon: "activity",
    description: "Shared chart engine with SMA, EMA, RSI, MACD, and Bollinger analysis tools.",
    phaseNote: "Available",
  },
  {
    id: "fundamental-analysis",
    label: "Fundamental Analysis",
    path: "/forex/fundamental-analysis",
    implemented: false,
    inSidebar: true,
    group: "analysis",
    groupLabel: "Analysis",
    icon: "book-open",
    description: "Fundamental market research tools will be added in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "market-intelligence",
    label: "Market Intelligence",
    path: "/forex/market-intelligence",
    implemented: false,
    inSidebar: true,
    group: "analysis",
    groupLabel: "Analysis",
    icon: "radar",
    description: "Market news, economic events and intelligence tools will be connected in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "ai-analysis",
    label: "AI Analysis",
    path: "/forex/ai-analysis",
    implemented: false,
    inSidebar: true,
    group: "ai",
    groupLabel: "AI Trading",
    icon: "brain",
    description: "AI-assisted Forex analysis will be connected in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "signals",
    label: "Signals",
    path: "/forex/signals",
    implemented: false,
    inSidebar: true,
    group: "ai",
    groupLabel: "AI Trading",
    icon: "zap",
    description: "Forex signal generation will be implemented in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "strategies",
    label: "Strategies",
    path: "/forex/strategies",
    implemented: false,
    inSidebar: true,
    group: "ai",
    groupLabel: "AI Trading",
    icon: "waypoints",
    description: "Trading strategy tools will be implemented in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "trade-journal",
    label: "Trade Journal",
    path: "/forex/trade-journal",
    implemented: false,
    inSidebar: true,
    group: "trading",
    groupLabel: "Trading",
    icon: "notebook",
    description: "Trade journaling and trade history will be implemented in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "risk-management",
    label: "Risk Management",
    path: "/forex/risk-management",
    implemented: false,
    inSidebar: true,
    group: "trading",
    groupLabel: "Trading",
    icon: "shield",
    description: "Risk management tools will be implemented in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "performance",
    label: "Performance",
    path: "/forex/performance",
    implemented: false,
    inSidebar: true,
    group: "trading",
    groupLabel: "Trading",
    icon: "bar-chart",
    description: "Trading performance analytics will be implemented in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "backtesting",
    label: "Backtesting",
    path: "/forex/backtesting",
    implemented: false,
    inSidebar: false,
    group: "trading",
    groupLabel: "Trading",
    icon: "history",
    description: "Historical strategy evaluation will be implemented in a future phase.",
    phaseNote: "Coming Soon",
  },
  {
    id: "settings",
    label: "Settings",
    path: "/forex/settings",
    implemented: false,
    inSidebar: true,
    group: "system",
    groupLabel: "System",
    icon: "settings",
    description: "Forex-specific settings will be implemented progressively.",
    phaseNote: "Coming Soon",
  },
];

/** Phase 1 paths still resolve to the canonical Phase 2 routes. */
export const FOREX_PATH_ALIASES: Record<string, ForexRouteId> = {
  "/forex/analysis/technical": "technical-analysis",
  "/forex/analysis/fundamental": "fundamental-analysis",
  "/forex/analysis/intelligence": "market-intelligence",
  "/forex/ai": "ai-analysis",
  "/forex/journal": "trade-journal",
  "/forex/risk": "risk-management",
};

export const FOREX_GROUP_ORDER: ForexNavGroupId[] = [
  "overview",
  "market",
  "analysis",
  "ai",
  "trading",
  "system",
];

export const FOREX_DASHBOARD_MODULES: Array<{
  id: ForexRouteId;
  title: string;
  description: string;
}> = [
  { id: "markets", title: "Market Watch", description: "Monitor currency pairs and market conditions." },
  { id: "charts", title: "Charts", description: "Analyze price action and technical structure." },
  { id: "ai-analysis", title: "AI Analysis", description: "Use AI-powered market analysis in future phases." },
  { id: "signals", title: "Signals", description: "Intelligent trading signals will be available in a future phase." },
  { id: "strategies", title: "Strategies", description: "Build and manage trading strategies." },
  { id: "risk-management", title: "Risk Management", description: "Manage exposure, position sizing and risk." },
  { id: "trade-journal", title: "Trade Journal", description: "Track and analyze trading activity." },
  { id: "backtesting", title: "Backtesting", description: "Test strategies against historical data." },
];

export const FOREX_NOT_FOUND: ForexNavItem = {
  id: "dashboard",
  label: "Page not found",
  path: "/forex",
  implemented: false,
  inSidebar: false,
  group: "overview",
  groupLabel: "Forex",
  icon: "layout-dashboard",
  description: "This Forex page does not exist. Return to the dashboard to continue.",
  phaseNote: "Unknown route",
};

export function isForexUrl(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): boolean {
  return pathname === "/forex" || pathname === "/forex/" || pathname.startsWith("/forex/");
}

export function isForexEntryPath(pathname: string): boolean {
  return isForexUrl(pathname);
}

export function forexPathFor(route: ForexRouteId): string {
  return FOREX_NAV.find((item) => item.id === route)?.path ?? FOREX_DASHBOARD_PATH;
}

export function getForexNavItem(id: ForexViewId): ForexNavItem {
  if (id === "not-found") return FOREX_NOT_FOUND;
  return FOREX_NAV.find((item) => item.id === id) ?? FOREX_NAV[0];
}

export function normalizeForexPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function resolveForexLocation(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): ForexLocation {
  const path = normalizeForexPath(pathname);
  if (path === "/forex") {
    return { view: "dashboard", canonicalPath: FOREX_DASHBOARD_PATH, shouldCanonicalize: true };
  }
  const exact = FOREX_NAV.find((item) => item.path === path);
  if (exact) {
    return { view: exact.id, canonicalPath: exact.path, shouldCanonicalize: false };
  }
  const aliased = FOREX_PATH_ALIASES[path];
  if (aliased) {
    return { view: aliased, canonicalPath: forexPathFor(aliased), shouldCanonicalize: true };
  }
  if (path.startsWith("/forex/")) {
    return { view: "not-found", canonicalPath: null, shouldCanonicalize: false };
  }
  return { view: "dashboard", canonicalPath: FOREX_DASHBOARD_PATH, shouldCanonicalize: true };
}

export function parseForexRouteFromLocation(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): ForexViewId {
  return resolveForexLocation(pathname).view;
}

export function getForexBreadcrumbs(view: ForexViewId): ForexBreadcrumb[] {
  if (view === "not-found") {
    return [
      { label: "Forex", route: "dashboard" },
      { label: "Page not found" },
    ];
  }
  const item = getForexNavItem(view);
  const crumbs: ForexBreadcrumb[] = [{ label: "Forex", route: "dashboard" }];
  if (item.id === "dashboard") {
    crumbs.push({ label: "Dashboard" });
    return crumbs;
  }
  if (item.id === "settings") {
    crumbs.push({ label: "Settings" });
    return crumbs;
  }
  crumbs.push({ label: item.groupLabel });
  crumbs.push({ label: item.label });
  return crumbs;
}

export function getForexDocumentTitle(view: ForexViewId): string {
  if (view === "not-found") return "KWIZERA AI STUDIO — Forex Page not found";
  const item = getForexNavItem(view);
  if (item.id === "dashboard") return "KWIZERA AI STUDIO — Forex Dashboard";
  return `KWIZERA AI STUDIO — ${item.label}`;
}

export function isForexChartRoute(route: ForexViewId): boolean {
  return route === "charts" || route === "technical-analysis";
}

export function isForexMarketStateRoute(route: ForexViewId): boolean {
  return (
    route === "dashboard" ||
    route === "markets" ||
    route === "watchlist" ||
    route === "charts" ||
    route === "technical-analysis"
  );
}

export function syncForexUrl(view: ForexViewId): void {
  if (typeof window === "undefined" || view === "not-found") return;
  const path = forexPathFor(view);
  const keepSearch = isForexMarketStateRoute(view);
  const href = keepSearch ? `${path}${window.location.search}` : path;
  const currentPath = normalizeForexPath(window.location.pathname);
  const currentHref = keepSearch ? `${currentPath}${window.location.search}` : currentPath;
  if (currentHref !== href) {
    window.history.replaceState({ forexRoute: view }, "", href);
  }
}

export function pushForexUrl(route: ForexRouteId): void {
  if (typeof window === "undefined") return;
  const path = forexPathFor(route);
  const from = parseForexRouteFromLocation();
  const keepSearch = isForexMarketStateRoute(from) && isForexMarketStateRoute(route);
  const href = keepSearch ? `${path}${window.location.search}` : path;
  const current = `${normalizeForexPath(window.location.pathname)}${keepSearch ? window.location.search : ""}`;
  if (current !== href) {
    window.history.pushState({ forexRoute: route }, "", href);
  }
}
