/**
 * Truthful degradation when Ollama returns non-JSON.
 * Assembles ForexAiAnalysis only from supplied Market State — never invents numbers
 * and never pretends the model produced a narrative.
 */
import { randomUUID } from "node:crypto";
import { formatDisplaySymbol } from "./data-quality.js";
import {
  FOREX_AI_ANALYSIS_SCHEMA_VERSION,
  FOREX_AI_ENGINE_VERSION,
  FOREX_ANALYSIS_PROMPT_VERSION,
} from "./prompts.js";
import type {
  ForexAiAnalysis,
  ForexAiAnalysisType,
  ForexAiDataQualityStatus,
  ForexAiKnowledgeSource,
  ForexMarketState,
} from "./types.js";

export function assembleGroundedMarketReadout(input: {
  market: ForexMarketState;
  model: string | null;
  knowledgeSources: ForexAiKnowledgeSource[];
  analysisType: ForexAiAnalysisType;
  dataQualityStatus: ForexAiDataQualityStatus;
  dataQualityStale: boolean;
  reason: string;
}): ForexAiAnalysis {
  const { market } = input;
  const observedFacts = [
    `Symbol ${market.symbol} · timeframe ${market.timeframe} · exchange BINANCE SPOT`,
    market.price != null ? `Last price ${market.price}` : "Last price unavailable",
    market.candle.close != null
      ? `Candle O=${market.candle.open} H=${market.candle.high} L=${market.candle.low} C=${market.candle.close} V=${market.candle.volume}`
      : "Candle OHLC unavailable",
    market.indicators.rsi != null ? `RSI14=${market.indicators.rsi}` : "RSI14 unavailable (not provided)",
    market.indicators.ema["50"] != null ? `EMA50=${market.indicators.ema["50"]}` : "EMA50 unavailable",
    market.indicators.sma["20"] != null ? `SMA20=${market.indicators.sma["20"]}` : "SMA20 unavailable",
    market.indicators.sma["50"] != null ? `SMA50=${market.indicators.sma["50"]}` : "SMA50 unavailable",
    market.trend ? `Classified trend=${market.trend}` : "Trend classification unavailable",
    market.momentum ? `Classified momentum=${market.momentum}` : "Momentum classification unavailable",
    market.volatility ? `Classified volatility=${market.volatility}` : "Volatility classification unavailable",
    `live=${market.live} · dataSource=${market.dataSource}`,
  ];

  return {
    schemaVersion: FOREX_AI_ANALYSIS_SCHEMA_VERSION,
    analysisId: randomUUID(),
    generatedAt: new Date().toISOString(),
    analysisType: input.analysisType,
    market: {
      exchange: "BINANCE",
      symbol: market.symbol,
      displaySymbol: formatDisplaySymbol(market.symbol),
      marketType: "CRYPTO",
      timeframe: market.timeframe,
    },
    dataQuality: {
      status: input.dataQualityStatus,
      stale: input.dataQualityStale,
      marketTimestamp: market.timestamp,
    },
    summary: "Grounded Market State readout only — Ollama did not return valid JSON for interpretive narrative.",
    observedFacts,
    trend: {
      direction: market.trend || "Insufficient data",
      explanation: "Taken from Phase 18 Market State classification; no model narrative available.",
    },
    momentum: {
      state: market.momentum || "Insufficient data",
      explanation: "Taken from Phase 18 Market State classification; no model narrative available.",
    },
    volatility: {
      state: market.volatility || "Insufficient data",
      explanation: "Taken from Phase 18 Market State classification; no model narrative available.",
    },
    marketStructure: {
      state: String(market.marketStructure.structureState ?? market.trend ?? "Insufficient data"),
      explanation: "Taken from supplied Market State structure fields only.",
    },
    scenarios: [{
      type: "WAIT",
      name: "Wait for valid AI narrative",
      status: "POSSIBLE",
      conditions: ["Valid Ollama JSON response"],
      confirmation: [],
      invalidation: [],
      reasoning: "Interpretive scenarios withheld because the model response was not valid JSON.",
      supportingFacts: observedFacts.slice(0, 4),
    }],
    confirmationNeeded: ["Retry analysis when the model returns valid JSON"],
    invalidationConditions: [],
    risks: ["Local model format failure can omit interpretive scenarios"],
    knowledgeSources: input.knowledgeSources,
    limitations: [
      input.reason,
      "No invented prices or indicators.",
      "AI narrative unavailable; facts are from Market State only.",
      "Not a trade signal and not trade execution.",
    ],
    decisionPosture: "WAIT",
    confidence: null,
    model: input.model,
    dataTimestamp: market.timestamp,
    promptVersion: FOREX_ANALYSIS_PROMPT_VERSION,
    engineVersion: FOREX_AI_ENGINE_VERSION,
    symbol: market.symbol,
    timeframe: market.timeframe,
    marketCondition: "Grounded readout (model JSON unavailable)",
    reasoning: "Ollama did not return parseable JSON after a controlled repair attempt. Returning Market State facts only.",
    invalidation: [],
  };
}
