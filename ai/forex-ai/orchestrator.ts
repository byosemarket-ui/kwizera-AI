/**
 * Phase 20/32/38E — Forex AI Market Analysis orchestrator.
 * Unified Market Data → Detectors → Market State → Knowledge → Ollama → validated ForexAiAnalysis.
 * Provider identity is explicit; no silent Binance↔FXCM↔ForexConnect fallback.
 */
import { buildForexMarketState, toForexAiMarketState } from "../forex-market-state/index.js";
import { getForexKnowledgeService } from "../forex-knowledge/index.js";
import type { ForexKnowledgeRetrievalHit } from "../forex-knowledge/types.js";
import { parseCanonicalTimeframe } from "../market-data/providers/contracts.js";
import {
  normalizeCanonicalSymbol,
  parseMarketProviderId,
} from "../market-data/providers/identity.js";
import {
  getMarketDataService,
  MarketDataRoutingError,
  type MarketDataService,
} from "../market-data/providers/market-data-service.js";
import type { MarketProviderId } from "../market-data/providers/types.js";
import { userFacingBinanceError } from "../market-data/binance/errors.js";
import { userFacingFxcmError } from "../market-data/fxcm/errors.js";
import { userFacingForexConnectError } from "../market-data/forexconnect/errors.js";
import { analyzeForexMarketState } from "./analysis-engine.js";
import { assessMarketStateForAnalysis } from "./data-quality.js";
import {
  buildEvidenceAwareKnowledgeQuery,
  buildForexAiEvidencePack,
  enrichEvidencePackKnowledge,
  type ForexAiEvidencePack,
} from "./evidence/index.js";
import {
  buildForexKnowledgeQuery,
  FOREX_AI_KNOWLEDGE_TOP_K,
  sanitizeKnowledgeQueryInput,
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

function parseAnalysisType(value: unknown): ForexAiAnalysisType {
  const raw = String(value ?? "MARKET_OVERVIEW").toUpperCase() as ForexAiAnalysisType;
  return ANALYSIS_TYPES.has(raw) ? raw : "MARKET_OVERVIEW";
}

function resolveProvider(raw: unknown): MarketProviderId {
  return parseMarketProviderId(raw) ?? "BINANCE";
}

function isForexSlashProvider(provider: MarketProviderId): boolean {
  return provider === "FXCM" || provider === "FOREXCONNECT";
}

function mapProviderError(provider: MarketProviderId, error: unknown): string {
  if (error instanceof MarketDataRoutingError) return error.message;
  if (provider === "FXCM") return userFacingFxcmError(error).message;
  if (provider === "FOREXCONNECT") return userFacingForexConnectError(error).message;
  return userFacingBinanceError(error).message;
}

/**
 * Authoritative server-side analysis: builds Market State from unified MarketDataService.
 */
export async function runForexMarketAnalysis(
  request: ForexAiAnalysisRequest,
  deps?: {
    marketData?: MarketDataService;
    nowMs?: number;
  },
): Promise<ForexAiAnalyzeResult> {
  const started = Date.now();
  const provider = resolveProvider(request.provider);
  const symbolRaw = String(request.symbol ?? "").trim();
  // FOREXCONNECT / FXCM may use display symbols with `/` — do not force-strip before fetch.
  const symbol = isForexSlashProvider(provider)
    ? symbolRaw
    : normalizeCanonicalSymbol(symbolRaw);
  const timeframe = parseCanonicalTimeframe(String(request.timeframe ?? "").trim().toLowerCase());
  const analysisType = parseAnalysisType(request.analysisType);
  const compact = normalizeCanonicalSymbol(symbol);

  if (!/^[A-Z0-9]{4,30}$/.test(compact) || !timeframe) {
    return {
      ok: false,
      code: "INVALID_MARKET_STATE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: "Require symbol and supported timeframe (e.g. 15m). Prefer explicit provider.",
    };
  }

  let series;
  try {
    const marketData = deps?.marketData ?? getMarketDataService();
    series = isForexSlashProvider(provider)
      ? (marketData.getLiveCandleSeries({ provider, symbol, timeframe })
        ?? await marketData.getHistoricalCandles({ provider, symbol, timeframe, limit: 300 }))
      : await marketData.getHistoricalCandles({ provider, symbol, timeframe, limit: 300 });
    if (series.identity.provider !== provider) {
      return {
        ok: false,
        code: "INVALID_MARKET_STATE",
        analysis: null,
        latencyMs: Date.now() - started,
        error: "Candle series provider does not match the requested provider.",
      };
    }
  } catch (error) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: mapProviderError(provider, error),
    };
  }

  const identitySymbol = series.identity.canonicalSymbol || compact;
  const displaySymbol = series.identity.displaySymbol || symbol;
  const providerSymbol = series.identity.providerSymbol || symbol;
  const environment = series.identity.environment ?? null;

  const evidenceStarted = Date.now();
  let evidencePack: ForexAiEvidencePack = buildForexAiEvidencePack({
    provider,
    environment,
    symbol: identitySymbol,
    timeframe: series.timeframe,
    candles: series.candles,
    priceBasis: provider === "FOREXCONNECT" ? "bid" : provider === "FXCM" ? "mid" : null,
  });
  const evidenceLatencyMs = Date.now() - evidenceStarted;

  const marketState = buildForexMarketState({
    symbol: identitySymbol,
    timeframe: series.timeframe,
    candles: series.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
      closed: c.isClosed,
    })),
    connection: series.connectionState === "LIVE" ? "LIVE"
      : series.candles.length > 0 ? "CONNECTED" : "NO_DATA",
    lastMarketUpdateMs: series.lastQuoteAt
      ? Date.parse(series.lastQuoteAt)
      : (series.candles.length ? series.candles[series.candles.length - 1]!.time * 1000 : null),
    provider,
    marketType: isForexSlashProvider(provider) ? "FOREX" : "SPOT",
    displaySymbol,
    providerSymbol,
    canonicalSymbol: identitySymbol,
  });

  const quality = assessMarketStateForAnalysis(marketState, deps?.nowMs ?? Date.now());
  if (!quality.ok) {
    return {
      ok: false,
      code: quality.code,
      analysis: null,
      latencyMs: Date.now() - started,
      error: quality.reason ?? quality.code,
      evidencePack,
      evidenceLatencyMs,
      diagnostics: { analysisType, knowledgeHits: 0 },
    };
  }

  const aiMarketState = toForexAiMarketState(marketState);
  // Merge STRUCTURE_V1 summary without breaking BASIC_SWINGS consumers.
  aiMarketState.marketStructure = {
    ...aiMarketState.marketStructure,
    structureV1: {
      trendState: evidencePack.structure.trendState,
      ruleVersion: evidencePack.structure.ruleVersion,
      eventCount: evidencePack.structure.events.length,
    },
  };

  const baseQuery = sanitizeKnowledgeQueryInput(request.knowledgeQuery)
    || buildForexKnowledgeQuery(aiMarketState, analysisType);
  const knowledgeQuery = buildEvidenceAwareKnowledgeQuery(baseQuery, evidencePack);

  let knowledgeHits: ForexKnowledgeRetrievalHit[] = [];
  try {
    knowledgeHits = await getForexKnowledgeService().retrieveRelevantForexKnowledge({
      query: knowledgeQuery,
      limit: FOREX_AI_KNOWLEDGE_TOP_K,
    });
  } catch (error) {
    console.warn(
      "[forex-ai] knowledge retrieval failed",
      error instanceof Error ? error.message : error,
    );
    knowledgeHits = [];
  }

  evidencePack = enrichEvidencePackKnowledge(evidencePack, knowledgeHits);

  const result = await analyzeForexMarketState(aiMarketState, {
    timeoutMs: request.timeoutMs ?? 120_000,
    knowledgeHits,
    analysisType,
    dataQualityStatus: quality.status,
    dataQualityStale: quality.stale,
    evidencePack,
  });

  return {
    ...result,
    evidencePack: result.evidencePack ?? evidencePack,
    evidenceLatencyMs,
  };
}
