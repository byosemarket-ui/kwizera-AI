/**
 * Phase 5C Step 1B — deterministic identities for chart patterns.
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

function series(): MifCanonicalCandle[] {
  const rows: Array<[number, number]> = [
    [102, 98], [103, 99], [101, 97], [104, 98], [103, 97.5],
    [110.1, 104], [108, 103], [107, 102], [105, 100],
    [106, 101], [107, 102], [110.2, 104], [108, 103], [107, 102],
    [101, 95, ],
  ];
  return rows.map((r, i) => candle(i, r[0]!, r[1]!, i === 14 ? 96 : undefined));
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
    ...over,
  };
}

describe("Phase 5C Step1B — pattern determinism", () => {
  it("repeats identity when wall-clock changes; no input mutation", () => {
    const candles = series();
    const snap = candles.map((c) => ({ ...c }));
    const q = validQuality(candles);
    const a = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2099-12-31T23:59:59.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.detections.map((d) => d.detectionIdentity)).toEqual(
      b.detections.map((d) => d.detectionIdentity),
    );
    expect(a.assessmentTimestamp).not.toBe(b.assessmentTimestamp);
    expect(candles).toEqual(snap);
    expect(a.mutatesBroker).toBe(false);
    expect(a.acceptsForExecution).toBe(false);
  });

  it("policy version and geometry changes alter identity", () => {
    const candles = series();
    const q = validQuality(candles);
    const base = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const altPolicy = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy({ policyVersion: "1.0.1-test" }),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(altPolicy.inputIdentity).not.toBe(base.inputIdentity);

    const mutated = series();
    mutated[11] = candle(11, 125, 104);
    const geo = assessMifChartPatterns({
      candles: mutated,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(mutated) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(geo.inputIdentity).not.toBe(base.inputIdentity);
  });
});
