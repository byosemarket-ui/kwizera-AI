/**
 * Stage 6 — Per-submission authorization requirements (design + evaluation).
 * Never enables Execution Master, never clears Emergency Lock, never grants mutation.
 */
import type { DemoAdapterAuthorizationRequirements } from "./types.js";

export interface PerSubmissionAuthorizationGrant {
  grantId: string;
  proposalId: string;
  proposalVersion: string;
  accountIdMasked: string;
  expiresAtUtc: string;
  usedAtUtc: string | null;
  revokedAtUtc: string | null;
  /** Stage 6 grants never activate mutation. */
  activatesMutation: false;
}

export function evaluateAuthorizationRequirements(input: {
  executionMasterEnabled: boolean;
  emergencyEntryLock: boolean;
  tradingEnabled: boolean;
  freshFinalPrecheckPass: boolean;
  demoEnvironmentVerified: boolean;
  perSubmissionGrant: PerSubmissionAuthorizationGrant | null;
  proposalId: string;
  proposalVersion: string;
  accountIdMasked: string | null;
  priorSuccessfulSubmission: boolean;
  nowMs?: number;
}): DemoAdapterAuthorizationRequirements {
  const missing: string[] = [];

  if (!input.executionMasterEnabled) missing.push("EXECUTION_MASTER_OFF");
  if (input.emergencyEntryLock !== false) missing.push("EMERGENCY_LOCK");
  if (!input.tradingEnabled) missing.push("TRADING_DISABLED");
  if (!input.freshFinalPrecheckPass) missing.push("FINAL_PRECHECK_REQUIRED");
  if (!input.demoEnvironmentVerified) missing.push("DEMO_ENVIRONMENT_NOT_VERIFIED");
  if (input.priorSuccessfulSubmission) missing.push("DUPLICATE_SUBMISSION");

  const grant = input.perSubmissionGrant;
  if (!grant) {
    missing.push("PER_SUBMISSION_AUTHORIZATION_MISSING");
  } else {
    if (grant.activatesMutation !== false) {
      missing.push("AUTHORIZATION_INVALID");
    }
    if (grant.proposalId !== input.proposalId) {
      missing.push("AUTHORIZATION_BOUND_TO_OTHER_PROPOSAL");
    }
    if (grant.proposalVersion !== input.proposalVersion) {
      missing.push("AUTHORIZATION_PROPOSAL_VERSION_MISMATCH");
    }
    if (!input.accountIdMasked || grant.accountIdMasked !== input.accountIdMasked) {
      missing.push("AUTHORIZATION_BOUND_TO_OTHER_ACCOUNT");
    }
    const exp = Date.parse(grant.expiresAtUtc);
    const now = input.nowMs ?? Date.now();
    if (!Number.isFinite(exp) || now > exp) {
      missing.push("AUTHORIZATION_EXPIRED");
    }
    if (grant.usedAtUtc) {
      missing.push("AUTHORIZATION_ALREADY_USED");
    }
    if (grant.revokedAtUtc) {
      missing.push("AUTHORIZATION_REVOKED");
    }
  }

  // Stage 6 hard rule: never report allSatisfied=true.
  return {
    executionMasterEnabled: input.executionMasterEnabled === true,
    emergencyLockCleared: input.emergencyEntryLock === false,
    tradingEnabled: input.tradingEnabled === true,
    freshFinalPrecheck: input.freshFinalPrecheckPass === true,
    demoEnvironmentVerified: input.demoEnvironmentVerified === true,
    perSubmissionAuthorization: Boolean(grant) && !missing.some((m) => m.startsWith("AUTHORIZATION")),
    exactProposalIdentity: Boolean(grant && grant.proposalId === input.proposalId),
    exactAccountIdentity: Boolean(
      grant && input.accountIdMasked && grant.accountIdMasked === input.accountIdMasked,
    ),
    shortLivedGrant: Boolean(grant && grant.expiresAtUtc),
    noPriorSuccessfulSubmission: input.priorSuccessfulSubmission !== true,
    allSatisfied: false,
    missing: Array.from(new Set([
      ...missing,
      "STAGE_6_SUBMISSION_DISABLED",
    ])),
  };
}
