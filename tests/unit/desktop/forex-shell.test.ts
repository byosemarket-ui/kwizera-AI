import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  FOREX_DASHBOARD_MODULES,
  FOREX_NAV,
  FOREX_PATH_ALIASES,
  forexPathFor,
  getForexBreadcrumbs,
  getForexDocumentTitle,
  isForexUrl,
  parseForexRouteFromLocation,
  resolveForexLocation,
} from "../../../desktop/forex/forex-routes.ts";
import {
  FOREX_INSTRUMENTS,
  FOREX_WATCHLIST,
  formatQuoteValue,
  resolveMarketSessions,
  unavailableQuote,
} from "../../../desktop/forex/dashboard-data.ts";

const REQUIRED_PATHS = [
  "/forex/dashboard",
  "/forex/markets",
  "/forex/watchlist",
  "/forex/charts",
  "/forex/technical-analysis",
  "/forex/fundamental-analysis",
  "/forex/market-intelligence",
  "/forex/ai-analysis",
  "/forex/signals",
  "/forex/strategies",
  "/forex/trade-journal",
  "/forex/risk-management",
  "/forex/performance",
  "/forex/settings",
];

describe("Forex Phase 1 routing", () => {
  it("treats /forex and /forex/dashboard as the Forex surface", () => {
    expect(isForexUrl("/forex")).toBe(true);
    expect(isForexUrl("/forex/")).toBe(true);
    expect(isForexUrl("/forex/dashboard")).toBe(true);
    expect(isForexUrl("/forex/markets")).toBe(true);
    expect(isForexUrl("/")).toBe(false);
    expect(isForexUrl("/admin")).toBe(false);
    expect(isForexUrl("/desktop/")).toBe(false);
  });

  it("defaults /forex to dashboard and keeps future modules as placeholders", () => {
    expect(parseForexRouteFromLocation("/forex")).toBe("dashboard");
    expect(parseForexRouteFromLocation("/forex/dashboard")).toBe("dashboard");
    expect(parseForexRouteFromLocation("/forex/charts")).toBe("charts");
    expect(forexPathFor("dashboard")).toBe("/forex/dashboard");
    expect(FOREX_NAV.find((item) => item.id === "dashboard")?.implemented).toBe(true);
    expect(FOREX_NAV.filter((item) => item.id !== "dashboard").every((item) => !item.implemented)).toBe(true);
    expect(FOREX_DASHBOARD_MODULES).toHaveLength(8);
  });
});

describe("Forex Phase 2 navigation", () => {
  it("maps every required Forex path and treats unknown paths as not-found", () => {
    for (const pathname of REQUIRED_PATHS) {
      const resolved = resolveForexLocation(pathname);
      expect(resolved.view).not.toBe("not-found");
      expect(FOREX_NAV.some((item) => item.path === pathname && item.inSidebar)).toBe(true);
    }
    expect(parseForexRouteFromLocation("/forex/unknown-module")).toBe("not-found");
    expect(resolveForexLocation("/forex/unknown-page").view).toBe("not-found");
    expect(resolveForexLocation("/forex").shouldCanonicalize).toBe(true);
  });

  it("canonicalizes Phase 1 aliases onto Phase 2 routes", () => {
    expect(FOREX_PATH_ALIASES["/forex/analysis/technical"]).toBe("technical-analysis");
    expect(parseForexRouteFromLocation("/forex/ai")).toBe("ai-analysis");
    expect(parseForexRouteFromLocation("/forex/journal")).toBe("trade-journal");
    expect(parseForexRouteFromLocation("/forex/risk")).toBe("risk-management");
    expect(forexPathFor("trade-journal")).toBe("/forex/trade-journal");
    expect(forexPathFor("risk-management")).toBe("/forex/risk-management");
  });

  it("builds route-specific breadcrumbs and document titles", () => {
    expect(getForexBreadcrumbs("dashboard").map((item) => item.label)).toEqual(["Forex", "Dashboard"]);
    expect(getForexBreadcrumbs("watchlist").map((item) => item.label)).toEqual(["Forex", "Market", "Watchlist"]);
    expect(getForexBreadcrumbs("technical-analysis").map((item) => item.label)).toEqual(["Forex", "Analysis", "Technical Analysis"]);
    expect(getForexBreadcrumbs("ai-analysis").map((item) => item.label)).toEqual(["Forex", "AI Trading", "AI Analysis"]);
    expect(getForexBreadcrumbs("trade-journal").map((item) => item.label)).toEqual(["Forex", "Trading", "Trade Journal"]);
    expect(getForexBreadcrumbs("settings").map((item) => item.label)).toEqual(["Forex", "Settings"]);
    expect(getForexDocumentTitle("dashboard")).toBe("KWIZERA AI STUDIO — Forex Dashboard");
    expect(getForexDocumentTitle("markets")).toBe("KWIZERA AI STUDIO — Markets");
    expect(getForexDocumentTitle("not-found")).toContain("Page not found");
  });
});

describe("Forex Phase 1 shell integration", () => {
  it("loads Forex as a Studio surface, not a second application", () => {
    const src = fs.readFileSync(path.resolve("desktop/src.tsx"), "utf8");
    expect(src).toContain("isForexUrl");
    expect(src).toContain('surface === "forex"');
    expect(src).toContain("AdminControlCenter");
    expect(src).toContain("AppShell");
    expect(src).toContain("lazy(() => import(\"./forex/ForexApp\"))");
    expect(src).toContain("STUDIO_ROOT_PATH");
    const header = fs.readFileSync(path.resolve("desktop/forex/ForexHeader.tsx"), "utf8");
    expect(header).toContain("Back to Studio");
    expect(header).toContain("data-forex-breadcrumb");
  });

  it("exposes a dedicated Forex shell with sidebar, header, and dashboard cards", () => {
    const shell = fs.readFileSync(path.resolve("desktop/forex/ForexShell.tsx"), "utf8");
    const dashboard = fs.readFileSync(path.resolve("desktop/forex/ForexDashboard.tsx"), "utf8");
    const css = fs.readFileSync(path.resolve("desktop/forex/forex.css"), "utf8");
    expect(shell).toContain('data-app-surface="forex"');
    expect(shell).toContain("ForexSidebar");
    expect(shell).toContain("ForexHeader");
    expect(shell).toContain("ForexNotFound");
    expect(shell).toContain("ForexModulePage");
    expect(dashboard).toContain("Welcome to KWIZERA Forex");
    expect(dashboard).toContain("Market data connection: Not connected");
    expect(dashboard).toContain("data-forex-chart-panel");
    expect(dashboard).toContain("data-forex-section=\"markets\"");
    expect(dashboard).toContain("Open Watchlist");
    expect(dashboard).not.toMatch(/1\.1723|BTC\/USD|\+4\.8%|Strong Buy|90% confidence|\$12,480/);
    expect(css).toContain(".fx-sidebar");
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain(".fx-nav-group.is-current");
    expect(css).toContain(".fx-chart-panel");
    expect(css).toContain(".fx-market-grid");
  });

  it("keeps Studio Home navigation into Forex", () => {
    const home = fs.readFileSync(path.resolve("desktop/customer-platform/CustomerHome.tsx"), "utf8");
    const nav = fs.readFileSync(path.resolve("desktop/customer-platform/CustomerNavSection.tsx"), "utf8");
    expect(home).toContain("data-forex-studio-entry");
    expect(home).toContain("window.location.assign(\"/forex\")");
    expect(nav).toContain("data-forex-nav");
    expect(nav).toContain("window.location.assign(\"/forex\")");
  });
});

describe("Forex Phase 3 dashboard data", () => {
  it("keeps instrument labels without fabricated quotes", () => {
    expect(FOREX_INSTRUMENTS.map((item) => item.symbol)).toContain("EUR/USD");
    expect(FOREX_WATCHLIST).toEqual([]);
    const quote = unavailableQuote(FOREX_INSTRUMENTS[0]);
    expect(quote.price).toBeNull();
    expect(quote.change).toBeNull();
    expect(quote.dataSource).toBeNull();
    expect(formatQuoteValue(null, "Not connected")).toBe("Not connected");
    expect(formatQuoteValue(1.1723, "Not connected")).toBe("1.1723");
  });

  it("derives session clocks from UTC hours without a market feed", () => {
    const londonOpen = resolveMarketSessions(new Date("2026-10-06T10:00:00Z"));
    expect(londonOpen.find((item) => item.id === "london")?.status).toBe("open");
    expect(londonOpen.find((item) => item.id === "sydney")?.status).toBe("closed");
    const openingSoon = resolveMarketSessions(new Date("2026-10-06T06:30:00Z"));
    expect(openingSoon.find((item) => item.id === "london")?.status).toBe("opening-soon");
  });
});
