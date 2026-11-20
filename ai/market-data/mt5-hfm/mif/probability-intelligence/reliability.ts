/**
 * Phase 5E Step 2 — reliability assessment (separate from probability value).
 */
import type {
  MifCalibrationStatus,
  MifConfidenceInterval,
  MifProbabilityPolicy,
  MifProbabilitySampleStatus,
  MifReliabilityStatus,
} from "./types.js";
import { resolveProbabilityPolicy } from "./policies.js";

export function assessProbabilityReliability(input: {
  sampleStatus: MifProbabilitySampleStatus;
  eligibleResolvedDenominator: number;
  confidenceInterval: MifConfidenceInterval | null;
  calibrationStatus: MifCalibrationStatus;
  dataQualityStatus?: string | null;
  cohortTier?: string | null;
  policy?: Partial<MifProbabilityPolicy> | null;
}): { status: MifReliabilityStatus; notes: string[] } {
  const policy = resolveProbabilityPolicy(input.policy);
  const notes: string[] = [];

  if (
    input.sampleStatus === "BLOCKED_BY_DATA_QUALITY"
    || input.dataQualityStatus === "BLOCKED"
  ) {
    return { status: "UNAVAILABLE", notes: ["blocked_by_data_quality"] };
  }

  if (
    input.sampleStatus === "UNAVAILABLE"
    || input.sampleStatus === "LEVELS_NOT_PROVIDED"
    || input.sampleStatus === "INVALID_LEVEL_RELATIONSHIP"
  ) {
    return { status: "UNAVAILABLE", notes: [`sampleStatus=${input.sampleStatus}`] };
  }

  if (
    input.sampleStatus === "INSUFFICIENT_SAMPLE"
    || input.sampleStatus === "INSUFFICIENT_HISTORICAL_COVERAGE"
    || input.eligibleResolvedDenominator < policy.minSampleForProbability
  ) {
    notes.push(
      `n=${input.eligibleResolvedDenominator}<min=${policy.minSampleForProbability}`,
    );
    return { status: "INSUFFICIENT_RELIABILITY", notes };
  }

  const half = input.confidenceInterval?.halfWidth ?? 1;
  notes.push(`ciHalfWidth=${half}`);
  notes.push(`calibration=${input.calibrationStatus}`);
  if (input.cohortTier) notes.push(`cohortTier=${input.cohortTier}`);

  if (
    (input.calibrationStatus === "CALIBRATED"
      || input.calibrationStatus === "PROVISIONALLY_CALIBRATED")
    && half <= policy.highReliabilityMaxHalfWidth
  ) {
    return { status: "HIGH_RELIABILITY", notes };
  }

  if (half <= policy.moderateReliabilityMaxHalfWidth) {
    if (input.calibrationStatus === "UNCALIBRATED") {
      notes.push("estimate_exists_but_uncalibrated");
      return { status: "LOW_RELIABILITY", notes };
    }
    return { status: "MODERATE_RELIABILITY", notes };
  }

  notes.push("wide_confidence_interval");
  return { status: "LOW_RELIABILITY", notes };
}
