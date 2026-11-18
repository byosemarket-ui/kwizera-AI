/**
 * Phase 5C Step 1A — reusable quality gate for MIF analytical assessments.
 * Preserves original quality assessment meaning. Never mutates Phase 2.
 * Does not invent universal freshness / candle-count / 6h sync thresholds.
 */
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import type { MifUnifiedQualityAssessment } from "../../quality/unified/types.js";
import type { MifScopedQualityStatus } from "../../quality/status.js";
import type { MifStep1IntegrityStatus } from "../../quality/types.js";

export type MifAnalyticalQualityStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "MISSING";

export type MifQualityGateSource =
  | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
  | { kind: "step3-unified-quality"; assessment: MifUnifiedQualityAssessment };

export interface MifAnalyticalQualityGateInput {
  /** Required quality assessment — null/undefined fails closed. */
  quality: MifQualityGateSource | null | undefined;
  /**
   * Statuses that permit confirmed analytical anchors (e.g. Fibonacci confirmed swings).
   * Must be supplied by the caller/policy — no silent universal default invented here.
   */
  allowedStatusesForConfirmedAnchors: readonly MifAnalyticalQualityStatus[];
}

export interface MifAnalyticalQualityGateResult {
  present: boolean;
  sourceKind: MifQualityGateSource["kind"] | null;
  qualityStatus: MifAnalyticalQualityStatus;
  qualityInputIdentity: string | null;
  qualityAssessmentId: string | null;
  /** True when confirmed anchors may be selected under the supplied policy list. */
  allowsConfirmedAnchors: boolean;
  /** Analytical assessment status contribution (never upgrades quality). */
  analyticalStatusHint: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "INSUFFICIENT_DATA";
  reasonCode:
    | "QUALITY_OK"
    | "QUALITY_WARNING"
    | "QUALITY_DEGRADED"
    | "QUALITY_BLOCKED"
    | "QUALITY_MISSING"
    | "QUALITY_DISALLOWS_CONFIRMED";
  message: string;
  /** Fixed: this gate never approves AI reasoning. */
  doesNotApproveAiReasoning: true;
}

function mapScoped(
  status: MifScopedQualityStatus | MifStep1IntegrityStatus,
): Exclude<MifAnalyticalQualityStatus, "MISSING"> {
  if (status === "VALID") return "VALID";
  if (status === "WARNING") return "WARNING";
  if (status === "DEGRADED") return "DEGRADED";
  return "BLOCKED";
}

function hintFromStatus(
  status: MifAnalyticalQualityStatus,
  allowsConfirmed: boolean,
): MifAnalyticalQualityGateResult["analyticalStatusHint"] {
  if (status === "MISSING") return "INSUFFICIENT_DATA";
  if (status === "BLOCKED") return "BLOCKED";
  if (!allowsConfirmed) return "INSUFFICIENT_DATA";
  if (status === "DEGRADED") return "DEGRADED";
  if (status === "WARNING") return "WARNING";
  return "VALID";
}

/**
 * Evaluate whether an analytical engine may use confirmed anchors given a MIF quality assessment.
 * Never upgrades WARNING/DEGRADED to VALID. Never mutates the supplied assessment.
 */
export function evaluateMifAnalyticalQualityGate(
  input: MifAnalyticalQualityGateInput,
): MifAnalyticalQualityGateResult {
  const allowed = input.allowedStatusesForConfirmedAnchors;
  if (!input.quality) {
    return {
      present: false,
      sourceKind: null,
      qualityStatus: "MISSING",
      qualityInputIdentity: null,
      qualityAssessmentId: null,
      allowsConfirmedAnchors: false,
      analyticalStatusHint: "INSUFFICIENT_DATA",
      reasonCode: "QUALITY_MISSING",
      message: "required MIF quality assessment missing — fail closed",
      doesNotApproveAiReasoning: true,
    };
  }

  const { kind, assessment } = input.quality;
  const qualityStatus = mapScoped(assessment.status);
  const allowsConfirmedAnchors = allowed.includes(qualityStatus);

  let reasonCode: MifAnalyticalQualityGateResult["reasonCode"] = "QUALITY_OK";
  let message = `quality status ${qualityStatus}`;
  if (qualityStatus === "BLOCKED") {
    reasonCode = "QUALITY_BLOCKED";
    message = "quality assessment is BLOCKED — confirmed analytical anchors unavailable";
  } else if (qualityStatus === "DEGRADED") {
    reasonCode = allowsConfirmedAnchors ? "QUALITY_DEGRADED" : "QUALITY_DISALLOWS_CONFIRMED";
    message = allowsConfirmedAnchors
      ? "quality assessment is DEGRADED"
      : "DEGRADED quality does not permit confirmed anchors under selected policy";
  } else if (qualityStatus === "WARNING") {
    reasonCode = allowsConfirmedAnchors ? "QUALITY_WARNING" : "QUALITY_DISALLOWS_CONFIRMED";
    message = allowsConfirmedAnchors
      ? "quality assessment is WARNING"
      : "WARNING quality does not permit confirmed anchors under selected policy";
  } else if (!allowsConfirmedAnchors) {
    reasonCode = "QUALITY_DISALLOWS_CONFIRMED";
    message = `quality status ${qualityStatus} not in policy allow-list for confirmed anchors`;
  }

  return {
    present: true,
    sourceKind: kind,
    qualityStatus,
    qualityInputIdentity: assessment.inputIdentity,
    qualityAssessmentId: assessment.assessmentId,
    allowsConfirmedAnchors,
    analyticalStatusHint: hintFromStatus(qualityStatus, allowsConfirmedAnchors),
    reasonCode,
    message,
    doesNotApproveAiReasoning: true,
  };
}
