/**
 * Phase 37F — responsive polish contracts for Charts / Markets.
 * Layout behavior is verified online at 1440 / 768 / 390.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 37F responsive polish", () => {
  it("tightens mobile chart stage and hides verbose stream diagnostics at ≤560px", () => {
    const css = read("desktop/forex/forex.css");
    expect(css).toContain("min-height: calc(100dvh - 96px)");
    expect(css).toContain("min-height: clamp(240px, 46vh, 420px)");
    expect(css).toMatch(/\.fx-stream-diagnostics\s*\{\s*display:\s*none;/);
    expect(css).toContain("padding-inline-end: 12px");
    expect(css).toContain("flex-shrink: 0");
  });

  it("aligns market-category collapse with the 820px shell drawer breakpoint", () => {
    const css = read("desktop/forex/forex.css");
    expect(css).toContain("Align explorer collapse with shell drawer breakpoint");
    expect(css).toContain("max-height: min(42vh, 320px)");
    expect(css).toContain("max-height: min(36vh, 260px)");
    // Former 900px explorer collapse must not remain as the sole mobile path.
    expect(css).not.toMatch(/@media \(max-width: 900px\)[\s\S]{0,200}\.fx-market-explorer-cat-toggle/);
  });

  it("keeps Charts/TA phase marker and unified series identity for regression", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain('data-phase="37f"');
    expect(workspace).toContain("data-ta-series-key");
    expect(workspace).toContain("data-fx-stream-diagnostics");
    expect(workspace).toContain("MARKET_INACTIVE · no Offers bid/ask changes");
    const explorer = read("desktop/forex/ForexConnectMarketExplorer.tsx");
    expect(explorer).toContain('data-phase="37c"');
    expect(explorer).toContain("data-fc-open-charts");
  });
});
