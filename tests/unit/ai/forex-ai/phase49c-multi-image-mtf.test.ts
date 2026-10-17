/**
 * Phase 49C — Multi-timeframe roster, conflict policy, prompt/UI contracts.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MULTI_IMAGE_ANALYSIS_SCHEMA,
  buildMtfRoster,
  compareTimeframesAsc,
  parseMtfReasoningFromModel,
  shouldForceWaitForMtf,
  timeframeRank,
} from "../../../../ai/forex-ai/multi-image-openai/index.ts";
import type { MultiImageCaptureRef } from "../../../../ai/forex-ai/multi-image-openai/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function ref(partial: Partial<MultiImageCaptureRef> & { captureId: string; timeframe: string }): MultiImageCaptureRef {
  return {
    capturedAtUtc: partial.capturedAtUtc ?? "2026-10-17T11:00:00.000Z",
    capturedAtLocal: "local",
    mode: "MANUAL",
    instrument: { symbol: "XAU/USD", displaySymbol: "XAU/USD", provider: "FOREXCONNECT" },
    quote: {
      bid: 4168.3,
      ask: null,
      mid: null,
      lastPrice: 4168.3,
      feedHealth: "MARKET_INACTIVE",
      lastGenuinePriceChangeAt: null,
      lastGenuinePriceChangeAgeMs: null,
    },
    candleWindow: {
      closedCount: 100,
      formingCount: 0,
      totalCount: 100,
      firstOpenTimeSec: 1,
      lastOpenTimeSec: 100,
    },
    marketSnapshot: { snapshotId: null, contentFingerprint: null },
    image: { mimeType: "image/png", width: 100, height: 50, byteLength: 1000 },
    hasImage: true,
    ...partial,
  };
}

describe("Phase 49C MTF roster", () => {
  it("ranks timeframes and assigns higher/intermediate/lower roles", () => {
    expect(timeframeRank("5m")).toBeLessThan(timeframeRank("15m"));
    expect(compareTimeframesAsc("30m", "5m")).toBeGreaterThan(0);

    const roster = buildMtfRoster([
      ref({ captureId: "a", timeframe: "5m", capturedAtUtc: "2026-10-17T11:00:00.000Z" }),
      ref({ captureId: "b", timeframe: "15m", capturedAtUtc: "2026-10-17T11:01:00.000Z" }),
      ref({ captureId: "c", timeframe: "30m", capturedAtUtc: "2026-10-17T11:10:00.000Z" }),
    ]);

    expect(roster.distinctTimeframes).toEqual(["5m", "15m", "30m"]);
    expect(roster.roles.find((r) => r.timeframe === "30m")?.role).toBe("higher");
    expect(roster.roles.find((r) => r.timeframe === "15m")?.role).toBe("intermediate");
    expect(roster.roles.find((r) => r.timeframe === "5m")?.role).toBe("lower");
    expect(roster.sameTimeframeDuplicates).toBe(false);
    expect(roster.captureSpanMs).toBe(10 * 60_000);
  });

  it("flags same-timeframe duplicates and single-TF selections", () => {
    const dup = buildMtfRoster([
      ref({ captureId: "a", timeframe: "1h" }),
      ref({ captureId: "b", timeframe: "1h" }),
    ]);
    expect(dup.sameTimeframeDuplicates).toBe(true);
    expect(dup.roles[0]?.role).toBe("only");
    expect(dup.roles[0]?.note).toMatch(/not independent/i);

    const single = buildMtfRoster([ref({ captureId: "a", timeframe: "15m" })]);
    expect(single.distinctTimeframes).toEqual(["15m"]);
    expect(single.note).toMatch(/does not include multiple/i);
  });
});

describe("Phase 49C MTF reasoning parse and WAIT policy", () => {
  it("parses model mtfReasoning and forces WAIT on conflicting BUY/SELL", () => {
    const roster = buildMtfRoster([
      ref({ captureId: "a", timeframe: "5m" }),
      ref({ captureId: "b", timeframe: "1h" }),
    ]);
    const mtf = parseMtfReasoningFromModel({
      mtfReasoning: {
        timeframeAgreement: "CONFLICTING",
        higherTimeframeContext: "VISIBLE_IN_IMAGE: downtrend on 1h",
        lowerTimeframeSetup: "VISIBLE_IN_IMAGE: bounce on 5m",
        conflictSummary: "Lower TF bounce conflicts with higher TF sell pressure",
        bullishScenario: "INFERENCE: hold above support",
        bearishScenario: "INFERENCE: break support",
        keyLevels: [
          { level: "~4160", provenance: "VISIBLE_IN_IMAGE", captureId: "a", timeframe: "5m" },
          { level: "4168.3", provenance: "CONFIRMED_BY_DATA", captureId: "b", timeframe: "1h" },
        ],
        confirmationConditions: ["CONFIRMED_BY_DATA break above resistance"],
        invalidationConditions: ["break below support"],
        missingEvidence: ["ANALYSIS_TIME snapshot unavailable"],
      },
    }, roster);

    expect(mtf.timeframeAgreement).toBe("CONFLICTING");
    expect(mtf.keyLevels).toHaveLength(2);
    expect(mtf.keyLevels[0]?.provenance).toBe("VISIBLE_IN_IMAGE");
    expect(shouldForceWaitForMtf("BUY", mtf)).toBe(true);
    expect(shouldForceWaitForMtf("SELL", mtf)).toBe(true);
    expect(shouldForceWaitForMtf("WAIT", mtf)).toBe(false);

    const aligned = parseMtfReasoningFromModel({
      mtfReasoning: { timeframeAgreement: "ALIGNED" },
    }, roster);
    expect(shouldForceWaitForMtf("BUY", aligned)).toBe(false);

    const insufficient = parseMtfReasoningFromModel({}, roster);
    expect(insufficient.timeframeAgreement).toBe("INSUFFICIENT");
    expect(shouldForceWaitForMtf("SELL", insufficient)).toBe(true);
  });

  it("defaults single-timeframe agreement when model omits mtf fields", () => {
    const roster = buildMtfRoster([ref({ captureId: "a", timeframe: "15m" })]);
    const mtf = parseMtfReasoningFromModel({ decision: "WAIT" }, roster);
    expect(mtf.timeframeAgreement).toBe("SINGLE_TIMEFRAME");
    expect(shouldForceWaitForMtf("BUY", mtf)).toBe(false);
  });
});

describe("Phase 49C wiring contracts", () => {
  it("ships schema v2, MTF prompts, UI section, and preserves confirm gate", () => {
    expect(MULTI_IMAGE_ANALYSIS_SCHEMA).toBe("forex-openai-multi-image-analysis-v2");

    const prompts = read("ai/forex-ai/multi-image-openai/prompts.ts");
    expect(prompts).toContain("MTF_ROSTER");
    expect(prompts).toContain("mtfReasoning");
    expect(prompts).toContain("timeframeAgreement");
    expect(prompts).toContain("SINGLE_TIMEFRAME");

    const engine = read("ai/forex-ai/multi-image-openai/engine.ts");
    expect(engine).toContain("buildMtfRoster");
    expect(engine).toContain("shouldForceWaitForMtf");
    expect(engine).toContain("parseMtfReasoningFromModel");
    expect(engine).toContain("latestQuote");
    expect(engine).toContain("CONFIRMATION_REQUIRED");

    const panel = read("desktop/forex/capture-library/MultiImageAnalysisPanel.tsx");
    expect(panel).toContain("mtfRoster");
    expect(panel).toContain("Multi-timeframe roster");
    expect(panel).toContain("confirmed: true");

    const resultUi = read("desktop/forex/SnapshotAiResultPanels.tsx");
    expect(resultUi).toContain("data-fx-mtf-reasoning");
    expect(resultUi).toContain("Multi-timeframe reasoning");
    expect(resultUi).toContain("data-ai-openai-assistant-items");

    const api = read("dev/server/forex-ai-openai-snapshot-api.ts");
    expect(api).toContain('phase: "49C"');

    // Capture-time snapshot remains optional/null-safe (no fabricated IDs).
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain("marketSnapshotId: null");
  });
});
