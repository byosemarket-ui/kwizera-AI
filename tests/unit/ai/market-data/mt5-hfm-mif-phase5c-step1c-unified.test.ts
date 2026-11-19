/**
 * Phase 5C Step 1C — unified chart-analysis assessment.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifChartPatterns,
  assessMifDataIntegrity,
  assessMifFibonacci,
  assessMifUnifiedChartAnalysis,
  baseCanonicalCandle,
  MIF_CHART_ANALYSIS_CONTRACT_ID,
  MIF_POLICY_HFM_CHART_PATTERNS,
  MIF_POLICY_HFM_FIBONACCI,
  MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
  MIF_UCA_SOURCE_MISSING,
  mifInstrumentFromHfmCatalog,
  validateMifUnifiedChartAnalysisPolicy,
  type MifCanonicalCandle,
  type MifChartPatternPolicy,
  type MifStep1DataIntegrityAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";

const T0 = 1_700_000_000;
const STEP = 3600;

function instrument() {
  return mifInstrumentFromHfmCatalog({
    symbol: "XAUUSD",
    description: "Gold",
    digits: 2,
    point: 0.01,
    tickSize: 0.01,
    catalogVersion: "v1",
    classification: { category: "metal", confidence: "high" },
  } as HfmCatalogInstrument);
}

function candle(index: number, high: number, low: number, close?: number): MifCanonicalCandle {
  const openTimeSec = T0 + index * STEP;
  const mid = (high + low) / 2;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + STEP,
    open: mid,
    high,
    low,
    close: close ?? mid,
    tickVolume: 1,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: null,
    candleState: "CLOSED",
    priceBasis: "bid",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "KNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: "test",
    sourceMode: "HISTORICAL",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: instrument(),
  });
}

function series(): MifCanonicalCandle[] {
  const rows: Array<[number, number]> = [
    [102, 98], [103, 99], [101, 97], [104, 98], [103, 97.5],
    [110.1, 104], [108, 103], [107, 102], [105, 100],
    [106, 101], [107, 102], [110.2, 104], [108, 103], [107, 102],
    [101, 95], [100, 94], [99, 93],
  ];
  return rows.map((r, i) => candle(i, r[0]!, r[1]!, i >= 14 ? 96 - (i - 14) : undefined));
}

function validQuality(candles: MifCanonicalCandle[]): MifStep1DataIntegrityAssessment {
  const integrity = assessMifDataIntegrity({
    candles,
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
  });
  return { ...integrity, status: "VALID" };
}

function patternPolicy(): MifChartPatternPolicy {
  return {
    ...MIF_POLICY_HFM_CHART_PATTERNS,
    atrPeriod: 3,
    peakEqualityTolRel: 0.01,
    peakEqualityTolAtrMult: 2,
    minRetraceOfSpan: 0.03,
  };
}

describe("Phase 5C Step1C — unified chart analysis", () => {
  it("validates built-in unified policy", () => {
    expect(validateMifUnifiedChartAnalysisPolicy(MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS).ok).toBe(true);
  });

  it("unifies compatible pattern + fibonacci assessments with safety flags", () => {
    const candles = series();
    const q = validQuality(candles);
    const pattern = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: patternPolicy(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const fibonacci = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const unified = assessMifUnifiedChartAnalysis({
      pattern,
      fibonacci,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(unified.contractId).toBe(MIF_CHART_ANALYSIS_CONTRACT_ID);
    expect(unified.sourceRefs.pattern?.inputIdentity).toBe(pattern.inputIdentity);
    expect(unified.sourceRefs.fibonacci?.inputIdentity).toBe(fibonacci.inputIdentity);
    expect(unified.doesNotApproveAiReasoning).toBe(true);
    expect(unified.placesOrders).toBe(false);
    expect(unified.mutatesBroker).toBe(false);
    expect(unified.acceptsForExecution).toBe(false);
    expect(unified.analyticalIntegrationOnly).toBe(true);
    expect(unified.confluence.analyticalReferenceOnly).toBe(true);
    expect(unified.preservedPatternLifecycles.map((p) => p.lifecycle)).toEqual(
      pattern.detections.map((d) => d.lifecycle),
    );
    // Sources unchanged
    expect(pattern.inputIdentity).toBe(unified.sourceRefs.pattern!.inputIdentity);
    expect(fibonacci.mathematicalReferenceOnly).toBe(true);
  });

  it("fails closed when a source assessment is missing", () => {
    const candles = series();
    const q = validQuality(candles);
    const fibonacci = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const unified = assessMifUnifiedChartAnalysis({
      pattern: null,
      fibonacci,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(unified.status).toBe("INSUFFICIENT_DATA");
    expect(unified.blockingCodes).toContain(MIF_UCA_SOURCE_MISSING);
    expect(unified.relationships).toHaveLength(0);
  });

  it("blocks symbol/timeframe mismatches", () => {
    const candles = series();
    const q = validQuality(candles);
    const pattern = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: patternPolicy(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const fibonacci = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const mismatched = {
      ...fibonacci,
      providerSymbol: "EURUSD",
      timeframe: "M15",
    };
    const unified = assessMifUnifiedChartAnalysis({
      pattern,
      fibonacci: mismatched,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(unified.diagnostics.compatible).toBe(false);
    expect(unified.status).toBe("BLOCKED");
    expect(unified.confluence.grade).toBe("INCOMPATIBLE");
  });

  it("keeps Fibonacci policy export intact", () => {
    expect(MIF_POLICY_HFM_FIBONACCI.policyId).toBe("mif-hfm-fibonacci");
  });
});
