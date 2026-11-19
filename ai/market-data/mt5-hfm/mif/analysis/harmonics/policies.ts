/**
 * Phase 5C Step 2 — versioned harmonic pattern policy.
 * Ratio tables are Carney-style ranges, versioned — not universal market laws.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_HARMONIC_ATR_METHOD_ID,
  MIF_HARMONIC_PATTERNS_POLICY_ID,
  MIF_HARMONIC_PATTERNS_POLICY_VERSION,
} from "./contracts.js";
import { MIF_HARMONIC_RATIO_TABLE_V1 } from "./ratios.js";
import type { MifHarmonicPolicy, MifHarmonicPolicyValidation } from "./types.js";

export const MIF_POLICY_HFM_HARMONIC_PATTERNS: MifHarmonicPolicy = {
  policyId: MIF_HARMONIC_PATTERNS_POLICY_ID,
  policyVersion: MIF_HARMONIC_PATTERNS_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  atrMethodId: MIF_HARMONIC_ATR_METHOD_ID,
  atrPeriod: 14,
  allowedQualityStatusesForConfirmed: ["VALID"],
  allowedQualityStatusesForForming: ["VALID", "WARNING"],
  requireConfirmedSwingsForConfirmed: true,
  minBarsBetweenPivots: 2,
  maxPrzWidthAtr: 1.5,
  minPrzProjections: 2,
  patternRatios: MIF_HARMONIC_RATIO_TABLE_V1,
  maxDetections: 20,
};

export function validateMifHarmonicPolicy(
  policy: MifHarmonicPolicy | null | undefined,
): MifHarmonicPolicyValidation {
  const errors: string[] = [];
  if (!policy) return { ok: false, errors: ["policy missing"] };
  if (!policy.policyId?.trim()) errors.push("policyId missing");
  if (!policy.policyVersion?.trim()) errors.push("policyVersion missing");
  if (policy.providerId !== MIF_PROVIDER_ID) errors.push("providerId must be HFM_MT5");
  if (policy.atrMethodId !== MIF_HARMONIC_ATR_METHOD_ID) {
    errors.push(`atrMethodId must be ${MIF_HARMONIC_ATR_METHOD_ID}`);
  }
  if (!(policy.atrPeriod >= 2) || !Number.isInteger(policy.atrPeriod)) {
    errors.push("atrPeriod must be integer >= 2");
  }
  if (policy.requireConfirmedSwingsForConfirmed !== true) {
    errors.push("requireConfirmedSwingsForConfirmed must be true");
  }
  if (
    !policy.allowedQualityStatusesForConfirmed?.length
    || policy.allowedQualityStatusesForConfirmed.includes("MISSING" as never)
    || policy.allowedQualityStatusesForConfirmed.includes("BLOCKED")
  ) {
    errors.push("allowedQualityStatusesForConfirmed invalid");
  }
  if (!policy.allowedQualityStatusesForForming?.length) {
    errors.push("allowedQualityStatusesForForming empty");
  }
  if (!(policy.minBarsBetweenPivots >= 1) || !Number.isInteger(policy.minBarsBetweenPivots)) {
    errors.push("minBarsBetweenPivots must be integer >= 1");
  }
  if (!(policy.maxPrzWidthAtr > 0) || !Number.isFinite(policy.maxPrzWidthAtr)) {
    errors.push("maxPrzWidthAtr must be finite > 0");
  }
  if (!(policy.minPrzProjections >= 1) || !Number.isInteger(policy.minPrzProjections)) {
    errors.push("minPrzProjections must be integer >= 1");
  }
  if (!(policy.maxDetections >= 1) || !Number.isInteger(policy.maxDetections)) {
    errors.push("maxDetections must be integer >= 1");
  }
  if (!policy.patternRatios?.length) {
    errors.push("patternRatios empty");
  } else {
    const types = new Set(policy.patternRatios.map((p) => p.patternType));
    for (const t of ["GARTLEY", "BAT", "BUTTERFLY", "CRAB", "SHARK"] as const) {
      if (!types.has(t)) errors.push(`missing ratio policy for ${t}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export class MifHarmonicPolicyRegistry {
  private readonly byKey = new Map<string, MifHarmonicPolicy>();

  register(policy: MifHarmonicPolicy, opts?: { allowOverwrite?: boolean }): void {
    const v = validateMifHarmonicPolicy(policy);
    if (!v.ok) throw new Error(`invalid harmonic policy: ${v.errors.join("; ")}`);
    const key = `${policy.policyId}@${policy.policyVersion}`;
    if (this.byKey.has(key) && !opts?.allowOverwrite) {
      throw new Error(`duplicate harmonic policy ${key}`);
    }
    this.byKey.set(key, policy);
  }

  get(policyId: string, policyVersion: string): MifHarmonicPolicy | null {
    return this.byKey.get(`${policyId}@${policyVersion}`) ?? null;
  }
}

export function createDefaultMifHarmonicPolicyRegistry(): MifHarmonicPolicyRegistry {
  const registry = new MifHarmonicPolicyRegistry();
  registry.register(MIF_POLICY_HFM_HARMONIC_PATTERNS);
  return registry;
}
