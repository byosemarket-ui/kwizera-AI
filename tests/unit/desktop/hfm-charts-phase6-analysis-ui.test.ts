/**
 * Phase 6 — Charts UI parsers, overlays, session guards, safety markers.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER,
  parseHfmAnalysisRecord,
} from "../../../desktop/forex/hfm-dashboard/charts/analysis/parse-hfm-analysis-result";
import {
  buildAnalyticalOverlays,
  HFM_ANALYTICAL_OVERLAY_MAX,
} from "../../../desktop/forex/hfm-dashboard/charts/analysis/analytical-overlays";
import { OPENAI_AI_MAX_CONCURRENT } from "../../../ai/forex-ai/snapshot-openai/concurrency";
import { getMifOdWorkerStatus } from "../../../ai/market-data/mt5-hfm/mif/index";

function mockAnalysis(overrides?: Record<string, unknown>) {
  return {
    analysisId: "a1",
    snapshotId: "snap-1",
    contextId: "snap-1",
    symbol: "XAUUSD",
    status: "COMPLETED",
    schemaVersion: "hfm-ai-analysis-v1.2",
    lineage: {
      groundingStatus: "PASSED",
      selectedScenarioId: "sc-bullish",
      inputCompleteness: "COMPLETE",
      evidencePackageId: "ep1",
      scenarioPackageId: "sp1",
    },
    result: {
      schemaVersion: "hfm-ai-analysis-v1.2",
      analysisStatus: "COMPLETED",
      decisionStatus: "WAITING_FOR_CONFIRMATION",
      selectedScenarioId: "sc-bullish",
      marketRegime: "RANGING",
      decision: {
        action: "WAITING_FOR_CONFIRMATION",
        confidence: 55,
        confidenceLabel: "MODERATE",
        summary: "Waiting for M5 close",
      },
      bullishAssessment: {
        side: "BULLISH",
        status: "POSSIBLE",
        summary: "Bull developing",
        supportingEvidenceIds: ["ev-1"],
        conflictingEvidenceIds: [],
        missingConfirmations: ["M5"],
        invalidationConditions: [],
      },
      bearishAssessment: {
        side: "BEARISH",
        status: "NOT_SUPPORTED",
        summary: "Bear weak",
        supportingEvidenceIds: [],
        conflictingEvidenceIds: ["ev-1"],
        missingConfirmations: [],
        invalidationConditions: [],
      },
      supportingEvidenceIds: ["ev-1"],
      conflictingEvidenceIds: [],
      missingConfirmations: ["M5"],
      invalidationConditions: ["break 1990"],
      deterministicDisagreement: {
        agreesWithRanking: false,
        agreesWithScenarioOutcome: true,
        disagreementReason: "Ranking overweight vs HTF conflict",
        alternativeEvidenceIds: ["ev-1"],
      },
      confidenceSemantics: {
        decisionConfidenceIsWinProbability: false,
        definition: HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER,
      },
      tradePlan: {
        direction: "NONE",
        setupStatus: "WAITING",
        entryZone: { low: null, high: null },
        stopLoss: null,
        takeProfitTargets: [],
        invalidationPrice: null,
        riskRewardEstimate: null,
        explanation: "wait",
      },
      evidence: { dataQualityWarnings: ["PARTIAL"] },
      completeness: { status: "COMPLETE" },
      model: "gpt-test",
    },
    ...overrides,
  };
}

describe("Phase 6 — parse v1.2 analysis", () => {
  it("parses decision, disagreement, and confidence disclaimer", () => {
    const view = parseHfmAnalysisRecord(mockAnalysis());
    expect(view?.action).toBe("WAITING_FOR_CONFIRMATION");
    expect(view?.decisionStatus).toBe("WAITING_FOR_CONFIRMATION");
    expect(view?.disagreement.agreesWithRanking).toBe(false);
    expect(view?.disagreement.disagreementReason).toMatch(/Ranking/);
    expect(view?.confidenceDisclaimer).toMatch(/not win probability/i);
    expect(view?.bullishAssessment?.supportingEvidenceIds).toContain("ev-1");
    expect(view?.selectedScenarioId).toBe("sc-bullish");
  });

  it("separates preferred BUY_BIAS from WAITING_FOR_CONFIRMATION", () => {
    const view = parseHfmAnalysisRecord(mockAnalysis());
    expect(view?.action).toBe("WAITING_FOR_CONFIRMATION");
    expect(view?.preferredBias).toBe("BUY_BIAS");
    expect(view?.blockingReasons).toEqual(["M5"]);
  });

  it("derives SELL_BIAS from ranking reference while waiting", () => {
    const raw = mockAnalysis({
      lineage: {
        groundingStatus: "PASSED",
        selectedScenarioId: null,
        inputCompleteness: "COMPLETE",
        evidencePackageId: "ep1",
        scenarioPackageId: "sp1",
        rankingReference: "BEARISH_PREFERRED",
      },
    });
    const result = raw.result as {
      bullishAssessment: { status: string; supportingEvidenceIds: string[] };
      bearishAssessment: {
        status: string;
        supportingEvidenceIds: string[];
        missingConfirmations: string[];
      };
      missingConfirmations: string[];
      selectedScenarioId: string | null;
    };
    result.bullishAssessment = {
      ...result.bullishAssessment,
      status: "INSUFFICIENT",
      supportingEvidenceIds: [],
    };
    result.bearishAssessment = {
      ...result.bearishAssessment,
      status: "WAITING_FOR_CONFIRMATION",
      supportingEvidenceIds: ["tc.regime"],
      missingConfirmations: ["tc.closed_continuation"],
    };
    result.missingConfirmations = [
      "tc.closed_continuation",
      "Closed-candle confirmation; all supplied timeframe tips are FORMING.",
    ];
    result.selectedScenarioId = null;
    const view = parseHfmAnalysisRecord(raw);
    expect(view?.action).toBe("WAITING_FOR_CONFIRMATION");
    expect(view?.preferredBias).toBe("SELL_BIAS");
    expect(view?.rankingReference).toBe("BEARISH_PREFERRED");
    expect(view?.blockingReasons[0]).toBe("tc.closed_continuation");
  });

  it("treats NO_TRADE as valid analytical outcome", () => {
    const raw = mockAnalysis();
    (raw.result as { decision: { action: string } }).decision.action = "NO_TRADE";
    (raw.result as { decisionStatus: string }).decisionStatus = "NO_TRADE";
    const view = parseHfmAnalysisRecord(raw);
    expect(view?.action).toBe("NO_TRADE");
    expect(view?.preferredBias).toBe("NO_TRADE");
  });
});

describe("Phase 6 — analytical overlays", () => {
  it("defaults to empty when toggle OFF", () => {
    const built = buildAnalyticalOverlays({
      enabled: false,
      snapshotId: "snap-1",
      levels: [{ label: "Entry", price: 2000, low: 2000, high: 2000, provenance: "t", sourceBacked: true }],
    });
    expect(built.overlays).toEqual([]);
  });

  it("accepts source-backed levels and rejects unverified", () => {
    const built = buildAnalyticalOverlays({
      enabled: true,
      snapshotId: "snap-1",
      levels: [
        { label: "Entry", price: 2000, low: 2000, high: 2000, provenance: "t", sourceBacked: true },
        { label: "Fake", price: 1234, low: 1234, high: 1234, provenance: null, sourceBacked: false },
      ],
    });
    expect(built.overlays.some((o) => o.price === 2000)).toBe(true);
    expect(built.rejected.some((r) => r.includes("not_source_backed"))).toBe(true);
  });

  it("rejects snapshot mismatch and invalid prices", () => {
    const mismatch = buildAnalyticalOverlays({
      enabled: true,
      snapshotId: "snap-1",
      expectedSnapshotId: "other",
      levels: [{ label: "Entry", price: 2000, low: 2000, high: 2000, provenance: "t", sourceBacked: true }],
    });
    expect(mismatch.overlays).toEqual([]);
    expect(mismatch.rejected).toContain("snapshot_mismatch");

    const bad = buildAnalyticalOverlays({
      enabled: true,
      snapshotId: "snap-1",
      levels: [],
      evidenceLevels: [{ id: "e1", kind: "SUPPORT", price: Number.NaN }],
    });
    expect(bad.rejected.some((r) => r.startsWith("invalid_evidence_price"))).toBe(true);
  });

  it("caps overlay count", () => {
    const levels = Array.from({ length: 40 }, (_, i) => ({
      label: `Entry ${i}`,
      price: 2000 + i,
      low: 2000 + i,
      high: 2000 + i,
      provenance: "t",
      sourceBacked: true as const,
    }));
    const built = buildAnalyticalOverlays({
      enabled: true,
      snapshotId: "snap-1",
      levels,
    });
    expect(built.overlays.length).toBeLessThanOrEqual(HFM_ANALYTICAL_OVERLAY_MAX);
  });
});

describe("Phase 6 — UI safety markers", () => {
  it("panel contains confidence disclaimer, history load-symbol, overlay toggle, phase6 marker", async () => {
    const panel = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/HfmAnalysisPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("data-phase6-ui");
    expect(panel).toContain("HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER");
    expect(panel).toContain("placesOrders=false");
    expect(panel).not.toMatch(/Place Order|Execute Trade|Submit Order/i);
    expect(panel).toContain("15_000");
    expect(panel).toContain("fromAuto");

    const levels = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/analysis/HfmAnalyticalLevels.tsx"),
      "utf8",
    );
    expect(levels).toContain("Show analytical levels");

    const history = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/analysis/HfmAnalysisHistory.tsx"),
      "utf8",
    );
    expect(history).toContain("data-load-symbol-on-chart");
    expect(history).toContain("View-only by default");

    const engine = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/HfmChartEngine.tsx"),
      "utf8",
    );
    expect(engine).toContain("analyticalOverlays");
    expect(engine).toContain("analyticalLinesRef");
  });

  it("css includes responsive scenario/evidence rules", async () => {
    const css = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/hfm-analysis-panel.css"),
      "utf8",
    );
    expect(css).toContain("hap-scenario-grid");
    expect(css).toContain("hap-grid-phase6");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 1200px)");
  });

  it("keeps OD disabled and OpenAI concurrency 1", () => {
    expect(getMifOdWorkerStatus().enabled).toBe(false);
    expect(OPENAI_AI_MAX_CONCURRENT).toBe(1);
  });
});
