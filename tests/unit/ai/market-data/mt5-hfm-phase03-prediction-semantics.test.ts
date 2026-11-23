/**
 * Phase 03 — prediction semantics + confidence↔outcome diagnostics (fixtures).
 */
import { describe, it, expect } from "vitest";
import {
  classifyConfidenceOutcomeDiagnosticStatus,
  HFM_CHARTS_PROBABILITY_AVAILABILITY_DEFAULT,
  HFM_SCORE_KIND_LABELS,
  HFM_CHARTS_CONFIDENCE_OUTCOME_PROVISIONAL_MIN,
  HFM_CHARTS_CONFIDENCE_OUTCOME_DIAGNOSTIC_MIN,
} from "../../../../ai/market-data/mt5-hfm/analysis/prediction-semantics";
import { buildChartsCalibrationCensus } from "../../../../ai/market-data/mt5-hfm/analysis/prediction-outcome/calibration-census";
import { clippedLogLoss } from "../../../../ai/market-data/mt5-hfm/mif/wf-calibration/metrics";
import { parseHfmAnalysisRecord } from "../../../../desktop/forex/hfm-dashboard/charts/analysis/parse-hfm-analysis-result";

describe("Phase 03 score semantics", () => {
  it("keeps four distinct score labels", () => {
    expect(HFM_SCORE_KIND_LABELS.ANALYTICAL_CONFIDENCE).toMatch(/confidence/i);
    expect(HFM_SCORE_KIND_LABELS.ESTIMATED_PROBABILITY).toMatch(/probability/i);
    expect(HFM_SCORE_KIND_LABELS.HISTORICAL_WIN_RATE).toMatch(/win rate/i);
    expect(HFM_SCORE_KIND_LABELS.OPPORTUNITY_RANKING).toMatch(/ranking/i);
    expect(HFM_CHARTS_PROBABILITY_AVAILABILITY_DEFAULT).toBe("NOT_AVAILABLE");
  });

  it("classifies diagnostic sample gates without claiming calibrated probability", () => {
    expect(classifyConfidenceOutcomeDiagnosticStatus(0)).toBe("NO_PAIRS");
    expect(
      classifyConfidenceOutcomeDiagnosticStatus(
        HFM_CHARTS_CONFIDENCE_OUTCOME_PROVISIONAL_MIN - 1,
      ),
    ).toBe("INSUFFICIENT_DATA");
    expect(
      classifyConfidenceOutcomeDiagnosticStatus(
        HFM_CHARTS_CONFIDENCE_OUTCOME_PROVISIONAL_MIN,
      ),
    ).toBe("PROVISIONAL_DIAGNOSTIC");
    expect(
      classifyConfidenceOutcomeDiagnosticStatus(
        HFM_CHARTS_CONFIDENCE_OUTCOME_DIAGNOSTIC_MIN,
      ),
    ).toBe("DIAGNOSTIC_READY_NOT_PROBABILITY_CALIBRATION");
  });
});

describe("Phase 03 census diagnostics", () => {
  it("computes Brier/log-loss for eligible pairs and never sets calibrated", () => {
    const report = buildChartsCalibrationCensus([
      {
        evaluatorVersion: "1.0.0",
        signedRPolicyVersion: "1.0.0",
        resultKind: "TARGET_REACHED",
        entryTrigger: { status: "TRIGGERED" },
        provenance: {
          symbol: "XAUUSD",
          timeframe: "H1",
          direction: "BUY",
          analyticalConfidence: 80,
          confidenceSource: "REASONING_STORE",
          confidenceUnavailableReason: null,
        },
      } as any,
      {
        evaluatorVersion: "1.0.0",
        signedRPolicyVersion: "1.0.0",
        resultKind: "INVALIDATION_REACHED",
        entryTrigger: { status: "TRIGGERED" },
        provenance: {
          symbol: "XAUUSD",
          timeframe: "H1",
          direction: "SELL",
          analyticalConfidence: 40,
          confidenceSource: "REASONING_STORE",
          confidenceUnavailableReason: null,
        },
      } as any,
    ]);
    expect(report.calibrated).toBe(false);
    expect(report.isNotCalibratedProbability).toBe(true);
    expect(report.warnings).not.toContain("CALIBRATION_MATH_NOT_IMPLEMENTED");
    expect(report.confidenceOutcomeDiagnostics.pairCount).toBe(2);
    expect(report.confidenceOutcomeDiagnostics.status).toBe("INSUFFICIENT_DATA");
    expect(report.confidenceOutcomeDiagnostics.brierScore).toBeCloseTo(
      ((0.8 - 1) ** 2 + (0.4 - 0) ** 2) / 2,
      8,
    );
    expect(report.confidenceOutcomeDiagnostics.logLoss).toBeCloseTo(
      (clippedLogLoss(0.8, 1) + clippedLogLoss(0.4, 0)) / 2,
      8,
    );
    expect(report.confidenceOutcomeDiagnostics.scoreKind).toBe(
      "ANALYTICAL_CONFIDENCE",
    );
  });
});

describe("Phase 03 Charts parse — probability unavailable + linkage", () => {
  it("exposes NOT_AVAILABLE probability and prediction linkage", () => {
    const view = parseHfmAnalysisRecord({
      analysisId: "a1",
      snapshotId: "s1",
      symbol: "XAUUSD",
      status: "COMPLETED",
      predictionLinkage: {
        status: "CREATED",
        predictionId: "pred-1",
        reason: null,
        bridgedAt: "2026-01-01T00:00:00.000Z",
      },
      lineage: { groundingStatus: "PASSED", inputCompleteness: "COMPLETE" },
      result: {
        decision: { action: "WAITING_FOR_CONFIRMATION", confidence: 37, summary: "wait" },
        confidenceSemantics: { definition: "Analytical confidence — not win probability." },
      },
    });
    expect(view).not.toBeNull();
    expect(view!.estimatedProbabilityStatus).toBe("NOT_AVAILABLE");
    expect(view!.estimatedProbabilityUnavailableReason).toMatch(/skipProbability/i);
    expect(view!.predictionLinkage.status).toBe("CREATED");
    expect(view!.predictionLinkage.predictionId).toBe("pred-1");
    expect(view!.confidence).toBe(37);
  });
});
