/**
 * Phase 5D Step 3 — Pullback Detector.
 * Distinguishes corrective pullbacks from potential reversals; fib alone is never confirmation.
 */
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type { MifOpportunityDetectionContext, MifOpportunityDetector } from "../types.js";
import {
  MIF_PULLBACK_DETECTOR_ID,
  MIF_PULLBACK_DETECTOR_VERSION,
} from "./contracts.js";
import {
  collectOptionalMissingWarnings,
  findEvidenceByFamily,
  findEvidenceById,
  isPresentUsable,
  resolveMtfView,
  resolveRegimeView,
} from "./shared.js";

const STRATEGY_ID = "PULLBACK" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

function evaluatePullback(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, ["pb.fib", "pb.structure"]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["pb.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks pullback evaluation`,
    };
  }

  // Higher-TF directional context required.
  if (regime.direction !== "UP" && regime.direction !== "DOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: `no higher-TF directional context: direction=${regime.direction}`,
    };
  }

  if (regime.structure !== "TRENDING" && regime.structure !== "TRANSITION") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime structure ${regime.structure} does not support pullback-vs-trend context`,
    };
  }

  if (mtf.status === "BLOCKED" || mtf.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `MTF status ${mtf.status} blocks pullback`,
    };
  }

  // Explicit reversal conflict — do not classify as pullback.
  if (mtf.relation === "POTENTIAL_REVERSAL") {
    const mtfEv =
      findEvidenceById(context, "pb.mtf")
      ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
    return {
      candidate: null,
      warnings: [
        ...warnings,
        "MTF POTENTIAL_REVERSAL conflicts with pullback interpretation",
      ],
      diagnostics: `potential reversal conflict; evidence=${mtfEv?.evidenceId ?? "mtf"}; ${mtf.explanation}`,
    };
  }

  const fibEv = findEvidenceById(context, "pb.fib") ?? findEvidenceByFamily(context, "FIBONACCI");
  const fibPresent = isPresentUsable(fibEv);

  // Fibonacci proximity alone is never confirmation of a pullback.
  const mtfPullback =
    mtf.relation === "COUNTERTREND_PULLBACK"
    || (mtf.relation === "PARTIAL_ALIGNMENT" && mtf.pullbackCompatible)
    || (mtf.relation === "CONFLICT" && mtf.pullbackCompatible);

  if (!mtfPullback && fibPresent) {
    return {
      candidate: null,
      warnings: [...warnings, "Fibonacci present without pullback confirmation"],
      diagnostics: "Fibonacci proximity alone is not pullback confirmation",
    };
  }

  if (!mtfPullback) {
    // Countertrend / unknown without pullback-compatible MTF relation.
    if (
      mtf.relation === "ALIGNMENT"
      || mtf.relation === "UNKNOWN"
      || mtf.relation === "INSUFFICIENT_DATA"
      || mtf.relation === "TRANSITION"
      || mtf.relation === "CONFLICT"
    ) {
      return {
        candidate: null,
        warnings,
        diagnostics:
          `no confirmed corrective pullback relation (mtf=${mtf.relation}, pullbackCompatible=${mtf.pullbackCompatible})`,
      };
    }
  }

  // Confirmation gate: MTF COUNTERTREND_PULLBACK, closed candle confirm, or usable swing structure.
  const candle =
    findEvidenceById(context, "pb.candle_confirm")
    ?? findEvidenceByFamily(context, "CANDLE_CONFIRMATION");
  const candleClosed = isPresentUsable(candle) && candle?.candleState === "CLOSED";
  const structureEv =
    findEvidenceById(context, "pb.structure")
    ?? findEvidenceByFamily(context, "MARKET_STRUCTURE");
  const structureUsable = isPresentUsable(structureEv);

  const confirmed =
    mtf.relation === "COUNTERTREND_PULLBACK"
    || candleClosed
    || (mtfPullback && structureUsable);

  if (!confirmed) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        "countertrend movement without confirmation (need COUNTERTREND_PULLBACK, closed candle, or swing structure)",
      ],
      diagnostics: "pullback not confirmed; refusing candidate",
    };
  }

  if (!structureUsable) {
    warnings.push("optional swing/structure evidence missing or unusable");
  }

  const supportingEvidenceIds = ["pb.regime", "pb.mtf", "pb.quality"].filter(
    (id) => isPresentUsable(findEvidenceById(context, id)) || id === "pb.quality",
  );
  const mtfEv =
    findEvidenceById(context, "pb.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
  if (mtfEv && isPresentUsable(mtfEv) && !supportingEvidenceIds.includes(mtfEv.evidenceId)) {
    supportingEvidenceIds.push(mtfEv.evidenceId);
  }
  if (structureUsable && structureEv && !supportingEvidenceIds.includes(structureEv.evidenceId)) {
    supportingEvidenceIds.push(structureEv.evidenceId);
  }
  if (candleClosed && candle && !supportingEvidenceIds.includes(candle.evidenceId)) {
    supportingEvidenceIds.push(candle.evidenceId);
  }
  if (fibPresent && fibEv && !supportingEvidenceIds.includes(fibEv.evidenceId)) {
    // Fib may support, never sole confirmation — listed only when confirmed otherwise.
    supportingEvidenceIds.push(fibEv.evidenceId);
  }

  const conflictingEvidenceIds: string[] = [];
  if (mtf.hasConflict && mtf.relation !== "COUNTERTREND_PULLBACK" && mtfEv) {
    conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push(`conflicting MTF retained: ${mtf.conflictKind ?? mtf.relation}`);
  }

  const direction = regime.direction === "UP" ? "BUY" : "SELL";
  const status = candleClosed || mtf.relation === "COUNTERTREND_PULLBACK"
    ? "DETECTED"
    : "NEEDS_CONFIRMATION";

  const thesis =
    regime.direction === "UP"
      ? "Bullish-trend pullback (corrective) setup"
      : "Bearish-trend pullback (corrective) setup";
  const rationale = [
    `Higher-TF direction ${regime.direction} structure=${regime.structure}.`,
    `MTF relation ${mtf.relation} pullbackCompatible=${mtf.pullbackCompatible}.`,
    confirmed ? "Confirmation evidence satisfied." : "Confirmation incomplete.",
    "Fibonacci is never sole confirmation.",
    "Not classified as reversal.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_PULLBACK_DETECTOR_ID,
    detectorVersion: MIF_PULLBACK_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["pb.resume_closed"],
    invalidationConditions: ["pb.becomes_reversal"],
    knownLimitations: [
      "Does not invent institutional order-flow.",
      "Eligibility and confirmation do not imply trade success probability.",
      "Analytical candidate only — not executable.",
    ],
    timeframeRoles: [
      "PRIMARY_DIRECTION",
      "OPPORTUNITY_FORMATION",
      "INTERMEDIATE_STRUCTURE",
    ],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics: `pullback candidate direction=${direction} status=${status} mtf=${mtf.relation}`,
  };
}

export const mifPullbackDetector: MifOpportunityDetector = {
  detectorId: MIF_PULLBACK_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_PULLBACK_DETECTOR_VERSION,
  policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
  availabilityStatus: "ACTIVE",
  supportedTimeframeRoles: [
    "PRIMARY_DIRECTION",
    "OPPORTUNITY_FORMATION",
    "INTERMEDIATE_STRUCTURE",
    "OPTIONAL_ENTRY_REFINEMENT",
  ],
  supportedSymbols: null,
  notes: "Phase 5D Step 3 — pullback; analytical only; distinguishes reversal conflicts.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluatePullback,
};
