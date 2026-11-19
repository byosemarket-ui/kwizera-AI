/**
 * Phase 5C Step 3 — integration + safety regression.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifChartPatterns,
  assessMifDataIntegrity,
  assessMifFibonacci,
  assessMifHarmonicPatterns,
  assessMifMarketRegime,
  assessMifMultiTimeframeRelationships,
  assessMifUnifiedChartAnalysis,
  baseCanonicalCandle,
  buildMifStep2AnalyticalBundle,
  buildMifStep3AnalyticalBundle,
  MIF_HARMONIC_PATTERNS_CONTRACT_ID,
  MIF_MARKET_REGIME_CONTRACT_ID,
  MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
  type MifCanonicalCandle,
  type MifMarketRegimeAssessment,
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

describe("Phase 5C Step3 — integration & safety", () => {
  it("Step 1/2 engines remain callable; MTF consumes regime refs without mutation", () => {
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

    expect(har.contractId).toBe(MIF_HARMONIC_PATTERNS_CONTRACT_ID);
    expect(reg.contractId).toBe(MIF_MARKET_REGIME_CONTRACT_ID);

    const snap = JSON.stringify(reg);
    const mtf = assessMifMultiTimeframeRelationships({
      sources: [
        {
          timeframe: "H4",
          providerSymbol: "XAUUSD",
          regime: { ...reg, timeframe: "H4", assessmentId: "h4" } as MifMarketRegimeAssessment,
          tipCandleState: "CLOSED",
          tipTimebase: "BROKER_SERVER",
          qualityStatus: "VALID",
        },
        {
          timeframe: "H1",
          providerSymbol: "XAUUSD",
          regime: reg,
          harmonic: har,
          fibonacci: fib,
          chartPatterns: pat,
          unified: uni,
          tipCandleState: "CLOSED",
          tipTimebase: "BROKER_SERVER",
          qualityStatus: "VALID",
        },
        {
          timeframe: "M15",
          providerSymbol: "XAUUSD",
          regime: { ...reg, timeframe: "M15", assessmentId: "m15" } as MifMarketRegimeAssessment,
          tipCandleState: "CLOSED",
          tipTimebase: "BROKER_SERVER",
          qualityStatus: "VALID",
        },
      ],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });

    expect(mtf.contractId).toBe(MIF_MTF_RELATIONSHIPS_CONTRACT_ID);
    expect(JSON.stringify(reg)).toBe(snap);
    expect(mtf.placesOrders).toBe(false);
    expect(mtf.mutatesBroker).toBe(false);
    expect(mtf.acceptsForExecution).toBe(false);
    expect(mtf.doesNotApproveAiReasoning).toBe(true);

    const step2 = buildMifStep2AnalyticalBundle({
      unifiedChartAnalysis: uni,
      harmonicPatterns: har,
      marketRegime: reg,
    });
    const step3 = buildMifStep3AnalyticalBundle({
      step2,
      multiTimeframeRelationships: mtf,
    });
    expect(step3.doesNotApproveAiReasoning).toBe(true);
    expect(step3.acceptsForExecution).toBe(false);
  });
});
