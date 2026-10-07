import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assessMarketStateForAnalysis,
  buildForexAnalysisPrompt,
  buildForexKnowledgeQuery,
  detectGroundingViolations,
  emptyForexMarketState,
  FOREX_AI_ANALYSIS_SCHEMA_VERSION,
  FOREX_AI_SYSTEM_RULES,
  formatDisplaySymbol,
  formatKnowledgeForPrompt,
  marketStateHasAnalyzableFacts,
  parseForexAiAnalysis,
  toKnowledgeSources,
  validateForexMarketState,
} from "../../../ai/forex-ai/index.ts";
import type { ForexBinanceMarketState } from "../../../ai/forex-market-state/types.ts";
import type { ForexKnowledgeRetrievalHit } from "../../../ai/forex-knowledge/types.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function sampleMarketState(overrides?: Partial<ForexBinanceMarketState>): ForexBinanceMarketState {
  const now = Date.now();
  const base: ForexBinanceMarketState = {
    version: "forex-market-state-v1",
    exchange: "BINANCE",
    marketType: "SPOT",
    symbol: "BTCUSDT",
    displaySymbol: "BTC/USDT",
    timeframe: "15m",
    candleOpenTime: Math.floor((now - 900_000) / 1000),
    candleCloseTime: Math.floor(now / 1000),
    lastMarketUpdate: now - 5_000,
    stateGeneratedAt: now,
    price: {
      last: 110000,
      open: 109500,
      high: 110500,
      low: 109000,
      close: 110000,
      absoluteChange: 100,
      percentageChange: 0.09,
      changeReference: "PREVIOUS_CLOSED_CANDLE",
    },
    candle: {
      open: 109500,
      high: 110500,
      low: 109000,
      close: 110000,
      volume: 12.5,
      openTime: Math.floor((now - 900_000) / 1000),
      closeTime: Math.floor(now / 1000),
      isClosed: false,
    },
    indicators: {
      sma20: 109200,
      sma50: 108800,
      ema50: 109000,
      rsi14: 62.4,
      macd: { value: 12, signal: 8, histogram: 4 },
      bollinger: { mid: 109500, upper: 111000, lower: 108000, widthPct: 2.7 },
      atr14: 450,
    },
    trend: { direction: "BULLISH", strength: "MODERATE", priceVsEma50: "ABOVE", sma20VsSma50: "ABOVE" },
    momentum: {
      rsi: 62.4,
      macd: { value: 12, signal: 8, histogram: 4 },
      classification: "POSITIVE",
    },
    volatility: { atr: 450, atrPercent: 0.41, classification: "LOW", period: 14 },
    volume: {
      current: 12.5,
      average: 10,
      relativeRatio: 1.25,
      classification: "ABOVE_AVERAGE",
      direction: "INCREASING",
      lookback: 20,
    },
    marketStructure: {
      trend: "BULLISH",
      lastSwingHigh: 111000,
      lastSwingLow: 108500,
      structureState: "BASIC_SWINGS",
    },
    supportResistance: null,
    supportResistanceReason: "MANUAL_ONLY",
    dataQuality: {
      connection: "CONNECTED",
      lastUpdate: now - 5_000,
      stale: true,
      candleCount: 200,
      valid: true,
    },
    dataSource: "binance-spot",
  };
  return {
    ...base,
    ...overrides,
    dataQuality: {
      ...base.dataQuality,
      ...(overrides?.dataQuality ?? {}),
    },
  };
}

describe("Forex Phase 20 — AI Market Analysis Engine", () => {
  it("reuses Market State, Knowledge, and Ollama adapter (no duplicates)", () => {
    const orchestrator = read("ai/forex-ai/orchestrator.ts");
    const engine = read("ai/forex-ai/analysis-engine.ts");
    const api = read("dev/server/forex-ai-api.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");

    expect(orchestrator).toContain("buildForexMarketState");
    expect(orchestrator).toContain("toForexAiMarketState");
    expect(orchestrator).toContain("retrieveRelevantForexKnowledge");
    expect(orchestrator).toContain("analyzeForexMarketState");
    expect(engine).toContain("getOllamaAdapter");
    expect(engine).not.toContain("http://127.0.0.1:11434");
    expect(api).toContain("runForexMarketAnalysis");
    expect(page).toContain("/api/forex/ai/analyze");
    expect(page).toContain("data-forex-ai-phase20");
    expect(page).not.toContain("11434");
  });

  it("accepts fresh CONNECTED Market State and rejects disconnected/stale/invalid", () => {
    const ok = assessMarketStateForAnalysis(sampleMarketState());
    expect(ok.ok).toBe(true);
    expect(ok.status).toBe("CONNECTED");

    const disconnected = assessMarketStateForAnalysis(sampleMarketState({
      dataQuality: { connection: "DISCONNECTED", stale: true, ageMs: 0, valid: true, reason: "ws down" },
    }));
    expect(disconnected.ok).toBe(false);
    expect(disconnected.code).toBe("DISCONNECTED");

    const stale = assessMarketStateForAnalysis(sampleMarketState({
      lastMarketUpdate: Date.now() - 60 * 60 * 1000,
    }));
    expect(stale.ok).toBe(false);
    expect(stale.code).toBe("STALE_DATA");

    const invalid = assessMarketStateForAnalysis(sampleMarketState({
      price: null as never,
      candle: null as never,
      dataQuality: { connection: "CONNECTED", stale: true, ageMs: 0, valid: false, reason: "NO_VALID_CANDLES" },
    }));
    expect(invalid.ok).toBe(false);
  });

  it("prompt includes supplied facts and knowledge as reference only", () => {
    const market = emptyForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "binance-spot",
      price: 110000,
      indicators: {
        sma: { "20": 109200 },
        ema: { "50": 109000 },
        rsi: 62.4,
        macd: { macd: 12, signal: 8, histogram: 4 },
        bollinger: { mid: null, upper: null, lower: null, widthPct: null },
      },
      trend: "BULLISH",
      momentum: "POSITIVE",
    });
    expect(marketStateHasAnalyzableFacts(market)).toBe(true);
    const prompt = buildForexAnalysisPrompt({
      market,
      knowledgeText: "[doc:abc v1] RSI guide\nRSI is a momentum oscillator.",
      analysisType: "TECHNICAL_ANALYSIS",
    });
    expect(prompt).toContain("MARKET FACTS");
    expect(prompt).toContain("FOREX KNOWLEDGE");
    expect(prompt).toContain("110000");
    expect(prompt).toContain("62.4");
    expect(prompt).toContain("BTCUSDT");
    expect(prompt).toContain("15m");
    expect(prompt).toContain("reference only");
    expect(FOREX_AI_SYSTEM_RULES).toContain("Never invent missing prices");
    expect(FOREX_AI_SYSTEM_RULES).toContain("Do not create BUY, SELL");
    expect(buildForexKnowledgeQuery(market)).toMatch(/RSI|momentum|trend/i);
  });

  it("excludes invented RSI/price and trade-execution language", () => {
    const market = emptyForexMarketState({
      symbol: "ETHUSDT",
      timeframe: "1h",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "binance-spot",
      price: 3500,
      indicators: {
        sma: {},
        ema: {},
        rsi: null,
        macd: { macd: null, signal: null, histogram: null },
        bollinger: { mid: null, upper: null, lower: null, widthPct: null },
      },
    });
    const inventedRsi = detectGroundingViolations("RSI is 78.5 and rising", market);
    expect(inventedRsi.some((f) => /RSI/i.test(f))).toBe(true);

    const badPrice = detectGroundingViolations("price is 5200 and accelerating", market);
    expect(badPrice.some((f) => /price/i.test(f))).toBe(true);

    const trade = detectGroundingViolations("Buy now with a market order", market);
    expect(trade.some((f) => /trade/i.test(f))).toBe(true);
  });

  it("parses structured analysis v1 with knowledge sources and null confidence", () => {
    const market = emptyForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "binance-spot",
      price: 110000,
      timestamp: "2026-10-07T10:00:00.000Z",
      indicators: {
        sma: {},
        ema: {},
        rsi: 62.4,
        macd: { macd: null, signal: null, histogram: null },
        bollinger: { mid: null, upper: null, lower: null, widthPct: null },
      },
    });
    const hits: ForexKnowledgeRetrievalHit[] = [{
      documentId: "doc-1",
      chunkId: "c1",
      title: "Understanding RSI",
      content: "RSI is a momentum oscillator.",
      relevanceScore: 2.5,
      categoryId: null,
      topicId: null,
      tags: ["rsi"],
      knowledgeType: "DEFINITION",
      sourceName: "manual",
      version: 1,
    }];
    const parsed = parseForexAiAnalysis({
      summary: "Momentum is constructive on supplied facts.",
      observed_facts: ["RSI14=62.4"],
      market_condition: "bullish bias",
      trend: "BULLISH",
      trend_explanation: "Price above EMA context from state.",
      momentum: "POSITIVE",
      volatility: "LOW",
      scenarios: [{
        type: "BULLISH",
        name: "Bullish continuation",
        status: "POSSIBLE",
        conditions: ["structure remains intact"],
        confirmation: ["momentum holds"],
        invalidation: ["structure breaks"],
        reasoning: "If structure holds, continuation remains possible.",
      }],
      confirmation_needed: ["hold structure"],
      invalidation: ["break below swing"],
      risks: ["news volatility"],
      limitations: ["single timeframe"],
      decision_posture: "OBSERVE",
      confidence: 0.91,
      reasoning: "Based only on supplied Market State.",
    }, {
      market,
      model: "test-model",
      knowledgeSources: toKnowledgeSources(hits),
      analysisType: "MARKET_OVERVIEW",
      dataQualityStatus: "CONNECTED",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.analysis.schemaVersion).toBe(FOREX_AI_ANALYSIS_SCHEMA_VERSION);
      expect(parsed.analysis.confidence).toBeNull();
      expect(parsed.analysis.symbol).toBe("BTCUSDT");
      expect(parsed.analysis.timeframe).toBe("15m");
      expect(parsed.analysis.market.displaySymbol).toBe("BTC/USDT");
      expect(parsed.analysis.knowledgeSources[0]?.title).toBe("Understanding RSI");
      expect(parsed.analysis.decisionPosture).toBe("OBSERVE");
      expect(parsed.analysis.observedFacts.some((f) => f.includes("62.4"))).toBe(true);
    }
  });

  it("rejects AI output that invents RSI when RSI was null", () => {
    const market = emptyForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "binance-spot",
      price: 100,
      indicators: {
        sma: {},
        ema: {},
        rsi: null,
        macd: { macd: null, signal: null, histogram: null },
        bollinger: { mid: null, upper: null, lower: null, widthPct: null },
      },
    });
    const parsed = parseForexAiAnalysis({
      summary: "RSI is 81 and overbought",
      trend: "BEARISH",
      momentum: "WEAK",
      volatility: "HIGH",
      reasoning: "RSI is 81 so sell soon",
      decision_posture: "WAIT",
    }, { market, model: "x" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe("AI_ANALYSIS_INVALID");
  });

  it("formats knowledge budget and display symbol helpers", () => {
    expect(formatDisplaySymbol("BTCUSDT")).toBe("BTC/USDT");
    const hits = toKnowledgeSources([{
      documentId: "a",
      chunkId: "1",
      title: "BOS",
      content: "x".repeat(2000),
      relevanceScore: 1,
      categoryId: null,
      topicId: null,
      tags: [],
      knowledgeType: "CONCEPT",
      sourceName: "",
      version: 2,
    }]);
    expect(hits).toHaveLength(1);
    expect(formatKnowledgeForPrompt([{
      documentId: "a",
      chunkId: "1",
      title: "BOS",
      content: "Break of structure explanation",
      relevanceScore: 3,
      categoryId: null,
      topicId: null,
      tags: [],
      knowledgeType: "CONCEPT",
      sourceName: "",
      version: 2,
    }])).toContain("BOS");
    const validated = validateForexMarketState({
      symbol: "btcusdt",
      timeframe: "15m",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "binance-spot",
      price: 1,
    });
    expect(validated.ok).toBe(true);
  });
});
