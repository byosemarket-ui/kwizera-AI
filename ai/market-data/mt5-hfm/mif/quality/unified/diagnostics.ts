/**
 * Phase 5B.2 Step 3 — bounded unified diagnostics.
 */
import type { MifQualityFinding } from "../types.js";
import type { MifScopedQualityStatus } from "../status.js";
import type { MifPolicyEvaluationResult } from "../policy/types.js";
import type { MifUnifiedQualityDiagnostics } from "./types.js";

export function buildUnifiedDiagnostics(input: {
  status: MifScopedQualityStatus;
  findings: readonly MifQualityFinding[];
  policyEvaluation: MifPolicyEvaluationResult | null;
  shadowDisagreement: boolean | null;
  presentSubsystems: string[];
}): MifUnifiedQualityDiagnostics {
  const triggering = input.findings
    .filter((f) => f.severity === "blocking" || f.severity === "degraded" || f.severity === "warning")
    .slice(0, 12)
    .map((f) => ({ code: f.code, severity: f.severity, message: f.message }));

  const missingEvidence =
    input.policyEvaluation?.missingRequiredSubsystems.map((s) => `required:${s}`) ?? [];

  let overallStatusReason = `overall=${input.status}`;
  if (input.status === "BLOCKED") {
    const first = triggering.find((t) => t.severity === "blocking");
    overallStatusReason = first
      ? `BLOCKED due to ${first.code}: ${first.message}`
      : "BLOCKED by policy evaluation";
  } else if (input.status === "DEGRADED") {
    const first = triggering.find((t) => t.severity === "degraded");
    overallStatusReason = first
      ? `DEGRADED due to ${first.code}: ${first.message}`
      : "DEGRADED by policy evaluation";
  } else if (input.status === "WARNING") {
    const first = triggering.find((t) => t.severity === "warning");
    overallStatusReason = first
      ? `WARNING due to ${first.code}: ${first.message}`
      : "WARNING from advisory findings";
  } else {
    overallStatusReason = "VALID: required assessments present and policy conditions passed";
  }

  return {
    overallStatusReason,
    contributingSubsystems: input.presentSubsystems,
    appliedPolicyRule: input.policyEvaluation
      ? `${input.policyEvaluation.policyId}@${input.policyEvaluation.policyVersion}`
      : "policy-unavailable",
    triggeringFindings: triggering,
    shadowDisagreement: input.shadowDisagreement,
    missingEvidence,
  };
}
