/**
 * Phase 22 — Decision / Scenario / Entry-Zone contracts.
 */
import type { NormalizedTimeframeId } from "../../market-data/binance/types.js";
import type { ForexAiKnowledgeSource } from "../types.js";
import type {
  ForexMtfAlignmentResult,
  ForexMtfCompactFacts,
  ForexMtfDataQuality,
  ForexMultiTimeframeMarketState,
} from "../mtf/types.js";

export type ForexDecisionScenarioType =
  | "BULLISH_CONTINUATION"
  | "BEARISH_CONTINUATION"
  | "BULLISH_PULLBACK"
  | "BEARISH_PULLBACK"
  | "RANGE_CONSOLIDATION"
  | "BREAKOUT_WATCH"
  | "BREAKDOWN_WATCH"
  | "REVERSAL_WATCH"
  | "CONFLICT"
  | "WAIT"
  | "INSUFFICIENT_DATA";

export type ForexDecisionPosture =
  | "WAIT"
  | "WATCH"
  | "CONFIRMATION_REQUIRED"
  | "SCENARIO_ACTIVE"
  | "INVALIDATED"
  | "INSUFFICIENT_DATA";

export type ForexScenarioDirection = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";

export type ForexEntryZoneStatus =
  | "CANDIDATE"
  | "ACTIVE"
  | "WAITING_CONFIRMATION"
  | "INVALIDATED"
  | "UNAVAILABLE";

export type ForexConfirmationCategory =
  | "STRUCTURE"
  | "MOMENTUM"
  | "CANDLE"
  | "MULTI_TIMEFRAME_ALIGNMENT"
  | "VOLATILITY"
  | "DATA_QUALITY";

export type ForexConditionStatus = "MET" | "NOT_MET" | "UNKNOWN" | "NOT_APPLICABLE";

export type ForexDecisionNarrativeStatus = "MODEL" | "DETERMINISTIC_ONLY";

export interface ForexConfirmationCondition {
  id: string;
  category: ForexConfirmationCategory;
  description: string;
  status: ForexConditionStatus;
  observedValue: string | null;
  requiredValue: string | null;
  timeframe: string | null;
  timestamp: string | null;
}

export interface ForexInvalidationCondition {
  id: string;
  description: string;
  status: ForexConditionStatus;
  level: number | null;
  timeframe: string | null;
  basis: string;
}

export interface ForexEntryZone {
  id: string;
  symbol: string;
  timeframe: NormalizedTimeframeId | null;
  scenario: ForexDecisionScenarioType;
  status: ForexEntryZoneStatus;
  lowerBound: number | null;
  upperBound: number | null;
  referencePrice: number | null;
  currentPrice: number | null;
  basis: string[];
  supportingFacts: string[];
  confirmationRequired: string[];
  invalidationLevel: number | null;
  createdAt: string;
  dataTimestamp: string | null;
  dataQuality: string;
  unavailableReason: string | null;
}

export interface ForexDecisionScenario {
  type: ForexDecisionScenarioType;
  direction: ForexScenarioDirection;
  name: string;
  evidence: string[];
  notes: string[];
}

export interface ForexRiskContext {
  volatility: string | null;
  atr: number | null;
  atrPercent: number | null;
  distanceToEntry: number | null;
  distanceToInvalidation: number | null;
  timeframeConflict: boolean;
  dataQuality: ForexMtfDataQuality;
  factors: string[];
}

export interface ForexRiskReward {
  risk: number | null;
  reward: number | null;
  ratio: number | null;
  method: string | null;
  unavailableReason: string | null;
}

export interface ForexDecisionAnalysis {
  schemaVersion: "forex-decision-analysis-v1";
  analysisId: string;
  generatedAt: string;
  narrativeStatus: ForexDecisionNarrativeStatus;
  market: {
    exchange: "BINANCE" | "FXCM";
    symbol: string;
    displaySymbol: string;
    marketType: "SPOT" | "FOREX";
    currentPrice: number | null;
  };
  timeframes: NormalizedTimeframeId[];
  timeframeStates: ForexMtfCompactFacts[];
  dataQuality: {
    status: ForexMtfDataQuality;
    perTimeframe: Array<{ timeframe: string; status: string; timestamp: string | null }>;
  };
  alignment: ForexMtfAlignmentResult;
  scenario: ForexDecisionScenario;
  entryZone: ForexEntryZone;
  confirmation: {
    conditions: ForexConfirmationCondition[];
    allRequiredMet: boolean;
    summary: string;
  };
  invalidation: {
    conditions: ForexInvalidationCondition[];
    triggered: boolean;
    summary: string;
  };
  riskContext: ForexRiskContext;
  riskReward: ForexRiskReward;
  stopLossCandidate: number | null;
  takeProfitCandidates: number[];
  decisionPosture: ForexDecisionPosture;
  observedFacts: string[];
  deterministicSummary: string;
  aiInterpretation: string | null;
  knowledgeSources: ForexAiKnowledgeSource[];
  memorySources: Array<{
    memoryId: string;
    symbol: string;
    timeframe: string | null;
    scenario: string | null;
    outcome: string;
    relevance: string;
    timestamp: string;
  }>;
  memoryUnavailable: boolean;
  knowledgeUnavailable: boolean;
  limitations: string[];
  confidence: null;
  model: string | null;
  promptVersion: string;
  engineVersion: string;
}

export interface ForexDecisionAnalyzeRequest {
  symbol: string;
  timeframes?: string[];
  scenarioMode?: string;
  knowledgeQuery?: string;
  timeoutMs?: number;
  /** Explicit provider — Decision MTF stack must stay single-provider. */
  provider?: "BINANCE" | "FXCM";
}

export interface ForexDecisionAnalyzeResult {
  ok: boolean;
  code: "OK" | "INVALID_MARKET_STATE" | "UNSUPPORTED_TIMEFRAME" | "DATA_UNAVAILABLE" | "AI_ERROR";
  analysis: ForexDecisionAnalysis | null;
  latencyMs: number;
  error?: string;
  diagnostics?: {
    promptChars?: number;
    knowledgeHits?: number;
    memoryHits?: number;
    model?: string | null;
    timeframes?: string[];
    marketStateMs?: number;
    deterministicMs?: number;
    memoryMs?: number;
    promptVersion?: string;
  };
}

/** Internal deterministic pack passed between engines. */
export interface ForexDecisionDeterministicPack {
  mtf: ForexMultiTimeframeMarketState;
  alignment: ForexMtfAlignmentResult;
  scenario: ForexDecisionScenario;
  entryZone: ForexEntryZone;
  confirmation: ForexDecisionAnalysis["confirmation"];
  invalidation: ForexDecisionAnalysis["invalidation"];
  riskContext: ForexRiskContext;
  riskReward: ForexRiskReward;
  stopLossCandidate: number | null;
  takeProfitCandidates: number[];
  decisionPosture: ForexDecisionPosture;
  observedFacts: string[];
  deterministicSummary: string;
}
