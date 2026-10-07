/**
 * Forex AI contracts — Phase 17 foundation + Phase 20 Market Analysis Engine.
 * Market numbers must come from the Binance / Technical Analysis / Market State engines.
 * Null means unknown; never invent values.
 */

export type ForexAiHealthState =
  | "AI_READY"
  | "AI_UNAVAILABLE"
  | "MODEL_NOT_AVAILABLE"
  | "AI_TIMEOUT"
  | "AI_ERROR"
  | "AI_DISABLED";

export type ForexAiScenarioType = "BULLISH" | "BEARISH" | "NEUTRAL" | "WAIT";

export type ForexAiAnalysisType =
  | "MARKET_OVERVIEW"
  | "TECHNICAL_ANALYSIS"
  | "MARKET_STRUCTURE"
  | "MOMENTUM"
  | "VOLATILITY"
  | "SCENARIO_ANALYSIS";

export type ForexAiDataQualityStatus =
  | "LIVE"
  | "CONNECTED"
  | "STALE_DATA"
  | "DISCONNECTED"
  | "DATA_UNAVAILABLE";

export type ForexAiDecisionPosture = "OBSERVE" | "WAIT" | "ANALYZE" | "INSUFFICIENT_DATA";

export type ForexAiErrorCode =
  | "AI_UNAVAILABLE"
  | "MODEL_NOT_AVAILABLE"
  | "AI_TIMEOUT"
  | "AI_FORMAT_ERROR"
  | "AI_ANALYSIS_INVALID"
  | "AI_ERROR"
  | "AI_DISABLED"
  | "INVALID_MARKET_STATE"
  | "INSUFFICIENT_MARKET_DATA"
  | "DATA_UNAVAILABLE"
  | "STALE_DATA"
  | "DISCONNECTED";

/** Structured market input for AI reasoning. Null = unknown (do not invent). */
export interface ForexMarketState {
  symbol: string;
  exchange: "BINANCE";
  marketType: "SPOT";
  timeframe: string;
  timestamp: string | null;
  price: number | null;
  candle: {
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
  };
  trend: string | null;
  momentum: string | null;
  volatility: string | null;
  indicators: {
    sma: Record<string, number | null>;
    ema: Record<string, number | null>;
    rsi: number | null;
    macd: {
      macd: number | null;
      signal: number | null;
      histogram: number | null;
    };
    bollinger: {
      mid: number | null;
      upper: number | null;
      lower: number | null;
      widthPct: number | null;
    };
  };
  marketStructure: Record<string, unknown>;
  supportResistance: {
    support: number[];
    resistance: number[];
  };
  dataSource: "binance-spot" | "none";
  live: boolean;
}

export interface ForexAiKnowledgeSource {
  documentId: string;
  title: string;
  relevanceScore: number;
  version: number;
}

export interface ForexAiScenario {
  type: ForexAiScenarioType;
  name?: string;
  status?: "POSSIBLE" | "WATCH" | "INACTIVE";
  conditions: string[];
  confirmation: string[];
  invalidation: string[];
  reasoning: string;
  supportingFacts?: string[];
}

/** Phase 20 output contract — forex-ai-analysis-v1 */
export interface ForexAiAnalysis {
  schemaVersion: "forex-ai-analysis-v1";
  analysisId: string;
  generatedAt: string;
  analysisType: ForexAiAnalysisType;
  market: {
    exchange: "BINANCE";
    symbol: string;
    displaySymbol: string;
    marketType: "SPOT" | "CRYPTO";
    timeframe: string;
  };
  dataQuality: {
    status: ForexAiDataQualityStatus;
    stale: boolean;
    marketTimestamp: string | null;
  };
  summary: string;
  observedFacts: string[];
  trend: { direction: string; explanation: string };
  momentum: { state: string; explanation: string };
  volatility: { state: string; explanation: string };
  marketStructure: { state: string; explanation: string };
  scenarios: ForexAiScenario[];
  confirmationNeeded: string[];
  invalidationConditions: string[];
  risks: string[];
  knowledgeSources: ForexAiKnowledgeSource[];
  limitations: string[];
  decisionPosture: ForexAiDecisionPosture;
  /** Qualitative model assessment only — never a fabricated probability. */
  confidence: null;
  model: string | null;
  dataTimestamp: string | null;
  promptVersion: string;
  engineVersion: string;
  /** @deprecated Prefer summary / structured fields. Kept for Phase 17 compat consumers. */
  symbol: string;
  timeframe: string;
  marketCondition: string;
  reasoning: string;
  invalidation: string[];
}

export interface ForexAiHealthPublic {
  state: ForexAiHealthState;
  ready: boolean;
  model: string | null;
  preferredModel: string;
  installedModels: string[];
  latencyMs: number | null;
  probedInference: boolean;
  baseUrlBound: "localhost";
  publicOllamaExposed: false;
  notes: string[];
  error?: string;
  ollamaCode?: string;
}

export interface ForexAiAnalyzeResult {
  ok: boolean;
  code: "OK" | ForexAiErrorCode;
  analysis: ForexAiAnalysis | null;
  latencyMs: number;
  error?: string;
  diagnostics?: {
    promptChars?: number;
    knowledgeHits?: number;
    model?: string | null;
    analysisType?: ForexAiAnalysisType;
  };
}

export interface ForexAiAnalysisRequest {
  symbol: string;
  timeframe: string;
  analysisType?: ForexAiAnalysisType;
  knowledgeQuery?: string;
  timeoutMs?: number;
}

export function emptyForexMarketState(partial?: Partial<ForexMarketState>): ForexMarketState {
  return {
    symbol: partial?.symbol ?? "",
    exchange: "BINANCE",
    marketType: "SPOT",
    timeframe: partial?.timeframe ?? "",
    timestamp: partial?.timestamp ?? null,
    price: partial?.price ?? null,
    candle: {
      open: partial?.candle?.open ?? null,
      high: partial?.candle?.high ?? null,
      low: partial?.candle?.low ?? null,
      close: partial?.candle?.close ?? null,
      volume: partial?.candle?.volume ?? null,
    },
    trend: partial?.trend ?? null,
    momentum: partial?.momentum ?? null,
    volatility: partial?.volatility ?? null,
    indicators: {
      sma: partial?.indicators?.sma ?? {},
      ema: partial?.indicators?.ema ?? {},
      rsi: partial?.indicators?.rsi ?? null,
      macd: {
        macd: partial?.indicators?.macd?.macd ?? null,
        signal: partial?.indicators?.macd?.signal ?? null,
        histogram: partial?.indicators?.macd?.histogram ?? null,
      },
      bollinger: {
        mid: partial?.indicators?.bollinger?.mid ?? null,
        upper: partial?.indicators?.bollinger?.upper ?? null,
        lower: partial?.indicators?.bollinger?.lower ?? null,
        widthPct: partial?.indicators?.bollinger?.widthPct ?? null,
      },
    },
    marketStructure: partial?.marketStructure ?? {},
    supportResistance: {
      support: partial?.supportResistance?.support ?? [],
      resistance: partial?.supportResistance?.resistance ?? [],
    },
    dataSource: partial?.dataSource ?? "none",
    live: partial?.live ?? false,
  };
}
