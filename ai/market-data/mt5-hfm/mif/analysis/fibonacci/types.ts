/**
 * Phase 5C Step 1A — Fibonacci analysis types (kwizera.mif.fibonacci.v1).
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { MifAnalyticalQualityStatus } from "../quality/assessment-quality-gate.js";
import type { MifFibonacciReasonCode } from "./codes.js";
import type {
  MIF_FIBONACCI_CONTRACT_ID,
  MIF_FIBONACCI_CONTRACT_VERSION,
} from "./contracts.js";

export type MifFibonacciAssessmentStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export type MifFibonacciOrientation = "BULLISH" | "BEARISH";

export type MifFibonacciAnchorSelectionStrategy = "latest_adjacent_confirmed_impulse";

export type MifFibonacciCandleStatePolicy = "closed_only" | "allow_forming_for_swings_only";

export type MifFibonacciMissingInstrumentBehavior = "block" | "degrade";

export interface MifFibonacciPolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  /** Quality statuses that permit confirmed Fibonacci anchors. */
  allowedQualityStatusesForConfirmedAnchors: readonly MifAnalyticalQualityStatus[];
  /** Only CONFIRMED structure swings may be anchors when true. */
  requireConfirmedSwings: true;
  retracementRatios: readonly number[];
  extensionRatios: readonly number[];
  anchorSelectionStrategy: MifFibonacciAnchorSelectionStrategy;
  candleStatePolicy: MifFibonacciCandleStatePolicy;
  requireInstrumentMetadata: boolean;
  missingInstrumentBehavior: MifFibonacciMissingInstrumentBehavior;
  /**
   * When true, level precision/tick mismatches elevate assessment to WARNING
   * but never silently round prices. Never blocks solely for calculated-level tick mismatch.
   */
  reportLevelPrecisionDiagnostics: true;
  levelPrecisionMismatchElevatesWarning: boolean;
  /** Require positive finite impulse range (H !== L). */
  requirePositiveImpulseRange: true;
}

export interface MifFibonacciPolicyValidation {
  ok: boolean;
  errors: string[];
}

export interface MifFibonacciAnchorRef {
  swingId: string;
  kind: "HIGH" | "LOW";
  price: number;
  timeSec: number;
  index: number;
  status: "CONFIRMED";
}

export interface MifFibonacciLevel {
  ratio: number;
  price: number;
  kind: "retracement" | "extension";
  precisionOk: boolean | null;
  tickAligned: boolean | null;
}

export interface MifFibonacciFinding {
  code: MifFibonacciReasonCode;
  severity: "blocking" | "degraded" | "warning" | "info";
  message: string;
  evidence?: Record<string, string | number | boolean | null>;
}

export interface MifFibonacciQualityRef {
  sourceKind: "step1-data-integrity" | "step3-unified-quality" | null;
  status: MifAnalyticalQualityStatus;
  inputIdentity: string | null;
  assessmentId: string | null;
}

export interface MifFibonacciDiagnostics {
  overallStatusReason: string;
  selectedPairIndex: number | null;
  confirmedSwingCount: number;
  provisionalSwingCount: number;
  candidateImpulseCount: number;
  digitsUsed: number | null;
  tickSizeUsed: number | null;
  levelPrecisionMismatchCount: number;
  levelTickMismatchCount: number;
}

export interface MifFibonacciAssessment extends MifSafetyFlags {
  contractId: typeof MIF_FIBONACCI_CONTRACT_ID;
  contractVersion: typeof MIF_FIBONACCI_CONTRACT_VERSION;
  scope: "step1a-fibonacci";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policyId: string | null;
  policyVersion: string | null;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifFibonacciAssessmentStatus;
  orientation: MifFibonacciOrientation | null;
  anchorA: MifFibonacciAnchorRef | null;
  anchorB: MifFibonacciAnchorRef | null;
  retracements: MifFibonacciLevel[];
  extensions: MifFibonacciLevel[];
  qualityRef: MifFibonacciQualityRef;
  findings: MifFibonacciFinding[];
  warningCodes: MifFibonacciReasonCode[];
  blockingCodes: MifFibonacciReasonCode[];
  diagnostics: MifFibonacciDiagnostics;
  diagnosticsSummary: string;
  /** Fixed safety — never configurable. */
  doesNotApproveAiReasoning: true;
  /** Mathematical reference levels only — not trade signals. */
  mathematicalReferenceOnly: true;
}
