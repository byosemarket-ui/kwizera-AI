/**
 * Phase 5F STEP 5 — research calibration readiness (Phase B/C).
 * Mid-split 5E scaffolding is never WF-calibrated.
 * Phase C WF metrics runs are reported separately when present.
 */
import type { MifWfCalibrationStatus } from "../wf-calibration/types.js";
import {
  MIF_RESEARCH_CALIBRATED_THRESHOLD,
  MIF_RESEARCH_DECISIVE_TARGET_EVENT,
  MIF_RESEARCH_LABEL_INSUFFICIENT,
  MIF_RESEARCH_LABEL_NOT_CALIBRATED,
  MIF_RESEARCH_LABEL_UNCALIBRATED,
  MIF_RESEARCH_PROVISIONAL_THRESHOLD,
} from "./contracts.js";
import type { MifResearchCalibrationStatusReport } from "./types.js";

const DECISIVE_KINDS = new Set(["TARGET_REACHED", "INVALIDATION_REACHED"]);

export function isDecisiveLevelResultKind(kind: string | null | undefined): boolean {
  return kind != null && DECISIVE_KINDS.has(kind);
}

export function buildResearchCalibrationStatus(input: {
  frozenAssessmentCount: number;
  highTrustFreezeCount: number;
  decisiveFrozenPairCount: number;
  scaffoldingCalibrationRunCount: number;
  wfCalibrationStatus?: MifWfCalibrationStatus | null;
  wfEligibleOosCount?: number;
  wfRunId?: string | null;
}): MifResearchCalibrationStatusReport {
  const reasons: string[] = [];
  const nFreeze = Math.max(0, input.frozenAssessmentCount);
  const nHigh = Math.max(0, input.highTrustFreezeCount);
  const nPairs = Math.max(0, input.decisiveFrozenPairCount);
  const scaffold = Math.max(0, input.scaffoldingCalibrationRunCount);
  const wfN = Math.max(0, input.wfEligibleOosCount ?? 0);

  if (nFreeze === 0) reasons.push("no_immutable_prediction_time_freezes");
  if (nHigh === 0) reasons.push("no_high_trust_prediction_time_freezes");
  if (nPairs === 0) reasons.push("no_decisive_frozen_prediction_outcome_pairs");
  if (nPairs > 0 && nPairs < MIF_RESEARCH_PROVISIONAL_THRESHOLD) {
    reasons.push(
      `decisive_frozen_pairs=${nPairs}<provisional_threshold=${MIF_RESEARCH_PROVISIONAL_THRESHOLD}`,
    );
  }
  reasons.push("walk_forward_calibrated=false");
  reasons.push("mid_split_scaffolding_is_not_wf_calibrated");
  reasons.push(`target_event=${MIF_RESEARCH_DECISIVE_TARGET_EVENT}`);
  reasons.push("ambiguous_expired_missing_level_unsupported_excluded_from_decisive_denominator");
  reasons.push("no_oos_fitting_or_tuning_in_research_results");
  if (scaffold > 0) {
    reasons.push(
      `existing_5e_calibration_scaffolding_runs=${scaffold}_are_metrics_only_not_wf_calibrated`,
    );
  }
  if (input.wfCalibrationStatus) {
    reasons.push(`latest_wf_calibration_status=${input.wfCalibrationStatus}`);
    reasons.push(`latest_wf_oos_eligible=${wfN}`);
    if (input.wfRunId) reasons.push(`latest_wf_run_id=${input.wfRunId}`);
  }

  let status: MifResearchCalibrationStatusReport["status"] =
    nHigh === 0 || nPairs === 0
      ? "NOT_CALIBRATED"
      : nPairs < MIF_RESEARCH_PROVISIONAL_THRESHOLD
        ? "INSUFFICIENT_DATA"
        : "NOT_CALIBRATED";

  // Surface WF status vocabulary into claim labels without claiming CALIBRATED falsely
  if (input.wfCalibrationStatus === "REJECTED_TEMPORAL_LEAKAGE") {
    status = "NOT_CALIBRATED";
    reasons.push("TEMPORAL_LEAKAGE — REJECTED");
  } else if (input.wfCalibrationStatus === "INSUFFICIENT_DATA") {
    status = "INSUFFICIENT_DATA";
  } else if (input.wfCalibrationStatus === "PROVISIONAL_EVALUATION") {
    status = "NOT_CALIBRATED";
    reasons.push("wf_provisional_evaluation_not_calibrated");
  } else if (input.wfCalibrationStatus === "CALIBRATION_EVALUATED") {
    status = "NOT_CALIBRATED";
    reasons.push("wf_metrics_evaluated_but_not_calibrated_claim");
  }

  if (nPairs >= MIF_RESEARCH_PROVISIONAL_THRESHOLD) {
    reasons.push("phase_b_c_blocks_calibrated_claim_without_full_wf_model_freeze");
  }

  return {
    status,
    reasons,
    provisionalThreshold: MIF_RESEARCH_PROVISIONAL_THRESHOLD,
    calibratedThreshold: MIF_RESEARCH_CALIBRATED_THRESHOLD,
    frozenAssessmentCount: nFreeze,
    decisiveFrozenPairCount: nPairs,
    walkForwardCalibrated: false,
    midSplitScaffoldingNotWfCalibrated: true,
    reliabilityClaimsAllowed: false,
    fabricatedProbabilities: false,
    existingScaffoldingRunCount: scaffold,
    scaffoldingRunsAreNotWalkForwardCalibrated: true,
    claimLabels: [
      MIF_RESEARCH_LABEL_NOT_CALIBRATED,
      MIF_RESEARCH_LABEL_UNCALIBRATED,
      MIF_RESEARCH_LABEL_INSUFFICIENT,
    ],
  };
}
