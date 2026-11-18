/**
 * Phase 5B.2 Step 3 — policy structural validation (no silent defaults).
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import type { MifPolicyValidationIssue, MifQualityPolicy } from "./types.js";

const UNCERTAINTY = new Set(["ignore", "warning", "degraded", "blocking"]);
const STALE = new Set(["warning", "degraded", "blocking"]);
const STATUS = new Set(["VALID", "WARNING", "DEGRADED", "BLOCKED"]);

export function validateMifQualityPolicy(
  policy: MifQualityPolicy | null | undefined,
): { ok: true; policy: MifQualityPolicy } | { ok: false; issues: MifPolicyValidationIssue[] } {
  const issues: MifPolicyValidationIssue[] = [];
  if (!policy) {
    return {
      ok: false,
      issues: [{ code: "POLICY_MISSING_ID", message: "policy is null/undefined" }],
    };
  }
  if (!policy.policyId || !String(policy.policyId).trim()) {
    issues.push({ code: "POLICY_MISSING_ID", message: "policyId required" });
  }
  if (!policy.policyVersion || !String(policy.policyVersion).trim()) {
    issues.push({ code: "POLICY_MISSING_VERSION", message: "policyVersion required" });
  }
  if (!policy.consumerId || !String(policy.consumerId).trim()) {
    issues.push({ code: "POLICY_MISSING_CONSUMER", message: "consumerId required" });
  }
  if (policy.providerId !== MIF_PROVIDER_ID) {
    issues.push({
      code: "POLICY_UNSUPPORTED_PROVIDER",
      message: `providerId must be HFM_MT5 (got ${String(policy.providerId)})`,
    });
  }
  if (!policy.blockOnSubsystemStatuses?.length) {
    issues.push({
      code: "POLICY_EMPTY_STATUS_LIST",
      message: "blockOnSubsystemStatuses must be non-empty",
    });
  }
  for (const s of policy.blockOnSubsystemStatuses ?? []) {
    if (!STATUS.has(s)) {
      issues.push({
        code: "POLICY_EMPTY_STATUS_LIST",
        message: `invalid block status ${String(s)}`,
      });
    }
  }
  if (!UNCERTAINTY.has(policy.uncertaintyImpact)) {
    issues.push({
      code: "POLICY_INVALID_UNCERTAINTY_IMPACT",
      message: `invalid uncertaintyImpact ${String(policy.uncertaintyImpact)}`,
    });
  }
  if (policy.staleQuoteImpact != null && !STALE.has(policy.staleQuoteImpact)) {
    issues.push({
      code: "POLICY_INVALID_STALE_IMPACT",
      message: `invalid staleQuoteImpact ${String(policy.staleQuoteImpact)}`,
    });
  }
  // Contradictory: require nothing at all
  if (
    !policy.requireDataIntegrity &&
    !policy.requireQuote &&
    !policy.requireInstrument &&
    !policy.requireMultiTimeframe
  ) {
    issues.push({
      code: "POLICY_CONTRADICTORY_REQUIREMENTS",
      message: "policy requires no subsystems; at least one required subsystem expected",
    });
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, policy };
}
