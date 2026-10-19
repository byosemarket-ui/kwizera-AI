/**
 * Phase 53 / 53.2 / 53.3 — Independent Automated Trading OpenAI technical analysis contracts.
 * Separate from Forex AI Analysis snapshot history. Read-only — no broker orders.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import {
  AT_DIRECTIONAL_CONFIDENCE_NOTE,
  type AtBinaryDirection,
} from "./direction.js";
export type { AtBinaryDirection } from "./direction.js";
export {
  AT_DIRECTIONAL_CONFIDENCE_NOTE,
  AT_BINARY_DIRECTION_SCHEMA,
} from "./direction.js";

export const AT_OPENAI_ANALYSIS_SCHEMA = "at-openai-ta-v1";
export const AT_OPENAI_ANALYSIS_PHASE = "53.3";
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

export interface AtChartImageMeta {
  available: boolean;
  imageHash: string | null;
  capturedAtUtc: string | null;
  source: string;
  note: string;
  blocker: string | null;
  width?: number;
  height?: number;
  byteLength?: number;
  /** True only when the chart bytes were present in a successful OpenAI multimodal request. */
  includedInOpenAiRequest: boolean;
  /** Market-data fingerprint this chart was rendered from (same observation window). */
  marketDataFingerprint?: string | null;
  evidenceWindowStartUtc?: string | null;
  evidenceWindowEndUtc?: string | null;
  observationUtc?: string | null;
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
  primaryTimeframe: string | null;
  inputFingerprint: string;
  provider: "OPENAI";
  modelRequested: string;
  modelUsed: string | null;
  modelVisionEligible: boolean;
  trigger: "scheduled" | "manual" | "legacy";
  monitorConfigEpoch: number | null;
  chartImage: AtChartImageMeta | null;
  /**
   * Phase 53.2 — binary directional forecast (BUY|SELL) for successful eligible analyses.
   * Null only when lifecycle is not ANALYSIS_VALID (failed / insufficient / invalid).
   */
  direction: AtBinaryDirection | null;
  /** 0–100 estimated confidence in `direction` — NOT a calibrated win probability. */
  directionalConfidencePct: number | null;
  /** Explicit display note required by Phase 53.2. */
  directionalConfidenceNote: typeof AT_DIRECTIONAL_CONFIDENCE_NOTE;
  /** Explicit horizon policy string bound to this result. */
  forecastHorizon: string | null;
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
  liveLabeled: false;
}

export interface AtOpenAiAnalysisPublicStatus {
  provider: "OPENAI";
  modelConfigured: string | null;
  apiKeyConfigured: boolean;
  modelVisionEligible: boolean;
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
