/**
 * P8.D — ForexAdmin Performance Analytics UI wiring + Charts nav link.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOREX_ADMIN_NAV,
  getForexAdminDocumentTitle,
  parseForexAdminRouteFromLocation,
} from "../../../desktop/forex-admin/forex-admin-routes";

const root = path.resolve(process.cwd());
function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("P8.D ForexAdmin Performance Analytics UI", () => {
  it("registers navigation and route", () => {
    expect(
      FOREX_ADMIN_NAV.some(
        (i) =>
          i.id === "mt5-hfm-performance-analytics"
          && i.path === "/admin/forex/mt5-hfm/performance-analytics"
          && i.implemented === true,
      ),
    ).toBe(true);
    const loc = parseForexAdminRouteFromLocation(
      "/admin/forex/mt5-hfm/performance-analytics",
    );
    expect(loc.view).toBe("mt5-hfm-performance-analytics");
    expect(loc.canonicalPath).toBe("/admin/forex/mt5-hfm/performance-analytics");
    expect(getForexAdminDocumentTitle("mt5-hfm-performance-analytics")).toContain(
      "Performance Analytics",
    );
  });

  it("wires page, API client, Charts nav link, and safety stamps", () => {
    const pages = read("desktop/forex-admin/ForexAdminPages.tsx");
    const api = read("desktop/forex-admin/api.ts");
    const page = read("desktop/forex-admin/ForexAdminMt5HfmPerformanceAnalyticsPage.tsx");
    const charts = read("desktop/forex/hfm-dashboard/charts/HfmAnalysisPanel.tsx");
    const server = read("dev/server/mt5-hfm-mif-api.ts");

    expect(pages).toContain("ForexAdminMt5HfmPerformanceAnalyticsPage");
    expect(pages).toContain('"mt5-hfm-performance-analytics"');
    expect(api).toContain("mt5HfmMifChartsPerformance");
    expect(api).toContain(
      "/api/forex/providers/mt5-hfm/mif/prediction-outcome/charts/performance",
    );
    expect(server).toContain("prediction-outcome/charts/performance");
    expect(server).toContain("validateAnalyticsFilters");
    expect(server).toContain("buildChartsPerformanceAnalyticsFromStorage");

    expect(page).toContain("data-forex-admin-performance-analytics");
    expect(page).toContain("READ-ONLY");
    expect(page).toContain("placesOrders=false");
    expect(page).toContain("mutatesBroker=false");
    expect(page).toContain("notBrokerAccountPnl");
    expect(page).toContain("activationOpenTimeSec");
    expect(page).toContain("LATEST_PER_PREDICTION");
    expect(page).toContain("PER_PIT_MANIFEST");
    expect(page).toContain("INSUFFICIENT_SAMPLE");
    expect(page).toContain("unavailable");
    expect(page).toContain("Empty population");
    expect(page).toContain("Below 50");
    expect(page).toContain("50 to below 75");
    expect(page).toContain("75 and above");
    expect(page).toContain('value="<50"');
    expect(page).toContain('value=">=75"');
    expect(page).not.toContain('value="<0.5"');
    expect(page).not.toContain("Place Order");
    expect(page).not.toContain("Activate Worker");

    expect(charts).toContain('data-perf-analytics-nav="true"');
    expect(charts).toContain("/admin/forex/mt5-hfm/performance-analytics");
    expect(charts).toContain("Performance Analytics");
  });
});
