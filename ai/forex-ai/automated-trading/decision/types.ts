/**
 * Phase 54 — Trading Decision Engine contracts (signal validation only).
 * Read-only. Never places broker orders. Separate from Phase 53 technical analysis.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtBinaryDirection } from "../analysis/direction.js";
import { AT_DIRECTIONAL_CONFIDENCE_NOTE } from "../analysis/direction.js";
import { AT_CONFIDENCE_LABEL } from "../analysis/types.js";

export const AT_DECISION_SCHEMA = "at-trading-decision-v1";
export const AT_DECISION_PHASE = "54";
export const AT_DECISION_CONFIDENCE_NOTE = AT_DIRECTIONAL_CONFIDENCE_NOTE;
export const AT_DECISION_CONFIDENCE_LABEL = AT_CONFIDENCE_LABEL;

/** Accepted for human review only — never for broker execution. */
export type AtDecisionStatus = "ACCEPTED_FOR_REVIEW" | "REJECTED";

export type AtDecisionCheckStatus = "PASS" | "FAIL" | "SKIPPED";

export interface AtDecisionCheck {
  code: string;
  status: AtDecisionCheckStatus;
  message: string;
}

export interface AtDecisionBlocker {
  code: string;
  message: string;
}

/**
 * Confidence threshold policy — disabled by default until explicitly approved.
 * When disabled, confidence is validated for range (0–100) only; no minimum is enforced.
 */
export interface AtDecisionPolicy {
  schemaVersion: "at-decision-policy-v1";
  /** When false (default), minDirectionalConfidencePct is not applied. */
  confidenceThresholdEnabled: boolean;
  /**
   * Minimum directionalConfidencePct required when confidenceThresholdEnabled.
   * Range 0–100. Conservative default 70 when enabling without a value.
   */
  minDirectionalConfidencePct: number;
  /**
   * Max age of source analysis relative to decision time.
   * null = derive from forecast horizon (2× primary TF) with a 2h fallback.
   */
  maxAnalysisAgeMs: number | null;
  updatedAtUtc: string;
  updatedBy: "admin" | "system";
}

export interface AtDecisionResult {
  schemaVersion: typeof AT_DECISION_SCHEMA;
  phase: typeof AT_DECISION_PHASE;
  decisionId: string;
  decisionStatus: AtDecisionStatus;
  /** Present when source analysis had a valid BUY/SELL direction. */
  direction: AtBinaryDirection | null;
  instrument: string | null;
  timeframe: string | null;
  forecastHorizon: string | null;
  sourceAnalysisId: string | null;
  sourceEvidenceFingerprint: string | null;
  sourceCreatedAtUtc: string | null;
  environment: AutomatedTradingEnvironment | null;
  environmentEpoch: number | null;
  monitorConfigEpoch: number | null;
  directionalConfidencePct: number | null;
  directionalConfidenceNote: typeof AT_DECISION_CONFIDENCE_NOTE;
  confidenceLabel: typeof AT_DECISION_CONFIDENCE_LABEL;
  /** Explicit: never a calibrated win probability. */
  confidenceIsCalibratedWinProbability: false;
  decidedAtUtc: string;
  checks: AtDecisionCheck[];
  blockers: AtDecisionBlocker[];
  rejectionReasons: string[];
  freshness: {
    quoteFresh: boolean | null;
    feedStatus: string | null;
    verificationIdentityStatus: string | null;
    analysisAgeMs: number | null;
    historicalOnly: boolean | null;
  };
  verification: {
    present: boolean;
    environmentMatches: boolean | null;
    accountIdentityVerified: boolean;
    marketDataHealthVerified: boolean;
    readyForTrading: false;
  };
  chartImage: {
    applicable: boolean;
    available: boolean | null;
    includedInOpenAiRequest: boolean | null;
    imageHash: string | null;
    fingerprintMatch: boolean | null;
  };
  policySnapshot: {
    confidenceThresholdEnabled: boolean;
    minDirectionalConfidencePct: number | null;
    maxAnalysisAgeMs: number | null;
  };
  placesOrders: false;
  acceptsForExecution: false;
}

export interface AtDecisionPublicStatus {
  phase: typeof AT_DECISION_PHASE;
  schemaVersion: typeof AT_DECISION_SCHEMA;
  policy: AtDecisionPolicy;
  latest: AtDecisionResult | null;
  historyCount: number;
  placesOrders: false;
  acceptsForExecution: false;
  note: string;
}

export function defaultDecisionPolicy(): AtDecisionPolicy {
  return {
    schemaVersion: "at-decision-policy-v1",
    confidenceThresholdEnabled: false,
    minDirectionalConfidencePct: 70,
    maxAnalysisAgeMs: null,
    updatedAtUtc: new Date().toISOString(),
    updatedBy: "system",
  };
}
