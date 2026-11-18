/**
 * Phase 5C Step 1A — Fibonacci stable identity / determinism.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifDataIntegrity,
  assessMifFibonacci,
  baseCanonicalCandle,
  MIF_POLICY_HFM_FIBONACCI,
  mifInstrumentFromHfmCatalog,
  type MifCanonicalCandle,
  type MifFibonacciPolicy,
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

function mifHl(index: number, high: number, low: number): MifCanonicalCandle {
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
    instrument: instrument(),
  });
}

function bullishSeries(): MifCanonicalCandle[] {
  const levels = [
    { h: 102, l: 98 },
    { h: 101, l: 97 },
    { h: 100, l: 90 },
    { h: 103, l: 94 },
    { h: 104, l: 95 },
    { h: 110, l: 100 },
    { h: 108, l: 99 },
    { h: 107, l: 98 },
    { h: 105, l: 94 },
    { h: 108, l: 96 },
    { h: 109, l: 97 },
    { h: 116, l: 104 },
    { h: 114, l: 103 },
    { h: 113, l: 102 },
    { h: 110, l: 98 },
    { h: 112, l: 100 },
    { h: 113, l: 101 },
    { h: 122, l: 108 },
    { h: 120, l: 107 },
    { h: 119, l: 106 },
  ];
  return levels.map((row, i) => mifHl(i, row.h, row.l));
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

describe("Phase 5C Step1A — Fibonacci determinism", () => {
  it("repeated assessments share identity and levels; wall-clock excluded", () => {
    const candles = bullishSeries();
    const snap = candles.map((c) => ({ ...c }));
    const q = validQuality(candles);
    const a = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2099-12-31T23:59:59.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.retracements).toEqual(b.retracements);
    expect(a.extensions).toEqual(b.extensions);
    expect(a.anchorA).toEqual(b.anchorA);
    expect(a.assessmentTimestamp).not.toBe(b.assessmentTimestamp);
    expect(candles).toEqual(snap);
  });

  it("policy version change alters identity", () => {
    const candles = bullishSeries();
    const q = validQuality(candles);
    const base = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const altPolicy: MifFibonacciPolicy = {
      ...MIF_POLICY_HFM_FIBONACCI,
      policyVersion: "1.0.1-test",
    };
    const alt = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      policy: altPolicy,
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(alt.inputIdentity).not.toBe(base.inputIdentity);
  });

  it("candle input change alters identity", () => {
    const candles = bullishSeries();
    const q = validQuality(candles);
    const base = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const mutated = bullishSeries();
    mutated[17] = mifHl(17, 123, 108);
    const changed = assessMifFibonacci({
      candles: mutated,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(mutated) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(changed.inputIdentity).not.toBe(base.inputIdentity);
  });
});
