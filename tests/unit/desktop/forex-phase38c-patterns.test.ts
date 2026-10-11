import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Forex Phase 38C — desktop candlestick patterns wiring", () => {
  it("wires detectCandlestickPatterns into ForexChartWorkspace analysis UI", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    const css = read("desktop/forex/forex.css");
    const server = read("dev/server/index.ts");
    const api = read("dev/server/forex-patterns-api.ts");

    expect(workspace).toContain("detectCandlestickPatterns");
    expect(workspace).toContain('data-ta-candlestick-patterns="true"');
    expect(workspace).toContain("ai/forex-patterns");
    expect(workspace).toContain("CANDLESTICK_RULE_VERSION");
    expect(workspace).toMatch(/Not a trade signal/i);
    expect(css).toContain(".fx-candlestick-pattern-list");
    expect(api).toContain("/api/forex/patterns/candlestick");
    expect(api).toContain("getHistoricalCandles");
    expect(api).toContain("detectCandlestickPatterns");
    expect(server).toContain("handleForexPatternsApi");
  });
});
