/**
 * Phase 5B.2 Step 3 — evaluate scoped assessments against an explicit policy.
 */
import {
  MIF_QI_FRESHNESS_PROFILE_MISMATCH,
  MIF_QI_OPTIONAL_ASSESSMENT_MISSING,
  MIF_QI_POLICY_SUBSYSTEM_BLOCKED,
  MIF_QI_POLICY_SUBSYSTEM_DEGRADED,
  MIF_QI_POLICY_SUBSYSTEM_WARNING,
  MIF_QI_POLICY_UNCERTAINTY,
  MIF_QI_QUOTE_STALE,
  MIF_QI_REQUIRED_ASSESSMENT_MISSING,
} from "../codes.js";
import type { MifInstrumentQualityAssessment } from "../instrument/types.js";
import type { MifMultiTimeframeQualityAssessment } from "../multi-timeframe/types.js";
import type { MifQuoteQualityAssessment } from "../quote/types.js";
import { deriveScopedQualityStatus, type MifScopedQualityStatus } from "../status.js";
import type { MifQualityFinding, MifStep1DataIntegrityAssessment } from "../types.js";
import type {
  MifPolicyEvaluationDecision,
  MifPolicyEvaluationResult,
  MifPolicySubsystemId,
  MifQualityPolicy,
} from "./types.js";

export interface PolicyEvaluationInput {
  policy: MifQualityPolicy;
  dataIntegrity: MifStep1DataIntegrityAssessment | null;
  quote: MifQuoteQualityAssessment | null;
  instrument: MifInstrumentQualityAssessment | null;
  multiTimeframe: MifMultiTimeframeQualityAssessment | null;
}

function decision(
  partial: Omit<MifPolicyEvaluationDecision, "policyId" | "policyVersion">,
  policy: MifQualityPolicy,
): MifPolicyEvaluationDecision {
  return {
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    ...partial,
  };
}

function statusImpact(
  status: MifScopedQualityStatus,
  policy: MifQualityPolicy,
): MifScopedQualityStatus | null {
  if (policy.blockOnSubsystemStatuses.includes(status)) return "BLOCKED";
  if (policy.degradeOnSubsystemStatuses.includes(status)) return "DEGRADED";
  if (policy.warnOnSubsystemStatuses.includes(status)) return "WARNING";
  return null;
}

export function evaluateMifQualityPolicy(
  input: PolicyEvaluationInput,
): { result: MifPolicyEvaluationResult; findings: MifQualityFinding[] } {
  const policy = input.policy;
  const decisions: MifPolicyEvaluationDecision[] = [];
  const findings: MifQualityFinding[] = [];
  const missingRequired: MifPolicySubsystemId[] = [];
  const missingOptional: MifPolicySubsystemId[] = [];

  const check = (
    id: MifPolicySubsystemId,
    required: boolean,
    assessment: { status: MifScopedQualityStatus; uncertaintyCodes: readonly string[] } | null,
  ) => {
    if (assessment == null) {
      if (required) {
        missingRequired.push(id);
        decisions.push(
          decision(
            {
              decisionId: `missing-required:${id}`,
              metricId: "assessment_present",
              subsystem: id,
              observedValue: false,
              threshold: true,
              unit: "boolean",
              outcome: "missing_required",
              reasonCode: MIF_QI_REQUIRED_ASSESSMENT_MISSING,
              explanation: `required subsystem ${id} assessment is missing`,
            },
            policy,
          ),
        );
        findings.push({
          code: MIF_QI_REQUIRED_ASSESSMENT_MISSING,
          severity: "blocking",
          message: `required ${id} assessment missing`,
          evidence: { subsystem: id },
        });
      } else {
        missingOptional.push(id);
        decisions.push(
          decision(
            {
              decisionId: `missing-optional:${id}`,
              metricId: "assessment_present",
              subsystem: id,
              observedValue: false,
              threshold: null,
              unit: "boolean",
              outcome: "missing_optional",
              reasonCode: MIF_QI_OPTIONAL_ASSESSMENT_MISSING,
              explanation: `optional subsystem ${id} assessment is missing`,
            },
            policy,
          ),
        );
        findings.push({
          code: MIF_QI_OPTIONAL_ASSESSMENT_MISSING,
          severity: "info",
          message: `optional ${id} assessment missing`,
          evidence: { subsystem: id },
        });
      }
      return;
    }

    decisions.push(
      decision(
        {
          decisionId: `status:${id}`,
          metricId: "subsystem_status",
          subsystem: id,
          observedValue: assessment.status,
          threshold: null,
          unit: "enum",
          outcome:
            assessment.status === "BLOCKED"
              ? "blocked"
              : assessment.status === "DEGRADED"
                ? "degraded"
                : assessment.status === "WARNING"
                  ? "warning"
                  : "pass",
          reasonCode: `SUBSYSTEM_${assessment.status}`,
          explanation: `${id} status=${assessment.status}`,
        },
        policy,
      ),
    );

    const impact = statusImpact(assessment.status, policy);
    if (impact === "BLOCKED") {
      findings.push({
        code: MIF_QI_POLICY_SUBSYSTEM_BLOCKED,
        severity: "blocking",
        message: `${id} status BLOCKED under policy`,
        evidence: { subsystem: id, status: assessment.status },
      });
    } else if (impact === "DEGRADED") {
      findings.push({
        code: MIF_QI_POLICY_SUBSYSTEM_DEGRADED,
        severity: "degraded",
        message: `${id} status DEGRADED under policy`,
        evidence: { subsystem: id, status: assessment.status },
      });
    } else if (impact === "WARNING") {
      findings.push({
        code: MIF_QI_POLICY_SUBSYSTEM_WARNING,
        severity: "warning",
        message: `${id} status WARNING under policy`,
        evidence: { subsystem: id, status: assessment.status },
      });
    }

    if (required && assessment.uncertaintyCodes.length > 0 && policy.uncertaintyImpact !== "ignore") {
      const severity =
        policy.uncertaintyImpact === "blocking"
          ? "blocking"
          : policy.uncertaintyImpact === "degraded"
            ? "degraded"
            : "warning";
      findings.push({
        code: MIF_QI_POLICY_UNCERTAINTY,
        severity,
        message: `${id} has ${assessment.uncertaintyCodes.length} uncertainty code(s)`,
        evidence: { subsystem: id, count: assessment.uncertaintyCodes.length },
      });
      decisions.push(
        decision(
          {
            decisionId: `uncertainty:${id}`,
            metricId: "uncertainty_codes",
            subsystem: id,
            observedValue: assessment.uncertaintyCodes.length,
            threshold: null,
            unit: "count",
            outcome:
              severity === "blocking"
                ? "blocked"
                : severity === "degraded"
                  ? "degraded"
                  : "uncertain",
            reasonCode: MIF_QI_POLICY_UNCERTAINTY,
            explanation: `policy uncertaintyImpact=${policy.uncertaintyImpact}`,
          },
          policy,
        ),
      );
    }
  };

  check("data_integrity", policy.requireDataIntegrity, input.dataIntegrity);
  check("quote", policy.requireQuote, input.quote);
  check("instrument", policy.requireInstrument, input.instrument);
  check("multi_timeframe", policy.requireMultiTimeframe, input.multiTimeframe);

  if (input.quote && policy.staleQuoteImpact && input.quote.freshness === "STALE") {
    const severity =
      policy.staleQuoteImpact === "blocking"
        ? "blocking"
        : policy.staleQuoteImpact === "degraded"
          ? "degraded"
          : "warning";
    findings.push({
      code: MIF_QI_QUOTE_STALE,
      severity,
      message: `quote freshness STALE; policy staleQuoteImpact=${policy.staleQuoteImpact}`,
    });
    decisions.push(
      decision(
        {
          decisionId: "quote:stale",
          metricId: "quote_freshness",
          subsystem: "quote",
          observedValue: "STALE",
          threshold: null,
          unit: "enum",
          outcome:
            severity === "blocking" ? "blocked" : severity === "degraded" ? "degraded" : "warning",
          reasonCode: MIF_QI_QUOTE_STALE,
          explanation: "Step 2 freshness class STALE under policy staleQuoteImpact",
        },
        policy,
      ),
    );
  }

  if (
    input.quote &&
    policy.expectedQuoteFreshnessProfileId &&
    input.quote.freshnessProfileId != null &&
    input.quote.freshnessProfileId !== policy.expectedQuoteFreshnessProfileId
  ) {
    findings.push({
      code: MIF_QI_FRESHNESS_PROFILE_MISMATCH,
      severity: "warning",
      message: `quote freshness profile ${input.quote.freshnessProfileId} != expected ${policy.expectedQuoteFreshnessProfileId}`,
    });
    decisions.push(
      decision(
        {
          decisionId: "quote:profile-mismatch",
          metricId: "freshness_profile_id",
          subsystem: "quote",
          observedValue: input.quote.freshnessProfileId,
          threshold: policy.expectedQuoteFreshnessProfileId,
          unit: "id",
          outcome: "warning",
          reasonCode: MIF_QI_FRESHNESS_PROFILE_MISMATCH,
          explanation: "named profile id mismatch (not a universal age threshold)",
        },
        policy,
      ),
    );
  }

  decisions.push(
    decision(
      {
        decisionId: "policy:no-universal-thresholds",
        metricId: "universal_thresholds",
        subsystem: "policy",
        observedValue: null,
        threshold: null,
        unit: "none",
        outcome: "unconfigured",
        reasonCode: "NO_UNIVERSAL_THRESHOLD",
        explanation:
          "policy does not define universal freshness/skew/missing-bar thresholds; measured subsystem results used only",
      },
      policy,
    ),
  );

  const derivedStatus = deriveScopedQualityStatus(findings);
  return {
    result: {
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      consumerId: policy.consumerId,
      policyAvailable: true,
      decisions,
      derivedStatus,
      missingRequiredSubsystems: missingRequired,
      missingOptionalSubsystems: missingOptional,
      diagnosticsSummary: `policy ${policy.policyId}@${policy.policyVersion} status=${derivedStatus}; missingRequired=${missingRequired.join(",") || "none"}`,
    },
    findings,
  };
}
