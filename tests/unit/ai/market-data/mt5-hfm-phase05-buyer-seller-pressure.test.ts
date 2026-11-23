/**
 * Phase 05 — Buyer/Seller Pressure & Dominance Intelligence (HFM MT5).
 * FIXTURE TESTS — not live market verification.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_BUYER_SELLER_PRESSURE_CONTRACT_ID,
  MIF_EVIDENCE_FAMILY_CATALOG,
  adaptBuyerSellerPressureToEvidence,
  assessMifBuyerSellerPressure,
  assessMifDataIntegrity,
  baseCanonicalCandle,
  buildMultiTimeframePressureContext,
  candleBuyingPressureScore,
  candleSellingPressureScore,
  isManualForceConfirmForbidden,
  toSemanticLifecycleStage,
  type MifCanonicalCandle,
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
): MifCanonicalCandle {
  const openTimeSec = T0 + index * STEP;
  const o = open ?? (high + low) / 2;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
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

/** Quiet series then strong bullish tip (buyers). */
function seriesBuyers(n = 40): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n - 1; i++) {
    const base = 2000 + i * 0.05;
    out.push(candle(i, base + 0.4, base - 0.4, base + 0.05, "CLOSED", base, 80));
  }
  const tip = n - 1;
  const open = 2000 + (n - 2) * 0.05;
  out.push(candle(tip, open + 8, open - 0.2, open + 7.6, "CLOSED", open, 90));
  return out;
}

/** Quiet series then strong bearish tip. */
function seriesSellers(n = 40): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n - 1; i++) {
    const base = 2000 - i * 0.05;
    out.push(candle(i, base + 0.4, base - 0.4, base - 0.05, "CLOSED", base, 80));
  }
  const tip = n - 1;
  const open = 2000 - (n - 2) * 0.05;
  out.push(candle(tip, open + 0.2, open - 8, open - 7.6, "CLOSED", open, 90));
  return out;
}

/** Balanced dojis. */
function seriesBalanced(n = 40): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n; i++) {
    const base = 2000;
    out.push(candle(i, base + 1, base - 1, base, "CLOSED", base, 50));
  }
  return out;
}

/** High tick volume, tiny body → possible absorption. */
function seriesAbsorption(n = 40): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n - 1; i++) {
    const base = 2000 + i * 0.02;
    out.push(candle(i, base + 0.5, base - 0.5, base + 0.1, "CLOSED", base, 50));
  }
  const tip = n - 1;
  const open = 2000 + (n - 2) * 0.02;
  out.push(candle(tip, open + 0.3, open - 0.3, open + 0.05, "CLOSED", open, 400));
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

describe("Phase 05 — catalog + score semantics (fixture)", () => {
  it("registers BUYER_SELLER_PRESSURE family as AVAILABLE", () => {
    const meta = MIF_EVIDENCE_FAMILY_CATALOG.BUYER_SELLER_PRESSURE;
    expect(meta.availability).toBe("AVAILABLE");
    expect(meta.expectedSourceContractId).toBe(MIF_BUYER_SELLER_PRESSURE_CONTRACT_ID);
  });

  it("candle buying/selling scores sum to ~100 and are not probability labels", () => {
    const buy = candleBuyingPressureScore({ open: 100, high: 110, low: 99, close: 109 });
    const sell = candleSellingPressureScore({ open: 100, high: 110, low: 99, close: 109 });
    expect(buy).toBeGreaterThan(60);
    expect(sell).toBeLessThan(40);
    expect(Math.abs(buy + sell - 100)).toBeLessThan(0.2);
  });
});

describe("Phase 05 — buying/selling pressure (fixture)", () => {
  it("detects buyer dominance on strong bullish tip", () => {
    const series = seriesBuyers();
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    expect(a.providerId).toBe("HFM_MT5");
    expect(a.dominantSide).toBe("BUYERS_DOMINANT");
    expect(a.buyingPressureScore!).toBeGreaterThan(a.sellingPressureScore!);
    expect(a.isWinProbability).toBe(false);
    expect(a.isEventProbability).toBe(false);
    expect(a.isCalibratedProbability).toBe(false);
    expect(a.doesNotClaimTrueAggressorVolume).toBe(true);
    expect(a.scoreClassification).toBe("INFERRED_FROM_CANDLE_STRUCTURE");
    expect(a.aggressorSideAvailable).toBe(false);
  });

  it("detects seller dominance on strong bearish tip", () => {
    const series = seriesSellers();
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    expect(a.dominantSide).toBe("SELLERS_DOMINANT");
    expect(a.sellingPressureScore!).toBeGreaterThan(a.buyingPressureScore!);
  });

  it("returns balanced / weak evidence on dojis", () => {
    const series = seriesBalanced();
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    expect(["BALANCED", "MIXED", "INSUFFICIENT_EVIDENCE"]).toContain(a.dominantSide);
    expect(Math.abs(a.pressureImbalance ?? 99)).toBeLessThan(0.2);
  });

  it("blocks null quality and insufficient candles", () => {
    const series = seriesBuyers(5);
    const blocked = assessMifBuyerSellerPressure({
      candles: seriesBuyers(),
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: null,
    });
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.buyingPressureScore).toBeNull();

    const short = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    expect(short.status).toBe("INSUFFICIENT_DATA");
    expect(short.dominantSide).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("rejects symbol mismatch in candles", () => {
    const series = seriesBuyers().map((c, i) =>
      i === 10 ? { ...c, providerSymbol: "EURUSD" } : c,
    );
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(seriesBuyers()),
    });
    expect(a.status).toBe("BLOCKED");
    expect(a.diagnosticsSummary).toMatch(/symbol_mismatch/);
  });

  it("marks FORMING tip provisional and never invents aggressor volume", () => {
    const closed = seriesBuyers(40);
    const forming = [
      ...closed.slice(0, -1),
      { ...closed[closed.length - 1]!, candleState: "FORMING" as const },
    ];
    const a = assessMifBuyerSellerPressure({
      candles: forming,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(closed),
    });
    expect(a.provisional).toBe(true);
    expect(a.status).toBe("PROVISIONAL");
    expect(a.orderBookAvailable).toBe(false);
  });

  it("labels possible absorption as proxy when tick activity elevated with small body", () => {
    const series = seriesAbsorption();
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    expect(["POSSIBLE_ABSORPTION", "NO_ABSORPTION_SIGNAL", "INSUFFICIENT_EVIDENCE"]).toContain(
      a.absorptionAssessment,
    );
    expect(a.limitations.some((l) => /not true aggressor/i.test(l) || /INFERRED/i.test(l))).toBe(
      true,
    );
    if (a.absorptionAssessment === "POSSIBLE_ABSORPTION") {
      expect(a.tickActivityClassification).toBe("INFERRED_FROM_TICK_ACTIVITY");
    }
  });

  it("reports UNAVAILABLE absorption when tick volume missing", () => {
    const series = seriesBuyers().map((c) => ({
      ...c,
      tickVolume: null,
      volumeType: "none" as const,
    }));
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    expect(["UNAVAILABLE", "INSUFFICIENT_EVIDENCE"]).toContain(a.absorptionAssessment);
    expect(a.missingInputs).toContain("tickVolume");
  });
});

describe("Phase 05 — price-pressure + mtf (fixture)", () => {
  it("classifies aligned price and pressure", () => {
    const series = seriesBuyers();
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
      recentPriceChange: 5,
    });
    expect(["PRICE_PRESSURE_ALIGNED", "PRESSURE_WITHOUT_PRICE_PROGRESS", "MIXED_EVIDENCE"]).toContain(
      a.pricePressureRelationship,
    );
  });

  it("classifies divergence without claiming automatic reversal", () => {
    const series = seriesBuyers();
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
      recentPriceChange: -5,
    });
    expect(a.exhaustionAssessment).not.toMatch(/REVERSAL/);
    expect([
      "PRICE_PRESSURE_DIVERGENCE",
      "MIXED_EVIDENCE",
      "PRESSURE_WITHOUT_PRICE_PROGRESS",
      "PRICE_MOVEMENT_UNCONFIRMED",
    ]).toContain(a.pricePressureRelationship);
  });

  it("does not average conflicting timeframes", () => {
    // Both series use H1 bar spacing so integrity stays VALID; TF labels differ only for MTF context.
    const buy = assessMifBuyerSellerPressure({
      candles: seriesBuyers(),
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(seriesBuyers(), "H1"),
    });
    const sellBase = assessMifBuyerSellerPressure({
      candles: seriesSellers(),
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(seriesSellers(), "H1"),
    });
    expect(buy.buyingPressureScore).not.toBeNull();
    expect(sellBase.buyingPressureScore).not.toBeNull();
    expect(buy.dominantSide).toBe("BUYERS_DOMINANT");
    expect(sellBase.dominantSide).toBe("SELLERS_DOMINANT");
    const sell = { ...sellBase, timeframe: "M15" };
    const mtf = buildMultiTimeframePressureContext({
      providerSymbol: "XAUUSD",
      assessments: [buy, sell],
    });
    expect(mtf.alignment).toBe("CONFLICTING");
    expect(mtf.doesNotAverageConflictingFrames).toBe(true);
    expect(mtf.notes.some((n) => /do_not_average/.test(n))).toBe(true);
  });
});

describe("Phase 05 — evidence adapter + phase safeguards (fixture)", () => {
  it("adapts to UMEP with isWinProbability false", () => {
    const series = seriesBuyers();
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    const ev = adaptBuyerSellerPressureToEvidence(a);
    expect(ev.evidenceType).toBe("BUYER_SELLER_PRESSURE");
    expect(ev.score?.isWinProbability).toBe(false);
    expect(ev.providerId).toBe("HFM_MT5");
  });

  it("does not treat pressure as lifecycle force-confirm permission", () => {
    expect(isManualForceConfirmForbidden("CONFIRMED")).toBe(true);
    expect(toSemanticLifecycleStage("CONFIRMED")).toBe("CONFIRMED");
    const series = seriesBuyers();
    const a = assessMifBuyerSellerPressure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: withQuality(series),
    });
    expect(a.doesNotConfirmOrInvalidateLifecycleAlone).toBe(true);
    expect(a.dominantSide).toBe("BUYERS_DOMINANT");
    // Dominance alone is analytical — API/lifecycle still forbid manual CONFIRMED.
  });
});
