/**
 * Phase 5E Step 1 — versioned ranking policy with documented weights.
 *
 * Weights prioritize evidence reliability and multi-timeframe agreement over
 * single-engine momentum spikes. Conflict is a separate penalty, not averaged away.
 */
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import {
  MIF_OPPORTUNITY_RANKING_POLICY_ID,
  MIF_OPPORTUNITY_RANKING_POLICY_VERSION,
} from "./contracts.js";
import type { MifRankingPolicy, MifRankingPolicyWeights } from "./types.js";

export const MIF_DEFAULT_RANKING_WEIGHTS: MifRankingPolicyWeights = {
  dataQuality: 0.15,
  evidenceCompleteness: 0.15,
  analyticalEvidence: 0.2,
  marketStructureAlignment: 0.12,
  momentumDisplacement: 0.13,
  multiTimeframeAgreement: 0.15,
  strategySetupQuality: 0.1,
};

export const MIF_POLICY_HFM_OPPORTUNITY_RANKING: MifRankingPolicy = {
  policyId: MIF_OPPORTUNITY_RANKING_POLICY_ID,
  policyVersion: MIF_OPPORTUNITY_RANKING_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  weights: { ...MIF_DEFAULT_RANKING_WEIGHTS },
  weightRationale: {
    dataQuality:
      "0.15 — invalid/stale HFM data undermines all other components; foundational gate.",
    evidenceCompleteness:
      "0.15 — strategy-required evidence coverage; missing required evidence is not treated as negative proof.",
    analyticalEvidence:
      "0.20 — largest positive weight: net supporting vs conflicting detector evidence after provenance dedupe.",
    marketStructureAlignment:
      "0.12 — structure bias vs candidate direction; correlated with displacement (deduped).",
    momentumDisplacement:
      "0.13 — ROC/RSI + dedicated CLOSED displacement; FORMING provisional never scored as confirmed.",
    multiTimeframeAgreement:
      "0.15 — HTF/ITF agreement is a strong prioritization signal; conflicts get conflict penalty separately.",
    strategySetupQuality:
      "0.10 — candidate status, confirmations outstanding, known limitations; secondary to evidence.",
  },
  maxConflictPenalty: 25,
  bandThresholds: {
    veryStrong: 80,
    strong: 65,
    moderate: 50,
    weak: 35,
  },
  correlatedFamilyGroups: [
    ["MARKET_STRUCTURE", "PRICE_DISPLACEMENT", "SUPPORT_RESISTANCE"],
    ["FIBONACCI", "GEOMETRIC_PATTERN", "HARMONIC_PATTERN"],
    ["MOMENTUM", "PRICE_DISPLACEMENT", "VOLATILITY"],
    ["MARKET_REGIME", "RANGE_STRUCTURE", "VOLATILITY"],
  ],
  scoreScaleMin: 0,
  scoreScaleMax: 100,
};

export function validateMifRankingPolicy(
  policy: MifRankingPolicy | null | undefined,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!policy) return { ok: false, errors: ["policy missing"] };
  if (!policy.policyId?.trim()) errors.push("policyId missing");
  if (!policy.policyVersion?.trim()) errors.push("policyVersion missing");
  if (policy.providerId !== MIF_PROVIDER_ID) errors.push("providerId must be HFM_MT5");
  const w = policy.weights;
  const sum =
    w.dataQuality
    + w.evidenceCompleteness
    + w.analyticalEvidence
    + w.marketStructureAlignment
    + w.momentumDisplacement
    + w.multiTimeframeAgreement
    + w.strategySetupQuality;
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-9) {
    errors.push(`weights must sum to 1.0 (got ${sum})`);
  }
  for (const [k, v] of Object.entries(w)) {
    if (!(typeof v === "number") || !Number.isFinite(v) || v < 0 || v > 1) {
      errors.push(`weight ${k} must be in [0,1]`);
    }
  }
  if (!(policy.maxConflictPenalty >= 0 && policy.maxConflictPenalty <= 40)) {
    errors.push("maxConflictPenalty must be in [0,40]");
  }
  const t = policy.bandThresholds;
  if (!(t.veryStrong > t.strong && t.strong > t.moderate && t.moderate > t.weak && t.weak >= 0)) {
    errors.push("bandThresholds must be strictly decreasing veryStrong>strong>moderate>weak>=0");
  }
  return { ok: errors.length === 0, errors };
}

export function resolveRankingPolicy(
  overrides?: Partial<MifRankingPolicy> | null,
): MifRankingPolicy {
  if (!overrides) return { ...MIF_POLICY_HFM_OPPORTUNITY_RANKING, weights: { ...MIF_DEFAULT_RANKING_WEIGHTS } };
  const merged: MifRankingPolicy = {
    ...MIF_POLICY_HFM_OPPORTUNITY_RANKING,
    ...overrides,
    weights: { ...MIF_DEFAULT_RANKING_WEIGHTS, ...(overrides.weights ?? {}) },
    weightRationale: {
      ...MIF_POLICY_HFM_OPPORTUNITY_RANKING.weightRationale,
      ...(overrides.weightRationale ?? {}),
    },
    bandThresholds: {
      ...MIF_POLICY_HFM_OPPORTUNITY_RANKING.bandThresholds,
      ...(overrides.bandThresholds ?? {}),
    },
    correlatedFamilyGroups:
      overrides.correlatedFamilyGroups
      ?? MIF_POLICY_HFM_OPPORTUNITY_RANKING.correlatedFamilyGroups,
  };
  const v = validateMifRankingPolicy(merged);
  if (!v.ok) throw new Error(`invalid ranking policy: ${v.errors.join("; ")}`);
  return merged;
}
