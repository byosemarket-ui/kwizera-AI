/**
 * Phase 5D Step 3 — Trend Continuation Detector.
 * Analytical only — does not invent opportunities from regime labels alone.
 */
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type { MifOpportunityDetectionContext, MifOpportunityDetector } from "../types.js";
import {
  MIF_TREND_CONTINUATION_DETECTOR_ID,
  MIF_TREND_CONTINUATION_DETECTOR_VERSION,
} from "./contracts.js";
import {
  collectOptionalMissingWarnings,
  findEvidenceByFamily,
  findEvidenceById,
  isPresentUsable,
  resolveMtfView,
  resolveRegimeView,
} from "./shared.js";

const STRATEGY_ID = "TREND_CONTINUATION" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

function evaluateTrendContinuation(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, ["tc.candle_confirm", "tc.fib"]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["tc.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks continuation evaluation`,
    };
  }

  // Established directional trend required — not TRANSITION / RANGING / UNKNOWN.
  if (regime.structure !== "TRENDING") {
    return {
      candidate: null,
      warnings,
      diagnostics: `no established trend: structure=${regime.structure} (source=${regime.source})`,
    };
  }
  if (regime.direction !== "UP" && regime.direction !== "DOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: `no clear directional regime: direction=${regime.direction}`,
    };
  }

  // Structure evidence must be usable — regime label alone is insufficient.
  const structureEv =
    findEvidenceById(context, "tc.structure")
    ?? findEvidenceByFamily(context, "MARKET_STRUCTURE");
  if (!isPresentUsable(structureEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "market structure evidence absent or unusable; regime alone is insufficient",
    };
  }

  const mtfEv =
    findEvidenceById(context, "tc.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
  if (!isPresentUsable(mtfEv) && mtf.source === "absent") {
    return {
      candidate: null,
      warnings,
      diagnostics: "multi-timeframe relationship evidence absent; regime alone is insufficient",
    };
  }

  if (mtf.status === "BLOCKED" || mtf.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `MTF status ${mtf.status} blocks continuation`,
    };
  }

  // Preserve conflicts — do not erase them into a continuation candidate.
  if (
    mtf.relation === "CONFLICT"
    || mtf.relation === "POTENTIAL_REVERSAL"
    || mtf.relation === "INSUFFICIENT_DATA"
    || mtf.relation === "UNKNOWN"
    || mtf.relation === "TRANSITION"
  ) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        `conflicting or non-continuation MTF relation=${mtf.relation}`,
      ],
      diagnostics: `MTF does not support continuation: relation=${mtf.relation}; ${mtf.explanation}`,
    };
  }

  if (mtf.relation !== "ALIGNMENT" && mtf.relation !== "PARTIAL_ALIGNMENT") {
    // COUNTERTREND_PULLBACK is a pullback setup, not continuation expansion.
    return {
      candidate: null,
      warnings,
      diagnostics: `MTF relation ${mtf.relation} is not continuation-compatible`,
    };
  }

  if (mtf.relation === "PARTIAL_ALIGNMENT") {
    warnings.push("MTF PARTIAL_ALIGNMENT — continuation thesis has residual disagreement");
  }

  const supportingEvidenceIds = ["tc.regime", "tc.mtf", "tc.structure", "tc.quality"].filter(
    (id) => isPresentUsable(findEvidenceById(context, id)),
  );
  // Ensure listed ids that exist under family match
  for (const e of [structureEv, mtfEv]) {
    if (e && isPresentUsable(e) && !supportingEvidenceIds.includes(e.evidenceId)) {
      supportingEvidenceIds.push(e.evidenceId);
    }
  }

  const conflictingEvidenceIds: string[] = [];
  if (mtf.hasConflict && mtfEv) conflictingEvidenceIds.push(mtfEv.evidenceId);

  const candle = findEvidenceById(context, "tc.candle_confirm");
  const candleClosed = isPresentUsable(candle) && candle?.candleState === "CLOSED";
  const status = candleClosed ? "DETECTED" : "NEEDS_CONFIRMATION";
  if (!candleClosed) {
    warnings.push("closed continuation candle confirmation not satisfied");
  }

  const direction = regime.direction === "UP" ? "BUY" : "SELL";
  const thesis =
    regime.direction === "UP"
      ? "Bullish trend continuation setup"
      : "Bearish trend continuation setup";
  const rationale = [
    `Regime ${regime.structure}/${regime.direction} (source=${regime.source}).`,
    `MTF relation ${mtf.relation} (source=${mtf.source}).`,
    "Structure evidence present and usable.",
    "Alignment score is not a win probability and is not used as trade probability.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_TREND_CONTINUATION_DETECTOR_ID,
    detectorVersion: MIF_TREND_CONTINUATION_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["tc.closed_continuation"],
    invalidationConditions: ["tc.structure_break"],
    knownLimitations: [
      "Market structure evidence is PARTIAL in current MIF.",
      "Does not treat regime labels or MTF alignment scores as win probability.",
      "Analytical candidate only — not executable.",
    ],
    timeframeRoles: [
      "PRIMARY_DIRECTION",
      "INTERMEDIATE_STRUCTURE",
      "SETUP_DEVELOPMENT",
    ],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics: `trend continuation candidate direction=${direction} status=${status}`,
  };
}

export const mifTrendContinuationDetector: MifOpportunityDetector = {
  detectorId: MIF_TREND_CONTINUATION_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_TREND_CONTINUATION_DETECTOR_VERSION,
  policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
  availabilityStatus: "ACTIVE",
  supportedTimeframeRoles: [
    "PRIMARY_DIRECTION",
    "INTERMEDIATE_STRUCTURE",
    "SETUP_DEVELOPMENT",
    "OPTIONAL_ENTRY_REFINEMENT",
  ],
  supportedSymbols: null,
  notes: "Phase 5D Step 3 — trend continuation; analytical only.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluateTrendContinuation,
};
