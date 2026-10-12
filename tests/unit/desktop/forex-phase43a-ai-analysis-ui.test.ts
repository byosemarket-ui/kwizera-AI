/**
 * Phase 43A — Forex AI Analysis compact workstation UI contracts.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 43A Forex AI Analysis UI", () => {
  it("keeps route contracts, analyze actions, and compact workstation markup", () => {
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const css = read("desktop/forex/forex.css");
    const routes = read("desktop/forex/forex-routes.ts");

    expect(routes).toContain('path: "/forex/ai-analysis"');
    expect(page).toContain('data-forex-page="ai-analysis"');
    expect(page).toContain("AI Market Analysis");
    expect(page).toContain("data-ai-config");
    expect(page).toContain("data-ai-analyze-btn");
    expect(page).toContain("data-ai-candle-timeframe");
    expect(page).toContain("data-ai-analysis-period");
    expect(page).toContain("/api/forex/ai/analyze");
    expect(page).toContain("/api/forex/ai/multi-timeframe");
    expect(page).toContain("/api/forex/ai/decision");
    expect(page).toContain("Analyze Decision");
    expect(page).toContain("Analyze Multi-Timeframe");
    expect(page).toContain("fx-ai-panel");
    expect(page).not.toContain("ForexSectionHeader");
    expect(page).not.toContain("11434");
    expect(page).not.toContain("fake progress percentage");

    expect(css).toContain(".fx-ai-analysis");
    expect(css).toContain(".fx-ai-config");
    expect(css).toContain(".fx-ai-panel");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (min-width: 1100px)");
  });
});
