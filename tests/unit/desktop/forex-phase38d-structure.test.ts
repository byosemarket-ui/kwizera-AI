import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Forex Phase 38D — desktop market structure wiring", () => {
  it("wires detectMarketStructure into ForexChartWorkspace analysis UI", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    const css = read("desktop/forex/forex.css");
    const server = read("dev/server/index.ts");
    const api = read("dev/server/forex-structure-api.ts");
    const engine = read("ai/forex-market-state/engine.ts");
    const entryZone = read("ai/forex-ai/decision/entry-zone.ts");
    const types = read("ai/forex-market-state/types.ts");

    expect(workspace).toContain("detectMarketStructure");
    expect(workspace).toContain('data-ta-market-structure="true"');
    expect(workspace).toContain("ai/forex-structure");
    expect(workspace).toContain("STRUCTURE_RULE_VERSION");
    expect(workspace).toMatch(/Not a trade signal/i);
    expect(workspace).toContain("data-ta-structure-summary");
    expect(css).toContain(".fx-structure-event-list");
    expect(css).toContain(".fx-structure-zone-list");
    expect(api).toContain("/api/forex/structure/market");
    expect(api).toContain("getHistoricalCandles");
    expect(api).toContain("detectMarketStructure");
    expect(server).toContain("handleForexStructureApi");
    expect(engine).toContain("detectMarketStructure");
    expect(engine).toContain("STRUCTURE_V1");
    expect(types).toContain("STRUCTURE_V1");
    expect(entryZone).toContain("STRUCTURE_V1");
    expect(entryZone).toContain("BASIC_SWINGS");
  });
});
