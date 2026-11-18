/**
 * Phase 5C Step 1A — versioned Fibonacci policy registry + validation.
 * No silent undocumented defaults for missing settings.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_FIBONACCI_POLICY_ID,
  MIF_FIBONACCI_POLICY_VERSION,
} from "./contracts.js";
import type { MifFibonacciPolicy, MifFibonacciPolicyValidation } from "./types.js";

/** Approved STEP 1A ratio set — explicit, not a universal market law. */
export const MIF_FIBONACCI_RETRACEMENT_RATIOS_V1 = [
  0.236, 0.382, 0.5, 0.618, 0.786,
] as const;

export const MIF_FIBONACCI_EXTENSION_RATIOS_V1 = [
  1.272, 1.414, 1.618, 2.0, 2.618,
] as const;

/**
 * Built-in policy `mif-hfm-fibonacci@1.0.0`.
 * Confirmed anchors require VALID quality only (WARNING/DEGRADED do not upgrade).
 */
export const MIF_POLICY_HFM_FIBONACCI: MifFibonacciPolicy = {
  policyId: MIF_FIBONACCI_POLICY_ID,
  policyVersion: MIF_FIBONACCI_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  allowedQualityStatusesForConfirmedAnchors: ["VALID"],
  requireConfirmedSwings: true,
  retracementRatios: MIF_FIBONACCI_RETRACEMENT_RATIOS_V1,
  extensionRatios: MIF_FIBONACCI_EXTENSION_RATIOS_V1,
  anchorSelectionStrategy: "latest_adjacent_confirmed_impulse",
  candleStatePolicy: "closed_only",
  requireInstrumentMetadata: true,
  missingInstrumentBehavior: "block",
  reportLevelPrecisionDiagnostics: true,
  levelPrecisionMismatchElevatesWarning: true,
  requirePositiveImpulseRange: true,
};

export function validateMifFibonacciPolicy(
  policy: MifFibonacciPolicy | null | undefined,
): MifFibonacciPolicyValidation {
  const errors: string[] = [];
  if (!policy) {
    return { ok: false, errors: ["policy missing"] };
  }
  if (!policy.policyId || !String(policy.policyId).trim()) {
    errors.push("policyId missing");
  }
  if (!policy.policyVersion || !String(policy.policyVersion).trim()) {
    errors.push("policyVersion missing");
  }
  if (policy.providerId !== MIF_PROVIDER_ID) {
    errors.push(`unsupported providerId ${String(policy.providerId)}`);
  }
  if (policy.requireConfirmedSwings !== true) {
    errors.push("requireConfirmedSwings must be true");
  }
  if (policy.requirePositiveImpulseRange !== true) {
    errors.push("requirePositiveImpulseRange must be true");
  }
  if (policy.reportLevelPrecisionDiagnostics !== true) {
    errors.push("reportLevelPrecisionDiagnostics must be true");
  }
  if (
    policy.anchorSelectionStrategy !== "latest_adjacent_confirmed_impulse"
  ) {
    errors.push(`unsupported anchorSelectionStrategy ${String(policy.anchorSelectionStrategy)}`);
  }
  if (
    policy.candleStatePolicy !== "closed_only"
    && policy.candleStatePolicy !== "allow_forming_for_swings_only"
  ) {
    errors.push(`unsupported candleStatePolicy ${String(policy.candleStatePolicy)}`);
  }
  if (
    !Array.isArray(policy.allowedQualityStatusesForConfirmedAnchors)
    || policy.allowedQualityStatusesForConfirmedAnchors.length === 0
  ) {
    errors.push("allowedQualityStatusesForConfirmedAnchors empty");
  } else if (policy.allowedQualityStatusesForConfirmedAnchors.includes("MISSING")) {
    errors.push("MISSING cannot be allowed for confirmed anchors");
  } else if (policy.allowedQualityStatusesForConfirmedAnchors.includes("BLOCKED")) {
    errors.push("BLOCKED cannot be allowed for confirmed anchors");
  }

  const validateRatios = (label: string, ratios: readonly number[], min: number, max: number) => {
    if (!Array.isArray(ratios) || ratios.length === 0) {
      errors.push(`${label} missing`);
      return;
    }
    const seen = new Set<number>();
    let prev: number | null = null;
    for (const r of ratios) {
      if (typeof r !== "number" || !Number.isFinite(r)) {
        errors.push(`${label} contains non-finite ratio`);
        continue;
      }
      if (r <= min || r >= max) {
        errors.push(`${label} ratio ${r} outside (${min}, ${max})`);
      }
      if (seen.has(r)) errors.push(`${label} duplicate ratio ${r}`);
      seen.add(r);
      if (prev != null && r < prev) {
        errors.push(`${label} must be strictly ascending`);
      }
      prev = r;
    }
  };

  // Retracements in (0, 1); extensions > 1.
  validateRatios("retracementRatios", policy.retracementRatios, 0, 1);
  validateRatios("extensionRatios", policy.extensionRatios, 1, Number.POSITIVE_INFINITY);

  if (
    policy.missingInstrumentBehavior !== "block"
    && policy.missingInstrumentBehavior !== "degrade"
  ) {
    errors.push("invalid missingInstrumentBehavior");
  }

  return { ok: errors.length === 0, errors };
}

export class MifFibonacciPolicyRegistry {
  private readonly byKey = new Map<string, MifFibonacciPolicy>();

  register(policy: MifFibonacciPolicy, opts?: { allowOverwrite?: boolean }): void {
    const v = validateMifFibonacciPolicy(policy);
    if (!v.ok) {
      throw new Error(`invalid Fibonacci policy: ${v.errors.join("; ")}`);
    }
    const key = `${policy.policyId}@${policy.policyVersion}`;
    if (this.byKey.has(key) && !opts?.allowOverwrite) {
      throw new Error(`duplicate Fibonacci policy ${key}`);
    }
    this.byKey.set(key, policy);
  }

  get(policyId: string, policyVersion: string): MifFibonacciPolicy | null {
    return this.byKey.get(`${policyId}@${policyVersion}`) ?? null;
  }
}

export function createDefaultMifFibonacciPolicyRegistry(): MifFibonacciPolicyRegistry {
  const registry = new MifFibonacciPolicyRegistry();
  registry.register(MIF_POLICY_HFM_FIBONACCI);
  return registry;
}
