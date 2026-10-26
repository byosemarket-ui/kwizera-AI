/**
 * Phase 60.0.15 — dedicated Admin Access nav, route, and global token gate.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  FOREX_NAV,
  forexPathFor,
  getForexBreadcrumbs,
  parseForexRouteFromLocation,
  resolveForexLocation,
} from "../../../desktop/forex/forex-routes.ts";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 60.0.15 Admin Access navigation", () => {
  it("registers Admin Access under Security with implemented route", () => {
    const item = FOREX_NAV.find((n) => n.id === "admin-access");
    expect(item).toBeTruthy();
    expect(item!.path).toBe("/forex/admin-access");
    expect(item!.implemented).toBe(true);
    expect(item!.inSidebar).toBe(true);
    expect(item!.group).toBe("security");
    expect(item!.groupLabel).toBe("Security");
    expect(item!.icon).toBe("shield");
    expect(forexPathFor("admin-access")).toBe("/forex/admin-access");
    expect(parseForexRouteFromLocation("/forex/admin-access")).toBe("admin-access");
    expect(resolveForexLocation("/forex/admin-access").view).toBe("admin-access");
    expect(getForexBreadcrumbs("admin-access").map((c) => c.label)).toEqual([
      "Forex",
      "Admin Access",
    ]);
  });

  it("keeps Settings in Security without duplicating Admin Access", () => {
    const security = FOREX_NAV.filter((n) => n.group === "security" && n.inSidebar);
    expect(security.map((n) => n.id)).toEqual(["admin-access", "settings"]);
    expect(FOREX_NAV.filter((n) => n.id === "admin-access")).toHaveLength(1);
  });
});

describe("Phase 60.0.15 page wiring and dashboard declutter", () => {
  it("shell loads dedicated page; dashboard no longer mounts token card", () => {
    const shell = read("desktop/forex/ForexShell.tsx");
    expect(shell).toContain("ForexAdminAccessPage");
    expect(shell).toContain('route === "admin-access"');

    const page = read("desktop/forex/ForexAdminAccessPage.tsx");
    expect(page).toContain("ForexAdminAccessCard");
    expect(page).toContain('data-places-orders="false"');
    expect(page).toContain('data-accepts-for-execution="false"');

    const dash = read("desktop/forex/ForexDashboard.tsx");
    expect(dash).not.toContain("ForexAdminAccessCard");
    expect(dash).toContain("fx-admin-access-dash-link");
    expect(dash).toContain('onOpenModule("admin-access")');
  });

  it("auth CTA targets /forex/admin-access and lists shared modules without fake connected dots", () => {
    const card = read("desktop/forex/admin-access/ForexAdminAccessCard.tsx");
    expect(card).toContain('"/forex/admin-access"');
    expect(card).toContain("FOREX_ADMIN_SHARED_MODULES");
    expect(card).toContain("Uses shared token");
    expect(card).toContain("data-shared-token");
    expect(card).not.toMatch(/data-connected=["']true["']/);
    expect(card).not.toContain("/forex/dashboard#fx-admin-access");

    for (const rel of [
      "desktop/forex/ForexTradeMonitorPage.tsx",
      "desktop/forex/ForexMonitorPage.tsx",
      "desktop/forex/ForexAutomatedTradingPage.tsx",
    ]) {
      const src = read(rel);
      expect(src).toContain("ForexAdminAccessLink");
      expect(src).toContain("buildForexAdminHeaders");
      expect(src).not.toContain("/forex/dashboard#fx-admin-access");
      expect(src).not.toMatch(/Dashboard → Admin Access/);
    }
  });

  it("preserves trading safety invariants", () => {
    const tm = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(tm).toContain('data-places-orders="false"');
    expect(tm).toContain('data-accepts-for-execution="false"');
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("DisabledBrokerMutationAdapter");
    expect(service).toMatch(/placesOrders:\s*false/);
  });
});
