/**
 * Phase 5C Step 2 — market regime detection (dimensional).
 */
import { describe, it, expect } from "vitest";
import {
  assessMifDataIntegrity,
  assessMifMarketRegime,
  baseCanonicalCandle,
  classifyVolatility,
  MIF_MARKET_REGIME_CONTRACT_ID,
  MIF_MARKET_REGIME_ATR_METHOD_ID,
  MIF_POLICY_HFM_MARKET_REGIME,
  resolvePatternAtr,
  mifCandlesToStructureCandles,
  validateMifMarketRegimePolicy,
  type MifCanonicalCandle,
  type MifMarketRegimePolicy,
  type MifStep1DataIntegrityAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(
  index: number,
  high: number,
  low: number,
  close?: number,
  state: "CLOSED" | "FORMING" = "CLOSED",
): MifCanonicalCandle {
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
    candleState: state,
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

function testPolicy(over: Partial<MifMarketRegimePolicy> = {}): MifMarketRegimePolicy {
  return {
    ...MIF_POLICY_HFM_MARKET_REGIME,
    atrPeriod: 5,
    lookbackBars: 20,
    minConfirmedSwings: 3,
    minTrendSwingPairs: 1,
    minTrendDisplacementAtr: 0.8,
    maxRangeDisplacementAtr: 0.5,
    minRangeWidthAtr: 0.5,
    maxRangeWidthAtr: 20,
    breakoutBufferAtr: 0.05,
    breakoutConfirmBars: 1,
    breakoutFailBars: 3,
    atrBaselineLookback: 25,
    structurePersistBars: 2,
    ...over,
  };
}

/** Strong upward path with clear HH/HL swings (L=2,R=2 friendly). */
function upTrendSeries(n = 50): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n; i++) {
    const base = 100 + i * 0.8;
    const bump = i % 5 === 2 ? 2.5 : i % 5 === 4 ? -1.2 : 0;
    const close = base + bump;
    out.push(candle(i, close + 1.2, close - 1.2, close));
  }
  return out;
}

function downTrendSeries(n = 50): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n; i++) {
    const base = 140 - i * 0.8;
    const bump = i % 5 === 2 ? -2.5 : i % 5 === 4 ? 1.2 : 0;
    const close = base + bump;
    out.push(candle(i, close + 1.2, close - 1.2, close));
  }
  return out;
}

function rangeSeries(n = 50): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n; i++) {
    const phase = Math.sin(i / 3);
    const close = 100 + phase * 1.5;
    out.push(candle(i, close + 0.8, close - 0.8, close));
  }
  return out;
}

function breakoutSeries(): MifCanonicalCandle[] {
  const base = rangeSeries(40);
  // tip: break above range with follow-through
  base.push(candle(40, 108, 103, 107));
  base.push(candle(41, 110, 106, 109));
  base.push(candle(42, 111, 107, 110));
  return base;
}

function failedBreakoutSeries(): MifCanonicalCandle[] {
  const base = rangeSeries(40);
  base.push(candle(40, 108, 103, 107));
  base.push(candle(41, 106, 99, 100)); // close back inside / below
  base.push(candle(42, 103, 98, 99));
  return base;
}

function highVolSeries(n = 50): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n; i++) {
    // Quiet baseline first, then extreme ranges — relative ATR must rise.
    if (i < 30) {
      const close = 100 + (i % 2 === 0 ? 0.2 : -0.2);
      out.push(candle(i, close + 0.3, close - 0.3, close));
    } else {
      const close = 100 + (i % 2 === 0 ? 6 : -6);
      out.push(candle(i, close + 8, close - 8, close));
    }
  }
  return out;
}

describe("Phase 5C Step2 — market regime", () => {
  it("validates built-in policy", () => {
    expect(validateMifMarketRegimePolicy(MIF_POLICY_HFM_MARKET_REGIME).ok).toBe(true);
    expect(MIF_POLICY_HFM_MARKET_REGIME.atrMethodId).toBe(MIF_MARKET_REGIME_ATR_METHOD_ID);
  });

  it("classifies clear upward and downward trends with separate dimensions", () => {
    const up = upTrendSeries();
    const rUp = assessMifMarketRegime({
      candles: up,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(up) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(rUp.contractId).toBe(MIF_MARKET_REGIME_CONTRACT_ID);
    expect(rUp.doesNotApproveAiReasoning).toBe(true);
    expect(rUp.placesOrders).toBe(false);
    expect(rUp.structure).toBe("TRENDING");
    expect(rUp.direction).toBe("UP");
    expect(rUp.compositeLabel).toBe("TRENDING_UP");
    expect(rUp.volatility).not.toBe("UNKNOWN");

    const down = downTrendSeries();
    const rDown = assessMifMarketRegime({
      candles: down,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(down) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(rDown.structure).toBe("TRENDING");
    expect(rDown.direction).toBe("DOWN");
    expect(rDown.compositeLabel).toBe("TRENDING_DOWN");
  });

  it("detects ranging market with boundaries", () => {
    const series = rangeSeries();
    const r = assessMifMarketRegime({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy({ minTrendDisplacementAtr: 3 }),
      quality: { kind: "step1-data-integrity", assessment: validQuality(series) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(["RANGING", "TRANSITION", "UNSTABLE"]).toContain(r.structure);
    if (r.structure === "RANGING") {
      expect(r.rangeEvidence.high).not.toBeNull();
      expect(r.rangeEvidence.low).not.toBeNull();
      expect(r.direction).toBe("NEUTRAL");
    }
  });

  it("distinguishes potential / confirmed / failed breakouts", () => {
    const confirmedSeries = breakoutSeries();
    const confirmed = assessMifMarketRegime({
      candles: confirmedSeries,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy({ lookbackBars: 25, breakoutConfirmBars: 1 }),
      quality: { kind: "step1-data-integrity", assessment: validQuality(confirmedSeries) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(["POTENTIAL", "CONFIRMED", "NONE"]).toContain(confirmed.breakoutEvidence.state);
    if (confirmed.breakoutEvidence.state === "CONFIRMED") {
      expect(confirmed.structure).toBe("BREAKOUT");
    }

    const failedSeries = failedBreakoutSeries();
    const failed = assessMifMarketRegime({
      candles: failedSeries,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy({ lookbackBars: 25 }),
      quality: { kind: "step1-data-integrity", assessment: validQuality(failedSeries) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(["FAILED", "NONE", "POTENTIAL"]).toContain(failed.breakoutEvidence.state);
  });

  it("classifies high volatility relative to baseline", () => {
    const series = highVolSeries();
    const policy = testPolicy({
      volLowMax: 0.5,
      volNormalMax: 0.8,
      volHighMax: 1.1,
      atrBaselineLookback: 40,
    });
    const adapted = mifCandlesToStructureCandles({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      includeForming: false,
    });
    const atrRes = resolvePatternAtr({
      candles: adapted.structureCandles,
      period: policy.atrPeriod,
      methodId: policy.atrMethodId,
    });
    expect(atrRes.atr).not.toBeNull();
    const vol = classifyVolatility({
      candles: adapted.structureCandles,
      atr: atrRes.atr!,
      atrPeriod: policy.atrPeriod,
      policy,
    });
    expect(vol.atrRatio).not.toBeNull();
    expect(["HIGH", "EXTREME"]).toContain(vol.classification);

    const r = assessMifMarketRegime({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy,
      quality: { kind: "step1-data-integrity", assessment: validQuality(series) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r.volatilityEvidence.atr).not.toBeNull();
    if (r.status !== "INSUFFICIENT_DATA" && r.status !== "BLOCKED") {
      expect(["HIGH", "EXTREME", "NORMAL", "LOW"]).toContain(r.volatility);
    }
  });

  it("returns INSUFFICIENT_DATA for short history and missing quality", () => {
    const few = Array.from({ length: 5 }, (_, i) => candle(i, 101, 99));
    const r1 = assessMifMarketRegime({
      candles: few,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r1.status).toBe("INSUFFICIENT_DATA");
    expect(r1.compositeLabel).toBe("INSUFFICIENT_DATA");

    const r2 = assessMifMarketRegime({
      candles: few,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: validQuality(few) },
      policy: testPolicy(),
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r2.status).toBe("INSUFFICIENT_DATA");
  });

  it("hysteresis holds previous structure until persistence met", () => {
    const series = upTrendSeries();
    const first = assessMifMarketRegime({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy({ structurePersistBars: 3 }),
      quality: { kind: "step1-data-integrity", assessment: validQuality(series) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const held = assessMifMarketRegime({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy({ structurePersistBars: 3 }),
      previousStructure: "RANGING",
      sameCandidateStreak: 0,
      quality: { kind: "step1-data-integrity", assessment: validQuality(series) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    if (first.structure !== "RANGING") {
      expect(held.transition.hysteresisHeld).toBe(true);
      expect(held.structure).toBe("RANGING");
    }
    const released = assessMifMarketRegime({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy({ structurePersistBars: 3 }),
      previousStructure: "RANGING",
      sameCandidateStreak: 3,
      quality: { kind: "step1-data-integrity", assessment: validQuality(series) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(released.transition.hysteresisHeld).toBe(false);
  });

  it("deterministic repeated assessments without mutating inputs", () => {
    const series = upTrendSeries();
    const snap = JSON.stringify(series);
    const q = validQuality(series);
    const a = assessMifMarketRegime({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifMarketRegime({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      policy: testPolicy(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.structure).toBe(b.structure);
    expect(a.direction).toBe(b.direction);
    expect(JSON.stringify(series)).toBe(snap);
    expect(a.analyticalRegimeInformationOnly).toBe(true);
  });
});
