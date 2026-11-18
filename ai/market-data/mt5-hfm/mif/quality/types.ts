/**
 * Phase 5B.2 Step 1 — scoped data-integrity / gap assessment types.
 * Not a Phase 2 quality report. Not a unified overall MIF assessment (Step 3).
 */
import type { MifCandleState, MifProviderId, MifSafetyFlags, MifTimebase } from "../canonical/types.js";
import type { MifQualityFindingCode, MifQualityFindingSeverity } from "./codes.js";

/** Scoped Step 1 subsystem statuses — do not map silently to Phase 2. */
export type MifStep1IntegrityStatus = "VALID" | "WARNING" | "DEGRADED" | "BLOCKED";

export type MifQualityMetricStatus = "ok" | "warning" | "degraded" | "blocked" | "uncertain" | "not_applicable";

export interface MifQualityFinding {
  code: MifQualityFindingCode;
  severity: MifQualityFindingSeverity;
  message: string;
  candleIndex?: number;
  openTimeSec?: number | null;
  closeTimeSec?: number | null;
  expectedOpenTimeSec?: number | null;
  actualOpenTimeSec?: number | null;
  expectedDurationSec?: number | null;
  actualDurationSec?: number | null;
  candleState?: MifCandleState;
  evidence?: Record<string, string | number | boolean | null>;
}

export interface MifQualityMetric {
  metricId: string;
  value: number | boolean | string | null;
  unit: string;
  status: MifQualityMetricStatus;
  threshold: number | null;
  thresholdSource: "none" | "explicit_consumer" | "requires_owner_decision";
  reasonCode: MifQualityFindingCode | null;
  evidence?: Record<string, string | number | boolean | null>;
}

/**
 * Future boundary for authoritative expected-interval evidence.
 * STEP 1 does not invent or connect an HFM session calendar.
 * Implementations may supply this later; absent authority ⇒ never CONFIRMED_MISSING for sessions.
 */
export interface MifExpectedIntervalAuthority {
  authorityId: string;
  authorityVersion: string;
  /**
   * Return true if a bar is expected at openTimeSec, false if not expected,
   * or "unknown" when the authority cannot decide.
   */
  isExpectedOpen(
    symbol: string,
    timeframe: string,
    openTimeSec: number,
  ): boolean | "unknown";
  /**
   * Optional: list expected opens strictly between (fromOpenExclusive, toOpenExclusive).
   * Return "unsupported" when the authority cannot enumerate.
   */
  listExpectedOpensBetween?(
    symbol: string,
    timeframe: string,
    fromOpenExclusive: number,
    toOpenExclusive: number,
  ): number[] | "unsupported";
}

/** Explicit consumer coverage requirement — never implied as universal MIF rule. */
export interface MifCoverageRequirement {
  consumerId: string;
  minValidCandles: number;
}

export interface MifGapCounters {
  confirmedMissingCount: number;
  possibleMissingCount: number;
  unknownSessionGapCount: number;
  insufficientHistoryCount: number;
}

export interface MifCoverageReport {
  observedCandleCount: number;
  validCandleCount: number;
  invalidCandleCount: number;
  distinctValidIntervalCount: number;
  firstOpenTimeSec: number | null;
  lastCloseTimeSec: number | null;
  lastOpenTimeSec: number | null;
  /** True only when an explicit consumer requirement was supplied and met. */
  satisfiesExplicitRequirement: boolean | null;
  consumerId: string | null;
  requiredMinValidCandles: number | null;
  /** Always true reminder: evaluation covers observed input window only. */
  observedRangeOnly: true;
}

/**
 * Scoped Step 1 assessment. Overall unified quality assessment is Step 3.
 */
export interface MifStep1DataIntegrityAssessment extends MifSafetyFlags {
  contractId: "kwizera.mif.quality.v1";
  contractVersion: "1.0.0";
  /** Distinguishes ephemeral run id from stable input identity. */
  assessmentId: string;
  /** Deterministic hash of canonical input + engine/policy versions (excludes wall-clock). */
  inputIdentity: string;
  scope: "step1-data-integrity";
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string;
  timebase: MifTimebase | "MIXED";
  instrumentRef: {
    providerSymbol: string;
    catalogVersion: string | null;
    digits: number | null;
    point: number | null;
    tickSize: number | null;
  } | null;
  assessmentTimestamp: string;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  status: MifStep1IntegrityStatus;
  metrics: MifQualityMetric[];
  findings: MifQualityFinding[];
  warningCodes: MifQualityFindingCode[];
  blockingCodes: MifQualityFindingCode[];
  uncertaintyCodes: MifQualityFindingCode[];
  gapCounters: MifGapCounters;
  coverage: MifCoverageReport;
  orderingValid: boolean;
  diagnosticsSummary: string;
  /**
   * Explicit: this result does NOT approve AI reasoning and is not Phase 2 VALID.
   */
  doesNotApproveAiReasoning: true;
  notUnifiedOverallAssessment: true;
}

export interface AssessDataIntegrityInput {
  candles: readonly import("../canonical/candle.js").MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  /**
   * Optional wall-clock for assessmentTimestamp only — excluded from inputIdentity.
   * Defaults to Date.now() ISO when omitted.
   */
  assessmentTimestamp?: string;
  /** Optional non-stable run id. Defaults to a deterministic placeholder when omitted for tests. */
  assessmentId?: string;
  coverageRequirement?: MifCoverageRequirement | null;
  expectedIntervalAuthority?: MifExpectedIntervalAuthority | null;
  policyId?: string;
  policyVersion?: string;
}
