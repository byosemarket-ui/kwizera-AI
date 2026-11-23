/**
 * Phase 06 §12 — cross-family technical confluence with double-count guards.
 * Grades are analytical labels — NOT win / event / calibrated probability.
 */
import type { MifDeepTechnicalIntelligencePolicy } from "./types.js";
import type {
  HfmDeepTechnicalTrendDirection,
  HfmTechnicalConfluenceAssessment,
  HfmTechnicalConfluenceFamilyVote,
  HfmTechnicalConfluenceGrade,
} from "./types.js";

function signFor(dir: HfmDeepTechnicalTrendDirection): number {
  if (dir === "BULLISH") return 1;
  if (dir === "BEARISH") return -1;
  return 0;
}

function pushVote(
  votes: HfmTechnicalConfluenceFamilyVote[],
  usedGroups: Set<string>,
  input: {
    family: string;
    direction: HfmDeepTechnicalTrendDirection;
    weight: number;
    group: string;
    sourceAssessmentIds: string[];
    forceSkip?: string | null;
  },
): void {
  if (input.forceSkip) {
    votes.push({
      family: input.family,
      direction: input.direction,
      weight: input.weight,
      contribution: 0,
      inputDependencyGroup: input.group,
      counted: false,
      skipReason: input.forceSkip,
      sourceAssessmentIds: input.sourceAssessmentIds,
    });
    return;
  }
  if (input.direction === "UNKNOWN" || input.direction === "MIXED" || input.direction === "NEUTRAL") {
    votes.push({
      family: input.family,
      direction: input.direction,
      weight: input.weight,
      contribution: 0,
      inputDependencyGroup: input.group,
      counted: false,
      skipReason: `non_directional_${input.direction}`,
      sourceAssessmentIds: input.sourceAssessmentIds,
    });
    return;
  }
  if (usedGroups.has(input.group)) {
    votes.push({
      family: input.family,
      direction: input.direction,
      weight: input.weight,
      contribution: 0,
      inputDependencyGroup: input.group,
      counted: false,
      skipReason: "double_count_guard_group_already_used",
      sourceAssessmentIds: input.sourceAssessmentIds,
    });
    return;
  }
  usedGroups.add(input.group);
  const contribution = signFor(input.direction) * input.weight;
  votes.push({
    family: input.family,
    direction: input.direction,
    weight: input.weight,
    contribution,
    inputDependencyGroup: input.group,
    counted: true,
    skipReason: null,
    sourceAssessmentIds: input.sourceAssessmentIds,
  });
}

export function computeDeepTechnicalConfluence(input: {
  policy: MifDeepTechnicalIntelligencePolicy;
  structureDirection: HfmDeepTechnicalTrendDirection;
  structureIds: string[];
  regimeDirection: HfmDeepTechnicalTrendDirection;
  regimeIds: string[];
  mtfDirection: HfmDeepTechnicalTrendDirection;
  mtfIds: string[];
  levelsDirection: HfmDeepTechnicalTrendDirection;
  levelsIds: string[];
  patternsDirection: HfmDeepTechnicalTrendDirection;
  patternsIds: string[];
  momentumDirection: HfmDeepTechnicalTrendDirection;
  momentumIds: string[];
  pressureDirection: HfmDeepTechnicalTrendDirection;
  pressureIds: string[];
  /** When true, pressure shares candle-body tip with displacement already counted. */
  pressureSharesCandleBodyGroup?: boolean;
  displacementCountedInCandleBody?: boolean;
}): HfmTechnicalConfluenceAssessment {
  const votes: HfmTechnicalConfluenceFamilyVote[] = [];
  const used = new Set<string>();
  const p = input.policy;

  pushVote(votes, used, {
    family: "MARKET_STRUCTURE",
    direction: input.structureDirection,
    weight: p.weightStructure,
    group: "structure_family",
    sourceAssessmentIds: input.structureIds,
  });
  pushVote(votes, used, {
    family: "REGIME_TREND",
    direction: input.regimeDirection,
    weight: p.weightRegime,
    group: "regime_family",
    sourceAssessmentIds: input.regimeIds,
  });
  pushVote(votes, used, {
    family: "MTF_ALIGNMENT",
    direction: input.mtfDirection,
    weight: p.weightMtf,
    group: "mtf_family",
    sourceAssessmentIds: input.mtfIds,
  });
  // Levels reuse structure swings — same structure_family would block; use levels_view group
  // but skip if structure already voted same tip and levels are derived from same swings.
  pushVote(votes, used, {
    family: "SUPPORT_RESISTANCE_LIQUIDITY",
    direction: input.levelsDirection,
    weight: p.weightLevels,
    group: "levels_family",
    sourceAssessmentIds: input.levelsIds,
  });
  pushVote(votes, used, {
    family: "PATTERNS_FIB_HARMONIC",
    direction: input.patternsDirection,
    weight: p.weightPatterns,
    group: "pattern_family",
    sourceAssessmentIds: input.patternsIds,
  });
  pushVote(votes, used, {
    family: "MOMENTUM",
    direction: input.momentumDirection,
    weight: p.weightMomentum,
    group: "momentum_family",
    sourceAssessmentIds: input.momentumIds,
  });

  const pressureSkip =
    input.pressureSharesCandleBodyGroup && input.displacementCountedInCandleBody
      ? "shared_candle_body_inputs_with_displacement"
      : null;
  // Pressure always in candle_body_proxy group — if something else claimed it, skip.
  pushVote(votes, used, {
    family: "BUYER_SELLER_PRESSURE",
    direction: input.pressureDirection,
    weight: p.weightPressure,
    group: "candle_body_proxy",
    sourceAssessmentIds: input.pressureIds,
    forceSkip: pressureSkip,
  });

  const counted = votes.filter((v) => v.counted);
  if (counted.length === 0) {
    return {
      grade: "INSUFFICIENT_DATA",
      directionalScore: null,
      bullishContribution: 0,
      bearishContribution: 0,
      families: votes,
      sharedInputDependencies: [
        "structure_family↔levels_family (shared swings)",
        "candle_body_proxy (pressure↔displacement↔candlestick)",
        "pattern_family (chart↔harmonic↔unified fib hit)",
      ],
      explanation: "no countable directional family votes",
      isWinProbability: false,
      isEventProbability: false,
      isCalibratedProbability: false,
      analyticalReferenceOnly: true,
    };
  }

  const weightSum = counted.reduce((a, v) => a + v.weight, 0) || 1;
  const raw = counted.reduce((a, v) => a + v.contribution, 0);
  const directionalScore = raw / weightSum;
  const bullishContribution = counted
    .filter((v) => v.contribution > 0)
    .reduce((a, v) => a + v.contribution, 0);
  const bearishContribution = counted
    .filter((v) => v.contribution < 0)
    .reduce((a, v) => a + Math.abs(v.contribution), 0);

  const dirs = new Set(counted.map((v) => v.direction));
  const hasConflict = dirs.has("BULLISH") && dirs.has("BEARISH");

  let grade: HfmTechnicalConfluenceGrade = "NONE";
  if (hasConflict && Math.abs(directionalScore) < p.confluenceModerateMin) {
    grade = "CONFLICTING";
  } else if (Math.abs(directionalScore) >= p.confluenceStrongMin && !hasConflict) {
    grade = "STRONG";
  } else if (Math.abs(directionalScore) >= p.confluenceModerateMin) {
    grade = hasConflict ? "CONFLICTING" : "MODERATE";
  } else if (Math.abs(directionalScore) > 0.05) {
    grade = "WEAK";
  } else {
    grade = "NONE";
  }

  return {
    grade,
    directionalScore,
    bullishContribution,
    bearishContribution,
    families: votes,
    sharedInputDependencies: [
      "structure_family↔levels_family (shared swings)",
      "candle_body_proxy (pressure↔displacement↔candlestick)",
      "pattern_family (chart↔harmonic↔unified fib hit)",
    ],
    explanation:
      `grade=${grade}; score=${directionalScore.toFixed(3)}; `
      + `bull=${bullishContribution.toFixed(3)} bear=${bearishContribution.toFixed(3)}; `
      + `counted=${counted.length}/${votes.length}; analytical reference only — not a trade probability`,
    isWinProbability: false,
    isEventProbability: false,
    isCalibratedProbability: false,
    analyticalReferenceOnly: true,
  };
}
