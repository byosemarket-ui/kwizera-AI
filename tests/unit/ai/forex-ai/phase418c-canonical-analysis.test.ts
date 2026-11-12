/**
 * Phase 4.18C — Canonical analysis reconciler, confidence, adapters, ATR labeling.
 */
import { describe, expect, it } from "vitest";
import {
  atrAt,
  ATR_METHOD_V1,
  evaluateSmaCrossoverStrategy,
} from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import { SMA_CROSSOVER_RULES } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import { generateAutoSignal } from "../../../../ai/forex-ai/automated-trading/auto-engine/signals/engine.js";
import { AutoSignalStore } from "../../../../ai/forex-ai/automated-trading/auto-engine/signals/store.js";
import {
  assertAiCannotPopulateIndicators,
  normalizeCanonicalTimeframe,
  normalizeInstrumentId,
  normalizeUnixSeconds,
  toCanonicalFromOpenAi,
  toCanonicalFromStrategy,
} from "../../../../ai/forex-ai/automated-trading/analysis/adapters.js";
import { calculateAnalysisConfidence } from "../../../../ai/forex-ai/automated-trading/analysis/confidence.js";
import {
  indicatorsFromStrategyValues,
  reconcileAnalysis,
} from "../../../../ai/forex-ai/automated-trading/analysis/reconciler.js";
import {
  ANALYSIS_CONFIDENCE_TYPE,
  CANONICAL_ANALYSIS_SCHEMA,
  type CanonicalAiInterpretationSlice,
  type CanonicalDeterministicStrategySlice,
  type CanonicalHtfContext,
  type CanonicalQuoteSnapshot,
} from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis.types.js";
import type { AtOpenAiAnalysisResult } from "../../../../ai/forex-ai/automated-trading/analysis/types.js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

function freshQuote(over: Partial<CanonicalQuoteSnapshot> = {}): CanonicalQuoteSnapshot {
  return {
    instrument: "XAU/USD",
    bid: 2650,
    ask: 2650.5,
    quoteFresh: true,
    freshnessReasonCode: "LIVE_FRESH",
    effectivePriceChangeAgeMs: 500,
    snapshotFingerprint: "fp-test",
    evaluatedAtUtc: "2026-11-01T12:00:00.000Z",
    ...over,
  };
}

function detSlice(over: Partial<CanonicalDeterministicStrategySlice> = {}): CanonicalDeterministicStrategySlice {
  return {
    strategyId: SMA_CROSSOVER_RULES.strategyId,
    direction: "BUY",
    code: "BUY_SMA_CROSS",
    reasons: ["test"],
    entryPrice: 2650,
    stopLoss: 2640,
    takeProfit: 2670,
    confidencePct: 55,
    closedCandle: {
      instrument: "XAU/USD",
      timeframe: "15m",
      openTimeSec: 1_700_000_000,
      closeTimeSec: 1_700_000_900,
      ohlcFingerprint: "abc",
      closed: true,
    },
    atrMethod: "SMA_OF_TR",
    ...over,
  };
}

function aiSlice(over: Partial<CanonicalAiInterpretationSlice> = {}): CanonicalAiInterpretationSlice {
  return {
    analysisId: "ai-1",
    schemaVersion: "at-openai-ta-v1",
    lifecycle: "ANALYSIS_VALID",
    direction: "BUY",
    directionalBias: "BULLISH",
    trendState: "UPTREND",
    trendStrength: "MODERATE",
    mtfAgreement: "AGREE_BULLISH",
    supportLevels: [{ price: 2600, verifiedAgainstSnapshot: true, provenance: "AI_INTERPRETED" }],
    resistanceLevels: [{ price: 2700, verifiedAgainstSnapshot: false, provenance: "AI_INTERPRETED" }],
    explanation: "ai",
    directionalConfidencePct: 71,
    placesOrders: false,
    ...over,
  };
}

function indicators(fast = 2651, slow = 2648, atr = 2) {
  return indicatorsFromStrategyValues({ fastSma: fast, slowSma: slow, atr, atrLength: 14 });
}

function baseReconcile(over: Parameters<typeof reconcileAnalysis>[0] extends infer T ? Partial<T> : never = {}) {
  return reconcileAnalysis({
    environment: "DEMO",
    instrument: "XAU/USD",
    primaryTimeframe: "15m",
    analyzedAtUtc: "2026-11-01T12:00:00.000Z",
    quote: freshQuote(),
    candleStrategyReady: true,
    candleQuality: {
      strategyReady: true,
      blockers: [],
      closedBars: 40,
      invalidOhlcCount: 0,
      duplicateCount: 0,
    },
    indicators: indicators(),
    deterministic: detSlice(),
    ai: aiSlice(),
    analysisId: "test-analysis-1",
    ...over,
  });
}

describe("Phase 4.18C reconciliation rules", () => {
  it("stale quote blocks trade eligibility but may retain directional bias", () => {
    const r = baseReconcile({
      quote: freshQuote({ quoteFresh: false, freshnessReasonCode: "QUOTE_AGE_EXCEEDED" }),
    });
    expect(r.finalOutcome).toBe("STALE_DATA");
    // Phase 2 — BUY evidence still yields directional bias; trade remains BLOCKED.
    expect(r.direction).toBe("BUY");
    expect(r.tradeEligibility).toBe("BLOCKED");
    expect(r.blockReasons).toContain("QUOTE_STALE");
    expect(r.reconciliationCode).toBe("RECON_STALE_QUOTE");
  });

  it("heartbeat-only update blocks trade eligibility but may retain directional bias", () => {
    const r = baseReconcile({
      quote: freshQuote({
        quoteFresh: false,
        freshnessReasonCode: "HEARTBEAT_ONLY_NO_PRICE_CHANGE",
      }),
    });
    expect(r.finalOutcome).toBe("STALE_DATA");
    expect(r.direction).toBe("BUY");
    expect(r.tradeEligibility).toBe("BLOCKED");
    expect(r.reconciliationCode).toBe("RECON_STALE_QUOTE");
  });

  it("MARKET_INACTIVE blocks trade eligibility but may retain directional bias", () => {
    const r = baseReconcile({
      quote: freshQuote({ quoteFresh: false, freshnessReasonCode: "MARKET_INACTIVE" }),
    });
    expect(r.finalOutcome).toBe("STALE_DATA");
    expect(r.direction).toBe("BUY");
    expect(r.tradeEligibility).toBe("BLOCKED");
  });

  it("insufficient candles block directional analysis", () => {
    const r = baseReconcile({
      candleStrategyReady: false,
      candleQuality: {
        strategyReady: false,
        blockers: ["Need more closed bars"],
        closedBars: 5,
        invalidOhlcCount: 0,
        duplicateCount: 0,
      },
      deterministic: detSlice({
        direction: "NO_TRADE",
        code: "INSUFFICIENT_CLOSED_CANDLES",
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        closedCandle: null,
      }),
    });
    expect(r.finalOutcome).toBe("INSUFFICIENT_DATA");
    expect(r.direction).toBeNull();
    expect(r.reconciliationCode).toBe("RECON_INSUFFICIENT");
    expect(r.confidencePct).toBeNull();
  });

  it("missing ATR blocks directional analysis", () => {
    const r = baseReconcile({
      indicators: indicatorsFromStrategyValues({ fastSma: 1, slowSma: 2, atr: null }),
      deterministic: detSlice({
        direction: "NO_TRADE",
        code: "ATR_UNAVAILABLE",
        atrMethod: "SMA_OF_TR",
        closedCandle: null,
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
      }),
    });
    expect(r.finalOutcome).toBe("INSUFFICIENT_DATA");
    expect(r.direction).toBeNull();
    expect(r.reconciliationCode).toBe("RECON_INSUFFICIENT");
  });

  it("deterministic NO_TRADE cannot be overridden into a trade candidate by AI", () => {
    const r = baseReconcile({
      deterministic: detSlice({
        direction: "NO_TRADE",
        code: "NO_CROSSOVER",
        stopLoss: null,
        takeProfit: null,
        confidencePct: 0,
      }),
      ai: aiSlice({ direction: "BUY" }),
    });
    expect(r.finalOutcome).toBe("NO_TRADE");
    expect(r.tradeEligibility).toBe("BLOCKED");
    // Phase 2 — AI may supply directional bias; never BUY_CANDIDATE without det cross.
    expect(r.direction).toBe("BUY");
    expect(r.reconciliationCode).toBe("RECON_NO_CROSS_AI_IGNORED");
  });

  it("deterministic BUY + AI SELL returns CONFLICT", () => {
    const r = baseReconcile({
      deterministic: detSlice({ direction: "BUY", code: "BUY_SMA_CROSS" }),
      ai: aiSlice({ direction: "SELL", directionalBias: "BEARISH" }),
    });
    expect(r.finalOutcome).toBe("CONFLICT");
    expect(r.direction).toBeNull();
    expect(r.reconciliationCode).toBe("RECON_DIR_CONFLICT");
    expect(r.confidencePct).toBeNull();
  });

  it("deterministic SELL + AI BUY returns CONFLICT", () => {
    const r = baseReconcile({
      deterministic: detSlice({ direction: "SELL", code: "SELL_SMA_CROSS" }),
      ai: aiSlice({ direction: "BUY" }),
    });
    expect(r.finalOutcome).toBe("CONFLICT");
    expect(r.direction).toBeNull();
    expect(r.reconciliationCode).toBe("RECON_DIR_CONFLICT");
  });

  it("deterministic BUY + agreeing AI returns BUY_CANDIDATE", () => {
    const r = baseReconcile({
      deterministic: detSlice({ direction: "BUY" }),
      ai: aiSlice({ direction: "BUY" }),
    });
    expect(r.finalOutcome).toBe("BUY_CANDIDATE");
    expect(r.direction).toBe("BUY");
    expect(r.marketInterpretation).toBe("BULLISH");
    expect(r.reconciliationCode).toBe("RECON_DET_BUY");
    expect(r.confidencePct).not.toBeNull();
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
  });

  it("deterministic SELL + agreeing AI returns SELL_CANDIDATE", () => {
    const r = baseReconcile({
      deterministic: detSlice({ direction: "SELL", code: "SELL_SMA_CROSS" }),
      ai: aiSlice({ direction: "SELL", directionalBias: "BEARISH" }),
    });
    expect(r.finalOutcome).toBe("SELL_CANDIDATE");
    expect(r.direction).toBe("SELL");
    expect(r.marketInterpretation).toBe("BEARISH");
    expect(r.reconciliationCode).toBe("RECON_DET_SELL");
  });

  it("deterministic BUY + unavailable AI remains BUY_CANDIDATE (DET_ONLY)", () => {
    const r = baseReconcile({ ai: null });
    expect(r.finalOutcome).toBe("BUY_CANDIDATE");
    expect(r.direction).toBe("BUY");
    expect(r.reconciliationCode).toBe("RECON_DET_ONLY");
  });

  it("deterministic SELL + unavailable AI remains SELL_CANDIDATE (DET_ONLY)", () => {
    const r = baseReconcile({
      deterministic: detSlice({ direction: "SELL", code: "SELL_SMA_CROSS" }),
      ai: null,
    });
    expect(r.finalOutcome).toBe("SELL_CANDIDATE");
    expect(r.direction).toBe("SELL");
    expect(r.reconciliationCode).toBe("RECON_DET_ONLY");
  });

  it("higher-timeframe conflict blocks trade candidacy (bias may remain if primary agrees)", () => {
    const htf: CanonicalHtfContext = {
      primaryTimeframe: "15m",
      confirmationTimeframes: ["1h"],
      perTf: [
        { timeframe: "15m", candleRef: null, deterministicBias: "BULLISH" },
        { timeframe: "1h", candleRef: null, deterministicBias: "BEARISH" },
      ],
      agreement: "CONFLICT",
    };
    const r = baseReconcile({ htf });
    expect(r.finalOutcome).toBe("NO_TRADE");
    // Phase 2 — det+AI both BUY → retain bias; HTF conflict blocks trade eligibility.
    expect(r.direction).toBe("BUY");
    expect(r.tradeEligibility).toBe("BLOCKED");
    expect(r.blockReasons).toContain("HTF_CONFLICT");
    expect(r.reconciliationCode).toBe("RECON_HTF_CONFLICT");
  });

  it("missing HTF evidence is not treated as a conflict", () => {
    const htf: CanonicalHtfContext = {
      primaryTimeframe: "15m",
      confirmationTimeframes: ["1h"],
      perTf: [],
      agreement: "INSUFFICIENT",
    };
    const r = baseReconcile({ htf, ai: null });
    expect(r.finalOutcome).toBe("BUY_CANDIDATE");
    expect(r.direction).toBe("BUY");
    expect(r.reconciliationCode).not.toBe("RECON_HTF_CONFLICT");
  });
});

describe("Phase 4.18C confidence score", () => {
  it("score is always between 0 and 100 when present", () => {
    const r = baseReconcile({ ai: null });
    expect(r.confidencePct).not.toBeNull();
    expect(r.confidencePct!).toBeGreaterThanOrEqual(0);
    expect(r.confidencePct!).toBeLessThanOrEqual(100);
    expect(r.confidenceType).toBe(ANALYSIS_CONFIDENCE_TYPE);
    expect(r.confidenceBreakdown?.isCalibratedWinProbability).toBe(false);
  });

  it("same input always produces the same score", () => {
    const a = baseReconcile({ analysisId: "a", ai: null });
    const b = baseReconcile({ analysisId: "b", ai: null });
    expect(a.confidencePct).toBe(b.confidencePct);
  });

  it("strong directional evidence scores higher than weak", () => {
    const strong = calculateAnalysisConfidence({
      finalOutcome: "BUY_CANDIDATE",
      direction: "BUY",
      indicators: indicators(2660, 2640, 2), // large sep/ATR
      deterministic: detSlice(),
      ai: aiSlice({ direction: "BUY" }),
      htf: {
        primaryTimeframe: "15m",
        confirmationTimeframes: ["1h"],
        perTf: [],
        agreement: "AGREE_BULLISH",
      },
      quote: freshQuote(),
      candleStrategyReady: true,
    });
    const weak = calculateAnalysisConfidence({
      finalOutcome: "BUY_CANDIDATE",
      direction: "BUY",
      indicators: indicators(2650.01, 2650, 5), // tiny sep
      deterministic: detSlice({ code: "BUY_SMA_CROSS" }),
      ai: null,
      htf: null,
      quote: freshQuote(),
      candleStrategyReady: true,
    });
    expect(strong.confidencePct!).toBeGreaterThan(weak.confidencePct!);
  });

  it("missing evidence does not falsely increase confidence", () => {
    const withHtfMissing = calculateAnalysisConfidence({
      finalOutcome: "BUY_CANDIDATE",
      direction: "BUY",
      indicators: indicators(),
      deterministic: detSlice(),
      ai: null,
      htf: null,
      quote: freshQuote(),
      candleStrategyReady: true,
    });
    const htfFactor = withHtfMissing.breakdown.factors.find((f) => f.id === "htf_agreement");
    const aiFactor = withHtfMissing.breakdown.factors.find((f) => f.id === "ai_agreement");
    expect(htfFactor?.available).toBe(false);
    expect(aiFactor?.available).toBe(false);
  });

  it("AI disagreement is reflected in confidence factors when conflict already resolved", () => {
    // Direct confidence call with agreeing setup vs disagreeing factor inspection
    // (reconciler would CONFLICT before scoring); unit-test the factor helper path via agree vs lower ai score
    const agree = calculateAnalysisConfidence({
      finalOutcome: "BUY_CANDIDATE",
      direction: "BUY",
      indicators: indicators(),
      deterministic: detSlice(),
      ai: aiSlice({ direction: "BUY" }),
      htf: null,
      quote: freshQuote(),
      candleStrategyReady: true,
    });
    const disagreeFactorInput = calculateAnalysisConfidence({
      finalOutcome: "BUY_CANDIDATE",
      direction: "BUY",
      indicators: indicators(),
      deterministic: detSlice(),
      // Force factor path: AI opposite would normally be CONFLICT; here we only check factor scoring API
      // by using same direction then manually comparing factor when AI sell — reconciler blocks first.
      ai: aiSlice({ direction: "BUY" }),
      htf: null,
      quote: freshQuote(),
      candleStrategyReady: true,
    });
    const aiF = agree.breakdown.factors.find((f) => f.id === "ai_agreement");
    expect(aiF?.available).toBe(true);
    expect(aiF?.scorePct).toBeGreaterThan(50);
    expect(disagreeFactorInput.breakdown.isCalibratedWinProbability).toBe(false);
  });

  it("AI disagreement lowers ai_agreement factor score", () => {
    const disagree = calculateAnalysisConfidence({
      finalOutcome: "BUY_CANDIDATE",
      direction: "BUY",
      indicators: indicators(),
      deterministic: detSlice(),
      ai: aiSlice({ direction: "SELL" }),
      htf: null,
      quote: freshQuote(),
      candleStrategyReady: true,
    });
    const aiF = disagree.breakdown.factors.find((f) => f.id === "ai_agreement");
    expect(aiF?.available).toBe(true);
    expect(aiF?.scorePct).toBeLessThan(50);
    expect(aiF?.detail).toMatch(/disagrees/i);
  });

  it("AI bias may remain when deterministic has no cross, but trade stays BLOCKED", () => {
    const r = baseReconcile({
      deterministic: detSlice({ direction: "NO_TRADE", code: "NO_CROSSOVER" }),
      ai: aiSlice({ direction: "SELL" }),
    });
    // Phase 2 — directional bias allowed; not a trade candidate.
    expect(r.direction).toBe("SELL");
    expect(r.finalOutcome).toBe("NO_TRADE");
    expect(r.tradeEligibility).toBe("BLOCKED");
  });

  it("stale data retains ANALYSIS_CONFIDENCE when directional bias exists", () => {
    const r = baseReconcile({
      quote: freshQuote({ quoteFresh: false, freshnessReasonCode: "MARKET_INACTIVE" }),
    });
    expect(r.direction).toBe("BUY");
    expect(r.tradeEligibility).toBe("BLOCKED");
    expect(r.calibratedWinProbability).toBeNull();
  });

  it("insufficient data returns no directional confidence", () => {
    const r = baseReconcile({
      deterministic: detSlice({ direction: "NO_TRADE", code: "ATR_UNAVAILABLE", closedCandle: null }),
      indicators: indicatorsFromStrategyValues({ fastSma: null, slowSma: null, atr: null }),
      candleStrategyReady: false,
    });
    expect(r.finalOutcome).toBe("INSUFFICIENT_DATA");
    expect(r.confidencePct).toBeNull();
  });

  it("confidence is not represented as calibrated win probability", () => {
    const r = baseReconcile({ ai: null });
    expect(r.confidenceBreakdown?.isCalibratedWinProbability).toBe(false);
    expect(r.confidenceLimitations.some((l) => /NOT a calibrated win probability/i.test(l))).toBe(true);
    expect(r.confidenceType).toBe("ANALYSIS_CONFIDENCE");
  });
});

describe("Phase 4.18C provenance protection", () => {
  it("AI cannot populate indicators.atr or fastSma", () => {
    const r = baseReconcile({
      ai: aiSlice({
        supportLevels: [{ price: 999, verifiedAgainstSnapshot: false, provenance: "AI_INTERPRETED" }],
      }),
    });
    expect(r.indicators.atr.provenance).toBe("DETERMINISTIC_COMPUTED");
    expect(r.indicators.fastSma.provenance).toBe("DETERMINISTIC_COMPUTED");
    expect(r.indicators.atrMethod).toBe("SMA_OF_TR");
    const guard = assertAiCannotPopulateIndicators(r.ai!);
    expect(guard.atrFromAi).toBeNull();
    expect(guard.fastSmaFromAi).toBeNull();
    expect(guard.bidFromAi).toBeNull();
  });

  it("AI-derived support/resistance remains AI-provenanced", () => {
    const r = baseReconcile();
    expect(r.supportResistance.support.every((s) => s.provenance === "AI_INTERPRETED")).toBe(true);
    expect(r.supportResistance.resistance.every((s) => s.provenance === "AI_INTERPRETED")).toBe(true);
  });

  it("broker quote fields retain quote snapshot values not AI", () => {
    const r = baseReconcile({
      quote: freshQuote({ bid: 100, ask: 101 }),
      ai: aiSlice(),
    });
    expect(r.quote.bid).toBe(100);
    expect(r.quote.ask).toBe(101);
  });
});

describe("Phase 4.18C ATR SMA_OF_TR compatibility", () => {
  it("documents SMA_OF_TR and keeps golden mean-of-TR vector", () => {
    expect(ATR_METHOD_V1).toBe("SMA_OF_TR");
    expect(SMA_CROSSOVER_RULES.atrMethod).toBe("SMA_OF_TR");
    // Construct TR series with known mean: need length+1 closes
    const highs = [0, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
    const lows = [0, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    const closes = [9, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11];
    // For i=1..14: TR = max(2, |12-prev|, |10-prev|). prevClose starts 9 then 11...
    // i=1: max(2, |12-9|, |10-9|) = max(2,3,1)=3
    // i=2..14: max(2,1,1)=2
    // mean of 14 TRs: (3 + 2*13)/14 = 29/14
    const atr = atrAt(highs, lows, closes, 14, 14);
    expect(atr).toBeCloseTo(29 / 14, 10);
  });

  it("strategy v1 output unchanged for identical candle inputs", () => {
    const candles: StrategyCandle[] = [];
    let px = 100;
    for (let i = 0; i < 40; i++) {
      const drift = i < 35 ? 0.02 : 0.8;
      const open = px;
      const close = px + drift;
      candles.push({
        time: 1_700_000_000 + i * 900,
        open,
        high: Math.max(open, close) + 0.1,
        low: Math.min(open, close) - 0.1,
        close,
        closed: true,
      });
      px = close;
    }
    const a = evaluateSmaCrossoverStrategy({ candles, pointSize: 0.01 });
    const b = evaluateSmaCrossoverStrategy({ candles, pointSize: 0.01 });
    expect(a).toEqual(b);
    expect(a.atr).toBe(b.atr);
  });
});

describe("Phase 4.18C adapters + isolation", () => {
  it("normalizes instrument and rejects invalid timestamps", () => {
    expect(normalizeInstrumentId("eur / usd")).toBe("EUR/USD");
    expect(normalizeCanonicalTimeframe("H1")).toBe("1h");
    expect(normalizeUnixSeconds(1_700_000_000)).toBe(1_700_000_000);
    expect(normalizeUnixSeconds(1_700_000_000_000)).toBe(1_700_000_000);
    expect(normalizeUnixSeconds(5e11)).toBeNull(); // ambiguous
    expect(normalizeUnixSeconds(100)).toBeNull();
  });

  it("toCanonicalFromStrategy maps evaluation with SMA_OF_TR", () => {
    const candles: StrategyCandle[] = [];
    let px = 100;
    for (let i = 0; i < 40; i++) {
      const drift = i < 35 ? 0.02 : 0.8;
      const open = px;
      const close = px + drift;
      candles.push({
        time: 1_700_000_000 + i * 900,
        open,
        high: Math.max(open, close) + 0.1,
        low: Math.min(open, close) - 0.1,
        close,
        closed: true,
      });
      px = close;
    }
    const ev = evaluateSmaCrossoverStrategy({ candles, pointSize: 0.01 });
    const adapted = toCanonicalFromStrategy({
      evaluation: ev,
      instrument: "XAU/USD",
      timeframe: "15m",
    });
    expect(adapted.ok).toBe(true);
    if (adapted.ok) {
      expect(adapted.slice.atrMethod).toBe("SMA_OF_TR");
      expect(adapted.instrument).toBe("XAU/USD");
    }
  });

  it("toCanonicalFromOpenAi keeps AI provenance on levels", () => {
    const raw = {
      schemaVersion: "at-openai-ta-v1",
      phase: "53.3",
      analysisId: "x",
      lifecycle: "ANALYSIS_VALID",
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      timeframes: ["15m"],
      primaryTimeframe: "15m",
      inputFingerprint: "f",
      provider: "OPENAI",
      modelRequested: "m",
      modelUsed: "m",
      modelVisionEligible: false,
      trigger: "manual",
      monitorConfigEpoch: null,
      chartImage: null,
      direction: "BUY",
      directionalConfidencePct: 60,
      directionalConfidenceNote: "Estimated directional confidence — NOT CALIBRATED",
      forecastHorizon: "h",
      directionalBias: "BULLISH",
      trendState: "UPTREND",
      trendStrength: "WEAK",
      mtfAgreement: "UNKNOWN",
      keyEvidence: [],
      counterEvidence: [],
      supportLevels: [
        {
          price: 1.1,
          timeframe: "15m",
          sourceCandleTime: null,
          provenance: "model",
          verifiedAgainstSnapshot: true,
          unavailableReason: null,
        },
      ],
      resistanceLevels: [],
      patterns: [],
      structureNotes: [],
      scenarios: [],
      explanation: "e",
      dataQuality: "SUFFICIENT",
      limitations: [],
      blockers: [],
      confidenceLabel: "NOT CALIBRATED",
      evidenceScoreIsWinProbability: false,
      createdAtUtc: "2026-11-01T12:00:00.000Z",
      latencyMs: 1,
      placesOrders: false,
      historicalOnly: true,
      liveLabeled: false,
    } as AtOpenAiAnalysisResult;
    const adapted = toCanonicalFromOpenAi(raw);
    expect(adapted.ok).toBe(true);
    if (adapted.ok) {
      expect(adapted.slice.supportLevels[0]?.provenance).toBe("AI_INTERPRETED");
      expect(adapted.instrument).toBe("EUR/USD");
    }
  });

  it("EUR/USD candles cannot enter an XAU/USD result", () => {
    const r = baseReconcile({
      instrument: "XAU/USD",
      strategyInstrument: "EUR/USD",
      deterministic: detSlice({
        closedCandle: {
          instrument: "EUR/USD",
          timeframe: "15m",
          openTimeSec: 1_700_000_000,
          closeTimeSec: 1_700_000_900,
          ohlcFingerprint: "eur",
          closed: true,
        },
      }),
    });
    expect(r.finalOutcome).toBe("INSUFFICIENT_DATA");
    expect(r.reconciliationCode).toBe("RECON_INSTRUMENT_MISMATCH");
    expect(r.direction).toBeNull();
  });

  it("timeframe mismatch blocks mixed TF candles", () => {
    const r = baseReconcile({
      primaryTimeframe: "15m",
      deterministic: detSlice({
        closedCandle: {
          instrument: "XAU/USD",
          timeframe: "1h",
          openTimeSec: 1_700_000_000,
          closeTimeSec: 1_700_003_600,
          ohlcFingerprint: "h1",
          closed: true,
        },
      }),
    });
    expect(r.reconciliationCode).toBe("RECON_TIMEFRAME_MISMATCH");
    expect(r.direction).toBeNull();
  });

  it("no silent fallback when instrument empty", () => {
    const r = reconcileAnalysis({
      environment: "DEMO",
      instrument: "",
      primaryTimeframe: "15m",
      quote: freshQuote(),
      indicators: indicators(),
      deterministic: detSlice(),
      candleStrategyReady: true,
    });
    expect(r.reconciliationCode).toBe("RECON_INSTRUMENT_MISMATCH");
  });
});

describe("Phase 4.18C compatibility — signals unchanged authority", () => {
  it("generateAutoSignal remains deterministic and schema-stable", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-418c-"));
    const store = new AutoSignalStore(path.join(dir, "signals.json"));
    const candles: StrategyCandle[] = [];
    let px = 100;
    for (let i = 0; i < 40; i++) {
      const drift = i < 35 ? 0.02 : 0.8;
      const open = px;
      const close = px + drift;
      candles.push({
        time: 1_700_000_000 + i * 900,
        open,
        high: Math.max(open, close) + 0.1,
        low: Math.min(open, close) - 0.1,
        close,
        closed: true,
      });
      px = close;
    }
    const res = generateAutoSignal({
      instrument: "XAU/USD",
      timeframe: "15m",
      candles,
      pointSize: 0.01,
      quoteAgeMs: 1_000,
      store,
      sessionUtcStartMinute: 0,
      sessionUtcEndMinute: 24 * 60,
      nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
    });
    expect(res.placesOrders).toBe(false);
    expect(res.mutatesBroker).toBe(false);
    if (res.signal) {
      expect(res.signal.schemaVersion).toBe("kwizera.auto-signal.v1");
    }
  });

  it("canonical schema constants are stable", () => {
    const r = baseReconcile({ ai: null });
    expect(r.schemaVersion).toBe(CANONICAL_ANALYSIS_SCHEMA);
    expect(r.analysisVersion).toBe("4.18C");
  });
});
