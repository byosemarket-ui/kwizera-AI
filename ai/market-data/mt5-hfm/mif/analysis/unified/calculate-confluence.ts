/**
 * Phase 5C Step 1C — explainable confluence assessment.
 * Grades are policy-threshold labels over measured hits — not win/reversal probabilities.
 */
import type { MifAnalyticalQualityStatus } from "../quality/assessment-quality-gate.js";
import type {
  MifConfluenceAssessment,
  MifPatternFibRelationship,
  MifUnifiedChartAnalysisPolicy,
} from "./types.js";

export function calculateConfluence(input: {
  relationships: readonly MifPatternFibRelationship[];
  policy: MifUnifiedChartAnalysisPolicy;
  qualityStatus: MifAnalyticalQualityStatus;
  incompatible?: boolean;
}): MifConfluenceAssessment {
  if (input.incompatible) {
    return {
      grade: "INCOMPATIBLE",
      components: {
        comparisonCount: 0,
        withinToleranceCount: 0,
        unavailableReferenceCount: 0,
        alignmentRatio: null,
        meanNormalizedDistanceAmongHits: null,
        qualityStatus: input.qualityStatus,
        precisionOkRatio: null,
        tickAlignedRatio: null,
      },
      explanation: "Sources incompatible — confluence not evaluated",
      analyticalReferenceOnly: true,
    };
  }

  const unavailable = input.relationships.filter((r) => !r.patternReference.available);
  const comparable = input.relationships.filter((r) => r.patternReference.available);
  const hits = comparable.filter((r) => r.withinTolerance);

  const alignmentRatio =
    comparable.length > 0 ? hits.length / comparable.length : null;

  const hitNorms = hits
    .map((h) => h.normalizedDistance)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const meanNormalizedDistanceAmongHits =
    hitNorms.length > 0
      ? hitNorms.reduce((a, b) => a + b, 0) / hitNorms.length
      : null;

  const precisionVals = comparable
    .map((r) => r.precisionOk)
    .filter((x): x is boolean => x === true || x === false);
  const tickVals = comparable
    .map((r) => r.tickAligned)
    .filter((x): x is boolean => x === true || x === false);

  const precisionOkRatio =
    precisionVals.length > 0
      ? precisionVals.filter(Boolean).length / precisionVals.length
      : null;
  const tickAlignedRatio =
    tickVals.length > 0 ? tickVals.filter(Boolean).length / tickVals.length : null;

  let grade: MifConfluenceAssessment["grade"] = "NONE";
  if (comparable.length === 0) {
    grade = unavailable.length > 0 ? "UNSCORED" : "NONE";
  } else if (
    hits.length >= input.policy.strongMinHits
    && (alignmentRatio ?? 0) >= input.policy.strongMinAlignmentRatio
  ) {
    grade = "STRONG";
  } else if (hits.length >= input.policy.moderateMinHits) {
    grade = "MODERATE";
  } else {
    grade = "WEAK";
  }

  const explanation =
    `grade=${grade}; hits=${hits.length}/${comparable.length}; `
    + `unavailableRefs=${unavailable.length}; `
    + `tolRel=${input.policy.confluenceTolRel}; tolAtrMult=${input.policy.confluenceTolAtrMult}; `
    + "analytical reference only — not a trade probability";

  return {
    grade,
    components: {
      comparisonCount: comparable.length,
      withinToleranceCount: hits.length,
      unavailableReferenceCount: unavailable.length,
      alignmentRatio,
      meanNormalizedDistanceAmongHits,
      qualityStatus: input.qualityStatus,
      precisionOkRatio,
      tickAlignedRatio,
    },
    explanation,
    analyticalReferenceOnly: true,
  };
}
