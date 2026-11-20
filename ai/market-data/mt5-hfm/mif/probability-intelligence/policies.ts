/**
 * Phase 5E Step 2 — versioned probability / evidence policies with documented thresholds.
 */
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import { MIF_PERFORMANCE_MIN_SAMPLE_FOR_WIN_RATE } from "../production-integration/performance-statistics.js";
import {
  MIF_EVIDENCE_INTELLIGENCE_POLICY_ID,
  MIF_EVIDENCE_INTELLIGENCE_POLICY_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_POLICY_ID,
  MIF_PROBABILITY_INTELLIGENCE_POLICY_VERSION,
} from "./contracts.js";
import type { MifProbabilityPolicy } from "./types.js";

export const MIF_POLICY_HFM_PROBABILITY: MifProbabilityPolicy = {
  policyId: MIF_PROBABILITY_INTELLIGENCE_POLICY_ID,
  policyVersion: MIF_PROBABILITY_INTELLIGENCE_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  minSampleForProbability: MIF_PERFORMANCE_MIN_SAMPLE_FOR_WIN_RATE,
  minSampleForProvisionalCalibration: 30,
  minSampleForCalibration: 100,
  confidenceLevel: 0.95,
  highReliabilityMaxHalfWidth: 0.08,
  moderateReliabilityMaxHalfWidth: 0.15,
  defaultEvaluationHorizonBars: 200,
  rationale: {
    minSampleForProbability:
      "Aligned with Phase 5D.7 performance min sample (10 decisive outcomes). Below this, raw frequency is reported as INSUFFICIENT_SAMPLE with probability=null.",
    minSampleForProvisionalCalibration:
      "30 OOS prediction–outcome pairs minimum for PROVISIONALLY_CALIBRATED; not claimed as CALIBRATED.",
    minSampleForCalibration:
      "100 OOS pairs required for CALIBRATED status. Small samples must not be labeled calibrated.",
    confidenceLevel: "Wilson score interval at 95% for binomial proportions.",
    highReliabilityMaxHalfWidth:
      "Half-width ≤ 0.08 and sufficient sample + calibrated/provisional → HIGH_RELIABILITY.",
    moderateReliabilityMaxHalfWidth:
      "Half-width ≤ 0.15 with sufficient sample → at most MODERATE_RELIABILITY.",
    defaultEvaluationHorizonBars:
      "Matches outcome-evaluation default maxAgeBars=200; horizon must be explicit on assessments.",
    noBayesianSmoothing:
      "No Bayesian prior is applied. Raw empirical frequency is never silently adjusted. Adjusted estimates are not invented.",
  },
};

export const MIF_POLICY_HFM_EVIDENCE_INTELLIGENCE = {
  policyId: MIF_EVIDENCE_INTELLIGENCE_POLICY_ID,
  policyVersion: MIF_EVIDENCE_INTELLIGENCE_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  reusesRankingProvenance: true as const,
  rationale:
    "Reuses STEP 1 buildEvidenceContributions / correlated family groups; missing ≠ negative proof.",
};

export function resolveProbabilityPolicy(
  overrides?: Partial<MifProbabilityPolicy> | null,
): MifProbabilityPolicy {
  if (!overrides) return { ...MIF_POLICY_HFM_PROBABILITY };
  const merged = {
    ...MIF_POLICY_HFM_PROBABILITY,
    ...overrides,
    rationale: { ...MIF_POLICY_HFM_PROBABILITY.rationale, ...(overrides.rationale ?? {}) },
  };
  if (merged.providerId !== MIF_PROVIDER_ID) {
    throw new Error("probability policy providerId must be HFM_MT5");
  }
  if (!(merged.minSampleForProbability >= 1)) {
    throw new Error("minSampleForProbability must be >= 1");
  }
  if (!(merged.confidenceLevel > 0 && merged.confidenceLevel < 1)) {
    throw new Error("confidenceLevel must be in (0,1)");
  }
  return merged;
}
