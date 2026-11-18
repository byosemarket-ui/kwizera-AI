/**
 * Phase 5C Step 1A — Fibonacci assessment engine.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifDataIntegrity,
  assessMifFibonacci,
  baseCanonicalCandle,
  computeFibExtensionPrice,
  computeFibRetracementPrice,
  createDefaultMifFibonacciPolicyRegistry,
  MIF_FIBONACCI_CONTRACT_ID,
  MIF_FIBONACCI_EXTENSION_RATIOS_V1,
  MIF_FIBONACCI_POLICY_ID,
  MIF_FIBONACCI_POLICY_VERSION,
  MIF_FIBONACCI_RETRACEMENT_RATIOS_V1,
  MIF_FIB_INSTRUMENT_MISSING,
  MIF_FIB_NO_CONFIRMED_IMPULSE,
  MIF_FIB_POLICY_INVALID,
  MIF_FIB_POLICY_UNAVAILABLE,
  MIF_FIB_QUALITY_MISSING,
  MIF_POLICY_HFM_FIBONACCI,
  mifInstrumentFromHfmCatalog,
  validateMifFibonacciPolicy,
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

function mifHl(index: number, high: number, low: number, state: "CLOSED" | "FORMING" = "CLOSED"): MifCanonicalCandle {
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
    close: mid + (high - low) * 0.05,
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
    instrument: instrument(),
  });
}

/** Same pivot geometry as Phase 38D bullishStructureSeries. */
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

describe("Phase 5C Step1A — Fibonacci mathematics", () => {
  it("matches hand-calculated bullish retracement and extension", () => {
    expect(computeFibRetracementPrice("BULLISH", 90, 110, 0.5)).toBe(100);
    expect(computeFibRetracementPrice("BULLISH", 90, 110, 0.618)).toBeCloseTo(97.64, 10);
    expect(computeFibExtensionPrice("BULLISH", 90, 110, 1.618)).toBeCloseTo(122.36, 10);
  });

  it("matches hand-calculated bearish retracement and extension", () => {
    expect(computeFibRetracementPrice("BEARISH", 90, 110, 0.5)).toBe(100);
    expect(computeFibRetracementPrice("BEARISH", 90, 110, 0.382)).toBeCloseTo(97.64, 10);
    expect(computeFibExtensionPrice("BEARISH", 90, 110, 1.618)).toBeCloseTo(77.64, 10);
  });

  it("covers exact approved ratio sets", () => {
    expect([...MIF_FIBONACCI_RETRACEMENT_RATIOS_V1]).toEqual([0.236, 0.382, 0.5, 0.618, 0.786]);
    expect([...MIF_FIBONACCI_EXTENSION_RATIOS_V1]).toEqual([1.272, 1.414, 1.618, 2.0, 2.618]);
    expect(validateMifFibonacciPolicy(MIF_POLICY_HFM_FIBONACCI).ok).toBe(true);
  });
});

describe("Phase 5C Step1A — Fibonacci assessment", () => {
  it("produces bullish levels from confirmed swings with safety flags", () => {
    const candles = bullishSeries();
    const result = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(candles) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(result.contractId).toBe(MIF_FIBONACCI_CONTRACT_ID);
    expect(result.policyId).toBe(MIF_FIBONACCI_POLICY_ID);
    expect(result.policyVersion).toBe(MIF_FIBONACCI_POLICY_VERSION);
    expect(result.orientation).toBe("BULLISH");
    expect(result.anchorA?.kind).toBe("LOW");
    expect(result.anchorB?.kind).toBe("HIGH");
    expect(result.anchorA?.status).toBe("CONFIRMED");
    expect(result.anchorB?.status).toBe("CONFIRMED");
    expect(result.retracements).toHaveLength(5);
    expect(result.extensions).toHaveLength(5);
    expect(result.retracements.map((r) => r.ratio)).toEqual([...MIF_FIBONACCI_RETRACEMENT_RATIOS_V1]);
    expect(result.extensions.map((r) => r.ratio)).toEqual([...MIF_FIBONACCI_EXTENSION_RATIOS_V1]);
    expect(result.doesNotApproveAiReasoning).toBe(true);
    expect(result.placesOrders).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.mathematicalReferenceOnly).toBe(true);
    expect(["VALID", "WARNING"]).toContain(result.status);

    const L = result.anchorA!.price;
    const H = result.anchorB!.price;
    for (const level of result.retracements) {
      expect(level.price).toBeCloseTo(computeFibRetracementPrice("BULLISH", L, H, level.ratio), 10);
    }
    for (const level of result.extensions) {
      expect(level.price).toBeCloseTo(computeFibExtensionPrice("BULLISH", L, H, level.ratio), 10);
    }
  });

  it("reports precision/tick mismatches without silent rounding", () => {
    const candles = bullishSeries();
    const result = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(candles) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const raw618 = result.retracements.find((r) => r.ratio === 0.618)!;
    expect(raw618.precisionOk === false || raw618.tickAligned === false).toBe(true);
    // Price must remain raw calculated value (not rounded to tick).
    const L = result.anchorA!.price;
    const H = result.anchorB!.price;
    expect(raw618.price).toBe(computeFibRetracementPrice("BULLISH", L, H, 0.618));
  });

  it("blocks when quality is missing", () => {
    const candles = bullishSeries();
    const result = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.blockingCodes).toContain(MIF_FIB_QUALITY_MISSING);
    expect(result.retracements).toHaveLength(0);
  });

  it("blocks missing instrument under policy", () => {
    const candles = bullishSeries();
    const result = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: null,
      quality: { kind: "step1-data-integrity", assessment: validQuality(candles) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.blockingCodes).toContain(MIF_FIB_INSTRUMENT_MISSING);
  });

  it("rejects invalid and unavailable policies", () => {
    const candles = bullishSeries();
    const bad: MifFibonacciPolicy = {
      ...MIF_POLICY_HFM_FIBONACCI,
      retracementRatios: [0.5, 0.5],
    };
    const invalid = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      policy: bad,
      quality: { kind: "step1-data-integrity", assessment: validQuality(candles) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(invalid.status).toBe("BLOCKED");
    expect(invalid.blockingCodes).toContain(MIF_FIB_POLICY_INVALID);

    const registry = createDefaultMifFibonacciPolicyRegistry();
    const missing = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      policyId: "no-such-policy",
      policyVersion: "9.9.9",
      policyRegistry: registry,
      quality: { kind: "step1-data-integrity", assessment: validQuality(candles) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(missing.status).toBe("BLOCKED");
    expect(missing.blockingCodes).toContain(MIF_FIB_POLICY_UNAVAILABLE);
  });

  it("returns INSUFFICIENT_DATA when swings cannot form a confirmed impulse", () => {
    const candles = [mifHl(0, 101, 99), mifHl(1, 102, 100), mifHl(2, 103, 101)];
    const result = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(candles) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(
      result.blockingCodes.includes(MIF_FIB_NO_CONFIRMED_IMPULSE)
        || result.findings.some((f) => f.code === "INSUFFICIENT_SWINGS"),
    ).toBe(true);
    expect(result.orientation).toBeNull();
  });

  it("selects latest adjacent confirmed impulse deterministically", () => {
    const candles = bullishSeries();
    const a = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(candles) },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifFibonacci({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      instrument: instrument(),
      quality: { kind: "step1-data-integrity", assessment: validQuality(candles) },
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
    });
    expect(a.anchorA?.swingId).toBe(b.anchorA?.swingId);
    expect(a.anchorB?.swingId).toBe(b.anchorB?.swingId);
    expect(a.diagnostics.candidateImpulseCount).toBeGreaterThan(0);
  });
});
