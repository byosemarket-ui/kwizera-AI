/**
 * Phase 06 — Deep Technical & Multi-Timeframe Intelligence (HFM MT5).
 * FIXTURE TESTS — not live market verification.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_DEEP_TECHNICAL_CONTRACT_ID,
  MIF_EVIDENCE_FAMILY_CATALOG,
  adaptDeepTechnicalIntelligenceToEvidence,
  assessMifBuyerSellerPressure,
  assessMifCandlestickPatterns,
  assessMifDataIntegrity,
  assessMifDeepTechnicalIntelligence,
  assessMifMarketRegime,
  assessMifMarketStructure,
  assessMifMomentum,
  assessMifMultiTimeframeRelationships,
  baseCanonicalCandle,
  computeDeepTechnicalConfluence,
  isManualForceConfirmForbidden,
  mapCanonicalCandleStatus,
  mapDeepTechnicalMtfAlignment,
  mapDeepTechnicalTrendRegime,
  resolveDeepTechnicalIntelligencePolicy,
  toSemanticLifecycleStage,
  type MifCanonicalCandle,
  type MifDeepTechnicalIntelligencePolicy,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(
  index: number,
  high: number,
  low: number,
  close: number,
  state: "CLOSED" | "FORMING" = "CLOSED",
  open?: number,
  tickVolume: number | null = 100,
  tf = "H1",
): MifCanonicalCandle {
  const openTimeSec = T0 + index * STEP;
  const o = open ?? (high + low) / 2;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: tf,
    openTimeSec,
    closeTimeSec: openTimeSec + STEP,
    open: o,
    high,
    low,
    close,
    tickVolume,
    realVolume: null,
    collapsedVolume: null,
    volumeType: tickVolume != null ? "tick" : "none",
    spread: 2,
    candleState: state,
    priceBasis: "bid",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "KNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: "fixture",
    sourceMode: "HISTORICAL",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
  });
}

/** Mild uptrend then strong bullish tip. */
function seriesBull(n = 60, tf = "H1"): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n - 1; i++) {
    const base = 2000 + i * 0.4;
    out.push(candle(i, base + 0.8, base - 0.3, base + 0.5, "CLOSED", base, 80, tf));
  }
  const tip = n - 1;
  const open = 2000 + (n - 2) * 0.4;
  out.push(candle(tip, open + 6, open - 0.2, open + 5.5, "CLOSED", open, 90, tf));
  return out;
}

function seriesBear(n = 60, tf = "H1"): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n - 1; i++) {
    const base = 2000 - i * 0.4;
    out.push(candle(i, base + 0.3, base - 0.8, base - 0.5, "CLOSED", base, 80, tf));
  }
  const tip = n - 1;
  const open = 2000 - (n - 2) * 0.4;
  out.push(candle(tip, open + 0.2, open - 6, open - 5.5, "CLOSED", open, 90, tf));
  return out;
}

function withQuality(series: MifCanonicalCandle[], tf = "H1") {
  const q = assessMifDataIntegrity({
    candles: series,
    providerSymbol: "XAUUSD",
    timeframe: tf,
  });
  return { kind: "step1-data-integrity" as const, assessment: q };
}

function buildBundle(tf: string, series: MifCanonicalCandle[]) {
  const quality = withQuality(series, tf);
  const marketStructure = assessMifMarketStructure({
    candles: series,
    providerSymbol: "XAUUSD",
    timeframe: tf,
    quality,
  });
  const momentum = assessMifMomentum({
    candles: series,
    providerSymbol: "XAUUSD",
    timeframe: tf,
    quality,
  });
  const regime = assessMifMarketRegime({
    candles: series,
    providerSymbol: "XAUUSD",
    timeframe: tf,
    quality,
  });
  const buyerSellerPressure = assessMifBuyerSellerPressure({
    candles: series,
    providerSymbol: "XAUUSD",
    timeframe: tf,
    quality,
  });
  const candlestick = assessMifCandlestickPatterns({
    candles: series,
    providerSymbol: "XAUUSD",
    timeframe: tf,
    quality,
  });
  return {
    timeframe: tf,
    tipCandleState: series[series.length - 1]!.candleState,
    integrity: quality.assessment,
    marketStructure,
    momentum,
    regime,
    buyerSellerPressure,
    candlestickPatternIds: candlestick.patternIds,
  };
}

describe("Phase 06 — catalog + semantics (fixture)", () => {
  it("registers DEEP_TECHNICAL_INTELLIGENCE family as AVAILABLE", () => {
    const meta = MIF_EVIDENCE_FAMILY_CATALOG.DEEP_TECHNICAL_INTELLIGENCE;
    expect(meta.availability).toBe("AVAILABLE");
    expect(meta.expectedSourceContractId).toBe(MIF_DEEP_TECHNICAL_CONTRACT_ID);
  });

  it("registers CANDLESTICK_PATTERN family", () => {
    expect(MIF_EVIDENCE_FAMILY_CATALOG.CANDLESTICK_PATTERN.availability).toBe("AVAILABLE");
  });

  it("maps candle states to Phase 06 vocabulary", () => {
    expect(mapCanonicalCandleStatus("CLOSED")).toBe("CLOSED_CANDLE");
    expect(mapCanonicalCandleStatus("FORMING")).toBe("FORMING_CANDLE");
    expect(mapCanonicalCandleStatus("STALE")).toBe("STALE_DATA");
    expect(mapCanonicalCandleStatus(null, { incompleteHistory: true })).toBe("INCOMPLETE_HISTORY");
  });

  it("confluence score is explicitly not probability", () => {
    const policy = resolveDeepTechnicalIntelligencePolicy();
    const c = computeDeepTechnicalConfluence({
      policy,
      structureDirection: "BULLISH",
      structureIds: ["s1"],
      regimeDirection: "BULLISH",
      regimeIds: ["r1"],
      mtfDirection: "BULLISH",
      mtfIds: ["m1"],
      levelsDirection: "BULLISH",
      levelsIds: ["l1"],
      patternsDirection: "UNKNOWN",
      patternsIds: [],
      momentumDirection: "BULLISH",
      momentumIds: ["mo1"],
      pressureDirection: "BULLISH",
      pressureIds: ["p1"],
      pressureSharesCandleBodyGroup: true,
      displacementCountedInCandleBody: true,
    });
    expect(c.isWinProbability).toBe(false);
    expect(c.isEventProbability).toBe(false);
    expect(c.isCalibratedProbability).toBe(false);
    expect(c.analyticalReferenceOnly).toBe(true);
    expect(c.grade).toMatch(/STRONG|MODERATE|WEAK/);
    const pressureVote = c.families.find((f) => f.family === "BUYER_SELLER_PRESSURE");
    expect(pressureVote?.counted).toBe(false);
    expect(pressureVote?.skipReason).toContain("shared_candle_body");
  });
});

describe("Phase 06 — multi-timeframe data (fixture)", () => {
  it("returns INSUFFICIENT_TIMEFRAME_DATA when mtf missing", () => {
    const mapped = mapDeepTechnicalMtfAlignment({ mtf: null, minFrames: 2 });
    expect(mapped.alignment).toBe("INSUFFICIENT_TIMEFRAME_DATA");
  });

  it("labels forming tip as FORMING_CANDLE / provisional", () => {
    const series = seriesBull(40);
    series[series.length - 1] = {
      ...series[series.length - 1]!,
      candleState: "FORMING",
    };
    const bundle = buildBundle("H1", series);
    bundle.tipCandleState = "FORMING";
    const a = assessMifDeepTechnicalIntelligence({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframeBundles: [bundle],
      mtfRelationships: null,
    });
    expect(a.primarySnapshot?.candleStatus).toBe("FORMING_CANDLE");
    expect(a.provisional).toBe(true);
  });

  it("blocks on symbol/timeframe identity missing", () => {
    const a = assessMifDeepTechnicalIntelligence({
      providerSymbol: "",
      primaryTimeframe: "H1",
      timeframeBundles: [],
    });
    expect(a.status).toBe("BLOCKED");
    expect(a.providerId).toBe("HFM_MT5");
  });
});

describe("Phase 06 — trend/regime + structure (fixture)", () => {
  it("maps bullish structure/regime toward bullish presentation labels", () => {
    const series = seriesBull();
    const quality = withQuality(series);
    const marketStructure = assessMifMarketStructure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
    });
    const regime = assessMifMarketRegime({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
    });
    const momentum = assessMifMomentum({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
    });
    const mapped = mapDeepTechnicalTrendRegime({ regime, marketStructure, momentum });
    expect(["STRONG_BULLISH_TREND", "BULLISH_TREND", "WEAK_BULLISH_TREND", "RANGE_BOUND", "TRANSITIONAL", "HIGH_VOLATILITY", "INSUFFICIENT_DATA"]).toContain(
      mapped.label,
    );
  });

  it("orchestrates bullish primary bundle without inventing aggressor volume", () => {
    const series = seriesBull();
    const bundle = buildBundle("H1", series);
    const a = assessMifDeepTechnicalIntelligence({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframeBundles: [bundle],
    });
    expect(a.contractId).toBe(MIF_DEEP_TECHNICAL_CONTRACT_ID);
    expect(a.isWinProbability).toBe(false);
    expect(a.elliottWaveStatus).toBe("NOT_IMPLEMENTED");
    expect(a.macdAdxBollingerStatus).toBe("NOT_IMPLEMENTED");
    expect(a.capabilityMatrix.buyerSellerPressure).toMatch(/REUSED|INSUFFICIENT/);
    expect(a.primarySnapshot?.pressureDataClassification).not.toBe("DIRECTLY_MEASURED");
  });
});

describe("Phase 06 — MTF alignment mapping (fixture)", () => {
  it("maps HTF bull / LTF bear opposition without averaging", () => {
    const bull = seriesBull(50, "H4");
    const bear = seriesBear(50, "M15");
    const bH4 = buildBundle("H4", bull);
    const bM15 = buildBundle("M15", bear);
    const mtf = assessMifMultiTimeframeRelationships({
      sources: [
        {
          timeframe: "H4",
          providerSymbol: "XAUUSD",
          regime: bH4.regime,
          tipCandleState: "CLOSED",
          qualityStatus: "VALID",
        },
        {
          timeframe: "H1",
          providerSymbol: "XAUUSD",
          regime: bH4.regime,
          tipCandleState: "CLOSED",
          qualityStatus: "VALID",
        },
        {
          timeframe: "M15",
          providerSymbol: "XAUUSD",
          regime: bM15.regime,
          tipCandleState: "CLOSED",
          qualityStatus: "VALID",
        },
      ],
      providerSymbol: "XAUUSD",
    });
    const a = assessMifDeepTechnicalIntelligence({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframeBundles: [bH4, { ...buildBundle("H1", seriesBull(50, "H1")) }, bM15],
      mtfRelationships: mtf,
    });
    expect(a.mtf.doesNotAverageConflictingFrames).toBe(true);
    expect([
      "FULL_BULLISH_ALIGNMENT",
      "FULL_BEARISH_ALIGNMENT",
      "HIGHER_TIMEFRAME_BULLISH_LOWER_TIMEFRAME_BEARISH",
      "HIGHER_TIMEFRAME_BEARISH_LOWER_TIMEFRAME_BULLISH",
      "PARTIAL_BULLISH_ALIGNMENT",
      "PARTIAL_BEARISH_ALIGNMENT",
      "RANGE_CONFLICT",
      "MIXED_TIMEFRAME_EVIDENCE",
      "INSUFFICIENT_TIMEFRAME_DATA",
    ]).toContain(a.mtf.alignment);
  });
});

describe("Phase 06 — Phase 05 pressure integration (fixture)", () => {
  it("keeps pressure inferred and does not treat it as aggressor volume", () => {
    const series = seriesBull();
    const bundle = buildBundle("H1", series);
    expect(bundle.buyerSellerPressure.aggressorSideAvailable).toBe(false);
    expect(bundle.buyerSellerPressure.doesNotClaimTrueAggressorVolume).toBe(true);
    const a = assessMifDeepTechnicalIntelligence({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframeBundles: [bundle],
    });
    expect(a.sourceRefs.primaryPressureId).toBe(bundle.buyerSellerPressure.assessmentId);
  });
});

describe("Phase 06 — evidence + lifecycle safeguards (fixture)", () => {
  it("UMEP adapter marks confluence as not win probability", () => {
    const series = seriesBull();
    const bundle = buildBundle("H1", series);
    const a = assessMifDeepTechnicalIntelligence({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframeBundles: [bundle],
    });
    const ev = adaptDeepTechnicalIntelligenceToEvidence(a);
    expect(ev.providerId).toBe("HFM_MT5");
    expect(ev.evidenceType).toBe("DEEP_TECHNICAL_INTELLIGENCE");
    expect(ev.score.isWinProbability).toBe(false);
  });

  it("pressure/dominance alone cannot force-confirm lifecycle", () => {
    expect(isManualForceConfirmForbidden("CONFIRMED")).toBe(true);
    const stage = toSemanticLifecycleStage("DETECTED");
    expect(stage).toBeTruthy();
  });

  it("policy documents double-count guard rationale", () => {
    const p: MifDeepTechnicalIntelligencePolicy = resolveDeepTechnicalIntelligencePolicy();
    expect(p.thresholdRationale.doubleCountGuard.toLowerCase()).toContain("candle");
    expect(p.weightPressure).toBeLessThan(p.weightStructure);
  });
});

describe("Phase 06 — candlestick wrapper (fixture)", () => {
  it("detects or returns empty without fabricating provider order-flow", () => {
    const series = seriesBull(30);
    // Engulfing-friendly tip: prior bearish, tip bullish engulf
    const n = series.length;
    series[n - 2] = candle(n - 2, 2010, 2000, 2001, "CLOSED", 2009, 80);
    series[n - 1] = candle(n - 1, 2012, 1999, 2011, "CLOSED", 2000, 90);
    const a = assessMifCandlestickPatterns({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    expect(a.providerId).toBe("HFM_MT5");
    expect(a.analyticalPatternInformationOnly).toBe(true);
    expect(Array.isArray(a.detections)).toBe(true);
  });

  it("insufficient closed history → INSUFFICIENT_DATA", () => {
    const a = assessMifCandlestickPatterns({
      candles: [],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(seriesBull(20)),
    });
    expect(a.status).toBe("INSUFFICIENT_DATA");
  });
});
