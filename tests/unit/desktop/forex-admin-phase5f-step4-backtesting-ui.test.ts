/**
 * Phase 5F STEP 4 — ForexAdmin Backtesting UI wiring.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOREX_ADMIN_NAV,
  parseForexAdminRouteFromLocation,
} from "../../../desktop/forex-admin/forex-admin-routes";

const root = path.resolve(process.cwd());
function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("Phase 5F STEP 4 ForexAdmin Backtesting UI", () => {
  it("registers navigation and route", () => {
    expect(
      FOREX_ADMIN_NAV.some(
        (i) =>
          i.id === "mt5-hfm-backtesting"
          && i.path === "/admin/forex/mt5-hfm/backtesting",
      ),
    ).toBe(true);
    const loc = parseForexAdminRouteFromLocation("/admin/forex/mt5-hfm/backtesting");
    expect(loc.view).toBe("mt5-hfm-backtesting");
  });

  it("wires page, API client, and safety copy", () => {
    const pages = read("desktop/forex-admin/ForexAdminPages.tsx");
    const api = read("desktop/forex-admin/api.ts");
    const page = read("desktop/forex-admin/ForexAdminMt5HfmBacktestingPage.tsx");
    expect(pages).toContain("ForexAdminMt5HfmBacktestingPage");
    expect(pages).toContain('"mt5-hfm-backtesting"');
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/backtesting/runs");
    expect(api).toContain("mt5HfmMifBacktestRunCreate");
    expect(api).toContain("costAdjusted: false");
    expect(page).toContain("GROSS_OHLC_ANALYTICAL");
    expect(page).toContain("costAdjusted=false");
    expect(page).toContain("placesOrders=false");
    expect(page).toContain("data-forex-admin-backtesting");
    expect(page).toContain("Not calibrated probability");
    expect(page).not.toContain("win probability");
  });
});
