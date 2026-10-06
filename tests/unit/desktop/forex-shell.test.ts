import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  FOREX_DASHBOARD_MODULES,
  FOREX_NAV,
  forexPathFor,
  isForexUrl,
  parseForexRouteFromLocation,
} from "../../../desktop/forex/forex-routes.ts";

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
    expect(parseForexRouteFromLocation("/forex/unknown-module")).toBe("dashboard");
    expect(forexPathFor("dashboard")).toBe("/forex/dashboard");
    expect(FOREX_NAV.find((item) => item.id === "dashboard")?.implemented).toBe(true);
    expect(FOREX_NAV.filter((item) => item.id !== "dashboard").every((item) => !item.implemented)).toBe(true);
    expect(FOREX_DASHBOARD_MODULES).toHaveLength(8);
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
  });

  it("exposes a dedicated Forex shell with sidebar, header, and dashboard cards", () => {
    const shell = fs.readFileSync(path.resolve("desktop/forex/ForexShell.tsx"), "utf8");
    const dashboard = fs.readFileSync(path.resolve("desktop/forex/ForexDashboard.tsx"), "utf8");
    const css = fs.readFileSync(path.resolve("desktop/forex/forex.css"), "utf8");
    expect(shell).toContain('data-app-surface="forex"');
    expect(shell).toContain("ForexSidebar");
    expect(shell).toContain("ForexHeader");
    expect(dashboard).toContain("Welcome to KWIZERA Forex");
    expect(dashboard).toContain("Market data connection: Not connected");
    expect(dashboard).not.toMatch(/EUR\/USD|1\.1723|BTC\/USD|\+4\.8%/);
    expect(css).toContain(".fx-sidebar");
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("prefers-reduced-motion");
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
