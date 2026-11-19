/**
 * Phase 5C Step 3 — versioned multi-timeframe relationships policy.
 * Hierarchy and weights are configurable — not universal market laws.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { MIF_SUPPORTED_FIXED_TIMEFRAMES } from "../../quality/multi-timeframe/requirements.js";
import {
  MIF_MTF_RELATIONSHIPS_POLICY_ID,
  MIF_MTF_RELATIONSHIPS_POLICY_VERSION,
} from "./contracts.js";
import type { MifMtfRelationshipsPolicy, MifMtfRelationshipsPolicyValidation } from "./types.js";

export const MIF_POLICY_HFM_MTF_RELATIONSHIPS: MifMtfRelationshipsPolicy = {
  policyId: MIF_MTF_RELATIONSHIPS_POLICY_ID,
  policyVersion: MIF_MTF_RELATIONSHIPS_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  hierarchy: ["W1", "D1", "H4", "H1", "M30", "M15", "M5", "M1"],
  bands: [
    { band: "HIGHER", timeframes: ["W1", "D1", "H4"] },
    { band: "INTERMEDIATE", timeframes: ["H1", "M30"] },
    { band: "LOWER", timeframes: ["M15", "M5", "M1"] },
  ],
  requiredTimeframes: ["H4", "H1", "M15"],
  optionalTimeframes: ["W1", "D1", "M30", "M5", "M1"],
  missingRequiredBlocks: false,
  maxAssessmentSkewMs: null,
  weightHigher: 0.5,
  weightIntermediate: 0.3,
  weightLower: 0.2,
  usableSourceStatuses: ["VALID", "WARNING"],
};

export function validateMifMtfRelationshipsPolicy(
  policy: MifMtfRelationshipsPolicy | null | undefined,
): MifMtfRelationshipsPolicyValidation {
  const errors: string[] = [];
  if (!policy) return { ok: false, errors: ["policy missing"] };
  if (!policy.policyId?.trim()) errors.push("policyId missing");
  if (!policy.policyVersion?.trim()) errors.push("policyVersion missing");
  if (policy.providerId !== MIF_PROVIDER_ID) errors.push("providerId must be HFM_MT5");
  if (!policy.hierarchy?.length) errors.push("hierarchy empty");
  const supported = new Set<string>(MIF_SUPPORTED_FIXED_TIMEFRAMES);
  for (const tf of policy.hierarchy) {
    if (!supported.has(tf)) errors.push(`unsupported hierarchy timeframe ${tf}`);
  }
  if (policy.bands?.length !== 3) errors.push("bands must define HIGHER/INTERMEDIATE/LOWER");
  const bandIds = new Set(policy.bands?.map((b) => b.band) ?? []);
  for (const b of ["HIGHER", "INTERMEDIATE", "LOWER"] as const) {
    if (!bandIds.has(b)) errors.push(`missing band ${b}`);
  }
  if (!(policy.weightHigher >= 0) || !(policy.weightIntermediate >= 0) || !(policy.weightLower >= 0)) {
    errors.push("weights must be >= 0");
  }
  if (policy.weightHigher + policy.weightIntermediate + policy.weightLower <= 0) {
    errors.push("weights must sum to > 0");
  }
  if (!policy.usableSourceStatuses?.length) errors.push("usableSourceStatuses empty");
  return { ok: errors.length === 0, errors };
}

export class MifMtfRelationshipsPolicyRegistry {
  private readonly byKey = new Map<string, MifMtfRelationshipsPolicy>();

  register(policy: MifMtfRelationshipsPolicy, opts?: { allowOverwrite?: boolean }): void {
    const v = validateMifMtfRelationshipsPolicy(policy);
    if (!v.ok) throw new Error(`invalid mtf-relationships policy: ${v.errors.join("; ")}`);
    const key = `${policy.policyId}@${policy.policyVersion}`;
    if (this.byKey.has(key) && !opts?.allowOverwrite) {
      throw new Error(`duplicate mtf-relationships policy ${key}`);
    }
    this.byKey.set(key, policy);
  }

  get(policyId: string, policyVersion: string): MifMtfRelationshipsPolicy | null {
    return this.byKey.get(`${policyId}@${policyVersion}`) ?? null;
  }
}

export function createDefaultMifMtfRelationshipsPolicyRegistry(): MifMtfRelationshipsPolicyRegistry {
  const registry = new MifMtfRelationshipsPolicyRegistry();
  registry.register(MIF_POLICY_HFM_MTF_RELATIONSHIPS);
  return registry;
}
