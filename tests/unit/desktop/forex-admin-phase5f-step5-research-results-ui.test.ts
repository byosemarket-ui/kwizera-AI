/**
 * Phase 5F STEP 5 Phase B — ForexAdmin Research Results UI wiring.
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

describe("Phase 5F STEP 5 Phase B ForexAdmin Research Results UI", () => {
  it("registers navigation and route", () => {
    expect(
      FOREX_ADMIN_NAV.some(
        (i) =>
          i.id === "mt5-hfm-research-results"
          && i.path === "/admin/forex/mt5-hfm/research-results",
      ),
    ).toBe(true);
    const loc = parseForexAdminRouteFromLocation("/admin/forex/mt5-hfm/research-results");
    expect(loc.view).toBe("mt5-hfm-research-results");
  });

  it("wires page, API client, NOT_CALIBRATED labels, and safety stamps", () => {
    const pages = read("desktop/forex-admin/ForexAdminPages.tsx");
    const api = read("desktop/forex-admin/api.ts");
    const page = read("desktop/forex-admin/ForexAdminMt5HfmResearchResultsPage.tsx");
    const server = read("dev/server/mt5-hfm-mif-api.ts");
    expect(pages).toContain("ForexAdminMt5HfmResearchResultsPage");
    expect(pages).toContain('"mt5-hfm-research-results"');
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/research-results");
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/calibration/status");
    expect(api).toContain("mt5HfmMifProbabilityFreezeCreate");
    expect(server).toContain("research-results");
    expect(server).toContain("calibration/status");
    expect(server).toContain("probability-freeze");
    expect(page).toContain("data-forex-admin-research-results");
    expect(page).toContain("DESCRIPTIVE — NOT A PROBABILITY");
    expect(page).toContain("NOT CALIBRATED");
    expect(page).toContain("INSUFFICIENT DATA");
    expect(page).toContain("TEMPORAL LEAKAGE — REJECTED");
    expect(page).toContain("COST-ADJUSTED BACKTEST NOT AVAILABLE");
    expect(page).toContain("POINT-IN-TIME METADATA LIMITED");
    expect(page).toContain("placesOrders=false");
    expect(page).toContain("walkForwardCalibrated=false");
    expect(api).toContain("calibration/walk-forward");
    expect(server).toContain("calibration/walk-forward");
    expect(page).not.toContain("calibrated win rate %");
  });
});
