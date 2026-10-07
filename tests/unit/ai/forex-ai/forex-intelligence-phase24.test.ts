/**
 * Phase 24 — Memory RAG + Intelligence Control Center focused tests.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assembleLabeledPromptBody,
  buildIntelligenceContext,
  detectMemoryGroundingViolations,
  FOREX_AI_PROMPT_VERSION_V24,
  FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET,
  createForexIntelligenceSettingsService,
} from "../../../../ai/forex-ai/intelligence/index.ts";
import {
  createForexMemoryService,
  formatMemoryContextForPrompt,
  retrieveRelevantMemory,
  FOREX_MEMORY_MIN_SAMPLE,
} from "../../../../ai/forex-memory/index.ts";
import { buildAnalysisMemoryFromPayload } from "../../../../ai/forex-memory/from-analysis.ts";
import { FOREX_DECISION_PROMPT_VERSION } from "../../../../ai/forex-ai/decision/config.ts";
import {
  FOREX_ADMIN_NAV,
  parseForexAdminRouteFromLocation,
} from "../../../../desktop/forex-admin/forex-admin-routes.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function sampleAnalysis(id: string, overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    schemaVersion: "forex-decision-analysis-v1",
    analysisId: id,
    generatedAt: "2026-10-07T12:00:00.000Z",
    narrativeStatus: "DETERMINISTIC_ONLY",
    market: {
      exchange: "BINANCE",
      symbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
      marketType: "SPOT",
      currentPrice: 100000,
    },
    timeframes: ["4h", "1h", "15m"],
    timeframeStates: [
      {
        timeframe: "4h",
        usable: true,
        status: "CONNECTED",
        trend: "BEARISH",
        momentum: "NEGATIVE",
        rsi: 40,
        price: 100000,
        timestamp: "2026-10-07T12:00:00.000Z",
      },
    ],
    dataQuality: { status: "COMPLETE_CONNECTED" },
    alignment: { overall: "ALIGNED_BEARISH", higherBias: "BEARISH" },
    scenario: {
      type: "BEARISH_CONTINUATION",
      direction: "BEARISH",
      name: "BEARISH CONTINUATION",
      evidence: [],
      notes: [],
    },
    entryZone: {
      status: "UNAVAILABLE",
      lowerBound: null,
      upperBound: null,
      referencePrice: null,
      invalidationLevel: null,
      timeframe: null,
      unavailableReason: "test",
    },
    confirmation: { conditions: [], allRequiredMet: false, summary: "n/a" },
    invalidation: { conditions: [], triggered: false, summary: "n/a" },
    decisionPosture: "WAIT",
    observedFacts: ["CURRENT MARKET STATE — AUTHORITATIVE"],
    deterministicSummary: "Bearish continuation wait.",
    aiInterpretation: null,
    knowledgeSources: [{ documentId: "kb-1", title: "Pullback rules" }],
    memorySources: [
      {
        memoryId: "mem-hist-1",
        symbol: "BTCUSDT",
        timeframe: null,
        scenario: "BULLISH_PULLBACK",
        outcome: "CONFIRMED",
        relevance: "MEDIUM",
        timestamp: "2026-09-01T00:00:00.000Z",
      },
    ],
    memoryUnavailable: false,
    knowledgeUnavailable: false,
    model: "llama3.2:1b",
    promptVersion: FOREX_AI_PROMPT_VERSION_V24,
    engineVersion: "forex-decision-engine-v1",
    confidence: null,
    ...overrides,
  };
}

describe("Forex Phase 24 — Intelligence Control Center", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "fx-intel-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reuses architecture — no second Ollama/KB/memory/shell", () => {
    const orch = read("ai/forex-ai/decision/orchestrator.ts");
    const intelApi = read("dev/server/forex-intelligence-api.ts");
    const routes = read("desktop/forex-admin/forex-admin-routes.ts");
    expect(orch).toContain("getForexMemoryService");
    expect(orch).toContain("buildIntelligenceContext");
    expect(orch).toContain("getForexKnowledgeService");
    expect(orch).toContain("getOllamaAdapter");
    expect(intelApi).not.toContain("placeOrder");
    expect(intelApi).not.toContain("fineTune");
    expect(intelApi).not.toContain("brokerOrder");
    expect(intelApi).toContain("no broker execution");
    expect(routes).toContain("/admin/forex/ai-configuration");
    expect(routes).toContain("/admin/forex/retrieval-diagnostics");
    expect(routes).toContain("/admin/forex/system-health");
    expect(routes).not.toContain("/forex-ai-admin");
    expect(FOREX_DECISION_PROMPT_VERSION).toBe("forex-ai-prompt-v24");
  });

  it("A/B/C knowledge and memory remain separate labeled contexts", () => {
    const memoryPack = retrieveRelevantMemory({
      analyses: [],
      outcomes: [],
      query: { symbol: "BTCUSDT", limit: 3 },
    });
    const intel = buildIntelligenceContext({
      currentFactsLine: "symbol=BTCUSDT trend=BEARISH",
      knowledgeHits: [],
      memoryPack,
    });
    expect(intel.labeledSections.current).toContain("CURRENT MARKET STATE — AUTHORITATIVE");
    expect(intel.labeledSections.knowledge).toContain("KNOWLEDGE BASE — METHODOLOGY / REFERENCE");
    expect(intel.labeledSections.memory).toContain("HISTORICAL MEMORY");
    expect(intel.labeledSections.memory).not.toContain("CURRENT MARKET STATE — AUTHORITATIVE:\nHISTORICAL");
  });

  it("D/E/F current market priority + labeling", () => {
    const prompt = assembleLabeledPromptBody({
      header: "hdr",
      currentFacts: "4H bearish 1H bearish 15M bearish",
      knowledgeText: "pullback methodology",
      memoryText: "BTCUSDT Scenario: BULLISH_PULLBACK Outcome: CONFIRMED",
      budget: FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET,
    });
    expect(prompt).toContain("CURRENT MARKET STATE — AUTHORITATIVE");
    expect(prompt).toContain("HISTORICAL MEMORY — NOT CURRENT MARKET DATA");
    expect(prompt).toContain("KNOWLEDGE BASE — METHODOLOGY / REFERENCE");
    expect(prompt.indexOf("CURRENT MARKET STATE")).toBeLessThan(prompt.indexOf("HISTORICAL MEMORY"));
  });

  it("G/H memory only on explicit analysis path; WS ticks do not call Ollama", () => {
    const orch = read("ai/forex-ai/decision/orchestrator.ts");
    const ws = read("dev/server/binance-market-data-api.ts");
    expect(orch).toContain("runForexDecisionAnalysis");
    expect(orch).toContain("retrieve(");
    expect(ws).not.toContain("runForexDecisionAnalysis");
    expect(ws).not.toContain("getOllamaAdapter");
  });

  it("I compact context stays within budget", () => {
    const hugeMemory = "HISTORICAL MEMORY\n" + "x".repeat(5000);
    const prompt = assembleLabeledPromptBody({
      header: "hdr",
      currentFacts: "facts",
      knowledgeText: "k".repeat(2000),
      memoryText: hugeMemory,
      budget: 2800,
    });
    expect(prompt.length).toBeLessThanOrEqual(2800);
  });

  it("J/K/O/P memory + knowledge source IDs and prompt/model versions persist", async () => {
    const service = createForexMemoryService(tmp);
    const built = buildAnalysisMemoryFromPayload({
      analysisType: "DECISION",
      analysis: sampleAnalysis("ana-p24-1"),
      latencyMs: 1200,
      promptChars: 2100,
    });
    expect(built.record.memorySources[0]?.memoryId).toBe("mem-hist-1");
    expect(built.record.knowledgeSources[0]?.documentId).toBe("kb-1");
    expect(built.record.promptVersion).toBe(FOREX_AI_PROMPT_VERSION_V24);
    expect(built.record.modelId).toBe("llama3.2:1b");
    const persisted = await service.persistAnalysis({
      analysisType: "DECISION",
      analysis: sampleAnalysis("ana-p24-1"),
    });
    expect(persisted.analysis.memorySources.length).toBe(1);
    expect(persisted.analysis.knowledgeSources.length).toBe(1);
  });

  it("L/M/N grounding rejects memory-as-current and outcome rewrite", () => {
    const pack = {
      alignment: { overall: "ALIGNED_BEARISH" as const, higherBias: "BEARISH" as const },
    } as never;
    const memorySources = [
      {
        memoryId: "mem-1",
        symbol: "BTCUSDT",
        timeframe: null,
        scenario: "BULLISH_PULLBACK",
        outcome: "INVALIDATED",
        relevance: "HIGH",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    ];
    const v1 = detectMemoryGroundingViolations(
      "BTCUSDT is currently bullish because previous historical scenarios succeeded.",
      { pack, memorySources },
    );
    expect(v1.length).toBeGreaterThan(0);
    const v2 = detectMemoryGroundingViolations(
      `Looking at mem-1 which was CONFIRMED earlier`,
      { pack, memorySources },
    );
    expect(v2.some((x) => /rewritten/i.test(x))).toBe(true);
    const v3 = detectMemoryGroundingViolations(
      "Historical cases are context only. Current state remains bearish.",
      { pack, memorySources },
    );
    expect(v3.length).toBe(0);
  });

  it("Q/R retrieval diagnostics + dry-run do not write memory / call Ollama", () => {
    const diag = read("ai/forex-ai/intelligence/diagnostics.ts");
    const api = read("dev/server/forex-intelligence-api.ts");
    expect(diag).toContain("calledOllama: false");
    expect(diag).toContain("buildForexRetrievalDiagnostic");
    expect(api).toContain("/build-context");
    expect(api).not.toContain("persistAnalysis");
  });

  it("S/T/U configuration validation + audit", async () => {
    const svc = createForexIntelligenceSettingsService(tmp);
    const a = await svc.updateSettings({ memoryMaxExamples: 2 });
    expect(a.settings.memoryMaxExamples).toBe(2);
    expect(a.changed.length).toBeGreaterThan(0);
    const b = await svc.updateSettings({ memoryMaxExamples: 99 });
    expect(b.settings.memoryMaxExamples).toBe(3); // clamped
    const audit = await svc.getAudit();
    expect(audit[0]?.setting).toBeTruthy();
    // Dangerous keys are not part of settings type / clamp surface
    expect(JSON.stringify(await svc.getSettings())).not.toContain("11434");
  });

  it("V/W learning rebuild deterministic; outcome re-eval idempotent path exists", async () => {
    const service = createForexMemoryService(tmp);
    await service.persistAnalysis({
      analysisType: "DECISION",
      analysis: sampleAnalysis("ana-rebuild-1"),
    });
    const l1 = await service.rebuildLearningAggregates();
    const l2 = await service.rebuildLearningAggregates();
    expect(l1.totals.analyses).toBe(l2.totals.analyses);
    expect(JSON.stringify(l1.scenarioPerformance)).toBe(JSON.stringify(l2.scenarioPerformance));
    const svcSrc = read("ai/forex-memory/service.ts");
    expect(svcSrc).toContain("existingFinal");
  });

  it("X/Y/Z no duplicate memories; min sample protection; no fake accuracy", async () => {
    const service = createForexMemoryService(tmp);
    const first = await service.persistAnalysis({
      analysisType: "DECISION",
      analysis: sampleAnalysis("ana-dup"),
    });
    const dup = await service.persistAnalysis({
      analysisType: "DECISION",
      analysis: sampleAnalysis("ana-dup"),
    });
    expect(first.created).toBe(true);
    expect(dup.created).toBe(false);
    const learning = await service.getLearning();
    for (const bucket of learning.scenarioPerformance) {
      if (bucket.sampleSize < FOREX_MEMORY_MIN_SAMPLE) {
        expect(bucket.statisticalConfidence).toBe("INSUFFICIENT_SAMPLE");
      }
    }
    const learningUi = read("desktop/forex-admin/ForexAdminMemoryPages.tsx");
    expect(learningUi).not.toContain("winRate");
    expect(learningUi).not.toContain("fakeAccuracy");
    expect(learningUi).toContain("INSUFFICIENT_SAMPLE");
  });

  it("AA/AB no model training / broker execution in Phase 24 surface", () => {
    const health = read("ai/forex-ai/intelligence/health.ts");
    const pages = read("desktop/forex-admin/ForexAdminIntelligencePages.tsx");
    expect(health).toContain("MODEL TRAINING");
    expect(health).toContain("active: false");
    expect(pages).not.toContain("Execute Trade");
    expect(pages).not.toContain("Train Model Now");
    expect(pages).not.toContain("Fine Tune");
    expect(pages).not.toContain("Place Order");
  });

  it("admin routes parse new Phase 24 pages under /admin/forex", () => {
    expect(parseForexAdminRouteFromLocation("/admin/forex/ai-configuration").view).toBe("ai-configuration");
    expect(parseForexAdminRouteFromLocation("/admin/forex/retrieval-diagnostics").view).toBe("retrieval-diagnostics");
    expect(parseForexAdminRouteFromLocation("/admin/forex/system-health").view).toBe("system-health");
    expect(FOREX_ADMIN_NAV.some((n) => n.id === "retrieval-diagnostics")).toBe(true);
    expect(FOREX_ADMIN_NAV.some((n) => n.group === "memory")).toBe(true);
  });

  it("formatMemoryContextForPrompt uses historical label", () => {
    const text = formatMemoryContextForPrompt({
      sampleSize: 1,
      examples: [{
        analysisId: "a1",
        symbol: "BTCUSDT",
        scenario: "BULLISH_PULLBACK",
        regime: "TRENDING_BULLISH",
        outcome: "CONFIRMED",
        posture: "WATCH",
        generatedAt: "2026-01-01T00:00:00.000Z",
        score: 8,
      }],
      limitations: [],
      note: "",
    });
    expect(text).toContain("HISTORICAL MEMORY — NOT CURRENT MARKET DATA");
    expect(text).toContain("Outcome: CONFIRMED");
  });

  it("static audit — production intelligence code avoids fake learning tokens", () => {
    const files = [
      "ai/forex-ai/intelligence/context-builder.ts",
      "ai/forex-ai/intelligence/health.ts",
      "ai/forex-ai/intelligence/diagnostics.ts",
      "ai/forex-ai/decision/orchestrator.ts",
      "dev/server/forex-intelligence-api.ts",
    ];
    const banned = [
      "fakePrice", "mockPrice", "fakeOutcome", "fakeAccuracy", "fakeWinRate",
      "fakePnl", "fakeProfit", "fakeLearning", "automaticFineTune", "autoTrain",
      "placeOrder", "brokerOrder",
    ];
    for (const file of files) {
      const src = read(file);
      for (const token of banned) {
        expect(src).not.toContain(token);
      }
    }
  });
});
