/**
 * Phase 20 — Forex AI Market Analysis orchestrator.
 * Binance → Market State → Knowledge retrieval → Ollama → validated ForexAiAnalysis.
 */
import { buildForexMarketState, toForexAiMarketState } from "../forex-market-state/index.js";
import { getForexKnowledgeService } from "../forex-knowledge/index.js";
import type { ForexKnowledgeRetrievalHit } from "../forex-knowledge/types.js";
import { parseInterval } from "../market-data/binance/adapter.js";
import { createBinanceMarketDataService, type BinanceMarketDataService } from "../market-data/binance/service.js";
import { userFacingBinanceError } from "../market-data/binance/errors.js";
import { analyzeForexMarketState } from "./analysis-engine.js";
import { assessMarketStateForAnalysis } from "./data-quality.js";
import {
  buildForexKnowledgeQuery,
  FOREX_AI_KNOWLEDGE_TOP_K,
} from "./knowledge-query.js";
import type {
  ForexAiAnalysisRequest,
  ForexAiAnalysisType,
  ForexAiAnalyzeResult,
} from "./types.js";

const ANALYSIS_TYPES = new Set<ForexAiAnalysisType>([
  "MARKET_OVERVIEW",
  "TECHNICAL_ANALYSIS",
  "MARKET_STRUCTURE",
  "MOMENTUM",
  "VOLATILITY",
  "SCENARIO_ANALYSIS",
]);

let defaultBinance: BinanceMarketDataService | null = null;

function getBinance(): BinanceMarketDataService {
  defaultBinance ??= createBinanceMarketDataService();
  return defaultBinance;
}

function parseAnalysisType(value: unknown): ForexAiAnalysisType {
  const raw = String(value ?? "MARKET_OVERVIEW").toUpperCase() as ForexAiAnalysisType;
  return ANALYSIS_TYPES.has(raw) ? raw : "MARKET_OVERVIEW";
}

/**
 * Authoritative server-side analysis: builds Market State (does not trust client market facts).
 */
export async function runForexMarketAnalysis(
  request: ForexAiAnalysisRequest,
  deps?: {
    binance?: BinanceMarketDataService;
    nowMs?: number;
  },
): Promise<ForexAiAnalyzeResult> {
  const started = Date.now();
  const symbol = String(request.symbol ?? "").trim().toUpperCase();
  const timeframe = parseInterval(String(request.timeframe ?? "").trim().toLowerCase());
  const analysisType = parseAnalysisType(request.analysisType);

  if (!/^[A-Z0-9]{4,30}$/.test(symbol) || !timeframe) {
    return {
      ok: false,
      code: "INVALID_MARKET_STATE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: "Require symbol (e.g. BTCUSDT) and supported timeframe (e.g. 15m).",
    };
  }

  let series;
  try {
    const binance = deps?.binance ?? getBinance();
    series = await binance.listKlines({ symbol, timeframe, limit: 300 });
  } catch (error) {
    const mapped = userFacingBinanceError(error);
    return {
      ok: false,
      code: mapped.code === "BINANCE_DISABLED" ? "DATA_UNAVAILABLE" : "DATA_UNAVAILABLE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: mapped.message,
    };
  }

  const marketState = buildForexMarketState({
    symbol: series.symbol,
    timeframe: series.timeframe,
    candles: series.candles,
    connection: series.candles.length > 0 ? "CONNECTED" : "NO_DATA",
    lastMarketUpdateMs: series.candles.length
      ? series.candles[series.candles.length - 1]!.time * 1000
      : null,
  });

  const quality = assessMarketStateForAnalysis(marketState, deps?.nowMs ?? Date.now());
  if (!quality.ok) {
    return {
      ok: false,
      code: quality.code,
      analysis: null,
      latencyMs: Date.now() - started,
      error: quality.reason ?? quality.code,
      diagnostics: { analysisType, knowledgeHits: 0 },
    };
  }

  const aiMarketState = toForexAiMarketState(marketState);
  const knowledgeQuery = String(request.knowledgeQuery ?? "").trim()
    || buildForexKnowledgeQuery(aiMarketState, analysisType);

  let knowledgeHits: ForexKnowledgeRetrievalHit[] = [];
  try {
    knowledgeHits = await getForexKnowledgeService().retrieveRelevantForexKnowledge({
      query: knowledgeQuery,
      limit: FOREX_AI_KNOWLEDGE_TOP_K,
    });
  } catch (error) {
    // Knowledge failure must not invent knowledge — continue without it.
    console.warn(
      "[forex-ai] knowledge retrieval failed",
      error instanceof Error ? error.message : error,
    );
    knowledgeHits = [];
  }

  return analyzeForexMarketState(aiMarketState, {
    timeoutMs: request.timeoutMs ?? 120_000,
    knowledgeHits,
    analysisType,
    dataQualityStatus: quality.status,
    dataQualityStale: quality.stale,
  });
}
