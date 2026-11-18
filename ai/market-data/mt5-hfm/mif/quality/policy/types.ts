/**
 * Phase 5B.2 Step 3 — versioned MIF quality policy contract.
 * No universal freshness/skew/missing-bar thresholds.
 */
import type { MifProviderId } from "../../canonical/types.js";
import type { MifScopedQualityStatus } from "../status.js";

export type MifUncertaintyImpact = "ignore" | "warning" | "degraded" | "blocking";
export type MifStaleQuoteImpact = "warning" | "degraded" | "blocking";

export type MifPolicySubsystemId =
  | "data_integrity"
  | "quote"
  | "instrument"
  | "multi_timeframe";

export interface MifQualityPolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  consumerId: string;
  /** Human-readable scope note (not a threshold). */
  description?: string;
  requireDataIntegrity: boolean;
  requireQuote: boolean;
  requireInstrument: boolean;
  requireMultiTimeframe: boolean;
  /** Subsystem statuses that elevate overall to BLOCKED. */
  blockOnSubsystemStatuses: readonly MifScopedQualityStatus[];
  /** Subsystem statuses that elevate overall to DEGRADED (if not blocked). */
  degradeOnSubsystemStatuses: readonly MifScopedQualityStatus[];
  /** Subsystem statuses that elevate overall to WARNING (if not degraded/blocked). */
  warnOnSubsystemStatuses: readonly MifScopedQualityStatus[];
  /**
   * How required-subsystem uncertainty codes affect overall status.
   * Does not invent thresholds — only maps existing uncertainty findings.
   */
  uncertaintyImpact: MifUncertaintyImpact;
  /**
   * When quote assessment is required/present and freshness === STALE.
   * Not a universal age threshold — consumes Step 2 freshness class.
   */
  staleQuoteImpact?: MifStaleQuoteImpact;
  /** Optional expected named freshness profile id (compatibility check only). */
  expectedQuoteFreshnessProfileId?: string | null;
}

export type MifPolicyValidationIssueCode =
  | "POLICY_MISSING_ID"
  | "POLICY_MISSING_VERSION"
  | "POLICY_MISSING_CONSUMER"
  | "POLICY_UNSUPPORTED_PROVIDER"
  | "POLICY_EMPTY_STATUS_LIST"
  | "POLICY_CONTRADICTORY_REQUIREMENTS"
  | "POLICY_INVALID_UNCERTAINTY_IMPACT"
  | "POLICY_INVALID_STALE_IMPACT";

export interface MifPolicyValidationIssue {
  code: MifPolicyValidationIssueCode;
  message: string;
}

export type MifPolicyEvaluationOutcome =
  | "pass"
  | "warning"
  | "degraded"
  | "blocked"
  | "missing_required"
  | "missing_optional"
  | "unconfigured"
  | "unsupported"
  | "uncertain";

export interface MifPolicyEvaluationDecision {
  decisionId: string;
  policyId: string;
  policyVersion: string;
  metricId: string;
  subsystem: MifPolicySubsystemId | "policy" | "aggregate";
  observedValue: string | number | boolean | null;
  threshold: number | string | null;
  unit: string;
  outcome: MifPolicyEvaluationOutcome;
  reasonCode: string;
  explanation: string;
}

export interface MifPolicyEvaluationResult {
  policyId: string;
  policyVersion: string;
  consumerId: string;
  policyAvailable: boolean;
  decisions: MifPolicyEvaluationDecision[];
  derivedStatus: MifScopedQualityStatus;
  missingRequiredSubsystems: MifPolicySubsystemId[];
  missingOptionalSubsystems: MifPolicySubsystemId[];
  diagnosticsSummary: string;
}
