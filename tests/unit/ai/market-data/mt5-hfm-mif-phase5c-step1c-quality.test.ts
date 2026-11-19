/**
 * Phase 5C Step 1C — unified quality aggregation.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifUnifiedChartAnalysis,
  MIF_CHART_PATTERNS_CONTRACT_ID,
  MIF_CHART_PATTERNS_CONTRACT_VERSION,
  MIF_FIBONACCI_CONTRACT_ID,
  MIF_FIBONACCI_CONTRACT_VERSION,
  MIF_UCA_QUALITY_BLOCKED,
  type MifChartPatternAssessment,
  type MifFibonacciAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function pattern(status: MifChartPatternAssessment["status"], qStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED"): MifChartPatternAssessment {
  return {
    contractId: MIF_CHART_PATTERNS_CONTRACT_ID,
    contractVersion: MIF_CHART_PATTERNS_CONTRACT_VERSION,
    scope: "step1b-chart-patterns",
    assessmentId: "pat",
    inputIdentity: "p-id",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    instrument: null,
    policyId: "mif-hfm-chart-patterns",
    policyVersion: "1.0.0",
    engineId: "mif-chart-patterns",
    engineVersion: "1.0.0",
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    status,
    detections: [
      {
        patternType: "DOUBLE_TOP",
        lifecycle: "FORMING",
        pivots: [],
        neckline: {
          kind: "horizontal",
          priceAtStart: 100,
          timeSecStart: 1,
          priceAtEnd: 100,
          timeSecEnd: 2,
          slopePerSec: 0,
          label: "n",
        },
        upperBoundary: null,
        lowerBoundary: null,
        measurements: {},
        confidenceComponents: {
          geometryFit: 1,
          depthOrProminence: 1,
          symmetryOrTouches: 1,
          qualityGate: 1,
          breakoutClarity: 0,
          composite: 1,
        },
        confirmation: {
          met: false,
          direction: "BEARISH",
          candleOpenTimeSec: null,
          candleClose: null,
          candleState: null,
          boundaryPriceAtBreak: null,
          bufferUsed: null,
        },
        retest: { observed: false, candleOpenTimeSec: null, advisoryOnly: true },
        invalidationCriteria: "i",
        failureCriteria: "f",
        detectionIdentity: "d1",
      },
    ],
    qualityRef: {
      sourceKind: "step1-data-integrity",
      status: qStatus,
      inputIdentity: "q-shared",
      assessmentId: "q",
    },
    findings: [],
    warningCodes: [],
    blockingCodes: [],
    diagnostics: {
      overallStatusReason: "ok",
      confirmedSwingCount: 3,
      provisionalSwingCount: 0,
      candidateCount: 1,
      atrMethodId: "SMA_OF_TR",
      atrValue: 1,
      atrPeriod: 14,
    },
    diagnosticsSummary: "ok",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalPatternInformationOnly: true,
  };
}

function fib(status: MifFibonacciAssessment["status"], qStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED"): MifFibonacciAssessment {
  return {
    contractId: MIF_FIBONACCI_CONTRACT_ID,
    contractVersion: MIF_FIBONACCI_CONTRACT_VERSION,
    scope: "step1a-fibonacci",
    assessmentId: "fib",
    inputIdentity: "f-id",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    instrument: null,
    policyId: "mif-hfm-fibonacci",
    policyVersion: "1.0.0",
    engineId: "mif-fibonacci",
    engineVersion: "1.0.0",
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    status,
    orientation: "BULLISH",
    anchorA: {
      swingId: "a",
      kind: "LOW",
      price: 90,
      timeSec: 1,
      index: 1,
      status: "CONFIRMED",
    },
    anchorB: {
      swingId: "b",
      kind: "HIGH",
      price: 110,
      timeSec: 2,
      index: 2,
      status: "CONFIRMED",
    },
    retracements: [{ ratio: 0.5, price: 100, kind: "retracement", precisionOk: null, tickAligned: null }],
    extensions: [],
    qualityRef: {
      sourceKind: "step1-data-integrity",
      status: qStatus,
      inputIdentity: "q-shared",
      assessmentId: "q",
    },
    findings: [],
    warningCodes: [],
    blockingCodes: [],
    diagnostics: {
      overallStatusReason: "ok",
      selectedPairIndex: 2,
      confirmedSwingCount: 2,
      provisionalSwingCount: 0,
      candidateImpulseCount: 1,
      digitsUsed: null,
      tickSizeUsed: null,
      levelPrecisionMismatchCount: 0,
      levelTickMismatchCount: 0,
    },
    diagnosticsSummary: "ok",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    mathematicalReferenceOnly: true,
  };
}

describe("Phase 5C Step1C — unified quality", () => {
  it("VALID sources can yield VALID unified status", () => {
    const u = assessMifUnifiedChartAnalysis({
      pattern: pattern("VALID", "VALID"),
      fibonacci: fib("VALID", "VALID"),
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(u.status).toBe("VALID");
    expect(u.preservedPatternLifecycles[0]?.lifecycle).toBe("FORMING");
  });

  it("WARNING is not upgraded to VALID", () => {
    const u = assessMifUnifiedChartAnalysis({
      pattern: pattern("WARNING", "WARNING"),
      fibonacci: fib("VALID", "WARNING"),
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(u.status).toBe("WARNING");
    expect(u.status).not.toBe("VALID");
  });

  it("DEGRADED is not upgraded to VALID", () => {
    const u = assessMifUnifiedChartAnalysis({
      pattern: pattern("DEGRADED", "DEGRADED"),
      fibonacci: fib("VALID", "VALID"),
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(u.status).toBe("DEGRADED");
  });

  it("BLOCKED quality blocks unified assessment", () => {
    const u = assessMifUnifiedChartAnalysis({
      pattern: pattern("VALID", "BLOCKED"),
      fibonacci: fib("VALID", "VALID"),
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(u.status).toBe("BLOCKED");
    expect(u.blockingCodes).toContain(MIF_UCA_QUALITY_BLOCKED);
  });

  it("CONFIRMED pattern with incompatible fibonacci does not fabricate confluence", () => {
    const p = pattern("VALID", "VALID");
    p.detections[0]!.lifecycle = "CONFIRMED";
    const f = fib("VALID", "VALID");
    f.providerSymbol = "EURUSD";
    const u = assessMifUnifiedChartAnalysis({
      pattern: p,
      fibonacci: f,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(u.diagnostics.compatible).toBe(false);
    expect(u.confluence.grade).toBe("INCOMPATIBLE");
    expect(u.preservedPatternLifecycles[0]?.lifecycle).toBe("CONFIRMED");
    expect(u.relationships).toHaveLength(0);
  });
});
