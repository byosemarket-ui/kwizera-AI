/**
 * Phase 37A — compact Charts trading layout (unit / source contracts).
 * Online verification confirms viewport density on production.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 37A trading layout compactness", () => {
  it("uses a compact trading header instead of oversized section banner", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain('data-fx-trading-header="true"');
    expect(workspace).toContain("fx-trading-toolbar");
    expect(workspace).toContain("fx-chart-stage-wrap");
    expect(workspace).toContain("Open Markets");
    expect(workspace).toContain("Open Technical Analysis");
    expect(workspace).not.toContain("ForexSectionHeader");
    expect(workspace).not.toContain("Interactive candlestick workspace fed by the unified Market Data layer");
  });

  it("keeps truthful stream status labels without inventing LIVE", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain("SUBSCRIBED_WAITING");
    expect(workspace).toContain("MARKET_INACTIVE");
    expect(workspace).toContain("LIVE · ForexConnect Offers");
    expect(workspace).not.toContain("fabricat");
  });

  it("styles chart-first density and mobile wrap behavior", () => {
    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-trading-header");
    expect(css).toContain(".fx-chart-stage-wrap");
    expect(css).toContain('data-forex-route="charts"');
    expect(css).toContain("min-height: clamp(280px, 52vh, 640px)");
    expect(css).toContain("overflow-x: auto");
  });

  it("resizes the price chart height with its container", () => {
    const chart = read("desktop/forex/chart/ForexPriceChart.tsx");
    expect(chart).toContain("host.clientHeight");
    expect(chart).toContain("height: nextHeight");
  });
});
