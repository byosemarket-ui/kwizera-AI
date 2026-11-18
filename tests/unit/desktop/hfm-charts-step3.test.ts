import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateADX,
  calculateATR,
  calculateCCI,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateBollingerBands,
} from "../../../desktop/forex/chart/indicators";
import { fibExtensionLevels, fibRetracementLevels } from "../../../desktop/forex/hfm-dashboard/charts/fibonacci";
import {
  HFM_CHART_TIMEFRAMES,
  HFM_CHART_VERIFIED_TFS,
  isVerifiedHfmChartTf,
} from "../../../desktop/forex/hfm-dashboard/charts/types";
import { HFM_MT5_CHARTS_PATH } from "../../../desktop/forex/forex-routes";

const root = resolve(__dirname, "../../..");
function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

const fixture = Array.from({ length: 60 }, (_, i) => {
  const close = 100 + Math.sin(i / 5) * 2 + i * 0.05;
  return {
    time: 1_700_000_000 + i * 60,
    open: close - 0.2,
    high: close + 0.5,
    low: close - 0.5,
    close,
  };
});

describe("STEP 3 HFM Charts workspace", () => {
  it("unlocks Charts route and workspace wiring", () => {
    const routes = read("desktop/forex/forex-routes.ts");
    expect(routes).toContain('id: "hfm-mt5-charts"');
    expect(routes).toContain(HFM_MT5_CHARTS_PATH);
    const shell = read("desktop/forex/ForexShell.tsx");
    expect(shell).toContain("hfm-mt5-charts");
    const dash = read("desktop/forex/hfm-dashboard/HfmDashboardPage.tsx");
    expect(dash).toContain('label: "Charts & Analysis", locked: false');
    expect(dash).toContain("HfmChartsWorkspace");
    const ws = read("desktop/forex/hfm-dashboard/charts/HfmChartsWorkspace.tsx");
    expect(ws).toContain('data-provider="HFM_MT5"');
    expect(ws).toContain("HfmAnalysisPanel");
    expect(ws).not.toMatch(/OrderSend/i);
    const panel = read("desktop/forex/hfm-dashboard/charts/HfmAnalysisPanel.tsx");
    expect(panel).toContain('data-hfm-analysis-boundary="true"');
    expect(panel).toContain('data-analysis-implemented="true"');
    expect(panel).toContain('data-phase2-context="true"');
    expect(panel).toMatch(/No BUY\/SELL signals/i);
    expect(panel).not.toMatch(/OrderSend|Execute Trade|Auto Trade/i);
  });

  it("uses STEP 2 HFM candle APIs and quote-watch only", () => {
    const api = read("desktop/forex/hfm-dashboard/charts/api.ts");
    expect(api).toContain("/api/forex/providers/mt5-hfm/market/candles");
    expect(api).toContain("/api/forex/providers/mt5-hfm/market/quote-watch");
    expect(api).not.toMatch(/FXCM|Binance|ForexConnect|Yahoo|TradingView/);
    expect(api).toContain("normalizeBars");
  });

  it("exposes verified and requested timeframes honestly", () => {
    expect(HFM_CHART_VERIFIED_TFS).toEqual(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]);
    expect(HFM_CHART_TIMEFRAMES).toContain("W1");
    expect(HFM_CHART_TIMEFRAMES).toContain("MN1");
    expect(isVerifiedHfmChartTf("H4")).toBe(true);
    expect(isVerifiedHfmChartTf("H2")).toBe(false);
  });

  it("calculates required indicators on fixture candles", () => {
    expect(calculateSMA(fixture, 20).length).toBeGreaterThan(0);
    expect(calculateEMA(fixture, 20).length).toBeGreaterThan(0);
    expect(calculateRSI(fixture, 14).at(-1)?.value).toBeGreaterThan(0);
    expect(calculateMACD(fixture).macd.length).toBeGreaterThan(0);
    expect(calculateStochastic(fixture).k.length).toBeGreaterThan(0);
    expect(calculateCCI(fixture, 20).length).toBeGreaterThan(0);
    expect(calculateATR(fixture, 14).length).toBeGreaterThan(0);
    expect(calculateBollingerBands(fixture, 20, 2).upper.length).toBeGreaterThan(0);
    expect(calculateADX(fixture, 14).adx.length).toBeGreaterThan(0);
  });

  it("computes fibonacci retracement and extension levels", () => {
    const ret = fibRetracementLevels(110, 100);
    expect(ret.find((r) => r.ratio === 0.5)?.price).toBeCloseTo(105, 8);
    const ext = fibExtensionLevels(100, 110, 108);
    expect(ext.find((r) => r.ratio === 1)?.price).toBeCloseTo(118, 8);
  });

  it("chart engine supports multiple series types and drawing tools", () => {
    const eng = read("desktop/forex/hfm-dashboard/charts/HfmChartEngine.tsx");
    expect(eng).toContain("addCandlestickSeries");
    expect(eng).toContain("addBarSeries");
    expect(eng).toContain("addLineSeries");
    expect(eng).toContain("addAreaSeries");
    expect(eng).toContain("fib_retracement");
    expect(eng).toContain("createPriceLine");
    expect(eng).toContain('from "lightweight-charts"');
    expect(eng).toContain("series.update");
    expect(eng).toContain("hfm-draw-handle");
    expect(eng).toContain("onDrawingUpdate");
  });

  it("applies live Bid ticks to verified timeframes (not M1-only)", () => {
    const hook = read("desktop/forex/hfm-dashboard/charts/use-hfm-chart-data.ts");
    expect(hook).toContain("applyBidToFormingCandle");
    expect(hook).toContain("isLiveFormingTimeframe");
    expect(hook).not.toContain('timeframe === "M1" && sq.bid');
    const live = read("desktop/forex/hfm-dashboard/charts/live-forming.ts");
    expect(live).toContain("resolveFormingBucket");
    expect(live).toContain("formatHfmSpread");
  });

  it("persists drawings and templates via Admin charts APIs", () => {
    const api = read("desktop/forex/hfm-dashboard/charts/api.ts");
    expect(api).toContain("/charts/drawings");
    expect(api).toContain("/charts/templates");
    expect(api).toContain("/charts/preferences");
    const ws = read("desktop/forex/hfm-dashboard/charts/HfmChartsWorkspace.tsx");
    expect(ws).toContain("saveHfmChartDrawings");
    expect(ws).toContain("saveHfmChartTemplate");
    expect(ws).toContain("saveHfmChartPreferences");
    expect(ws).toContain("formatHfmSpread");
    expect(ws).toContain("Selected drawing");
  });

  it("preserves read-only safety markers in workspace", () => {
    const ws = read("desktop/forex/hfm-dashboard/charts/HfmChartsWorkspace.tsx");
    expect(ws).toContain('data-readonly="true"');
    expect(ws).toContain("placesOrders=false");
    expect(ws).toContain("buildHfmChartsAnalysisSnapshot");
  });
});
