/**
 * Phase 5C Step 1B — versioned chart-pattern policy.
 *
 * Initial values are conservative, configurable, and versioned — not universal market laws.
 * Basis (documented for owner review):
 * - Equality / prominence: relative mid-price OR ATR multiple (whichever is larger).
 * - minRetraceOfSpan 0.05: intervening trough/peak must reclaim ≥5% of average peak/trough price.
 * - Triangle residual ≤ 0.75 ATR: pivot-only fit must stay inside three-quarters ATR.
 * - breakoutBufferRel 0 / atrMult 0: exact close beyond boundary (mirrors structure bosBufferRel=0).
 * - ATR method SMA_OF_TR@14: same method ID as AT strategy atrAt — never Wilder for this policy.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_CHART_PATTERNS_ATR_METHOD_ID,
  MIF_CHART_PATTERNS_POLICY_ID,
  MIF_CHART_PATTERNS_POLICY_VERSION,
} from "./contracts.js";
import type { MifChartPatternPolicy, MifChartPatternPolicyValidation } from "./types.js";

export const MIF_POLICY_HFM_CHART_PATTERNS: MifChartPatternPolicy = {
  policyId: MIF_CHART_PATTERNS_POLICY_ID,
  policyVersion: MIF_CHART_PATTERNS_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  allowedQualityStatusesForConfirmed: ["VALID"],
  allowedQualityStatusesForForming: ["VALID", "WARNING"],
  requireConfirmedSwingsForConfirmed: true,
  allowProvisionalSwingsForForming: false,
  atrMethodId: MIF_CHART_PATTERNS_ATR_METHOD_ID,
  atrPeriod: 14,
  peakEqualityTolRel: 0.0025,
  peakEqualityTolAtrMult: 0.35,
  minRetraceOfSpan: 0.05,
  minBarsBetweenPivots: 2,
  minHeadProminenceRel: 0.004,
  minHeadProminenceAtrMult: 0.5,
  shoulderSymmetryTolRel: 0.01,
  shoulderSymmetryTolAtrMult: 0.5,
  maxNecklineSlopeAtrPerBar: 0.15,
  triangleMinTouchesPerBoundary: 2,
  triangleMaxResidualAtr: 0.75,
  triangleMinConvergencePerBar: 1e-8,
  triangleFlatSlopeAtrMult: 0.05,
  breakoutBufferRel: 0,
  breakoutBufferAtrMult: 0,
  failureWindowBars: 5,
  candleStatePolicy: "closed_only_confirm",
  maxDetections: 20,
};

export function validateMifChartPatternPolicy(
  policy: MifChartPatternPolicy | null | undefined,
): MifChartPatternPolicyValidation {
  const errors: string[] = [];
  if (!policy) return { ok: false, errors: ["policy missing"] };
  if (!policy.policyId?.trim()) errors.push("policyId missing");
  if (!policy.policyVersion?.trim()) errors.push("policyVersion missing");
  if (policy.providerId !== MIF_PROVIDER_ID) errors.push("providerId must be HFM_MT5");
  if (policy.atrMethodId !== MIF_CHART_PATTERNS_ATR_METHOD_ID) {
    errors.push(`atrMethodId must be ${MIF_CHART_PATTERNS_ATR_METHOD_ID}`);
  }
  if (!(policy.atrPeriod >= 2) || !Number.isInteger(policy.atrPeriod)) {
    errors.push("atrPeriod must be integer >= 2");
  }
  if (policy.requireConfirmedSwingsForConfirmed !== true) {
    errors.push("requireConfirmedSwingsForConfirmed must be true");
  }
  if (policy.candleStatePolicy !== "closed_only_confirm") {
    errors.push("candleStatePolicy must be closed_only_confirm");
  }
  if (
    !policy.allowedQualityStatusesForConfirmed?.length
    || policy.allowedQualityStatusesForConfirmed.includes("MISSING")
    || policy.allowedQualityStatusesForConfirmed.includes("BLOCKED")
  ) {
    errors.push("allowedQualityStatusesForConfirmed invalid");
  }
  if (!policy.allowedQualityStatusesForForming?.length) {
    errors.push("allowedQualityStatusesForForming empty");
  }
  const nonNeg = [
    "peakEqualityTolRel",
    "peakEqualityTolAtrMult",
    "minRetraceOfSpan",
    "minHeadProminenceRel",
    "minHeadProminenceAtrMult",
    "shoulderSymmetryTolRel",
    "shoulderSymmetryTolAtrMult",
    "maxNecklineSlopeAtrPerBar",
    "triangleMaxResidualAtr",
    "triangleMinConvergencePerBar",
    "triangleFlatSlopeAtrMult",
    "breakoutBufferRel",
    "breakoutBufferAtrMult",
  ] as const;
  for (const k of nonNeg) {
    const v = policy[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      errors.push(`${k} must be finite >= 0`);
    }
  }
  if (policy.minRetraceOfSpan <= 0 || policy.minRetraceOfSpan >= 1) {
    errors.push("minRetraceOfSpan must be in (0,1)");
  }
  if (!(policy.minBarsBetweenPivots >= 1) || !Number.isInteger(policy.minBarsBetweenPivots)) {
    errors.push("minBarsBetweenPivots must be integer >= 1");
  }
  if (!(policy.triangleMinTouchesPerBoundary >= 2) || !Number.isInteger(policy.triangleMinTouchesPerBoundary)) {
    errors.push("triangleMinTouchesPerBoundary must be integer >= 2");
  }
  if (!(policy.failureWindowBars >= 1) || !Number.isInteger(policy.failureWindowBars)) {
    errors.push("failureWindowBars must be integer >= 1");
  }
  if (!(policy.maxDetections >= 1) || !Number.isInteger(policy.maxDetections)) {
    errors.push("maxDetections must be integer >= 1");
  }
  return { ok: errors.length === 0, errors };
}

export class MifChartPatternPolicyRegistry {
  private readonly byKey = new Map<string, MifChartPatternPolicy>();

  register(policy: MifChartPatternPolicy, opts?: { allowOverwrite?: boolean }): void {
    const v = validateMifChartPatternPolicy(policy);
    if (!v.ok) throw new Error(`invalid chart-pattern policy: ${v.errors.join("; ")}`);
    const key = `${policy.policyId}@${policy.policyVersion}`;
    if (this.byKey.has(key) && !opts?.allowOverwrite) {
      throw new Error(`duplicate chart-pattern policy ${key}`);
    }
    this.byKey.set(key, policy);
  }

  get(policyId: string, policyVersion: string): MifChartPatternPolicy | null {
    return this.byKey.get(`${policyId}@${policyVersion}`) ?? null;
  }
}

export function createDefaultMifChartPatternPolicyRegistry(): MifChartPatternPolicyRegistry {
  const registry = new MifChartPatternPolicyRegistry();
  registry.register(MIF_POLICY_HFM_CHART_PATTERNS);
  return registry;
}
