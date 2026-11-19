/**
 * Phase 5C Step 1B — quality gating for chart patterns.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifChartPatterns,
  assessMifDataIntegrity,
  baseCanonicalCandle,
  MIF_PAT_QUALITY_BLOCKED,
  MIF_PAT_QUALITY_MISSING,
  MIF_POLICY_HFM_CHART_PATTERNS,
  type MifCanonicalCandle,
  type MifChartPatternPolicy,
  type MifStep1DataIntegrityAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(index: number, high: number, low: number): MifCanonicalCandle {
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
    close: mid,
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
    [101, 95],
  ];
  return rows.map((r, i) => candle(i, r[0]!, r[1]!));
}

function policy(): MifChartPatternPolicy {
  return {
    ...MIF_POLICY_HFM_CHART_PATTERNS,
    atrPeriod: 3,
    peakEqualityTolRel: 0.01,
    peakEqualityTolAtrMult: 2,
    minRetraceOfSpan: 0.03,
  };
}

describe("Phase 5C Step1B — pattern quality gate", () => {
  it("fails closed on missing quality", () => {
    const candles = series();
    const result = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.blockingCodes).toContain(MIF_PAT_QUALITY_MISSING);
    expect(result.detections).toHaveLength(0);
  });

  it("BLOCKED quality blocks confirmed patterns", () => {
    const candles = series();
    const integrity = assessMifDataIntegrity({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const blocked = { ...integrity, status: "BLOCKED" as const };
    const result = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: blocked },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.blockingCodes).toContain(MIF_PAT_QUALITY_BLOCKED);
    expect(result.detections).toHaveLength(0);
  });

  it("WARNING does not upgrade to VALID; CONFIRMED requires VALID", () => {
    const candles = series();
    const integrity = assessMifDataIntegrity({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const warned: MifStep1DataIntegrityAssessment = { ...integrity, status: "WARNING" };
    const result = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: warned },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(result.qualityRef.status).toBe("WARNING");
    expect(result.detections.every((d) => d.lifecycle !== "CONFIRMED")).toBe(true);
    // FORMING may still appear under allowedQualityStatusesForForming.
    expect(result.doesNotApproveAiReasoning).toBe(true);
    expect((result as { approvedForAiReasoning?: boolean }).approvedForAiReasoning).toBeUndefined();
  });

  it("DEGRADED cannot silently become VALID", () => {
    const candles = series();
    const integrity = assessMifDataIntegrity({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const degraded = { ...integrity, status: "DEGRADED" as const };
    const result = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: policy(),
      quality: { kind: "step1-data-integrity", assessment: degraded },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(result.status).not.toBe("VALID");
    expect(result.qualityRef.status).toBe("DEGRADED");
  });
});
