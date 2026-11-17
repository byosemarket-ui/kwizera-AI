/**
 * STEP 3A — HFM Market Watch foundation: integrity, helpers, routing, design tokens.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  HFM_MT5_DASHBOARD_PATH,
  HFM_MT5_MARKET_WATCH_PATH,
  getForexDocumentTitle,
  getForexNavItem,
  resolveForexLocation,
} from "../../../desktop/forex/forex-routes";
import {
  computeMovementSummary,
  unavailableMovementSummary,
} from "../../../desktop/forex/hfm-dashboard/market-watch/movement";
import {
  mapHfmProviderUiStatus,
  providerUiStatusLabel,
} from "../../../desktop/forex/hfm-dashboard/market-watch/provider-status";
import {
  resolveTradingSessionOverview,
  resolveTradingSessionRows,
} from "../../../desktop/forex/hfm-dashboard/market-watch/sessions";
import { HFM_MW_PROVIDER } from "../../../desktop/forex/hfm-dashboard/market-watch/types";

/** Screenshot sample values that must never appear as live UI facts in MW sources. */
const HFM_MW_FORBIDDEN_SAMPLE_VALUES = [
  "49903799",
  "2347.61",
  "1.08542",
  "1.08545",
  "2347.58",
  "2347.64",
] as const;

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const MW_SRC_FILES = [
  "desktop/forex/hfm-dashboard/market-watch/HfmMarketWatchPage.tsx",
  "desktop/forex/hfm-dashboard/market-watch/api.ts",
  "desktop/forex/hfm-dashboard/market-watch/movement.ts",
  "desktop/forex/hfm-dashboard/market-watch/sessions.ts",
  "desktop/forex/hfm-dashboard/market-watch/provider-status.ts",
  "desktop/forex/hfm-dashboard/market-watch/components/HfmMarketOverview.tsx",
  "desktop/forex/hfm-dashboard/market-watch/components/HfmMarketCategories.tsx",
  "desktop/forex/hfm-dashboard/market-watch/components/HfmSelectedInstrumentPanel.tsx",
  "desktop/forex/hfm-dashboard/market-watch/components/HfmTradingSessionsPanel.tsx",
  "desktop/forex/hfm-dashboard/market-watch/components/HfmMarketWatchHeader.tsx",
  "desktop/forex/hfm-dashboard/market-watch/components/HfmMarketWatchWorkspace.tsx",
  "desktop/forex/hfm-dashboard/market-watch/components/HfmProviderStatus.tsx",
  "desktop/forex/hfm-dashboard/market-watch/hfm-market-watch.css",
  "desktop/forex/hfm-dashboard/HfmDashboardPage.tsx",
];

describe("STEP 3A HFM Market Watch routing", () => {
  it("resolves Market Watch path and preserves dashboard path", () => {
    const mw = resolveForexLocation(HFM_MT5_MARKET_WATCH_PATH);
    expect(mw.view).toBe("hfm-mt5-market-watch");
    expect(mw.canonicalPath).toBe(HFM_MT5_MARKET_WATCH_PATH);

    const dash = resolveForexLocation(HFM_MT5_DASHBOARD_PATH);
    expect(dash.view).toBe("hfm-mt5-dashboard");
    expect(dash.canonicalPath).toBe(HFM_MT5_DASHBOARD_PATH);

    expect(resolveForexLocation("/forex/hfm/market-watch").view).toBe("hfm-mt5-market-watch");
  });

  it("exposes implemented Market Watch nav with DEMO HFM identity in title", () => {
    const item = getForexNavItem("hfm-mt5-market-watch");
    expect(item.implemented).toBe(true);
    expect(item.path).toBe(HFM_MT5_MARKET_WATCH_PATH);
    expect(getForexDocumentTitle("hfm-mt5-market-watch")).toContain("HFM MT5 Market Watch");
  });
});

describe("STEP 3A provider identity and status mapping", () => {
  it("validates fixed HFM DEMO provider identity", () => {
    expect(HFM_MW_PROVIDER.provider).toBe("HFM_MT5");
    expect(HFM_MW_PROVIDER.environment).toBe("demo");
    expect(HFM_MW_PROVIDER.platform).toBe("MT5");
    expect(HFM_MW_PROVIDER.label).toBe("HFM MT5 DEMO");
  });

  it("maps distinguishable health signals without treating Node-only reachability as connected", () => {
    expect(
      mapHfmProviderUiStatus({
        sseStatus: "auth_required",
        connectionState: "waiting",
        freshness: "WAITING_FOR_DATA",
        terminalRunning: null,
        authenticated: null,
      }),
    ).toBe("AUTH_REQUIRED");

    expect(
      mapHfmProviderUiStatus({
        sseStatus: "connected",
        connectionState: "connected",
        freshness: "LIVE",
        terminalRunning: true,
        authenticated: true,
      }),
    ).toBe("CONNECTED");

    expect(
      mapHfmProviderUiStatus({
        sseStatus: "connected",
        connectionState: "degraded",
        freshness: "STALE",
        terminalRunning: true,
        authenticated: true,
      }),
    ).toBe("DEGRADED");

    expect(
      mapHfmProviderUiStatus({
        sseStatus: "error",
        connectionState: "disconnected",
        freshness: "DISCONNECTED",
        terminalRunning: false,
        authenticated: false,
      }),
    ).toBe("ERROR");

    expect(providerUiStatusLabel("CONNECTED")).toBe("Connected");
  });
});

describe("STEP 3A movement and session honesty", () => {
  it("keeps rising/falling/unchanged unavailable without daily reference baseline", () => {
    const empty = computeMovementSummary([]);
    expect(empty.availability).toBe("unavailable");
    expect(empty.rising).toBeNull();
    expect(empty.falling).toBeNull();
    expect(empty.unchanged).toBeNull();

    const noBaseline = computeMovementSummary([
      { symbol: "EURUSD", dailyReferencePrice: null, mid: 1.1 },
      { symbol: "XAUUSD", dailyReferencePrice: undefined, mid: 2000 },
    ]);
    expect(noBaseline.availability).toBe("unavailable");
    expect(noBaseline.rising).toBeNull();

    const withBaseline = computeMovementSummary([
      { symbol: "EURUSD", dailyReferencePrice: 1.1, mid: 1.12 },
      { symbol: "GBPUSD", dailyReferencePrice: 1.25, mid: 1.24 },
      { symbol: "USDJPY", dailyReferencePrice: 150, mid: 150 },
    ]);
    expect(withBaseline.availability).toBe("available");
    expect(withBaseline.rising).toBe(1);
    expect(withBaseline.falling).toBe(1);
    expect(withBaseline.unchanged).toBe(1);

    const explicit = unavailableMovementSummary();
    expect(explicit.availability).toBe("unavailable");
  });

  it("does not invent named Sydney/Tokyo/London/New York sessions", () => {
    const overview = resolveTradingSessionOverview(null);
    expect(overview.availability).toBe("unavailable");
    expect(overview.name).toBeNull();
    expect(overview.status).toBeNull();

    const panel = resolveTradingSessionRows(null);
    expect(panel.availability).toBe("unavailable");
    expect(panel.rows).toEqual([]);

    const named = resolveTradingSessionRows([
      {
        name: "BrokerSessionA",
        openTime: "08:00",
        closeTime: "16:00",
        status: "Open",
        timeZone: "UTC",
      },
    ]);
    expect(named.availability).toBe("available");
    expect(named.rows).toHaveLength(1);
    expect(named.rows[0]?.name).toBe("BrokerSessionA");
  });
});

describe("STEP 3A source integrity — no screenshot sample facts", () => {
  it("Market Watch sources do not hardcode screenshot account/prices/counts as live facts", () => {
    const joined = MW_SRC_FILES.map((rel) => read(rel)).join("\n");
    for (const sample of HFM_MW_FORBIDDEN_SAMPLE_VALUES) {
      expect(joined.includes(sample), `forbidden sample ${sample}`).toBe(false);
    }
    // Screenshot instrument totals / movement counts must not be baked in as literals driving UI.
    expect(joined).not.toMatch(/Total Instruments[^\n]{0,40}\b347\b/);
    expect(joined).not.toMatch(/\brising:\s*152\b/i);
    expect(joined).not.toMatch(/\bfalling:\s*168\b/i);
    expect(joined).not.toMatch(/London \(Open\)/);
    expect(joined).not.toMatch(/XAUUSD - Gold vs US Dollar/);
  });

  it("does not select XAUUSD by default or fabricate session hub rows", () => {
    const page = read("desktop/forex/hfm-dashboard/market-watch/HfmMarketWatchPage.tsx");
    expect(page).toMatch(/useState<HfmMwSelectedInstrument \| null>\(null\)/);
    expect(page).toMatch(/resolveTradingSessionRows\(null\)/);
    expect(page).toMatch(/unavailableMovementSummary\(\)/);

    const sessions = read(
      "desktop/forex/hfm-dashboard/market-watch/components/HfmTradingSessionsPanel.tsx",
    );
    expect(sessions).not.toMatch(/Sydney/);
    expect(sessions).not.toMatch(/Tokyo/);
    expect(sessions).not.toMatch(/New York/);
  });

  it("uses confirmed HFM catalog endpoints only", () => {
    const api = read("desktop/forex/hfm-dashboard/market-watch/api.ts");
    expect(api).toContain("/api/forex/providers/mt5-hfm/symbols/status");
    expect(api).toContain("/api/forex/providers/mt5-hfm/symbols/categories");
    expect(api).not.toMatch(/fakeQuotes|samplePrices|fixtureData/i);
    expect(api.toLowerCase()).not.toContain("substitute data when");
    expect(api).not.toContain("fxcm");
    expect(api).not.toContain("binance");
    expect(api).not.toContain("oanda");
  });
});

describe("STEP 3A design system and component foundation", () => {
  it("defines Market Watch design tokens and responsive rules", () => {
    const css = read("desktop/forex/hfm-dashboard/market-watch/hfm-market-watch.css");
    for (const token of [
      "--hfm-mw-bg",
      "--hfm-mw-sidebar",
      "--hfm-mw-card",
      "--hfm-mw-purple",
      "--hfm-mw-text",
      "--hfm-mw-text-muted",
      "--hfm-mw-border",
      "--hfm-mw-positive",
      "--hfm-mw-negative",
      "--hfm-mw-warn",
      "--hfm-mw-info",
      "--hfm-mw-live",
      "--hfm-mw-stale",
      "--hfm-mw-disconnected",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("@media (max-width: 520px)");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("wires Market Watch into HFM shell with compact account overview preserved", () => {
    const page = read("desktop/forex/hfm-dashboard/HfmDashboardPage.tsx");
    expect(page).toContain("HfmMarketWatchPage");
    expect(page).toContain('label: "Market Watch"');
    expect(page).toContain("locked: false");
    expect(page).toContain("HfmAccountOverview");
    expect(page).toContain('data-hfm-view={view}');
    expect(page).toContain("hfm-mt5-market-watch");

    const accountCss = read("desktop/forex/hfm-dashboard/hfm-dashboard.css");
    expect(accountCss).toContain(".hfm-card.hfm-account-panel");
    expect(accountCss).toContain("grid-template-columns: repeat(6, minmax(0, 1fr))");
  });

  it("selected instrument and session panels expose empty/unavailable foundations", () => {
    const selected = read(
      "desktop/forex/hfm-dashboard/market-watch/components/HfmSelectedInstrumentPanel.tsx",
    );
    expect(selected).toContain("No instrument selected");
    expect(selected).toContain("STEP 3B");

    const sessions = read(
      "desktop/forex/hfm-dashboard/market-watch/components/HfmTradingSessionsPanel.tsx",
    );
    expect(sessions).toContain("Session schedule unavailable");

    const states = read(
      "desktop/forex/hfm-dashboard/market-watch/components/HfmMarketWatchStates.tsx",
    );
    expect(states).toContain("HfmMarketWatchLoadingState");
    expect(states).toContain("HfmMarketWatchEmptyState");
    expect(states).toContain("HfmMarketWatchErrorState");
  });

  it("preserves read-only safety markers on HFM shell", () => {
    const page = read("desktop/forex/hfm-dashboard/HfmDashboardPage.tsx");
    expect(page).toContain('data-broker="HFM_MT5"');
    expect(page).toContain('data-environment="demo"');
    expect(page).toContain('data-readonly="true"');
    expect(page).not.toMatch(/placesOrders\s*=\s*true/);
    expect(page).not.toMatch(/submitOrder|placeOrder|mutatesBroker\s*=\s*true/);
  });
});

describe("STEP 3A responsive CSS foundations", () => {
  it("stacks workspace and rearranges overview cards across breakpoints", () => {
    const css = read("desktop/forex/hfm-dashboard/market-watch/hfm-market-watch.css");
    expect(css).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toMatch(/\.hfm-mw-workspace\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toContain("overflow-x: auto");
  });
});
