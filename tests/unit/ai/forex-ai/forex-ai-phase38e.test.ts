import { describe, expect, it } from "vitest";
import {
  EVIDENCE_SCHEMA_VERSION,
  assembleGroundedMarketReadout,
  buildEvidenceAwareKnowledgeQuery,
  buildForexAiEvidencePack,
  enrichEvidencePackKnowledge,
  formatEvidenceForPrompt,
  sanitizeAnalysisAgainstEvidence,
  toKnowledgeSources,
  type ForexAiAnalysis,
  type ForexAiEvidencePack,
  type ForexMarketState,
} from "../../../../ai/forex-ai/index.ts";
import type { ForexKnowledgeRetrievalHit } from "../../../../ai/forex-knowledge/types.ts";

const T0 = 1_700_000_000;
const STEP = 900;

function c(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  closed = true,
) {
  return { time, open, high, low, close, isClosed: closed, closed };
}

function hl(index: number, high: number, low: number, closed = true) {
  const mid = (high + low) / 2;
  return c(T0 + index * STEP, mid, high, low, mid + (high - low) * 0.05, closed);
}

/** Bullish structure series from Phase 38D tests + trailing doji. */
function syntheticBullishWithDoji() {
  const levels: Array<{ h: number; l: number }> = [
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
  const candles = levels.map((row, i) => hl(i, row.h, row.l, true));
  // Trailing doji for pattern detection
  candles.push(c(T0 + 20 * STEP, 118, 119, 117, 118.05, true));
  return candles;
}

function mockHit(partial: Partial<ForexKnowledgeRetrievalHit> & {
  documentId: string;
  chunkId: string;
  title: string;
}): ForexKnowledgeRetrievalHit {
  return {
    documentId: partial.documentId,
    chunkId: partial.chunkId,
    title: partial.title,
    content: partial.content ?? "Published methodology excerpt.",
    relevanceScore: partial.relevanceScore ?? 0.9,
    categoryId: null,
    topicId: null,
    tags: [],
    knowledgeType: "PATTERN",
    sourceName: partial.sourceName ?? "Test Source",
    version: partial.version ?? 1,
    documentTitle: partial.title,
    pageNumber: partial.pageNumber ?? 3,
  };
}

function baseMarket(overrides: Partial<ForexMarketState> = {}): ForexMarketState {
  return {
    symbol: "BTCUSDT",
    exchange: "BINANCE",
    marketType: "SPOT",
    timeframe: "15m",
    timestamp: new Date().toISOString(),
    price: 100,
    candle: { open: 99, high: 101, low: 98, close: 100, volume: 10 },
    trend: "BULLISH",
    momentum: "POSITIVE",
    volatility: "NORMAL",
    indicators: {
      sma: { "20": 99, "50": 98 },
      ema: { "50": 99 },
      rsi: 55,
      macd: { macd: 0.1, signal: 0.05, histogram: 0.05 },
      bollinger: { mid: 100, upper: 102, lower: 98, widthPct: 4 },
    },
    marketStructure: { structureState: "HH_HL" },
    supportResistance: { support: [], resistance: [] },
    dataSource: "binance-spot",
    live: false,
    ...overrides,
  };
}

function stubAnalysis(pack?: ForexAiEvidencePack): ForexAiAnalysis {
  return {
    schemaVersion: "forex-ai-analysis-v1",
    analysisId: "test",
    generatedAt: new Date().toISOString(),
    analysisType: "MARKET_OVERVIEW",
    market: {
      exchange: "BINANCE",
      symbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
      marketType: "CRYPTO",
      timeframe: "15m",
    },
    dataQuality: { status: "CONNECTED", stale: false, marketTimestamp: null },
    summary: "Model summary",
    observedFacts: ["price 100"],
    trend: { direction: "BULLISH", explanation: "x" },
    momentum: { state: "POSITIVE", explanation: "x" },
    volatility: { state: "NORMAL", explanation: "x" },
    marketStructure: { state: "HH_HL", explanation: "x" },
    scenarios: [{
      type: "BULLISH",
      name: "Continuation",
      status: "POSSIBLE",
      conditions: [],
      confirmation: [],
      invalidation: [],
      reasoning: "ok",
    }],
    confirmationNeeded: [],
    invalidationConditions: [],
    risks: [],
    knowledgeSources: [],
    limitations: [],
    decisionPosture: "OBSERVE",
    confidence: null,
    model: "llama3.2:1b",
    dataTimestamp: null,
    promptVersion: "forex-analysis-prompt-v3",
    engineVersion: "forex-ai-engine-v1",
    symbol: "BTCUSDT",
    timeframe: "15m",
    marketCondition: "test",
    reasoning: "ok",
    invalidation: [],
    evidencePack: pack,
  };
}

describe("Forex Phase 38E — AI Reasoning Integration (evidence)", () => {
  it("builds evidence pack from synthetic candles with doji + bullish structure", () => {
    const candles = syntheticBullishWithDoji();
    const pack = buildForexAiEvidencePack({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles,
    });
    expect(pack.schemaVersion).toBe(EVIDENCE_SCHEMA_VERSION);
    expect(pack.patterns.detections.some((d) => d.id === "doji")).toBe(true);
    expect(pack.structure.trendState).toBe("BULLISH");
    expect(pack.evidenceIds.some((id) => id.startsWith("pattern:doji:"))).toBe(true);
    expect(pack.insufficientHistory).toBe(false);
  });

  it("propagates provider, symbol, and timeframe", () => {
    const pack = buildForexAiEvidencePack({
      provider: "FOREXCONNECT",
      environment: "demo",
      symbol: "EURUSD",
      timeframe: "1h",
      candles: [c(T0, 1.1, 1.11, 1.09, 1.1005)],
      priceBasis: "bid",
    });
    expect(pack.provider).toBe("FOREXCONNECT");
    expect(pack.symbol).toBe("EURUSD");
    expect(pack.timeframe).toBe("1h");
    expect(pack.environment).toBe("demo");
    expect(pack.priceBasis).toBe("bid");
  });

  it("preserves knowledge citations from published hits and allows empty knowledge", () => {
    const candles = [c(T0, 100, 101, 99, 100.05)];
    const empty = buildForexAiEvidencePack({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles,
      knowledgeHits: [],
    });
    expect(empty.knowledge).toEqual([]);

    const hits = [
      mockHit({ documentId: "doc-a", chunkId: "chk-1", title: "Doji Guide", sourceName: "Book A" }),
      mockHit({ documentId: "doc-b", chunkId: "chk-2", title: "Structure Notes", pageNumber: 12 }),
    ];
    const pack = enrichEvidencePackKnowledge(empty, hits);
    expect(pack.knowledge).toHaveLength(2);
    expect(pack.knowledge[0]).toMatchObject({
      documentId: "doc-a",
      chunkId: "chk-1",
      title: "Doji Guide",
      sourceName: "Book A",
    });
    expect(pack.evidenceIds).toContain("knowledge:doc-a:chk-1");

    const sources = toKnowledgeSources(hits);
    expect(sources[0]?.chunkId).toBe("chk-1");
    expect(sources[0]?.sourceName).toBe("Book A");
  });

  it("is honest about insufficient history / UNKNOWN structure", () => {
    const pack = buildForexAiEvidencePack({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: [],
    });
    expect(pack.insufficientHistory).toBe(true);
    expect(pack.structure.trendState).toBe("UNKNOWN");
    expect(pack.warnings.some((w) => /insufficient|UNKNOWN/i.test(w))).toBe(true);
    const formatted = formatEvidenceForPrompt(pack);
    expect(formatted).toContain("DETECTOR_EVIDENCE");
    expect(formatted).toContain("trend=UNKNOWN");
  });

  it("enriches knowledge query with evidence tokens", () => {
    const pack = buildForexAiEvidencePack({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: syntheticBullishWithDoji(),
    });
    const q = buildEvidenceAwareKnowledgeQuery("trend momentum", pack);
    expect(q.toLowerCase()).toMatch(/doji|bullish|bos|choch|structure/);
  });

  it("sanitize strips fake knowledge citation", () => {
    const pack = buildForexAiEvidencePack({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: [c(T0, 100, 101, 99, 100.05)],
      knowledgeHits: [mockHit({ documentId: "real-doc", chunkId: "real-chk", title: "Real Title" })],
    });
    const analysis = stubAnalysis(pack);
    analysis.scenarios[0]!.reasoning = "According to Fake Secret Manual the market will rise";
    analysis.summary = "See knowledge:fake-doc:fake-chunk for proof";
    const { analysis: cleaned, strippedClaims } = sanitizeAnalysisAgainstEvidence(analysis, pack);
    expect(strippedClaims.some((c) => c.startsWith("unsupported-knowledge:"))).toBe(true);
    expect(cleaned.summary).not.toContain("knowledge:fake-doc:fake-chunk");
    expect(cleaned.limitations.some((l) => /knowledge/i.test(l))).toBe(true);
    expect(cleaned.evidencePack?.schemaVersion).toBe(EVIDENCE_SCHEMA_VERSION);
  });

  it("sanitize / limitations when inventing pattern not in pack", () => {
    // Flat candles → no engulfing; pack should not include morning star
    const pack = buildForexAiEvidencePack({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: [
        c(T0, 100, 100.2, 99.8, 100.1),
        c(T0 + STEP, 100.1, 100.3, 99.9, 100.2),
      ],
    });
    expect(pack.patterns.detections.every((d) => d.id !== "morning_star")).toBe(true);
    const analysis = stubAnalysis(pack);
    analysis.summary = "Clear Morning Star reversal confirms bullish continuation";
    analysis.observedFacts = ["Morning Star present on last bar"];
    const { analysis: cleaned, strippedClaims } = sanitizeAnalysisAgainstEvidence(analysis, pack);
    expect(strippedClaims.some((c) => c.includes("morning star") || c.includes("unsupported-pattern"))).toBe(true);
    expect(cleaned.limitations.some((l) => /pattern/i.test(l))).toBe(true);
    expect(cleaned.summary.toLowerCase()).not.toContain("morning star");
  });

  it("grounded fallback on malformed path still includes evidencePack", () => {
    const pack = buildForexAiEvidencePack({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: syntheticBullishWithDoji(),
    });
    const grounded = assembleGroundedMarketReadout({
      market: baseMarket(),
      model: "llama3.2:1b",
      knowledgeSources: [],
      analysisType: "MARKET_OVERVIEW",
      dataQualityStatus: "CONNECTED",
      dataQualityStale: false,
      reason: "Ollama returned non-JSON",
      evidencePack: pack,
      inferenceStatus: "FORMAT_ERROR",
      inferenceLatencyMs: 12,
    });
    expect(grounded.evidencePack?.schemaVersion).toBe(EVIDENCE_SCHEMA_VERSION);
    expect(grounded.evidencePack?.structure.trendState).toBe("BULLISH");
    expect(grounded.observedFacts.some((f) => /STRUCTURE_V1|pattern/i.test(f))).toBe(true);
    expect(grounded.inferenceStatus).toBe("FORMAT_ERROR");

    const sanitized = sanitizeAnalysisAgainstEvidence(grounded, pack);
    expect(sanitized.analysis.evidencePack).toBeTruthy();
  });

  it("timeout-style grounded fallback keeps pack and TIMEOUT inference status", () => {
    const pack = buildForexAiEvidencePack({
      provider: "FXCM",
      symbol: "EURUSD",
      timeframe: "1h",
      candles: syntheticBullishWithDoji(),
    });
    const grounded = assembleGroundedMarketReadout({
      market: baseMarket({
        exchange: "FXCM",
        marketType: "FOREX",
        symbol: "EURUSD",
        dataSource: "fxcm-mid",
      }),
      model: null,
      knowledgeSources: [],
      analysisType: "TECHNICAL_ANALYSIS",
      dataQualityStatus: "CONNECTED",
      dataQualityStale: false,
      reason: "Ollama timeout",
      evidencePack: pack,
      inferenceStatus: "TIMEOUT",
      inferenceLatencyMs: 120_000,
    });
    expect(grounded.inferenceStatus).toBe("TIMEOUT");
    expect(grounded.evidencePack?.provider).toBe("FXCM");
    expect(formatEvidenceForPrompt(pack).length).toBeLessThanOrEqual(900);
  });
});
