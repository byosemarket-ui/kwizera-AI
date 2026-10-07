/**
 * Phase 21 — Multi-timeframe AI contracts.
 */
import type { ForexBinanceMarketState } from "../../forex-market-state/types.js";
import type { NormalizedTimeframeId } from "../../market-data/binance/types.js";
import type { ForexAiDecisionPosture, ForexAiErrorCode, ForexAiKnowledgeSource } from "../types.js";
import type { ForexMtfRole } from "./config.js";

export type ForexMtfAlignment =
  | "ALIGNED_BULLISH"
  | "ALIGNED_BEARISH"
  | "MIXED"
  | "CONFLICTING"
  | "INSUFFICIENT_DATA";

export type ForexMtfDataQuality =
  | "COMPLETE_LIVE"
  | "COMPLETE_CONNECTED"
  | "PARTIALLY_STALE"
  | "STALE"
  | "DISCONNECTED"
  | "INSUFFICIENT_DATA";

export type ForexMtfScenarioType =
  | "BULLISH_CONTINUATION"
  | "BEARISH_CONTINUATION"
  | "PULLBACK"
  | "CONSOLIDATION"
  | "CONFLICT"
  | "WAIT"
  | "INSUFFICIENT_DATA";

export type ForexMtfNarrativeStatus = "MODEL" | "MARKET_STATE_ONLY";

export interface ForexMtfCompactFacts {
  timeframe: NormalizedTimeframeId;
  role: ForexMtfRole;
  usable: boolean;
  status: string;
  trend: string | null;
  momentum: string | null;
  volatility: string | null;
  rsi: number | null;
  ema50: number | null;
  sma20: number | null;
  sma50: number | null;
  structure: string | null;
  price: number | null;
  candleOpen: boolean | null;
  timestamp: string | null;
  reason?: string;
}

export interface ForexMtfSlot {
  timeframe: NormalizedTimeframeId;
  role: ForexMtfRole;
  marketState: ForexBinanceMarketState | null;
  compact: ForexMtfCompactFacts;
}

export interface ForexMultiTimeframeMarketState {
  symbol: string;
  exchange: "BINANCE";
  marketType: "SPOT";
  displaySymbol: string;
  generatedAt: string;
  timeframes: NormalizedTimeframeId[];
  required: NormalizedTimeframeId[];
  slots: ForexMtfSlot[];
  dataQuality: ForexMtfDataQuality;
}

export interface ForexMtfAlignmentResult {
  overall: ForexMtfAlignment;
  higherBias: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
  higherBasis: string[];
  intermediateState: string;
  lowerState: string;
  confluence: string[];
  conflicts: string[];
  notes: string[];
}

export interface ForexMtfTimeframeAnalysis {
  timeframe: string;
  role: ForexMtfRole;
  observedFacts: string[];
  interpretation: string;
}

export interface ForexMtfScenario {
  type: ForexMtfScenarioType;
  name: string;
  status: "POSSIBLE" | "WATCH" | "INACTIVE";
  reasoning: string;
  conditions: string[];
  confirmation: string[];
  invalidation: string[];
}

export interface ForexMtfAiAnalysis {
  schemaVersion: "forex-mtf-ai-analysis-v1";
  analysisId: string;
  generatedAt: string;
  narrativeStatus: ForexMtfNarrativeStatus;
  market: {
    exchange: "BINANCE";
    symbol: string;
    displaySymbol: string;
    marketType: "SPOT" | "CRYPTO";
  };
  timeframes: NormalizedTimeframeId[];
  timeframeStates: ForexMtfCompactFacts[];
  dataQuality: {
    status: ForexMtfDataQuality;
    perTimeframe: Array<{ timeframe: string; status: string; timestamp: string | null }>;
  };
  overallAlignment: ForexMtfAlignmentResult;
  higherTimeframeBias: {
    direction: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
    basis: string[];
  };
  intermediateTimeframeState: string;
  lowerTimeframeState: string;
  timeframeAnalysis: ForexMtfTimeframeAnalysis[];
  confluence: string[];
  conflicts: string[];
  scenarios: ForexMtfScenario[];
  confirmationNeeded: string[];
  invalidationConditions: string[];
  risks: string[];
  knowledgeSources: ForexAiKnowledgeSource[];
  limitations: string[];
  decisionPosture: ForexAiDecisionPosture;
  confidence: null;
  model: string | null;
  promptVersion: string;
  engineVersion: string;
}

export interface ForexMtfAnalyzeRequest {
  symbol: string;
  timeframes?: string[];
  analysisType?: string;
  knowledgeQuery?: string;
  timeoutMs?: number;
}

export interface ForexMtfAnalyzeResult {
  ok: boolean;
  code: "OK" | ForexAiErrorCode | "UNSUPPORTED_TIMEFRAME" | "MTF_INSUFFICIENT_DATA";
  analysis: ForexMtfAiAnalysis | null;
  latencyMs: number;
  error?: string;
  diagnostics?: {
    promptChars?: number;
    knowledgeHits?: number;
    model?: string | null;
    timeframes?: string[];
    marketStateMs?: number;
  };
}
