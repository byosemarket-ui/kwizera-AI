/**
 * Phase 5C Step 1C — pattern/Fibonacci correlation & confluence.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifUnifiedChartAnalysis,
  calculateConfluence,
  correlatePatternFibonacci,
  MIF_FIBONACCI_CONTRACT_ID,
  MIF_FIBONACCI_CONTRACT_VERSION,
  MIF_CHART_PATTERNS_CONTRACT_ID,
  MIF_CHART_PATTERNS_CONTRACT_VERSION,
  MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
  type MifChartPatternAssessment,
  type MifFibonacciAssessment,
  type MifUnifiedChartAnalysisPolicy,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function basePattern(over: Partial<MifChartPatternAssessment> = {}): MifChartPatternAssessment {
  return {
    contractId: MIF_CHART_PATTERNS_CONTRACT_ID,
    contractVersion: MIF_CHART_PATTERNS_CONTRACT_VERSION,
    scope: "step1b-chart-patterns",
    assessmentId: "pat-1",
    inputIdentity: "pattern-identity-aaa",
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
          timeSecStart: 1_700_000_000,
          priceAtEnd: 100,
          timeSecEnd: 1_700_010_000,
          slopePerSec: 0,
          label: "neckline",
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
          composite: 0.8,
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
        invalidationCriteria: "x",
        failureCriteria: "y",
        detectionIdentity: "det-double-top",
      },
    ],
    qualityRef: {
      sourceKind: "step1-data-integrity",
      status: "VALID",
      inputIdentity: "quality-shared",
      assessmentId: "q1",
    },
    findings: [],
    warningCodes: [],
    blockingCodes: [],
    diagnostics: {
      overallStatusReason: "ok",
      confirmedSwingCount: 4,
      provisionalSwingCount: 0,
      candidateCount: 1,
      atrMethodId: "SMA_OF_TR",
      atrValue: 2,
      atrPeriod: 14,
    },
    diagnosticsSummary: "ok",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalPatternInformationOnly: true,
    ...over,
  };
}

function baseFib(over: Partial<MifFibonacciAssessment> = {}): MifFibonacciAssessment {
  return {
    contractId: MIF_FIBONACCI_CONTRACT_ID,
    contractVersion: MIF_FIBONACCI_CONTRACT_VERSION,
    scope: "step1a-fibonacci",
    assessmentId: "fib-1",
    inputIdentity: "fib-identity-bbb",
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
      timeSec: 1_700_000_000,
      index: 2,
      status: "CONFIRMED",
    },
    anchorB: {
      swingId: "b",
      kind: "HIGH",
      price: 110,
      timeSec: 1_700_010_000,
      index: 8,
      status: "CONFIRMED",
    },
    retracements: [
      { ratio: 0.5, price: 100, kind: "retracement", precisionOk: false, tickAligned: false },
      { ratio: 0.618, price: 97.64, kind: "retracement", precisionOk: false, tickAligned: false },
    ],
    extensions: [
      { ratio: 1.618, price: 122.36, kind: "extension", precisionOk: false, tickAligned: false },
    ],
    qualityRef: {
      sourceKind: "step1-data-integrity",
      status: "VALID",
      inputIdentity: "quality-shared",
      assessmentId: "q1",
    },
    findings: [],
    warningCodes: [],
    blockingCodes: [],
    diagnostics: {
      overallStatusReason: "ok",
      selectedPairIndex: 8,
      confirmedSwingCount: 4,
      provisionalSwingCount: 0,
      candidateImpulseCount: 1,
      digitsUsed: 2,
      tickSizeUsed: 0.01,
      levelPrecisionMismatchCount: 3,
      levelTickMismatchCount: 3,
    },
    diagnosticsSummary: "ok",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    mathematicalReferenceOnly: true,
    ...over,
  };
}

describe("Phase 5C Step1C — correlation", () => {
  it("aligns neckline with matching Fibonacci retracement without rounding", () => {
    const pattern = basePattern();
    const fibonacci = baseFib();
    const { relationships } = correlatePatternFibonacci({
      pattern,
      fibonacci,
      policy: MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
    });
    const hit = relationships.find(
      (r) =>
        r.patternReference.available
        && r.fibonacciRatio === 0.5
        && r.withinTolerance,
    );
    expect(hit).toBeTruthy();
    expect(hit!.patternReference.price).toBe(100);
    expect(hit!.fibonacciPrice).toBe(100);
    expect(hit!.absoluteDistance).toBe(0);
    // raw fib price preserved (not rounded)
    const far = relationships.find((r) => r.fibonacciRatio === 0.618 && r.patternReference.available);
    expect(far!.fibonacciPrice).toBe(97.64);
    expect(far!.precisionOk).toBe(false);
    expect(far!.tickAligned).toBe(false);
  });

  it("reports unavailable for sloped boundary without reference timestamp", () => {
    const pattern = basePattern({
      detections: [
        {
          ...basePattern().detections[0]!,
          neckline: null,
          upperBoundary: {
            kind: "sloped",
            priceAtStart: 110,
            timeSecStart: 1_700_000_000,
            priceAtEnd: 108,
            timeSecEnd: 1_700_010_000,
            slopePerSec: -0.0002,
            label: "upper",
          },
          patternType: "ASCENDING_TRIANGLE",
          detectionIdentity: "det-tri",
        },
      ],
    });
    const fibonacci = baseFib({
      anchorA: null,
      anchorB: null,
    });
    const { relationships, referenceTimeSec } = correlatePatternFibonacci({
      pattern,
      fibonacci,
      policy: MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
    });
    expect(referenceTimeSec).toBeNull();
    expect(relationships.some((r) => !r.patternReference.available)).toBe(true);
  });

  it("projects sloped triangle boundary at Fibonacci anchorB time", () => {
    const t0 = 1_700_000_000;
    const t1 = 1_700_010_000;
    const slope = (108 - 110) / (t1 - t0);
    const pattern = basePattern({
      detections: [
        {
          ...basePattern().detections[0]!,
          neckline: null,
          upperBoundary: {
            kind: "sloped",
            priceAtStart: 110,
            timeSecStart: t0,
            priceAtEnd: 108,
            timeSecEnd: t1,
            slopePerSec: slope,
            label: "upper",
          },
          lowerBoundary: {
            kind: "horizontal",
            priceAtStart: 100,
            timeSecStart: t0,
            priceAtEnd: 100,
            timeSecEnd: t1,
            slopePerSec: 0,
            label: "lower",
          },
          patternType: "SYMMETRICAL_TRIANGLE",
          detectionIdentity: "det-sym",
        },
      ],
    });
    const refTime = t1;
    const projected = 110 + slope * (refTime - t0);
    const fibonacci = baseFib({
      retracements: [
        { ratio: 0.5, price: projected, kind: "retracement", precisionOk: null, tickAligned: null },
      ],
      extensions: [],
      anchorB: {
        swingId: "b",
        kind: "HIGH",
        price: 110,
        timeSec: refTime,
        index: 8,
        status: "CONFIRMED",
      },
    });
    const { relationships } = correlatePatternFibonacci({
      pattern,
      fibonacci,
      policy: MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
    });
    const upperHit = relationships.find(
      (r) =>
        r.patternReference.referenceKind === "UPPER_BOUNDARY"
        && r.patternReference.available
        && r.withinTolerance,
    );
    expect(upperHit).toBeTruthy();
    expect(upperHit!.patternReference.price).toBeCloseTo(projected, 10);
  });

  it("grades confluence from policy thresholds without inventing trade probability", () => {
    const pattern = basePattern();
    const fibonacci = baseFib();
    const { relationships } = correlatePatternFibonacci({
      pattern,
      fibonacci,
      policy: MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
    });
    const confluence = calculateConfluence({
      relationships,
      policy: MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
      qualityStatus: "VALID",
    });
    expect(confluence.analyticalReferenceOnly).toBe(true);
    expect(confluence.explanation).toContain("not a trade probability");
    expect(["NONE", "WEAK", "MODERATE", "STRONG", "UNSCORED"]).toContain(confluence.grade);
    expect(confluence.components.comparisonCount).toBeGreaterThan(0);
  });

  it("does not fabricate confluence when no detections exist", () => {
    const pattern = basePattern({ detections: [] });
    const fibonacci = baseFib();
    const unified = assessMifUnifiedChartAnalysis({
      pattern,
      fibonacci,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(unified.relationships).toHaveLength(0);
    expect(unified.confluence.components.withinToleranceCount).toBe(0);
  });

  it("rejects invalid policy confluence settings", () => {
    const bad: MifUnifiedChartAnalysisPolicy = {
      ...MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
      moderateMinHits: 5,
      strongMinHits: 2,
    };
    const pattern = basePattern();
    const fibonacci = baseFib();
    const unified = assessMifUnifiedChartAnalysis({
      pattern,
      fibonacci,
      policy: bad,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(unified.status).toBe("BLOCKED");
  });
});
