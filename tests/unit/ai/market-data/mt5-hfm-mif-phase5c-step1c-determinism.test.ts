/**
 * Phase 5C Step 1C — unified identity determinism.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifUnifiedChartAnalysis,
  MIF_CHART_PATTERNS_CONTRACT_ID,
  MIF_CHART_PATTERNS_CONTRACT_VERSION,
  MIF_FIBONACCI_CONTRACT_ID,
  MIF_FIBONACCI_CONTRACT_VERSION,
  MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
  type MifChartPatternAssessment,
  type MifFibonacciAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function pattern(inputIdentity = "p-id"): MifChartPatternAssessment {
  return {
    contractId: MIF_CHART_PATTERNS_CONTRACT_ID,
    contractVersion: MIF_CHART_PATTERNS_CONTRACT_VERSION,
    scope: "step1b-chart-patterns",
    assessmentId: "pat",
    inputIdentity,
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    instrument: null,
    policyId: "mif-hfm-chart-patterns",
    policyVersion: "1.0.0",
    engineId: "mif-chart-patterns",
    engineVersion: "1.0.0",
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    status: "VALID",
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
      status: "VALID",
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

function fib(inputIdentity = "f-id"): MifFibonacciAssessment {
  return {
    contractId: MIF_FIBONACCI_CONTRACT_ID,
    contractVersion: MIF_FIBONACCI_CONTRACT_VERSION,
    scope: "step1a-fibonacci",
    assessmentId: "fib",
    inputIdentity,
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    instrument: null,
    policyId: "mif-hfm-fibonacci",
    policyVersion: "1.0.0",
    engineId: "mif-fibonacci",
    engineVersion: "1.0.0",
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    status: "VALID",
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
      status: "VALID",
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

describe("Phase 5C Step1C — determinism", () => {
  it("repeats identity when wall-clock changes; no source mutation", () => {
    const p = pattern();
    const f = fib();
    const pSnap = { ...p };
    const fSnap = { ...f };
    const a = assessMifUnifiedChartAnalysis({
      pattern: p,
      fibonacci: f,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifUnifiedChartAnalysis({
      pattern: p,
      fibonacci: f,
      assessmentTimestamp: "2099-12-31T23:59:59.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.relationships.map((r) => r.relationshipId)).toEqual(
      b.relationships.map((r) => r.relationshipId),
    );
    expect(a.assessmentTimestamp).not.toBe(b.assessmentTimestamp);
    expect(p).toEqual(pSnap);
    expect(f).toEqual(fSnap);
    expect(a.doesNotApproveAiReasoning).toBe(true);
    expect(a.placesOrders).toBe(false);
  });

  it("changes identity when pattern, fibonacci, or policy changes", () => {
    const base = assessMifUnifiedChartAnalysis({
      pattern: pattern("p-id"),
      fibonacci: fib("f-id"),
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const patChanged = assessMifUnifiedChartAnalysis({
      pattern: pattern("p-id-changed"),
      fibonacci: fib("f-id"),
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const fibChanged = assessMifUnifiedChartAnalysis({
      pattern: pattern("p-id"),
      fibonacci: fib("f-id-changed"),
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const policyChanged = assessMifUnifiedChartAnalysis({
      pattern: pattern("p-id"),
      fibonacci: fib("f-id"),
      policy: {
        ...MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
        policyVersion: "1.0.1-test",
        confluenceTolRel: 0.01,
      },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(patChanged.inputIdentity).not.toBe(base.inputIdentity);
    expect(fibChanged.inputIdentity).not.toBe(base.inputIdentity);
    expect(policyChanged.inputIdentity).not.toBe(base.inputIdentity);
  });
});
