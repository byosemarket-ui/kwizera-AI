/**
 * Phase 5C Step 2 — integration + safety regression.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifChartPatterns,
  assessMifDataIntegrity,
  assessMifFibonacci,
  assessMifHarmonicPatterns,
  assessMifMarketRegime,
  assessMifUnifiedChartAnalysis,
  baseCanonicalCandle,
  buildMifStep2AnalyticalBundle,
  MIF_CHART_PATTERNS_CONTRACT_ID,
  MIF_FIBONACCI_CONTRACT_ID,
  MIF_HARMONIC_PATTERNS_CONTRACT_ID,
  MIF_MARKET_REGIME_CONTRACT_ID,
  MIF_CHART_ANALYSIS_CONTRACT_ID,
  MIF_POLICY_HFM_HARMONIC_PATTERNS,
  MIF_POLICY_HFM_MARKET_REGIME,
  type MifCanonicalCandle,
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

describe("Phase 5C Step2 — integration & safety", () => {
  it("both engines consume canonical MIF inputs and keep versioned contracts", () => {
    const candles = Array.from({ length: 50 }, (_, i) =>
      candle(i, 100 + i * 0.5 + 1, 100 + i * 0.5 - 1, 100 + i * 0.5),
    );
    const quality = {
      kind: "step1-data-integrity" as const,
      assessment: {
        ...assessMifDataIntegrity({
          candles,
          providerSymbol: "XAUUSD",
          timeframe: "H1",
          assessmentTimestamp: "2024-01-01T00:00:00.000Z",
        }),
        status: "VALID" as const,
      },
    };

    const har = assessMifHarmonicPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      policy: { ...MIF_POLICY_HFM_HARMONIC_PATTERNS, atrPeriod: 5 },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const reg = assessMifMarketRegime({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      policy: { ...MIF_POLICY_HFM_MARKET_REGIME, atrPeriod: 5, lookbackBars: 20, minConfirmedSwings: 3 },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });

    expect(har.contractId).toBe(MIF_HARMONIC_PATTERNS_CONTRACT_ID);
    expect(har.contractVersion).toBe("1.0.0");
    expect(har.policyId).toBe("mif-hfm-harmonic-patterns");
    expect(reg.contractId).toBe(MIF_MARKET_REGIME_CONTRACT_ID);
    expect(reg.contractVersion).toBe("1.0.0");
    expect(reg.policyId).toBe("mif-hfm-market-regime");
    expect(har.providerId).toBe("HFM_MT5");
    expect(reg.providerId).toBe("HFM_MT5");
  });

  it("STEP 1A/1B/1C remain independently callable and unchanged in safety flags", () => {
    const candles = Array.from({ length: 40 }, (_, i) =>
      candle(i, 102 + (i % 4), 98 - (i % 3), 100),
    );
    const quality = {
      kind: "step1-data-integrity" as const,
      assessment: {
        ...assessMifDataIntegrity({
          candles,
          providerSymbol: "XAUUSD",
          timeframe: "H1",
          assessmentTimestamp: "2024-01-01T00:00:00.000Z",
        }),
        status: "VALID" as const,
      },
    };
    const fib = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const pat = assessMifChartPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const uni = assessMifUnifiedChartAnalysis({
      pattern: pat,
      fibonacci: fib,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });

    expect(fib.contractId).toBe(MIF_FIBONACCI_CONTRACT_ID);
    expect(pat.contractId).toBe(MIF_CHART_PATTERNS_CONTRACT_ID);
    expect(uni.contractId).toBe(MIF_CHART_ANALYSIS_CONTRACT_ID);

    for (const a of [fib, pat, uni]) {
      expect(a.placesOrders).toBe(false);
      expect(a.mutatesBroker).toBe(false);
      expect(a.acceptsForExecution).toBe(false);
      expect(a.doesNotApproveAiReasoning).toBe(true);
    }

    const har = assessMifHarmonicPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const reg = assessMifMarketRegime({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const bundle = buildMifStep2AnalyticalBundle({
      unifiedChartAnalysis: uni,
      harmonicPatterns: har,
      marketRegime: reg,
    });
    expect(bundle.doesNotApproveAiReasoning).toBe(true);
    expect(bundle.placesOrders).toBe(false);
    expect(bundle.mutatesBroker).toBe(false);
    expect(bundle.acceptsForExecution).toBe(false);
    expect(bundle.analyticalBundleOnly).toBe(true);
    // STEP 1C identity unchanged by bundling
    expect(bundle.unifiedChartAnalysis?.inputIdentity).toBe(uni.inputIdentity);
  });

  it("quality-gate failures are respected — no confident classifications", () => {
    const candles = Array.from({ length: 30 }, (_, i) => candle(i, 101, 99));
    const har = assessMifHarmonicPatterns({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const reg = assessMifMarketRegime({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(har.status).toBe("INSUFFICIENT_DATA");
    expect(har.detections).toHaveLength(0);
    expect(reg.status).toBe("INSUFFICIENT_DATA");
    expect(reg.structure).toBe("UNKNOWN");
  });
});
