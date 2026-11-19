/**
 * Phase 5C Step 1B — pattern lifecycle states.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifChartPatterns,
  assessMifDataIntegrity,
  baseCanonicalCandle,
  MIF_POLICY_HFM_CHART_PATTERNS,
  type MifCanonicalCandle,
  type MifChartPatternPolicy,
  type MifStep1DataIntegrityAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

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
    instrument: null,
  });
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

function policy(over: Partial<MifChartPatternPolicy> = {}): MifChartPatternPolicy {
  return {
    ...MIF_POLICY_HFM_CHART_PATTERNS,
    atrPeriod: 3,
    peakEqualityTolRel: 0.01,
    peakEqualityTolAtrMult: 2,
    minRetraceOfSpan: 0.03,
    failureWindowBars: 3,
    ...over,
  };
}

function doubleTopBase(): MifCanonicalCandle[] {
  const rows: Array<[number, number]> = [
    [102, 98], [103, 99], [101, 97], [104, 98], [103, 97.5],
    [110.1, 104], [108, 103], [107, 102], [105, 100],
    [106, 101], [107, 102], [110.2, 104], [108, 103], [107, 102],
  ];
  return rows.map((r, i) => candle(i, r[0]!, r[1]!));
}

describe("Phase 5C Step1B — lifecycle", () => {
  it("FORMING before breakout; CONFIRMED after closed break; FAILED on reclaim", () => {
    const base = doubleTopBase();
    const forming = assessMifChartPatterns({
      candles: base,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(base) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const f = forming.detections.find((d) => d.patternType === "DOUBLE_TOP");
    expect(f?.lifecycle).toBe("FORMING");

    const confirmedSeries = [
      ...base,
      candle(14, 101, 95, 96),
      candle(15, 100, 94, 95),
    ];
    const confirmed = assessMifChartPatterns({
      candles: confirmedSeries,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(confirmedSeries) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const c = confirmed.detections.find((d) => d.patternType === "DOUBLE_TOP");
    expect(c?.lifecycle).toBe("CONFIRMED");

    const failedSeries = [
      ...base,
      candle(14, 101, 95, 96),
      candle(15, 108, 99, 107), // reclaim above neckline
      candle(16, 109, 100, 108),
    ];
    const failed = assessMifChartPatterns({
      candles: failedSeries,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(failedSeries) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const fl = failed.detections.find((d) => d.patternType === "DOUBLE_TOP");
    expect(fl?.lifecycle).toBe("FAILED");
    expect(fl?.lifecycle).not.toBe("INVALIDATED");
  });

  it("does not conflate assessment status with lifecycle", () => {
    const base = doubleTopBase();
    const result = assessMifChartPatterns({
      candles: base,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(base) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const dt = result.detections.find((d) => d.patternType === "DOUBLE_TOP");
    expect(dt?.lifecycle).toBe("FORMING");
    expect(result.status).not.toBe(dt?.lifecycle as unknown as typeof result.status);
  });
});
