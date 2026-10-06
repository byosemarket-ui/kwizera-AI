export type ForexRouteId =
  | "dashboard"
  | "markets"
  | "watchlist"
  | "charts"
  | "technical-analysis"
  | "fundamental-analysis"
  | "intelligence"
  | "ai-analysis"
  | "signals"
  | "strategies"
  | "journal"
  | "risk"
  | "performance"
  | "backtesting"
  | "settings";

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
  group: ForexNavGroupId;
  groupLabel: string;
  icon: ForexNavIconId;
  description: string;
  phaseNote: string;
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
    implemented: false,
    group: "market",
    groupLabel: "Market",
    icon: "globe",
    description: "Currency pairs and market conditions.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "watchlist",
    label: "Watchlist",
    path: "/forex/watchlist",
    implemented: false,
    group: "market",
    groupLabel: "Market",
    icon: "star",
    description: "Saved instruments for later sessions.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "charts",
    label: "Charts",
    path: "/forex/charts",
    implemented: false,
    group: "market",
    groupLabel: "Market",
    icon: "candlestick",
    description: "Price action and technical structure.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "technical-analysis",
    label: "Technical Analysis",
    path: "/forex/analysis/technical",
    implemented: false,
    group: "analysis",
    groupLabel: "Analysis",
    icon: "activity",
    description: "Structure, levels, and technical context.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "fundamental-analysis",
    label: "Fundamental Analysis",
    path: "/forex/analysis/fundamental",
    implemented: false,
    group: "analysis",
    groupLabel: "Analysis",
    icon: "book-open",
    description: "Macro, session, and event context.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "intelligence",
    label: "Market Intelligence",
    path: "/forex/analysis/intelligence",
    implemented: false,
    group: "analysis",
    groupLabel: "Analysis",
    icon: "radar",
    description: "Research workspace for market narratives.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "ai-analysis",
    label: "AI Analysis",
    path: "/forex/ai",
    implemented: false,
    group: "ai",
    groupLabel: "AI Trading",
    icon: "brain",
    description: "AI-assisted market analysis workflows.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "signals",
    label: "Signals",
    path: "/forex/signals",
    implemented: false,
    group: "ai",
    groupLabel: "AI Trading",
    icon: "zap",
    description: "Trading signal workspace.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "strategies",
    label: "Strategies",
    path: "/forex/strategies",
    implemented: false,
    group: "ai",
    groupLabel: "AI Trading",
    icon: "waypoints",
    description: "Build and manage trading strategies.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "journal",
    label: "Trade Journal",
    path: "/forex/journal",
    implemented: false,
    group: "trading",
    groupLabel: "Trading",
    icon: "notebook",
    description: "Track and review trading activity.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "risk",
    label: "Risk Management",
    path: "/forex/risk",
    implemented: false,
    group: "trading",
    groupLabel: "Trading",
    icon: "shield",
    description: "Exposure, sizing, and risk controls.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "performance",
    label: "Performance",
    path: "/forex/performance",
    implemented: false,
    group: "trading",
    groupLabel: "Trading",
    icon: "bar-chart",
    description: "Performance review workspace.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "backtesting",
    label: "Backtesting",
    path: "/forex/backtesting",
    implemented: false,
    group: "trading",
    groupLabel: "Trading",
    icon: "history",
    description: "Historical strategy evaluation.",
    phaseNote: "Coming in a future phase",
  },
  {
    id: "settings",
    label: "Settings",
    path: "/forex/settings",
    implemented: false,
    group: "system",
    groupLabel: "System",
    icon: "settings",
    description: "Forex workspace preferences.",
    phaseNote: "Coming in a future phase",
  },
];

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
  { id: "risk", title: "Risk Management", description: "Manage exposure, position sizing and risk." },
  { id: "journal", title: "Trade Journal", description: "Track and analyze trading activity." },
  { id: "backtesting", title: "Backtesting", description: "Test strategies against historical data." },
];

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

export function getForexNavItem(id: ForexRouteId): ForexNavItem {
  return FOREX_NAV.find((item) => item.id === id) ?? FOREX_NAV[0];
}

export function parseForexRouteFromLocation(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): ForexRouteId {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/forex") return "dashboard";
  if (!path.startsWith("/forex/")) return "dashboard";
  const match = FOREX_NAV.find((item) => item.path === path || path.startsWith(`${item.path}/`));
  return match?.id ?? "dashboard";
}

export function syncForexUrl(route: ForexRouteId): void {
  if (typeof window === "undefined") return;
  const next = forexPathFor(route);
  const current = window.location.pathname.replace(/\/+$/, "") || "/";
  if (current !== next) {
    window.history.replaceState({ forexRoute: route }, "", next);
  }
}

export function pushForexUrl(route: ForexRouteId): void {
  if (typeof window === "undefined") return;
  const next = forexPathFor(route);
  const current = window.location.pathname.replace(/\/+$/, "") || "/";
  if (current !== next) {
    window.history.pushState({ forexRoute: route }, "", next);
  }
}
