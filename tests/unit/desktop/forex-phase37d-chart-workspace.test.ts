/**
 * Phase 37D — professional chart workspace contracts.
 * Production candle delivery is verified online against live providers.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { hasGenuineVolume, pricePrecision } from "../../../desktop/forex/chart/price-format.ts";
import type { Candle } from "../../../desktop/forex/chart/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 37D professional chart workspace", () => {
  it("keeps compact chrome with chart-first stage and loading affordance", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain('data-phase="37d"');
    expect(workspace).toContain('data-fx-trading-header="true"');
    expect(workspace).toContain("fx-trading-chrome");
    expect(workspace).toContain("fx-trading-toolbar");
    expect(workspace).toContain('data-fx-chart-loading');
    expect(workspace).toContain("pricePrecision(");
    expect(workspace).toContain("hasGenuineVolume");
    expect(workspace).toContain("Open Markets");
    expect(workspace).toContain("Open Technical Analysis");
    expect(workspace).not.toContain("fabricat");
  });

  it("formats instrument precision without inventing prices", () => {
    expect(pricePrecision("EUR/USD")).toBe(5);
    expect(pricePrecision("USD/JPY")).toBe(3);
    expect(pricePrecision("XAU/USD")).toBe(2);
    expect(pricePrecision("AAPL.us")).toBe(2);
    expect(pricePrecision("US30")).toBe(1);
    expect(pricePrecision("BTCUSDT", 83000)).toBe(2);
  });

  it("hides ForexConnect placeholder volume while keeping Binance volume", () => {
    const seeded: Candle[] = [
      { time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1, closed: true },
      { time: 2, open: 1, high: 1, low: 1, close: 1, volume: 1, closed: true },
    ];
    expect(hasGenuineVolume("FOREXCONNECT", seeded, 1)).toBe(false);
    expect(hasGenuineVolume("BINANCE", seeded, 12.5)).toBe(true);
  });

  it("applies price scale precision and resize height in the chart renderer", () => {
    const chart = read("desktop/forex/chart/ForexPriceChart.tsx");
    expect(chart).toContain("pricePrecision");
    expect(chart).toContain("priceFormat");
    expect(chart).toContain("host.clientHeight");
    expect(chart).toContain("height: nextHeight");
    expect(chart).toContain("fitContent");
  });

  it("styles denser chrome and larger chart stage for Charts/TA routes", () => {
    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-trading-chrome");
    expect(css).toContain(".fx-chart-loading");
    expect(css).toContain("min-height: calc(100vh - 128px)");
    expect(css).toContain("min-height: clamp(320px, 58vh, 760px)");
  });

  it("preserves Phase 37A–C contracts for toolbar, explorer, and search", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain("Authenticated · waiting for fresh quotes");
    expect(workspace).toContain("MARKET_INACTIVE");
    expect(workspace).toContain("LIVE · ForexConnect Offers");
    const explorer = read("desktop/forex/ForexConnectMarketExplorer.tsx");
    expect(explorer).toContain('data-phase="37c"');
    expect(explorer).toContain("data-fc-open-charts");
  });
});
