/**
 * Phase 5C Step 1C — versioned unified chart-analysis policy.
 *
 * Initial confluence tolerances are conservative and versioned — not universal market laws.
 * Basis: alignment within max(0.15% of mid-price, 0.25×ATR when ATR is available from pattern diagnostics).
 * Grade thresholds count explainable hits only — never trade-win probabilities.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_FIBONACCI_CONTRACT_ID,
  MIF_FIBONACCI_CONTRACT_VERSION,
} from "../fibonacci/contracts.js";
import {
  MIF_CHART_PATTERNS_CONTRACT_ID,
  MIF_CHART_PATTERNS_CONTRACT_VERSION,
} from "../patterns/contracts.js";
import {
  MIF_CHART_ANALYSIS_CORRELATION_METHOD_ID,
  MIF_CHART_ANALYSIS_CORRELATION_METHOD_VERSION,
  MIF_CHART_ANALYSIS_POLICY_ID,
  MIF_CHART_ANALYSIS_POLICY_VERSION,
} from "./contracts.js";
import type {
  MifUnifiedChartAnalysisPolicy,
  MifUnifiedChartAnalysisPolicyValidation,
} from "./types.js";

export const MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS: MifUnifiedChartAnalysisPolicy = {
  policyId: MIF_CHART_ANALYSIS_POLICY_ID,
  policyVersion: MIF_CHART_ANALYSIS_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  acceptedPatternContractId: MIF_CHART_PATTERNS_CONTRACT_ID,
  acceptedPatternContractVersion: MIF_CHART_PATTERNS_CONTRACT_VERSION,
  acceptedFibonacciContractId: MIF_FIBONACCI_CONTRACT_ID,
  acceptedFibonacciContractVersion: MIF_FIBONACCI_CONTRACT_VERSION,
  requireMatchingQualityInputIdentity: true,
  confluenceNormalizationMethod: "atr_or_mid_price",
  confluenceTolRel: 0.0015,
  confluenceTolAtrMult: 0.25,
  strongMinHits: 2,
  strongMinAlignmentRatio: 0.3,
  moderateMinHits: 1,
  allowedQualityStatusesForValid: ["VALID"],
  correlationMethodId: MIF_CHART_ANALYSIS_CORRELATION_METHOD_ID,
  correlationMethodVersion: MIF_CHART_ANALYSIS_CORRELATION_METHOD_VERSION,
};

export function validateMifUnifiedChartAnalysisPolicy(
  policy: MifUnifiedChartAnalysisPolicy | null | undefined,
): MifUnifiedChartAnalysisPolicyValidation {
  const errors: string[] = [];
  if (!policy) return { ok: false, errors: ["policy missing"] };
  if (!policy.policyId?.trim()) errors.push("policyId missing");
  if (!policy.policyVersion?.trim()) errors.push("policyVersion missing");
  if (policy.providerId !== MIF_PROVIDER_ID) errors.push("providerId must be HFM_MT5");
  if (policy.acceptedPatternContractId !== MIF_CHART_PATTERNS_CONTRACT_ID) {
    errors.push("acceptedPatternContractId mismatch");
  }
  if (policy.acceptedFibonacciContractId !== MIF_FIBONACCI_CONTRACT_ID) {
    errors.push("acceptedFibonacciContractId mismatch");
  }
  if (policy.confluenceNormalizationMethod !== "atr_or_mid_price") {
    errors.push("unsupported confluenceNormalizationMethod");
  }
  for (const k of [
    "confluenceTolRel",
    "confluenceTolAtrMult",
    "strongMinAlignmentRatio",
  ] as const) {
    const v = policy[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      errors.push(`${k} must be finite >= 0`);
    }
  }
  if (policy.confluenceTolRel >= 1) errors.push("confluenceTolRel must be < 1");
  if (!(policy.strongMinHits >= 1) || !Number.isInteger(policy.strongMinHits)) {
    errors.push("strongMinHits must be integer >= 1");
  }
  if (!(policy.moderateMinHits >= 1) || !Number.isInteger(policy.moderateMinHits)) {
    errors.push("moderateMinHits must be integer >= 1");
  }
  if (policy.moderateMinHits > policy.strongMinHits) {
    errors.push("moderateMinHits cannot exceed strongMinHits");
  }
  if (
    !policy.allowedQualityStatusesForValid?.length
    || policy.allowedQualityStatusesForValid.includes("MISSING")
    || policy.allowedQualityStatusesForValid.includes("BLOCKED")
  ) {
    errors.push("allowedQualityStatusesForValid invalid");
  }
  if (!policy.correlationMethodId?.trim() || !policy.correlationMethodVersion?.trim()) {
    errors.push("correlation method identity missing");
  }
  return { ok: errors.length === 0, errors };
}

export class MifUnifiedChartAnalysisPolicyRegistry {
  private readonly byKey = new Map<string, MifUnifiedChartAnalysisPolicy>();

  register(policy: MifUnifiedChartAnalysisPolicy, opts?: { allowOverwrite?: boolean }): void {
    const v = validateMifUnifiedChartAnalysisPolicy(policy);
    if (!v.ok) throw new Error(`invalid unified chart-analysis policy: ${v.errors.join("; ")}`);
    const key = `${policy.policyId}@${policy.policyVersion}`;
    if (this.byKey.has(key) && !opts?.allowOverwrite) {
      throw new Error(`duplicate unified chart-analysis policy ${key}`);
    }
    this.byKey.set(key, policy);
  }

  get(policyId: string, policyVersion: string): MifUnifiedChartAnalysisPolicy | null {
    return this.byKey.get(`${policyId}@${policyVersion}`) ?? null;
  }
}

export function createDefaultMifUnifiedChartAnalysisPolicyRegistry(): MifUnifiedChartAnalysisPolicyRegistry {
  const registry = new MifUnifiedChartAnalysisPolicyRegistry();
  registry.register(MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS);
  return registry;
}
