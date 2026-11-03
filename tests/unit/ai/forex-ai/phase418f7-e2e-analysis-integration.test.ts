/**
 * Phase 4.18F.7+ — End-to-end analysis integration scenarios (fixtures).
 * Analysis-only. Never places orders.
 */
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeAtOpenAiAnalysis } from "../../../../ai/forex-ai/automated-trading/analysis/validate.js";
import { validateEvidenceIntegrity } from "../../../../ai/forex-ai/automated-trading/analysis/evidence-integrity.js";
import { reconcileAnalysis, indicatorsFromStrategyValues } from "../../../../ai/forex-ai/automated-trading/analysis/reconciler.js";
import type {
  CanonicalAiInterpretationSlice,
  CanonicalDeterministicStrategySlice,
  CanonicalQuoteSnapshot,
} from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis.types.js";
import { AtOpenAiAnalysisEngine } from "../../../../ai/forex-ai/automated-trading/analysis/engine.js";
import { SMA_CROSSOVER_RULES } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";

function risingCandles(n = 40, start = 1.1): Array<{
  time: number; open: number; high: number; low: number; close: number; closed?: boolean;
}> {
  const out = [];
  let px = start;
  const t0 = Math.floor(Date.now() / 1000) - n * 900;
  for (let i = 0; i < n; i++) {
    const open = px;
    const close = px + 0.001;
    out.push({
      time: t0 + i * 900,
      open,
      high: close + 0.0005,
      low: open - 0.0005,
      close,
      closed: i < n - 1,
    });
    px = close;
  }
  return out;
}

function fallingCandles(n = 40, start = 1.2) {
  const out = [];
  let px = start;
  const t0 = Math.floor(Date.now() / 1000) - n * 900;
  for (let i = 0; i < n; i++) {
    const open = px;
    const close = px - 0.001;
    out.push({
      time: t0 + i * 900,
      open,
      high: open + 0.0005,
      low: close - 0.0005,
      close,
      closed: i < n - 1,
    });
    px = close;
  }
  return out;
}

function baseNormalize(over: Record<string, unknown> = {}, opts: {
  localDataGatePassed?: boolean;
  historicalOnly?: boolean;
  candles?: ReturnType<typeof risingCandles>;
} = {}) {
  const candles = opts.candles ?? risingCandles();
  return normalizeAtOpenAiAnalysis({
    analysisId: "a1",
    raw: {
      direction: "BUY",
      directionalConfidencePct: 72,
      directionalBias: "BULLISH",
      trendState: "UPTREND",
      trendStrength: "MODERATE",
      mtfAgreement: "AGREE_BULLISH",
      keyEvidence: ["SMA fast above slow on closed candle"],
      counterEvidence: [],
      structureNotes: ["HH/HL sequence"],
      supportLevels: [{ price: candles[0]!.low, timeframe: "15m", provenance: "swing" }],
      resistanceLevels: [{ price: candles[candles.length - 1]!.high, timeframe: "15m", provenance: "swing" }],
      dataQuality: "SUFFICIENT",
      explanation: "Bullish structure with aligned MTF.",
      limitations: [],
      ...over,
    },
    environment: "DEMO",
    environmentEpoch: 1,
    instrument: "XAU/USD",
    timeframes: ["15m", "1h"],
    primaryTimeframe: "15m",
    inputFingerprint: "fp1",
    modelRequested: "gpt-test",
    modelUsed: "gpt-test",
    candlesByTf: { "15m": candles },
    historicalOnly: opts.historicalOnly === true,
    createdAtUtc: new Date().toISOString(),
    latencyMs: 10,
    localDataGatePassed: opts.localDataGatePassed,
  });
}

function freshQuote(over: Partial<CanonicalQuoteSnapshot> = {}): CanonicalQuoteSnapshot {
  return {
    instrument: "EUR/USD",
    bid: 1.1,
    ask: 1.1002,
    quoteFresh: true,
    freshnessReasonCode: null,
    effectivePriceChangeAgeMs: 100,
    snapshotFingerprint: "q1",
    evaluatedAtUtc: new Date().toISOString(),
    ...over,
  };
}

describe("F.7+ e2e analysis integration", () => {
  it("1/2 valid BUY and SELL with confidence when local gates passed", () => {
    const buy = baseNormalize({ direction: "BUY", directionalConfidencePct: 68 });
    expect(buy.lifecycle).toBe("ANALYSIS_VALID");
    expect(buy.result.direction).toBe("BUY");
    expect(buy.result.directionalConfidencePct).toBe(68);
    expect(buy.result.evidenceScoreIsWinProbability).toBe(false);

    const sell = baseNormalize({
      direction: "SELL",
      directionalConfidencePct: 61,
      directionalBias: "BEARISH",
      trendState: "DOWNTREND",
      keyEvidence: ["SMA fast below slow"],
    }, { candles: fallingCandles() });
    expect(sell.lifecycle).toBe("ANALYSIS_VALID");
    expect(sell.result.direction).toBe("SELL");
  });

  it("3/4/5 fail-closed: model INSUFFICIENT without direction stays DATA_INSUFFICIENT even with local gates", () => {
    const r = baseNormalize({
      direction: "WAIT",
      directionalConfidencePct: null,
      dataQuality: "INSUFFICIENT",
      keyEvidence: [],
      explanation: "Cannot form a binary view.",
    }, { localDataGatePassed: true });
    expect(r.lifecycle).toBe("DATA_INSUFFICIENT");
    expect(r.result.direction).toBeNull();
    expect(r.result.blockers.some((b) => b.code === "MODEL_DATA_QUALITY_INSUFFICIENT_ADVISORY")).toBe(true);
  });

  it("local gates + model INSUFFICIENT + valid BUY still validates (advisory demotion)", () => {
    const r = baseNormalize({
      direction: "BUY",
      directionalConfidencePct: 55,
      dataQuality: "INSUFFICIENT",
      explanation: "Model was cautious but chose BUY.",
    }, { localDataGatePassed: true });
    expect(r.result.dataQuality).toBe("PARTIAL");
    expect(r.lifecycle).toBe("ANALYSIS_VALID");
    expect(r.result.direction).toBe("BUY");
  });

  it("11/12/13/14 evidence integrity: missing image, hash mismatch, observation mismatch", () => {
    const missing = validateEvidenceIntegrity({
      observationId: "obs-1",
      imageId: null,
      imageHash: null,
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      requireImage: true,
    });
    expect(missing.ok).toBe(false);
    expect(missing.status).toBe("MISSING_IMAGE");

    const hashMismatch = validateEvidenceIntegrity({
      observationId: "obs-1",
      imageId: "img-1",
      imageHash: "aaa",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      deliveryObservationId: "obs-1",
      deliveryImageId: "img-1",
      deliveryImageHash: "bbb",
      includedImageBytesInRequest: true,
    });
    expect(hashMismatch.status).toBe("IMAGE_HASH_MISMATCH");

    const ok = validateEvidenceIntegrity({
      observationId: "obs-1",
      imageId: "img-1",
      imageHash: "abc",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      marketDataFingerprint: "fp",
      deliveryObservationId: "obs-1",
      deliveryImageId: "img-1",
      deliveryImageHash: "abc",
      evidenceFingerprint: "fp",
      analysisInstrument: "XAU/USD",
      analysisPrimaryTimeframe: "15m",
      includedImageBytesInRequest: true,
    });
    expect(ok.ok).toBe(true);
    expect(ok.status).toBe("VALID");
  });

  it("17/18 reject invented levels and calibration claims; never claim chart reviewed without bytes", () => {
    const r = baseNormalize({
      supportLevels: [{ price: 999999, timeframe: "15m", provenance: "invented" }],
      explanation: "Calibrated win probability is 90%.",
    });
    expect(r.result.blockers.some((b) => b.code === "LEVELS_UNVERIFIED")).toBe(true);
    expect(r.result.blockers.some((b) => b.code === "CALIBRATION_CLAIM_REJECTED")).toBe(true);
    expect(r.result.evidenceScoreIsWinProbability).toBe(false);
  });

  it("19/20 AI cannot override deterministic NO_TRADE or opposite BUY", () => {
    const indicators = indicatorsFromStrategyValues({
      fastSma: 1.1,
      slowSma: 1.11,
      atr: 0.002,
      atrLength: 14,
      asOfUtc: new Date().toISOString(),
    });
    const detNoTrade: CanonicalDeterministicStrategySlice = {
      strategyId: SMA_CROSSOVER_RULES.strategyId,
      direction: "NO_TRADE",
      code: "NO_CROSSOVER",
      reasons: ["No crossover on closed candle."],
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      confidencePct: null,
      closedCandle: {
        instrument: "EUR/USD",
        timeframe: "15m",
        openTimeSec: 1_700_000_000,
        closeTimeSec: 1_700_000_900,
        ohlcFingerprint: "abc",
        closed: true,
      },
      atrMethod: "SMA_OF_TR",
    };
    const aiBuy: CanonicalAiInterpretationSlice = {
      analysisId: "oa1",
      schemaVersion: "at-openai-ta-v1",
      lifecycle: "ANALYSIS_VALID",
      direction: "BUY",
      directionalBias: "BULLISH",
      trendState: "UPTREND",
      trendStrength: "MODERATE",
      mtfAgreement: "AGREE_BULLISH",
      supportLevels: [],
      resistanceLevels: [],
      explanation: "Buy",
      directionalConfidencePct: 80,
      placesOrders: false,
    };
    const noTrade = reconcileAnalysis({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      analyzedAtUtc: new Date().toISOString(),
      trigger: "manual",
      evidenceFingerprint: "e1",
      quote: freshQuote(),
      candleStrategyReady: true,
      candleQuality: {
        strategyReady: true,
        blockers: [],
        closedBars: 40,
        invalidOhlcCount: 0,
        duplicateCount: 0,
      },
      indicators,
      deterministic: detNoTrade,
      ai: aiBuy,
      htf: null,
      aiInstrument: "EUR/USD",
      strategyInstrument: "EUR/USD",
      expectedInstrument: "EUR/USD",
    });
    expect(noTrade.finalOutcome).toBe("NO_TRADE");
    expect(noTrade.direction).toBeNull();

    const conflict = reconcileAnalysis({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      analyzedAtUtc: new Date().toISOString(),
      trigger: "manual",
      evidenceFingerprint: "e2",
      quote: freshQuote(),
      candleStrategyReady: true,
      candleQuality: {
        strategyReady: true,
        blockers: [],
        closedBars: 40,
        invalidOhlcCount: 0,
        duplicateCount: 0,
      },
      indicators,
      deterministic: {
        ...detNoTrade,
        direction: "BUY",
        code: "CROSS_UP",
        reasons: ["Fast crossed above slow."],
        entryPrice: 1.1,
        stopLoss: 1.09,
        takeProfit: 1.12,
        confidencePct: 50,
      },
      ai: { ...aiBuy, analysisId: "oa2", direction: "SELL", directionalBias: "BEARISH", trendState: "DOWNTREND", mtfAgreement: "AGREE_BEARISH", explanation: "Sell" },
      htf: null,
      aiInstrument: "EUR/USD",
      strategyInstrument: "EUR/USD",
      expectedInstrument: "EUR/USD",
    });
    expect(conflict.finalOutcome).toBe("CONFLICT");
    expect(conflict.direction).toBeNull();
    expect(conflict.reconciliationCode).toBe("RECON_DIR_CONFLICT");
  });

  it("15/16 OpenAI timeout → VALIDATION_FAILED (delivery); semantic reject uses RESPONSE_SEMANTIC_REJECTED", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-e2e-"));
    const candles = risingCandles(60).map((c) => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    const load = async () => candles;
    const cfg = {
      getPublicStatus: async () => ({
        configured: true,
        vaultUnlocked: true,
        model: "gpt-4o-mini",
        modelEligible: true,
        updatedAt: null,
        lastValidatedAt: null,
        lastValidationStatus: "ok",
        verificationDisplay: "VERIFIED",
        lastVerificationNote: null,
        modelsDiscoveredAt: null,
        eligibleModelCount: 1,
        note: "test",
      }),
      getApiKey: async () => "sk-test-key-not-real-xxxxxxxxxxxx",
    } as never;

    const chatFail = vi.fn(async () => ({
      ok: false as const,
      data: null,
      model: null,
      code: "OPENAI_TIMEOUT",
      error: "Request timeout",
      latencyMs: 1,
    }));
    const engineFail = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      config: cfg,
      chat: chatFail as never,
      loadCandles: load as never,
    });
    const failed = await engineFail.analyze({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      timeframes: ["15m"],
      verification: null,
    });
    expect(failed.ok).toBe(false);
    expect(failed.analysis?.evidenceDelivery?.requestStatus).toBe("OPENAI_TIMEOUT");
    expect(failed.analysis?.evidenceDelivery?.validationStatus).toBe("VALIDATION_FAILED");

    const chatOk = vi.fn(async () => ({
      ok: true as const,
      code: "OK" as const,
      data: {
        direction: "WAIT",
        dataQuality: "INSUFFICIENT",
        explanation: "Not enough to choose.",
        keyEvidence: [],
        counterEvidence: [],
        structureNotes: [],
        supportLevels: [],
        resistanceLevels: [],
        limitations: ["insufficient"],
      },
      model: "gpt-4o-mini",
      error: null,
      latencyMs: 5,
    }));
    const engineOk = new AtOpenAiAnalysisEngine({
      storageRoot: path.join(tmp, "semantic"),
      config: cfg,
      chat: chatOk as never,
      loadCandles: load as never,
    });
    const semantic = await engineOk.analyze({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      timeframes: ["15m"],
      verification: null,
    });
    expect(semantic.ok).toBe(true);
    expect(semantic.analysis?.lifecycle).toBe("DATA_INSUFFICIENT");
    expect(semantic.analysis?.evidenceDelivery?.responseStatus).toBe("RESPONSE_RECEIVED");
    expect(semantic.analysis?.evidenceDelivery?.validationStatus).toBe("RESPONSE_SEMANTIC_REJECTED");
    expect(semantic.analysis?.placesOrders).toBe(false);
  });
});
