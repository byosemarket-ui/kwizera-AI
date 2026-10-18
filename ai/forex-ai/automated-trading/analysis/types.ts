/**
 * Phase 53 — Independent Automated Trading OpenAI technical analysis contracts.
 * Separate from Forex AI Analysis snapshot history. Read-only — no broker orders.
 */
import type { AutomatedTradingEnvironment } from "../types.js";

export const AT_OPENAI_ANALYSIS_SCHEMA = "at-openai-ta-v1";
export const AT_OPENAI_ANALYSIS_PHASE = "53";
export const AT_CONFIDENCE_LABEL = "NOT CALIBRATED";

export type AtAnalysisLifecycle =
  | "ANALYSIS_PENDING"
  | "ANALYSIS_VALID"
  | "ANALYSIS_INVALID"
  | "ANALYSIS_FAILED"
  | "DATA_INSUFFICIENT"
  | "STALE_RESULT";

export type AtDirectionalBias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";

export type AtTrendState =
  | "UPTREND"
  | "DOWNTREND"
  | "RANGE"
  | "TRANSITION"
  | "UNKNOWN";

export type AtMtfAgreement =
  | "AGREE_BULLISH"
  | "AGREE_BEARISH"
  | "CONFLICT"
  | "INSUFFICIENT"
  | "UNKNOWN";

export type AtDataQualityState =
  | "SUFFICIENT"
  | "PARTIAL"
  | "HISTORICAL_ONLY"
  | "INSUFFICIENT"
  | "STALE_QUOTE";

export interface AtPriceLevel {
  price: number | null;
  timeframe: string | null;
  sourceCandleTime: string | null;
  provenance: string | null;
  verifiedAgainstSnapshot: boolean;
  unavailableReason: string | null;
}

export interface AtScenario {
  id: "bullish" | "bearish";
  summary: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  confirmationConditions: string[];
  invalidationConditions: string[];
  potentialEntryZone: AtPriceLevel | null;
}

export interface AtCandleSummary {
  timeframe: string;
  count: number;
  firstTimeUtc: string | null;
  lastTimeUtc: string | null;
  historicalOnly: boolean;
  ohlcFingerprint: string;
}

export interface AtAnalysisEvidenceBundle {
  fingerprint: string;
  environment: AutomatedTradingEnvironment;
  instrument: string;
  timeframes: string[];
  candles: AtCandleSummary[];
  bid: number | null;
  ask: number | null;
  quoteFresh: boolean;
  feedStatus: string | null;
  historicalOnly: boolean;
  verificationIdentityStatus: string | null;
  warnings: string[];
  builtAtUtc: string;
}

export interface AtOpenAiAnalysisResult {
  schemaVersion: typeof AT_OPENAI_ANALYSIS_SCHEMA;
  phase: typeof AT_OPENAI_ANALYSIS_PHASE;
  analysisId: string;
  lifecycle: AtAnalysisLifecycle;
  environment: AutomatedTradingEnvironment;
  environmentEpoch: number;
  instrument: string;
  timeframes: string[];
  inputFingerprint: string;
  provider: "OPENAI";
  modelRequested: string;
  modelUsed: string | null;
  directionalBias: AtDirectionalBias;
  trendState: AtTrendState;
  trendStrength: "STRONG" | "MODERATE" | "WEAK" | "UNKNOWN";
  mtfAgreement: AtMtfAgreement;
  keyEvidence: string[];
  counterEvidence: string[];
  supportLevels: AtPriceLevel[];
  resistanceLevels: AtPriceLevel[];
  patterns: Array<{
    name: string;
    timeframe: string | null;
    candleTimes: string[];
    provenance: string | null;
  }>;
  structureNotes: string[];
  scenarios: AtScenario[];
  explanation: string;
  dataQuality: AtDataQualityState;
  limitations: string[];
  blockers: Array<{ code: string; message: string }>;
  confidenceLabel: typeof AT_CONFIDENCE_LABEL;
  /** Explicit: never win probability. */
  evidenceScoreIsWinProbability: false;
  createdAtUtc: string;
  latencyMs: number;
  placesOrders: false;
  historicalOnly: boolean;
}

export interface AtOpenAiAnalysisPublicStatus {
  provider: "OPENAI";
  modelConfigured: string | null;
  apiKeyConfigured: boolean;
  latest: AtOpenAiAnalysisResult | null;
  historyCount: number;
  inFlight: boolean;
  placesOrders: false;
}

export interface AtOpenAiRunRequest {
  environment?: unknown;
  expectedEnvironmentEpoch?: unknown;
  instrument?: unknown;
  timeframes?: unknown;
  timeoutMs?: unknown;
}
