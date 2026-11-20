/**
 * Phase 5F STEP 2 — deterministic similarity scoring.
 *
 * Continuous groups: weighted normalized squared Euclidean → similarity via
 *   score = 100 * exp(-distance)
 * where distance is sqrt(sum w_i * d_i^2) with per-feature abs diffs after
 * optional z-style scale (features already dimensionless).
 *
 * Categorical: Jaccard agreement converted to [0,1] disagreement, mixed with
 * continuous via fixed group weights.
 *
 * Missing features: excluded from distance; coverage = availablePairs/totalPairs;
 * if coverage < minCoverage → insufficientComparableFeatures (score still computed
 * but flagged; callers may reject). Missing never improves similarity artificially
 * (no zero-fill as match).
 */
import {
  MIF_ANALOGUE_NORMALIZATION_POLICY_ID,
  MIF_ANALOGUE_NORMALIZATION_POLICY_VERSION,
  MIF_ANALOGUE_SCORE_MAX,
  MIF_ANALOGUE_SCORE_MIN,
  MIF_ANALOGUE_SIMILARITY_ALGORITHM_ID,
  MIF_ANALOGUE_SIMILARITY_ALGORITHM_VERSION,
  MIF_ANALOGUE_WEIGHT_TABLE_ID,
  MIF_ANALOGUE_WEIGHT_TABLE_VERSION,
} from "./contracts.js";
import type {
  MifAnalogueFeatureVector,
  MifAnalogueScoreContribution,
  MifAnalogueSimilarityResult,
} from "./types.js";

/** Fixed versioned group weights (sum ≈ 1). */
export const MIF_ANALOGUE_GROUP_WEIGHTS_V1: Readonly<Record<string, number>> = {
  SHAPE: 0.3,
  RETURNS: 0.3,
  VOLATILITY: 0.15,
  MOMENTUM: 0.15,
  CATEGORICAL: 0.1,
  STRUCTURE: 0.0, // reserved; inactive in v1 baseline
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return MIF_ANALOGUE_SCORE_MIN;
  return Math.max(MIF_ANALOGUE_SCORE_MIN, Math.min(MIF_ANALOGUE_SCORE_MAX, n));
}

function pairKey(name: string): string {
  return name;
}

/**
 * Map Euclidean-like distance d∈[0,∞) to similarity∈[0,100].
 * Identical vectors → distance 0 → score 100.
 */
export function distanceToSimilarityScore(distance: number): number {
  if (!Number.isFinite(distance) || distance < 0) return MIF_ANALOGUE_SCORE_MIN;
  return clampScore(100 * Math.exp(-distance));
}

export function scoreAnalogueSimilarity(input: {
  reference: MifAnalogueFeatureVector;
  candidate: MifAnalogueFeatureVector;
  minFeatureCoverage: number;
}): MifAnalogueSimilarityResult {
  const refMap = new Map(input.reference.continuous.map((f) => [pairKey(f.name), f]));
  const candMap = new Map(input.candidate.continuous.map((f) => [pairKey(f.name), f]));
  const refCat = new Map(input.reference.categorical.map((f) => [pairKey(f.name), f]));
  const candCat = new Map(input.candidate.categorical.map((f) => [pairKey(f.name), f]));

  const allNames = new Set<string>([
    ...refMap.keys(),
    ...candMap.keys(),
    ...refCat.keys(),
    ...candCat.keys(),
  ]);

  const contributions: MifAnalogueScoreContribution[] = [];
  const agreeing: string[] = [];
  const disagreeing: string[] = [];
  const unavailable: string[] = [];

  let weightedSq = 0;
  let weightSum = 0;
  let comparablePairs = 0;
  let totalPairs = 0;

  // Continuous
  for (const name of [...refMap.keys()].sort()) {
    const rf = refMap.get(name)!;
    const cf = candMap.get(name);
    const groupW = MIF_ANALOGUE_GROUP_WEIGHTS_V1[rf.group] ?? 0;
    totalPairs += 1;
    if (!cf || !rf.available || !cf.available || rf.value == null || cf.value == null) {
      unavailable.push(name);
      contributions.push({
        name,
        group: rf.group,
        weight: groupW,
        contribution: 0,
        available: false,
        referenceValue: rf.value,
        candidateValue: cf?.value ?? null,
      });
      continue;
    }
    comparablePairs += 1;
    const diff = Math.abs(rf.value - cf.value);
    // Soft scale: shape ratios ~[0,1]; returns/momentum can be larger — use tanh to bound.
    const scaled = Math.tanh(diff);
    const w = groupW;
    weightedSq += w * scaled * scaled;
    weightSum += w;
    const contribution = w * scaled;
    contributions.push({
      name,
      group: rf.group,
      weight: w,
      contribution,
      available: true,
      referenceValue: rf.value,
      candidateValue: cf.value,
    });
    if (scaled < 0.15) agreeing.push(name);
    else if (scaled > 0.45) disagreeing.push(name);
  }

  // Categorical Jaccard-style: agreement fraction → disagreement distance
  let catAgree = 0;
  let catTotal = 0;
  for (const name of [...refCat.keys()].sort()) {
    const rf = refCat.get(name)!;
    const cf = candCat.get(name);
    const groupW = MIF_ANALOGUE_GROUP_WEIGHTS_V1.CATEGORICAL ?? 0.1;
    totalPairs += 1;
    if (!cf || !rf.available || !cf.available || rf.value == null || cf.value == null) {
      unavailable.push(name);
      contributions.push({
        name,
        group: "CATEGORICAL",
        weight: groupW,
        contribution: 0,
        available: false,
        referenceValue: rf.value,
        candidateValue: cf?.value ?? null,
      });
      continue;
    }
    comparablePairs += 1;
    catTotal += 1;
    const match = rf.value === cf.value;
    if (match) {
      catAgree += 1;
      agreeing.push(name);
    } else {
      disagreeing.push(name);
    }
    contributions.push({
      name,
      group: "CATEGORICAL",
      weight: groupW,
      contribution: match ? 0 : groupW,
      available: true,
      referenceValue: rf.value,
      candidateValue: cf.value,
    });
  }

  const catDisagreement = catTotal > 0 ? 1 - catAgree / catTotal : 0;
  const catW = MIF_ANALOGUE_GROUP_WEIGHTS_V1.CATEGORICAL ?? 0.1;
  if (catTotal > 0) {
    weightedSq += catW * catDisagreement * catDisagreement;
    weightSum += catW;
  }

  const distance =
    weightSum > 0 ? Math.sqrt(weightedSq / weightSum) : Number.POSITIVE_INFINITY;
  const coverage = totalPairs > 0 ? comparablePairs / totalPairs : 0;
  const insufficient = coverage < input.minFeatureCoverage || !Number.isFinite(distance);
  const score = insufficient && comparablePairs === 0
    ? MIF_ANALOGUE_SCORE_MIN
    : distanceToSimilarityScore(Number.isFinite(distance) ? distance : 10);

  // Ensure allNames unused warning silence
  void allNames;

  return {
    score,
    distance: Number.isFinite(distance) ? distance : 10,
    algorithmId: MIF_ANALOGUE_SIMILARITY_ALGORITHM_ID,
    algorithmVersion: MIF_ANALOGUE_SIMILARITY_ALGORITHM_VERSION,
    weightTableId: MIF_ANALOGUE_WEIGHT_TABLE_ID,
    weightTableVersion: MIF_ANALOGUE_WEIGHT_TABLE_VERSION,
    normalizationPolicyId: MIF_ANALOGUE_NORMALIZATION_POLICY_ID,
    normalizationPolicyVersion: MIF_ANALOGUE_NORMALIZATION_POLICY_VERSION,
    comparableCoverage: coverage,
    insufficientComparableFeatures: insufficient,
    contributions,
    agreeingFeatures: agreeing,
    disagreeingFeatures: disagreeing,
    unavailableFeatures: [...new Set(unavailable)],
  };
}
