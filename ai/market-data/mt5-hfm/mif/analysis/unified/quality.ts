/**
 * Phase 5C Step 1C — quality / status aggregation for unified chart analysis.
 *
 * Precedence: BLOCKED > DEGRADED > INSUFFICIENT_DATA > WARNING > VALID
 * Never upgrades DEGRADED/WARNING to VALID.
 * Pattern lifecycle is NOT rewritten here.
 */
import type { MifAnalyticalQualityStatus } from "../quality/assessment-quality-gate.js";
import type { MifFibonacciAssessmentStatus } from "../fibonacci/types.js";
import type { MifChartPatternAssessmentStatus } from "../patterns/types.js";
import type {
  MifUnifiedChartAnalysisPolicy,
  MifUnifiedChartAnalysisStatus,
} from "./types.js";
import { MIF_UCA_STATUS_PRECEDENCE } from "./types.js";

function rank(status: MifUnifiedChartAnalysisStatus): number {
  const i = MIF_UCA_STATUS_PRECEDENCE.indexOf(status);
  return i < 0 ? MIF_UCA_STATUS_PRECEDENCE.length : i;
}

export function stricterStatus(
  a: MifUnifiedChartAnalysisStatus,
  b: MifUnifiedChartAnalysisStatus,
): MifUnifiedChartAnalysisStatus {
  return rank(a) <= rank(b) ? a : b;
}

export function mapSourceStatus(
  status: MifChartPatternAssessmentStatus | MifFibonacciAssessmentStatus,
): MifUnifiedChartAnalysisStatus {
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "DEGRADED") return "DEGRADED";
  if (status === "INSUFFICIENT_DATA") return "INSUFFICIENT_DATA";
  if (status === "WARNING") return "WARNING";
  return "VALID";
}

export function deriveUnifiedQualityStatus(input: {
  patternQuality: MifAnalyticalQualityStatus;
  fibonacciQuality: MifAnalyticalQualityStatus;
}): MifAnalyticalQualityStatus {
  const order: MifAnalyticalQualityStatus[] = [
    "MISSING",
    "BLOCKED",
    "DEGRADED",
    "WARNING",
    "VALID",
  ];
  const pick = (a: MifAnalyticalQualityStatus, b: MifAnalyticalQualityStatus) =>
    order.indexOf(a) <= order.indexOf(b) ? a : b;
  return pick(input.patternQuality, input.fibonacciQuality);
}

/**
 * Aggregate unified assessment status from source assessments + compatibility + quality policy.
 */
export function aggregateUnifiedStatus(input: {
  policy: MifUnifiedChartAnalysisPolicy;
  compatible: boolean;
  patternStatus: MifChartPatternAssessmentStatus | null;
  fibonacciStatus: MifFibonacciAssessmentStatus | null;
  unifiedQuality: MifAnalyticalQualityStatus;
  missingSource: boolean;
}): { status: MifUnifiedChartAnalysisStatus; reason: string } {
  if (input.missingSource) {
    return { status: "INSUFFICIENT_DATA", reason: "required source assessment missing" };
  }
  if (!input.compatible) {
    return { status: "BLOCKED", reason: "source assessments incompatible" };
  }
  if (input.unifiedQuality === "BLOCKED" || input.unifiedQuality === "MISSING") {
    return {
      status: input.unifiedQuality === "MISSING" ? "INSUFFICIENT_DATA" : "BLOCKED",
      reason: `unified quality ${input.unifiedQuality}`,
    };
  }

  let status: MifUnifiedChartAnalysisStatus = "VALID";
  if (input.patternStatus) status = stricterStatus(status, mapSourceStatus(input.patternStatus));
  if (input.fibonacciStatus) {
    status = stricterStatus(status, mapSourceStatus(input.fibonacciStatus));
  }
  if (input.unifiedQuality === "DEGRADED") {
    status = stricterStatus(status, "DEGRADED");
  } else if (input.unifiedQuality === "WARNING") {
    status = stricterStatus(status, "WARNING");
  }

  if (
    status === "VALID"
    && !input.policy.allowedQualityStatusesForValid.includes(input.unifiedQuality)
  ) {
    status = input.unifiedQuality === "WARNING" ? "WARNING" : "DEGRADED";
  }

  return {
    status,
    reason: `aggregated status=${status} (precedence BLOCKED>DEGRADED>INSUFFICIENT_DATA>WARNING>VALID)`,
  };
}
