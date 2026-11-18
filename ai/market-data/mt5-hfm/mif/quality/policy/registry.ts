/**
 * Phase 5B.2 Step 3 — versioned policy registry (no silent arbitrary fallback).
 */
import {
  MIF_POLICY_OBSERVATIONAL_HFM_ID,
  MIF_POLICY_OBSERVATIONAL_HFM_VERSION,
} from "../contracts.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import type { MifQualityPolicy } from "./types.js";
import { validateMifQualityPolicy } from "./validate-policy.js";

function policyKey(id: string, version: string): string {
  return `${id}@${version}`;
}

/** Built-in observational policy — integrity required; no universal thresholds. */
export const MIF_POLICY_OBSERVATIONAL_HFM: MifQualityPolicy = {
  policyId: MIF_POLICY_OBSERVATIONAL_HFM_ID,
  policyVersion: MIF_POLICY_OBSERVATIONAL_HFM_VERSION,
  providerId: MIF_PROVIDER_ID,
  consumerId: "mif-observational",
  description:
    "Observational MIF quality: require data-integrity; quote/instrument/mtf optional; no universal freshness/skew thresholds",
  requireDataIntegrity: true,
  requireQuote: false,
  requireInstrument: false,
  requireMultiTimeframe: false,
  blockOnSubsystemStatuses: ["BLOCKED"],
  degradeOnSubsystemStatuses: ["DEGRADED"],
  warnOnSubsystemStatuses: ["WARNING"],
  uncertaintyImpact: "warning",
  staleQuoteImpact: "degraded",
  expectedQuoteFreshnessProfileId: null,
};

/** Stricter consumer example used in tests — still no universal numeric thresholds. */
export const MIF_POLICY_HFM_ANALYSIS_SHADOW: MifQualityPolicy = {
  policyId: "mif-hfm-analysis-shadow",
  policyVersion: "1.0.0",
  providerId: MIF_PROVIDER_ID,
  consumerId: "hfm-analysis-shadow",
  description:
    "Shadow comparison consumer: requires integrity+quote+mtf; uses named quote profile id check only",
  requireDataIntegrity: true,
  requireQuote: true,
  requireInstrument: true,
  requireMultiTimeframe: true,
  blockOnSubsystemStatuses: ["BLOCKED"],
  degradeOnSubsystemStatuses: ["DEGRADED"],
  warnOnSubsystemStatuses: ["WARNING"],
  uncertaintyImpact: "warning",
  staleQuoteImpact: "degraded",
  expectedQuoteFreshnessProfileId: "hfm-analysis-quote",
};

export class MifQualityPolicyRegistry {
  private readonly byKey = new Map<string, MifQualityPolicy>();

  register(policy: MifQualityPolicy, opts?: { allowOverwrite?: boolean }): void {
    const v = validateMifQualityPolicy(policy);
    if (!v.ok) {
      throw new Error(
        `invalid policy: ${v.issues.map((i) => `${i.code}:${i.message}`).join("; ")}`,
      );
    }
    const key = policyKey(policy.policyId, policy.policyVersion);
    if (this.byKey.has(key) && !opts?.allowOverwrite) {
      throw new Error(`duplicate policy ${key}`);
    }
    this.byKey.set(key, policy);
  }

  get(policyId: string, policyVersion: string): MifQualityPolicy | null {
    return this.byKey.get(policyKey(policyId, policyVersion)) ?? null;
  }

  has(policyId: string, policyVersion: string): boolean {
    return this.byKey.has(policyKey(policyId, policyVersion));
  }

  list(): MifQualityPolicy[] {
    return [...this.byKey.values()].sort((a, b) =>
      policyKey(a.policyId, a.policyVersion).localeCompare(policyKey(b.policyId, b.policyVersion)),
    );
  }
}

/** Default registry with built-in observational + shadow-analysis policies. */
export function createDefaultMifQualityPolicyRegistry(): MifQualityPolicyRegistry {
  const reg = new MifQualityPolicyRegistry();
  reg.register(MIF_POLICY_OBSERVATIONAL_HFM);
  reg.register(MIF_POLICY_HFM_ANALYSIS_SHADOW);
  return reg;
}
