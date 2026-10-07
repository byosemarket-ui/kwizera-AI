import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createForexMemoryService,
  evaluateScenarioOutcome,
  detectMistakesForAnalysis,
  aggregateLearning,
  retrieveRelevantMemory,
  FOREX_MEMORY_MIN_SAMPLE,
  FOREX_MEMORY_SCHEMA_VERSION,
  type ForexAnalysisMemoryRecord,
} from "../../../../ai/forex-memory/index.ts";
import { buildAnalysisMemoryFromPayload } from "../../../../ai/forex-memory/from-analysis.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function sampleDecisionAnalysis(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: "forex-decision-analysis-v1",
    analysisId: overrides?.analysisId ?? "ana-test-1",
    generatedAt: overrides?.generatedAt ?? "2026-10-07T12:00:00.000Z",
    narrativeStatus: "DETERMINISTIC_ONLY",
    market: { exchange: "BINANCE", symbol: "BTCUSDT", displaySymbol: "BTC/USDT", marketType: "SPOT", currentPrice: 100000 },
    timeframes: ["4h", "1h", "30m", "15m", "5m"],
    timeframeStates: [
      { timeframe: "4h", usable: true, status: "CONNECTED", trend: "BULLISH", momentum: "POSITIVE", rsi: 55, price: 100000, timestamp: "2026-10-07T12:00:00.000Z" },
      { timeframe: "1h", usable: true, status: "CONNECTED", trend: "BULLISH", momentum: "POSITIVE", rsi: 52, price: 100000, timestamp: "2026-10-07T12:00:00.000Z" },
      { timeframe: "15m", usable: true, status: "CONNECTED", trend: "BEARISH", momentum: "NEGATIVE", rsi: 34, price: 100000, timestamp: "2026-10-07T12:00:00.000Z" },
    ],
    dataQuality: { status: "COMPLETE_CONNECTED" },
    alignment: { overall: "MIXED", higherBias: "BULLISH" },
    scenario: { type: "BULLISH_PULLBACK", direction: "BULLISH", name: "BULLISH PULLBACK", evidence: ["4h bullish"], notes: [] },
    entryZone: {
      status: "WAITING_CONFIRMATION",
      lowerBound: 98000,
      upperBound: 99000,
      referencePrice: 98500,
      invalidationLevel: 97500,
      timeframe: "15m",
      unavailableReason: null,
    },
    confirmation: {
      conditions: [{ id: "htf-bias", status: "MET", description: "HTF" }, { id: "ltf-confirm", status: "NOT_MET", description: "LTF" }],
      allRequiredMet: false,
      summary: "need confirm",
    },
    invalidation: {
      conditions: [{ id: "structure-level", status: "NOT_MET", description: "level", level: 97500 }],
      triggered: false,
      summary: "ok",
    },
    decisionPosture: "CONFIRMATION_REQUIRED",
    observedFacts: ["symbol=BTCUSDT"],
    deterministicSummary: "Bullish pullback waiting confirmation.",
    aiInterpretation: null,
    knowledgeSources: [{ documentId: "d1", title: "BOS" }],
    stopLossCandidate: 97500,
    takeProfitCandidates: [102000],
    riskReward: { ratio: 2 },
    model: "llama3.2:1b",
    promptVersion: "forex-decision-prompt-v1",
    engineVersion: "forex-decision-engine-v1",
    confidence: null,
    ...overrides,
  };
}

describe("Forex Phase 23 — Memory / Journal / Learning", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "fx-memory-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reuses storage helpers and wires API/admin without duplicates", () => {
    const svc = read("ai/forex-memory/service.ts");
    const api = read("dev/server/forex-memory-api.ts");
    const aiApi = read("dev/server/forex-ai-api.ts");
    const routes = read("desktop/forex-admin/forex-admin-routes.ts");
    expect(svc).toContain("writeJsonAtomic");
    expect(svc).toContain("resolveStorageRoot");
    expect(svc).toContain("forex-memory");
    expect(api).toContain("/api/forex/memory");
    expect(api).not.toContain("11434");
    expect(aiApi).toContain("persistAnalysisMemory");
    expect(routes).toContain("/admin/forex/memory");
    expect(routes).toContain("/admin/forex/journal");
    expect(routes).toContain("/admin/forex/learning");
    expect(FOREX_MEMORY_SCHEMA_VERSION).toBe("forex-memory-v1");
    expect(FOREX_MEMORY_MIN_SAMPLE).toBe(10);
  });

  it("A/B/C creates analysis memory, retrieves, prevents duplicates", async () => {
    const service = createForexMemoryService(tmp);
    const first = await service.persistAnalysis({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis(),
      latencyMs: 1000,
      promptChars: 1800,
    });
    expect(first.created).toBe(true);
    expect(first.analysis.symbol).toBe("BTCUSDT");
    expect(first.analysis.confidence).toBeNull();
    expect(first.analysis.originalImmutable).toBe(true);

    const dup = await service.persistAnalysis({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis(),
      latencyMs: 1000,
    });
    expect(dup.created).toBe(false);
    expect(dup.analysis.id).toBe(first.analysis.id);

    const listed = await service.listAnalyses({ symbol: "BTCUSDT" });
    expect(listed.total).toBe(1);
    expect(listed.items[0]!.id).toBe(first.analysis.id);

    const got = await service.getAnalysis(first.analysis.id);
    expect(got?.deterministicSummary).toBe(first.analysis.deterministicSummary);
  });

  it("D immutability: original analysis body not rewritten on evaluate", async () => {
    const service = createForexMemoryService(tmp);
    const saved = await service.persistAnalysis({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis({ analysisId: "imm-1" }),
    });
    const before = structuredClone(saved.analysis);
    await service.evaluateAnalysis({
      analysisId: saved.analysis.id,
      laterPrice: 97000,
      laterTimestamp: "2026-10-07T14:00:00.000Z",
      historicalAvailable: true,
    });
    const after = await service.getAnalysis(saved.analysis.id);
    expect(after?.scenario).toBe(before.scenario);
    expect(after?.deterministicSummary).toBe(before.deterministicSummary);
    expect(after?.aiInterpretation).toBe(before.aiInterpretation);
    expect(after?.entryZone).toEqual(before.entryZone);
    expect(after?.outcomeId).toBeTruthy();
  });

  it("G/H/I outcome confirmed / invalidated / inconclusive", () => {
    const built = buildAnalysisMemoryFromPayload({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis({ analysisId: "out-1" }),
    }).record;

    const invalidated = evaluateScenarioOutcome({
      analysis: built,
      laterPrice: 97000,
      laterTimestamp: "2026-10-07T14:00:00.000Z",
      historicalAvailable: true,
    });
    expect(invalidated.status).toBe("INVALIDATED");
    expect(invalidated.invalidationReached).toBe(true);

    const confirmed = evaluateScenarioOutcome({
      analysis: {
        ...built,
        confirmationConditions: built.confirmationConditions.map((c) => ({ ...c, status: "MET" })),
      },
      laterPrice: 102500,
      laterTimestamp: "2026-10-07T14:00:00.000Z",
      historicalAvailable: true,
    });
    expect(["CONFIRMED", "PARTIALLY_CONFIRMED"]).toContain(confirmed.status);

    const inconclusive = evaluateScenarioOutcome({
      analysis: { ...built, scenario: "WAIT" },
      laterPrice: 100000,
      laterTimestamp: "2026-10-07T14:00:00.000Z",
      historicalAvailable: true,
    });
    expect(inconclusive.status).toBe("INCONCLUSIVE");
  });

  it("K/L/M/N zone touch, confirmation, invalidation, target", () => {
    const built = buildAnalysisMemoryFromPayload({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis({ analysisId: "zone-1" }),
    }).record;
    const touch = evaluateScenarioOutcome({
      analysis: built,
      laterPrice: 98500,
      laterTimestamp: "2026-10-07T13:00:00.000Z",
      historicalAvailable: true,
    });
    expect(touch.zoneTouched).toBe(true);
    expect(touch.eventOrder).toContain("ZONE_TOUCHED");

    const withConfirm = evaluateScenarioOutcome({
      analysis: {
        ...built,
        confirmationConditions: built.confirmationConditions.map((c) => ({ ...c, status: "MET" })),
      },
      laterPrice: 102000,
      laterTimestamp: "2026-10-07T13:00:00.000Z",
      historicalAvailable: true,
    });
    expect(withConfirm.confirmationReached).toBe(true);
    expect(withConfirm.targetReached.some(Boolean)).toBe(true);
  });

  it("Q missing historical data → INSUFFICIENT_DATA", () => {
    const built = buildAnalysisMemoryFromPayload({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis({ analysisId: "miss-1" }),
    }).record;
    const out = evaluateScenarioOutcome({
      analysis: built,
      laterPrice: null,
      laterTimestamp: null,
      historicalAvailable: false,
    });
    expect(out.status).toBe("INSUFFICIENT_DATA");
  });

  it("R/S mistake detection and severity", () => {
    const built = buildAnalysisMemoryFromPayload({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis({
        analysisId: "mist-1",
        aiInterpretation: "Market is strongly aligned bullish across all timeframes",
        narrativeStatus: "MODEL",
      }),
    }).record;
    const mistakes = detectMistakesForAnalysis(built, null);
    expect(mistakes.some((m) => m.category === "TIMEFRAME_CONFLICT_IGNORED")).toBe(true);
    expect(mistakes.some((m) => m.category === "ENTRY_ZONE_UNAVAILABLE")).toBe(false);
    const high = mistakes.find((m) => m.category === "TIMEFRAME_CONFLICT_IGNORED");
    expect(high?.severity).toBe("HIGH");
  });

  it("T/U learning aggregation respects min sample threshold", () => {
    const analyses: ForexAnalysisMemoryRecord[] = [];
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      const built = buildAnalysisMemoryFromPayload({
        analysisType: "DECISION",
        analysis: sampleDecisionAnalysis({ analysisId: `learn-${i}`, generatedAt: `2026-10-07T12:0${i}:00.000Z` }),
      }).record;
      analyses.push(built);
      outcomes.push(evaluateScenarioOutcome({
        analysis: built,
        laterPrice: 97000,
        laterTimestamp: "2026-10-07T14:00:00.000Z",
        historicalAvailable: true,
      }));
    }
    const learning = aggregateLearning({ analyses, outcomes, mistakes: [], modelPerf: [] });
    const bucket = learning.scenarioPerformance.find((b) => b.key === "BULLISH_PULLBACK");
    expect(bucket?.sampleSize).toBe(3);
    expect(bucket?.statisticalConfidence).toBe("INSUFFICIENT_SAMPLE");
  });

  it("Z confidence remains null; AA/AB no pnl/execution language in engines", () => {
    const built = buildAnalysisMemoryFromPayload({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis({ analysisId: "conf-1", confidence: 0.92 }),
    }).record;
    expect(built.confidence).toBeNull();
    for (const f of [
      "ai/forex-memory/service.ts",
      "ai/forex-memory/outcome-engine.ts",
      "ai/forex-memory/learning-engine.ts",
      "ai/forex-memory/mistake-engine.ts",
    ]) {
      const src = read(f);
      expect(src).not.toContain("Math.random");
      expect(src).not.toMatch(/fakeOutcome|fakeAccuracy|fakeWinRate|fakePnl|placeOrder|broker/);
    }
  });

  it("AE memory retrieval is compact; AF knowledge remains separate", () => {
    const analyses = [1, 2, 3].map((i) => buildAnalysisMemoryFromPayload({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis({ analysisId: `ret-${i}`, generatedAt: `2026-10-0${i}T12:00:00.000Z` }),
    }).record);
    const pack = retrieveRelevantMemory({
      analyses,
      outcomes: [],
      query: { symbol: "BTCUSDT", scenario: "BULLISH_PULLBACK", limit: 5 },
    });
    expect(pack.examples.length).toBeLessThanOrEqual(5);
    expect(pack.note).toMatch(/MEMORY ≠ KNOWLEDGE|MEMORY/);
    expect(pack.limitations.some((l) => /Current Market State/i.test(l))).toBe(true);
    const knowledge = read("ai/forex-knowledge/service.ts");
    expect(knowledge).not.toContain("forex-memory");
  });

  it("persistence survives process restart (new service instance)", async () => {
    const service1 = createForexMemoryService(tmp);
    const saved = await service1.persistAnalysis({
      analysisType: "DECISION",
      analysis: sampleDecisionAnalysis({ analysisId: "persist-1" }),
    });
    expect(existsSync(path.join(tmp, "forex-memory", "store.json"))).toBe(true);

    const service2 = createForexMemoryService(tmp);
    const got = await service2.getAnalysis(saved.analysis.id);
    expect(got?.id).toBe(saved.analysis.id);
    expect(got?.scenario).toBe("BULLISH_PULLBACK");
  });
});
