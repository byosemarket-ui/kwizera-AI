/**
 * Phase 5C Step 2 — harmonic pattern detection (Gartley/Bat/Butterfly/Crab/Shark).
 */
import { describe, it, expect } from "vitest";
import {
  assessMifDataIntegrity,
  assessMifHarmonicPatterns,
  baseCanonicalCandle,
  evaluateHarmonicCandidate,
  evaluateHarmonicLifecycle,
  measureHarmonicRatios,
  MIF_HARMONIC_PATTERNS_CONTRACT_ID,
  MIF_HARMONIC_ATR_METHOD_ID,
  MIF_POLICY_HFM_HARMONIC_PATTERNS,
  validateMifHarmonicPolicy,
  type MifCanonicalCandle,
  type MifHarmonicPivotRef,
  type MifHarmonicPolicy,
  type MifStep1DataIntegrityAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(
  index: number,
  high: number,
  low: number,
  close?: number,
  state: "CLOSED" | "FORMING" | "STALE" | "MISSING" = "CLOSED",
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

function pivot(
  role: MifHarmonicPivotRef["role"],
  kind: "HIGH" | "LOW",
  price: number,
  index: number,
  status: "CONFIRMED" | "PROVISIONAL" = "CONFIRMED",
): MifHarmonicPivotRef {
  return {
    role,
    swingId: `${role}:${index}`,
    kind,
    price,
    timeSec: T0 + index * STEP,
    index,
    status,
  };
}

function structureCandle(index: number, close: number, high?: number, low?: number) {
  return {
    time: T0 + index * STEP,
    open: close,
    high: high ?? close + 0.5,
    low: low ?? close - 0.5,
    close,
    isClosed: true,
    closed: true,
  };
}

/** Bullish Gartley with textbook ratios. */
function gartleyBullishPivots(): MifHarmonicPivotRef[] {
  // X=100 L, A=110 H, XA=10
  // B = 110 - 0.618*10 = 103.82 L
  // C = 103.82 + 0.5*6.18 = 106.91 H
  // D = 110 - 0.786*10 = 102.14 L
  return [
    pivot("X", "LOW", 100, 0),
    pivot("A", "HIGH", 110, 5),
    pivot("B", "LOW", 103.82, 10),
    pivot("C", "HIGH", 106.91, 15),
    pivot("D", "LOW", 102.14, 20),
  ];
}

function batBullishPivots(): MifHarmonicPivotRef[] {
  // AB=0.45, BC=0.5, AD=0.886
  // XA=10, B=110-4.5=105.5, C=105.5+2.25=107.75, D=110-8.86=101.14
  // CD/BC = (107.75-101.14)/2.25 = 2.938 → within 1.618-2.618? NO
  // Need CD in 1.618-2.618. Use BC=0.618 of AB: AB=4.5, BC=2.781, C=108.281
  // D=101.14, CD=7.141, CD/BC=2.568 OK
  return [
    pivot("X", "LOW", 100, 0),
    pivot("A", "HIGH", 110, 5),
    pivot("B", "LOW", 105.5, 10),
    pivot("C", "HIGH", 108.281, 15),
    pivot("D", "LOW", 101.14, 20),
  ];
}

function butterflyBullishPivots(): MifHarmonicPivotRef[] {
  // AB=0.786, AD=1.272, BC=0.5, CD ~1.618-2.618
  // B=110-7.86=102.14, C=102.14+3.93=106.07, D=110-12.72=97.28
  // CD=(106.07-97.28)/3.93=2.236 OK
  return [
    pivot("X", "LOW", 100, 0),
    pivot("A", "HIGH", 110, 5),
    pivot("B", "LOW", 102.14, 10),
    pivot("C", "HIGH", 106.07, 15),
    pivot("D", "LOW", 97.28, 20),
  ];
}

function crabBullishPivots(): MifHarmonicPivotRef[] {
  // AB=0.5 (XA=10→B=105), AD=1.618→D=93.82, BC=0.86*5=4.3→C=109.3
  // CD/BC=(109.3-93.82)/4.3=3.6 within [2.24, 3.618]; BC/AB=0.86 within [0.382, 0.886]
  return [
    pivot("X", "LOW", 100, 0),
    pivot("A", "HIGH", 110, 5),
    pivot("B", "LOW", 105, 10),
    pivot("C", "HIGH", 109.3, 15),
    pivot("D", "LOW", 93.82, 20),
  ];
}

function sharkBullishPivots(): MifHarmonicPivotRef[] {
  // Shark: AB/XA=1.272, BC/AB=1.62, CD/BC=0.9, AD=1.0659, CD/XC≈1.037
  return [
    pivot("X", "LOW", 100, 0),
    pivot("A", "HIGH", 110, 5),
    pivot("B", "LOW", 97.28, 10),
    pivot("C", "HIGH", 117.8864, 15),
    pivot("D", "LOW", 99.34064, 20),
  ];
}

describe("Phase 5C Step2 — harmonic patterns", () => {
  it("validates built-in policy and ATR method", () => {
    expect(validateMifHarmonicPolicy(MIF_POLICY_HFM_HARMONIC_PATTERNS).ok).toBe(true);
    expect(MIF_POLICY_HFM_HARMONIC_PATTERNS.atrMethodId).toBe(MIF_HARMONIC_ATR_METHOD_ID);
    expect(MIF_POLICY_HFM_HARMONIC_PATTERNS.patternRatios).toHaveLength(5);
  });

  it("matches valid Gartley / Bat / Butterfly / Crab / Shark geometry", () => {
    const cases: Array<{ name: string; pivots: MifHarmonicPivotRef[] }> = [
      { name: "GARTLEY", pivots: gartleyBullishPivots() },
      { name: "BAT", pivots: batBullishPivots() },
      { name: "BUTTERFLY", pivots: butterflyBullishPivots() },
      { name: "CRAB", pivots: crabBullishPivots() },
      { name: "SHARK", pivots: sharkBullishPivots() },
    ];
    for (const c of cases) {
      const dets = evaluateHarmonicCandidate({
        pivots: c.pivots,
        orientation: "BULLISH",
        policy: MIF_POLICY_HFM_HARMONIC_PATTERNS,
        atr: 1.5,
        candles: [structureCandle(21, c.pivots[4]!.price + 1)],
        allowConfirmed: true,
      });
      expect(dets.some((d) => d.patternType === c.name), c.name).toBe(true);
      const hit = dets.find((d) => d.patternType === c.name)!;
      expect(hit.allRequiredRatiosPassed).toBe(true);
      expect(hit.prz.analyticalReferenceOnly).toBe(true);
      expect(hit.prz.contributingProjections.length).toBeGreaterThanOrEqual(2);
      expect(hit.ratios.every((r) => Number.isFinite(r.measured))).toBe(true);
    }
  });

  it("rejects incorrect Fibonacci ratios and invalid pivot ordering", () => {
    const bad = gartleyBullishPivots();
    bad[2] = pivot("B", "LOW", 108, 10); // AB/XA ~0.2 — not Gartley
    const dets = evaluateHarmonicCandidate({
      pivots: bad,
      orientation: "BULLISH",
      policy: MIF_POLICY_HFM_HARMONIC_PATTERNS,
      atr: 1.5,
      candles: [],
      allowConfirmed: true,
    });
    expect(dets.some((d) => d.patternType === "GARTLEY")).toBe(false);

    const unordered = gartleyBullishPivots();
    // swap times to break chronology
    const tmp = unordered[1]!.timeSec;
    unordered[1] = { ...unordered[1]!, timeSec: unordered[2]!.timeSec, index: unordered[2]!.index };
    unordered[2] = { ...unordered[2]!, timeSec: tmp, index: 5 };
    expect(
      evaluateHarmonicCandidate({
        pivots: unordered,
        orientation: "BULLISH",
        policy: MIF_POLICY_HFM_HARMONIC_PATTERNS,
        atr: 1,
        candles: [],
        allowConfirmed: true,
      }),
    ).toHaveLength(0);

    const missing = gartleyBullishPivots().slice(0, 4);
    expect(
      evaluateHarmonicCandidate({
        pivots: missing as MifHarmonicPivotRef[],
        orientation: "BULLISH",
        policy: MIF_POLICY_HFM_HARMONIC_PATTERNS,
        atr: 1,
        candles: [],
        allowConfirmed: true,
      }),
    ).toHaveLength(0);
  });

  it("records ratio measurements with expected ranges and deviations", () => {
    const prices = { x: 100, a: 110, b: 103.82, c: 106.91, d: 102.14 };
    const policy = MIF_POLICY_HFM_HARMONIC_PATTERNS.patternRatios.find((p) => p.patternType === "GARTLEY")!;
    const ratios = measureHarmonicRatios(prices, policy);
    const ab = ratios.find((r) => r.id === "AB_XA")!;
    expect(ab.passed).toBe(true);
    expect(ab.expectedExact).toBe(0.618);
    expect(ab.deviation).not.toBeNull();
    expect(ab.deviation!).toBeLessThan(0.04);
  });

  it("lifecycle: FORMING without reaction; CONFIRMED after closed reaction; FAILED on PRZ breach", () => {
    const pivots = gartleyBullishPivots();
    const detsForming = evaluateHarmonicCandidate({
      pivots,
      orientation: "BULLISH",
      policy: MIF_POLICY_HFM_HARMONIC_PATTERNS,
      atr: 1,
      candles: [],
      allowConfirmed: true,
    });
    const g = detsForming.find((d) => d.patternType === "GARTLEY")!;
    expect(g.lifecycle).toBe("FORMING");

    const confirmed = evaluateHarmonicLifecycle({
      ratiosValid: true,
      structureInvalidated: false,
      orientation: "BULLISH",
      pivots,
      prz: g.prz,
      atr: 1,
      candles: [structureCandle(21, 103)],
      allowConfirmed: true,
    });
    expect(confirmed.lifecycle).toBe("CONFIRMED");

    const failed = evaluateHarmonicLifecycle({
      ratiosValid: true,
      structureInvalidated: false,
      orientation: "BULLISH",
      pivots,
      prz: g.prz,
      atr: 1,
      candles: [structureCandle(21, (g.prz.low ?? 100) - 2, (g.prz.low ?? 100) - 1, (g.prz.low ?? 100) - 3)],
      allowConfirmed: true,
    });
    expect(failed.lifecycle).toBe("FAILED");

    const invalidated = evaluateHarmonicLifecycle({
      ratiosValid: false,
      structureInvalidated: false,
      orientation: "BULLISH",
      pivots,
      prz: g.prz,
      atr: 1,
      candles: [structureCandle(21, 103)],
      allowConfirmed: true,
    });
    expect(invalidated.lifecycle).toBe("INVALIDATED");
  });

  it("FORMING candles do not confirm; quality gate blocks; insufficient history", () => {
    const pivots = gartleyBullishPivots().map((p, i) =>
      i === 4 ? { ...p, status: "PROVISIONAL" as const } : p,
    );
    const dets = evaluateHarmonicCandidate({
      pivots,
      orientation: "BULLISH",
      policy: MIF_POLICY_HFM_HARMONIC_PATTERNS,
      atr: 1,
      candles: [
        {
          time: T0 + 21 * STEP,
          open: 103,
          high: 104,
          low: 102,
          close: 103.5,
          isClosed: false,
          closed: false,
        },
      ],
      allowConfirmed: true,
    });
    expect(dets.find((d) => d.patternType === "GARTLEY")?.lifecycle).toBe("FORMING");

    const few = Array.from({ length: 8 }, (_, i) => candle(i, 101 + (i % 3), 99 - (i % 2)));
    const blocked = assessMifHarmonicPatterns({
      candles: few,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(blocked.status).toBe("INSUFFICIENT_DATA");
    expect(blocked.doesNotApproveAiReasoning).toBe(true);
    expect(blocked.placesOrders).toBe(false);
    expect(blocked.contractId).toBe(MIF_HARMONIC_PATTERNS_CONTRACT_ID);

    const q = assessMifHarmonicPatterns({
      candles: few,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: validQuality(few) },
      policy: { ...MIF_POLICY_HFM_HARMONIC_PATTERNS, atrPeriod: 3 } satisfies MifHarmonicPolicy,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(["INSUFFICIENT_DATA", "BLOCKED"]).toContain(q.status);
  });

  it("deterministic repeated assessments and no input mutation", () => {
    const series = Array.from({ length: 60 }, (_, i) => {
      const wave = Math.sin(i / 4) * 3;
      return candle(i, 100 + wave + 1, 100 + wave - 1, 100 + wave);
    });
    const q = validQuality(series);
    const snap = JSON.stringify(series);
    const a = assessMifHarmonicPatterns({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      policy: { ...MIF_POLICY_HFM_HARMONIC_PATTERNS, atrPeriod: 5, minBarsBetweenPivots: 1 },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifHarmonicPatterns({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      policy: { ...MIF_POLICY_HFM_HARMONIC_PATTERNS, atrPeriod: 5, minBarsBetweenPivots: 1 },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.detections.map((d) => d.detectionIdentity)).toEqual(
      b.detections.map((d) => d.detectionIdentity),
    );
    expect(JSON.stringify(series)).toBe(snap);
    expect(a.analyticalHarmonicInformationOnly).toBe(true);
  });
});
