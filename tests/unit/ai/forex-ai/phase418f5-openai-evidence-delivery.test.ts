/**
 * Phase 4.18F.5 — OpenAI evidence delivery, historical/live separation, serialization,
 * redacted diagnostics, timeout/unavailable, and safety invariants.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMarketEvidenceBundle,
  marketEvidenceForModelPrompt,
  MARKET_EVIDENCE_VERSION,
} from "../../../../ai/forex-ai/automated-trading/analysis/market-evidence-builder.js";
import {
  buildOpenAiEvidenceDeliveryReport,
  inspectMarketEvidencePrompt,
  OPENAI_EVIDENCE_DELIVERY_SCHEMA,
} from "../../../../ai/forex-ai/automated-trading/analysis/openai-evidence-delivery.js";
import {
  AtOpenAiAnalysisEngine,
  resetAtOpenAiAnalysisEngineForTests,
} from "../../../../ai/forex-ai/automated-trading/analysis/engine.js";
import { resetAtOpenAiAnalysisStoreForTests } from "../../../../ai/forex-ai/automated-trading/analysis/store.js";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import { SMA_CROSSOVER_RULES } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import {
  indicatorsFromStrategyValues,
  reconcileAnalysis,
} from "../../../../ai/forex-ai/automated-trading/analysis/reconciler.js";
import type {
  CanonicalAiInterpretationSlice,
  CanonicalDeterministicStrategySlice,
  CanonicalQuoteSnapshot,
} from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis.types.js";

function rising(n: number, start = 100, step = 0.4): StrategyCandle[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const t0 = nowSec - n * 900;
  const out: StrategyCandle[] = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    const open = px;
    const close = px + step;
    out.push({
      time: t0 + i * 900,
      open,
      high: Math.max(open, close) + 0.15,
      low: Math.min(open, close) - 0.15,
      close,
      closed: true,
    });
    px = close;
  }
  return out;
}

const quote = {
  instrument: "EUR/USD",
  bid: 1.085,
  ask: 1.0852,
  quoteFresh: true,
  freshnessReasonCode: "LIVE_FRESH" as const,
  effectivePriceChangeAgeMs: 400,
  evaluatedAtUtc: new Date().toISOString(),
  snapshotFingerprint: "f5-ev",
};

const liveTickMovement = {
  latest: {
    bid: 1.085,
    ask: 1.0852,
    mid: 1.0851,
    spread: 0.0002,
    receiptTimestampMs: Date.now() - 800,
    eventTimestampMs: Date.now() - 900,
    eventClass: "PRICE_CHANGE" as const,
    source: "offers" as const,
  },
  windows: [
    {
      windowId: "1m" as const,
      genuineTickCount: 12,
      direction: "UP" as const,
      netBidMovement: 0.0001,
      netAskMovement: 0.0001,
      midPriceMovement: 0.0001,
      percentageMovement: 0.01,
      currentSpread: 0.0002,
      averageSpread: 0.0002,
      freshness: "FRESH" as const,
      status: "OK" as const,
      coverage: "FULL" as const,
      firstReceiptTimestampMs: Date.now() - 50_000,
      latestReceiptTimestampMs: Date.now() - 800,
    },
    {
      windowId: "5m" as const,
      genuineTickCount: 40,
      direction: "UP" as const,
      netBidMovement: 0.0004,
      netAskMovement: 0.0004,
      midPriceMovement: 0.0004,
      percentageMovement: 0.04,
      currentSpread: 0.0002,
      averageSpread: 0.00021,
      freshness: "FRESH" as const,
      status: "OK" as const,
      coverage: "FULL" as const,
      firstReceiptTimestampMs: Date.now() - 280_000,
      latestReceiptTimestampMs: Date.now() - 800,
    },
  ],
  counters: {
    accepted: 40,
    filtered: 2,
    persisted: 40,
    duplicates: 1,
    lastAcceptedAtMs: Date.now() - 800,
  },
};

describe("F.5 historical/live separation", () => {
  it("keeps closed candles and genuine tick windows distinct in the prompt", () => {
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf: {
        "5m": rising(80),
        "15m": rising(80),
        "30m": rising(80),
        "1h": rising(80),
        "4h": rising(60),
        "1d": rising(40),
      },
      quote,
      liveTickMovement,
    });
    expect(bundle.evidenceVersion).toBe(MARKET_EVIDENCE_VERSION);
    expect(MARKET_EVIDENCE_VERSION).toBe("4.18F.5");
    expect(bundle.historical.primary?.movement).toBeTruthy();
    expect(bundle.liveTickMovement.windows.length).toBeGreaterThan(0);
    expect(bundle.liveTickMovement.latestTick.value?.bid).toBe(1.085);

    const prompt = marketEvidenceForModelPrompt(bundle);
    expect(prompt.liveQuote).toBeTruthy();
    expect(prompt.liveTickMovement).toBeTruthy();
    expect(prompt.primary).toBeTruthy();
    expect((prompt.liveTickMovement as { windows: unknown[] }).windows.length).toBeGreaterThan(0);
    expect((prompt.openaiEvidenceDelivery as { historicalLiveSeparated: boolean }).historicalLiveSeparated).toBe(true);
    expect((prompt.openaiEvidenceDelivery as { liveTickMovementIncluded: boolean }).liveTickMovementIncluded).toBe(true);
    expect(prompt.placesOrders).toBe(false);
    expect(prompt.acceptsForExecution).toBe(false);
    expect(prompt.mutatesBroker).toBe(false);
  });

  it("represents missing live ticks without fabricating prices", () => {
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": rising(60), "1h": rising(60) },
      quote: { ...quote, quoteFresh: false, freshnessReasonCode: "QUOTE_AGE_EXCEEDED" },
      liveTickMovement: null,
    });
    const prompt = marketEvidenceForModelPrompt(bundle);
    const live = prompt.liveTickMovement as { latest: unknown; windows: unknown[] };
    expect(live.latest == null || live.windows.length === 0).toBe(true);
    const inspected = inspectMarketEvidencePrompt(prompt);
    expect(inspected.categoriesIncluded.historicalCandles).toBe(true);
  });
});

describe("F.5 evidence assembly + redacted diagnostics", () => {
  it("reports categories, timeframes, windows, indicators, and MTF in delivery report", () => {
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf: {
        "5m": rising(80),
        "15m": rising(80),
        "30m": rising(80),
        "1h": rising(80),
        "4h": rising(60),
        "1d": rising(40),
      },
      quote,
      liveTickMovement,
    });
    const prompt = marketEvidenceForModelPrompt(bundle);
    const report = buildOpenAiEvidenceDeliveryReport({
      prompt,
      bundle,
      analysisId: "test-f5",
      instrument: "EUR/USD",
      requestStatus: "REQUEST_SENT",
      responseStatus: "RESPONSE_RECEIVED",
      validationStatus: "VALIDATED",
      modelRequested: "gpt-test",
      modelUsed: "gpt-test",
      latencyMs: 12,
      lifecycle: "ANALYSIS_VALID",
    });
    expect(report.schemaVersion).toBe(OPENAI_EVIDENCE_DELIVERY_SCHEMA);
    expect(report.phase).toBe("4.18F.5");
    expect(report.categoriesIncluded.historicalCandles).toBe(true);
    expect(report.categoriesIncluded.liveTickMovement).toBe(true);
    expect(report.categoriesIncluded.movementWindows).toBe(true);
    expect(report.categoriesIncluded.technicalIndicators).toBe(true);
    expect(report.categoriesIncluded.mtfMatrix).toBe(true);
    expect(report.categoriesIncluded.mtfAlignment).toBe(true);
    expect(report.timeframesIncluded.length).toBeGreaterThanOrEqual(4);
    expect(report.movementWindowIds).toEqual(expect.arrayContaining(["1m", "5m"]));
    expect(report.indicatorGroupsIncluded).toEqual(
      expect.arrayContaining(["SMA", "EMA", "RSI", "MACD", "BOLLINGER", "ATR", "ADX"]),
    );
    expect(report.structureIncluded).toBe(true);
    expect(report.atrMethodLabel).toBe("SMA_OF_TR");
    expect(report.historicalLiveSeparated).toBe(true);
    expect(report.evidenceSizeChars).toBeGreaterThan(100);
    expect(report.placesOrders).toBe(false);
    expect(report.acceptsForExecution).toBe(false);
    expect(report.mutatesBroker).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/sk-|api[_-]?key|Bearer |password/i);
  });

  it("never marks VALIDATED without successful validation status input", () => {
    const prompt = marketEvidenceForModelPrompt(
      buildMarketEvidenceBundle({
        environment: "DEMO",
        instrument: "EUR/USD",
        primaryTimeframe: "15m",
        candlesByTf: { "15m": rising(40) },
        quote,
      }),
    );
    const report = buildOpenAiEvidenceDeliveryReport({
      prompt,
      requestStatus: "REQUEST_NOT_RUN",
      responseStatus: "RESPONSE_NOT_VERIFIED",
      validationStatus: "REQUEST_NOT_RUN",
    });
    expect(report.validationStatus).not.toBe("VALIDATED");
  });
});

function cfgOk() {
  return {
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
}

function loadRising() {
  return async () =>
    rising(60).map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
}

describe("F.5 OpenAI adapter invocation + failure paths", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-f5-"));
    resetAtOpenAiAnalysisStoreForTests();
    resetAtOpenAiAnalysisEngineForTests();
  });

  afterEach(() => {
    resetAtOpenAiAnalysisEngineForTests();
    resetAtOpenAiAnalysisStoreForTests();
  });

  it("attaches evidenceDelivery on successful OpenAI analyze path", async () => {
    const chat = vi.fn(async (args: { user?: string }) => {
      expect(String(args.user ?? "")).toMatch(/marketEvidence/);
      expect(String(args.user ?? "")).toMatch(/technicalIntelligence|multiTimeframe|liveTickMovement|liveQuote/);
      return {
        ok: true as const,
        code: "OK" as const,
        model: "gpt-4o-mini-2024",
        latencyMs: 8,
        data: {
          direction: "BUY",
          directionalConfidencePct: 55,
          directionalBias: "BULLISH",
          trendState: "UPTREND",
          trendStrength: "MODERATE",
          mtfAgreement: "AGREE_BULLISH",
          dataQuality: "SUFFICIENT",
          keyEvidence: ["15m rising SMA9>SMA21"],
          counterEvidence: [],
          structureNotes: ["HH/HL sequence"],
          explanation: "Historical uptrend with fresh live bid/ask; windows show mild upward movement.",
          supportLevels: [],
          resistanceLevels: [],
          patterns: [],
          scenarios: {
            bullish: { summary: "Continuation if HTF holds", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
            bearish: { summary: "Invalid if HTF flips", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
          },
          limitations: [],
        },
      };
    });
    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      config: cfgOk(),
      chat: chat as never,
      loadCandles: await Promise.resolve(loadRising()),
    });
    const result = await engine.analyze({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      timeframes: ["15m", "1h", "4h"],
      verification: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(chat).toHaveBeenCalledTimes(1);
    expect(result.analysis.evidenceDelivery).toBeTruthy();
    expect(result.analysis.evidenceDelivery!.requestStatus).toBe("REQUEST_SENT");
    expect(result.analysis.evidenceDelivery!.responseStatus).toBe("RESPONSE_RECEIVED");
    expect(result.analysis.evidenceDelivery!.categoriesIncluded.historicalCandles).toBe(true);
    expect(result.analysis.evidenceDelivery!.placesOrders).toBe(false);
    expect(result.analysis.evidenceDelivery!.mutatesBroker).toBe(false);
    expect(result.analysis.placesOrders).toBe(false);
    expect(JSON.stringify(result.analysis.evidenceDelivery)).not.toMatch(/sk-test-key/i);
  });

  it("records OPENAI_TIMEOUT diagnostics when OpenAI fails", async () => {
    const chat = vi.fn(async () => ({
      ok: false as const,
      data: null,
      model: null,
      code: "OPENAI_TIMEOUT",
      error: "Request timeout",
      latencyMs: 1,
    }));
    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      config: cfgOk(),
      chat: chat as never,
      loadCandles: await Promise.resolve(loadRising()),
    });
    const result = await engine.analyze({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      timeframes: ["15m"],
      verification: null,
    });
    expect(result.ok).toBe(false);
    expect(result.analysis?.evidenceDelivery?.requestStatus).toBe("OPENAI_TIMEOUT");
    expect(result.analysis?.evidenceDelivery?.validationStatus).toBe("VALIDATION_FAILED");
    expect(result.analysis?.placesOrders).toBe(false);
  });

  it("does not break when OpenAI is not configured", async () => {
    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      config: {
        getPublicStatus: async () => ({
          configured: false,
          vaultUnlocked: false,
          model: "gpt-4o-mini",
          modelEligible: true,
          updatedAt: null,
          lastValidatedAt: null,
          lastValidationStatus: "never",
          verificationDisplay: "NOT_VERIFIED",
          lastVerificationNote: null,
          modelsDiscoveredAt: null,
          eligibleModelCount: null,
          note: "test",
        }),
        getApiKey: async () => null,
      } as never,
      loadCandles: await Promise.resolve(loadRising()),
    });
    const result = await engine.analyze({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      verification: null,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("OPENAI_NOT_CONFIGURED");
    expect(result.analysis).toBeNull();
  });
});

describe("F.5 canonical NO_TRADE authority + MTF conflict", () => {
  function freshQuote(over: Partial<CanonicalQuoteSnapshot> = {}): CanonicalQuoteSnapshot {
    return {
      instrument: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      quoteFresh: true,
      freshnessReasonCode: "LIVE_FRESH",
      effectivePriceChangeAgeMs: 100,
      snapshotFingerprint: "f5",
      evaluatedAtUtc: new Date().toISOString(),
      ...over,
    };
  }

  function detSlice(over: Partial<CanonicalDeterministicStrategySlice> = {}): CanonicalDeterministicStrategySlice {
    return {
      strategyId: SMA_CROSSOVER_RULES.strategyId,
      direction: "NO_TRADE",
      code: "NO_CROSSOVER",
      reasons: ["No crossover"],
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
      supportLevels: [],
      resistanceLevels: [],
      explanation: "AI wants BUY",
      directionalConfidencePct: 70,
      placesOrders: false,
      ...over,
    };
  }

  it("keeps deterministic NO_TRADE when AI disagrees / HTF conflicts", () => {
    const result = reconcileAnalysis({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      quote: freshQuote(),
      candleStrategyReady: true,
      candleQuality: {
        strategyReady: true,
        blockers: [],
        closedBars: 80,
        invalidOhlcCount: 0,
        duplicateCount: 0,
      },
      indicators: indicatorsFromStrategyValues({
        fastSma: 1.1,
        slowSma: 1.09,
        atr: 0.001,
        atrLength: 14,
      }),
      deterministic: detSlice(),
      ai: aiSlice(),
      htf: {
        primaryTimeframe: "15m",
        confirmationTimeframes: ["1h", "4h"],
        perTf: [
          { timeframe: "15m", candleRef: null, deterministicBias: "BULLISH" },
          { timeframe: "1h", candleRef: null, deterministicBias: "BEARISH" },
        ],
        agreement: "CONFLICT",
      },
      aiInstrument: "EUR/USD",
      strategyInstrument: "EUR/USD",
      expectedInstrument: "EUR/USD",
    });
    // Deterministic NO_TRADE / HTF conflict must never authorize execution.
    expect(["NO_TRADE", "CONFLICT", "INSUFFICIENT_DATA", "STALE_DATA"].includes(result.finalOutcome)
      || result.direction === null
      || result.direction === "NO_TRADE").toBe(true);
    expect(result.placesOrders).toBe(false);
    expect(result.acceptsForExecution).toBe(false);
  });

  it("isolates instruments — mismatched AI cannot force execution", () => {
    const result = reconcileAnalysis({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      quote: freshQuote({ snapshotFingerprint: "f5b" }),
      candleStrategyReady: true,
      candleQuality: {
        strategyReady: true,
        blockers: [],
        closedBars: 80,
        invalidOhlcCount: 0,
        duplicateCount: 0,
      },
      indicators: indicatorsFromStrategyValues({
        fastSma: 1.1,
        slowSma: 1.09,
        atr: 0.001,
        atrLength: 14,
      }),
      deterministic: detSlice({
        direction: "BUY",
        code: "BUY_SMA_CROSS",
        entryPrice: 1.1,
        stopLoss: 1.09,
        takeProfit: 1.12,
        confidencePct: 50,
      }),
      ai: aiSlice({ direction: "SELL", directionalBias: "BEARISH", analysisId: "ai-xau" }),
      htf: null,
      aiInstrument: "XAU/USD",
      strategyInstrument: "EUR/USD",
      expectedInstrument: "EUR/USD",
    });
    expect(result.acceptsForExecution).toBe(false);
    expect(result.placesOrders).toBe(false);
    expect(result.reconciliationCode === "RECON_INSTRUMENT_MISMATCH"
      || result.finalOutcome === "CONFLICT"
      || result.finalOutcome === "NO_TRADE"
      || result.direction === null
      || result.ai == null
      || result.direction === "BUY").toBe(true);
  });
});
