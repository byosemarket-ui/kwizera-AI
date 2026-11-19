/**
 * Phase 5D Step 7 — Range Opportunity Detector.
 * Edge opportunities inside a validated range (NEAR_LOWER / NEAR_UPPER) with CLOSED rejection.
 * RANGE_STRUCTURE / boundaries remain PARTIAL (notes + optional regime.rangeEvidence).
 * Does not invent proximity thresholds; does not duplicate STEP 5 breakout detection.
 */
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type {
  MifOpportunityDetectionContext,
  MifOpportunityDetector,
  MifOpportunityDirection,
} from "../types.js";
import {
  MIF_RANGE_DETECTOR_ID,
  MIF_RANGE_DETECTOR_VERSION,
} from "./contracts.js";
import {
  collectOptionalMissingWarnings,
  findEvidenceByFamily,
  findEvidenceById,
  isPresentUsable,
  noteValue,
  resolveMtfView,
  resolveRegimeView,
} from "./shared.js";

const STRATEGY_ID = "RANGE" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

type RangePosition =
  | "NEAR_LOWER"
  | "NEAR_UPPER"
  | "MID"
  | "OUTSIDE_UPPER"
  | "OUTSIDE_LOWER"
  | "UNKNOWN";

function parseRangeStructure(notes: string | undefined): {
  upperId: string | null;
  lowerId: string | null;
  rangeState: string | null;
  position: RangePosition;
  orderValid: boolean | null;
  fibonacciSource: boolean;
  arbitrary: boolean;
  invalid: boolean;
} {
  const upperId = noteValue(notes, "upperId") ?? noteValue(notes, "upperBoundaryId");
  const lowerId = noteValue(notes, "lowerId") ?? noteValue(notes, "lowerBoundaryId");
  const rangeState = noteValue(notes, "rangeState") ?? noteValue(notes, "state");
  const posRaw = noteValue(notes, "position");
  const allowed: RangePosition[] = [
    "NEAR_LOWER",
    "NEAR_UPPER",
    "MID",
    "OUTSIDE_UPPER",
    "OUTSIDE_LOWER",
    "UNKNOWN",
  ];
  const position = (posRaw && allowed.includes(posRaw as RangePosition)
    ? posRaw
    : "UNKNOWN") as RangePosition;
  const orderRaw = noteValue(notes, "orderValid");
  const orderValid = orderRaw === "TRUE" ? true : orderRaw === "FALSE" ? false : null;
  const fibonacciSource = noteValue(notes, "source") === "FIBONACCI";
  const arbitrary = noteValue(notes, "arbitrary") === "TRUE";
  const quality = noteValue(notes, "quality") ?? noteValue(notes, "boundaryQuality") ?? "VALID";
  const invalid =
    quality === "INVALID"
    || quality === "MISSING"
    || rangeState === "INVALID"
    || noteValue(notes, "invalid") === "TRUE";
  return {
    upperId,
    lowerId,
    rangeState,
    position,
    orderValid,
    fibonacciSource,
    arbitrary,
    invalid,
  };
}

function parseRejection(notes: string | undefined): {
  reject: string | null;
  closeState: string | null;
  accepted: boolean | null;
} {
  const reject =
    noteValue(notes, "reject")
    ?? noteValue(notes, "rejection")
    ?? noteValue(notes, "retestResult");
  const closeState = noteValue(notes, "closeState");
  const acceptedRaw = noteValue(notes, "accepted");
  const accepted = acceptedRaw === "TRUE" ? true : acceptedRaw === "FALSE" ? false : null;
  return { reject, closeState, accepted };
}

function evaluateRange(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, ["rg.vol", "rg.mtf"]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["rg.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks range evaluation`,
    };
  }

  // Confirmed breakout invalidates normal range-edge opportunities (STEP 5 owns breakouts).
  const regimeBo = context.regime?.breakoutEvidence ?? null;
  if (regimeBo?.state === "CONFIRMED" || regime.structure === "BREAKOUT") {
    return {
      candidate: null,
      warnings: [...warnings, "confirmed breakout / BREAKOUT regime — not a range-edge opportunity"],
      diagnostics: "range invalidated by confirmed breakout evidence",
    };
  }
  if (regimeBo?.state === "FAILED") {
    warnings.push("failed breakout evidence preserved — not treated as range confirmation");
  }

  // RANGING required for range opportunity (catalog). TRANSITION alone is insufficient.
  if (regime.structure === "TRANSITION") {
    return {
      candidate: null,
      warnings: [...warnings, "TRANSITION alone does not establish a valid range opportunity"],
      diagnostics: "regime TRANSITION is not sufficient for RANGE",
    };
  }
  if (regime.structure === "TRENDING") {
    return {
      candidate: null,
      warnings: [...warnings, "TRENDING regime conflicts with range-edge opportunity"],
      diagnostics: "regime TRENDING — range opportunity rejected",
    };
  }
  if (regime.structure === "UNSTABLE" || regime.structure === "UNKNOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime structure ${regime.structure} does not support range opportunity`,
    };
  }
  if (regime.structure !== "RANGING") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime structure ${regime.structure} is not RANGING`,
    };
  }

  const rangeEv =
    findEvidenceById(context, "rg.range")
    ?? findEvidenceByFamily(context, "RANGE_STRUCTURE");
  if (!isPresentUsable(rangeEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "RANGE_STRUCTURE evidence absent or unusable",
    };
  }
  if (rangeEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "range structure evidence STALE"],
      diagnostics: "stale range structure evidence rejected",
    };
  }
  if (rangeEv!.qualityStatus === "DEGRADED") {
    warnings.push("range structure quality DEGRADED (RANGE_STRUCTURE is PARTIAL in MIF)");
  }

  const range = parseRangeStructure(rangeEv!.notes);
  if (range.invalid || range.rangeState === "BROKEN") {
    return {
      candidate: null,
      warnings: [...warnings, "range invalid or broken"],
      diagnostics: `rangeState=${range.rangeState} invalid=${range.invalid}`,
    };
  }
  if (range.fibonacciSource) {
    return {
      candidate: null,
      warnings: [...warnings, "Fibonacci-only range boundaries rejected"],
      diagnostics: "Fibonacci levels alone are not range boundaries",
    };
  }
  if (range.arbitrary) {
    return {
      candidate: null,
      warnings: [...warnings, "arbitrary unsupported levels rejected"],
      diagnostics: "arbitrary levels are not a validated range",
    };
  }
  if (!range.upperId) {
    return {
      candidate: null,
      warnings,
      diagnostics: "missing upper boundary identity",
    };
  }
  if (!range.lowerId) {
    return {
      candidate: null,
      warnings,
      diagnostics: "missing lower boundary identity",
    };
  }
  if (range.upperId === range.lowerId) {
    return {
      candidate: null,
      warnings,
      diagnostics: "upper and lower boundary identities must differ",
    };
  }

  // Boundary order: prefer regime.rangeEvidence numerics; else require orderValid=TRUE in notes.
  let orderOk = range.orderValid;
  const re = context.regime?.rangeEvidence;
  if (re && re.high != null && re.low != null) {
    orderOk = re.high > re.low;
    if (!orderOk) {
      return {
        candidate: null,
        warnings: [...warnings, "regime rangeEvidence high is not above low"],
        diagnostics: "upper boundary not above lower boundary",
      };
    }
  } else if (orderOk === false) {
    return {
      candidate: null,
      warnings: [...warnings, "orderValid=FALSE — upper not above lower"],
      diagnostics: "upper boundary not above lower boundary",
    };
  } else if (orderOk == null) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        "boundary order not established (no regime.rangeEvidence numerics and no orderValid)",
      ],
      diagnostics: "cannot safely validate upper > lower without inventing measurements",
    };
  }

  // Mid-range / outside / unknown → no edge candidate.
  if (range.position === "MID") {
    return {
      candidate: null,
      warnings: [...warnings, "price mid-range — no edge opportunity"],
      diagnostics: "valid range with mid-range position — no candidate",
    };
  }
  if (range.position === "OUTSIDE_UPPER" || range.position === "OUTSIDE_LOWER") {
    return {
      candidate: null,
      warnings: [...warnings, "price outside range boundary — breakout framework owns this"],
      diagnostics: `position=${range.position} — not a range-edge opportunity`,
    };
  }
  if (range.position === "UNKNOWN") {
    return {
      candidate: null,
      warnings: [...warnings, "missing price-position evidence"],
      diagnostics: "price position relative to range boundaries unknown",
    };
  }

  // CLOSED boundary rejection confirmation (catalog: rg.boundary_reject).
  const candleEv =
    findEvidenceById(context, "rg.candle")
    ?? findEvidenceByFamily(context, "CANDLE_CONFIRMATION");
  if (!isPresentUsable(candleEv)) {
    return {
      candidate: null,
      warnings: [...warnings, "missing CLOSED boundary rejection confirmation"],
      diagnostics: "range membership / RANGING alone is not an opportunity",
    };
  }
  if (candleEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "boundary rejection candle STALE"],
      diagnostics: "stale candle confirmation rejected",
    };
  }

  const candle = parseRejection(candleEv!.notes);
  if (candle.closeState === "FORMING" || candleEv!.candleState === "FORMING") {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING candle cannot provide CLOSED boundary rejection"],
      diagnostics: "FORMING candle is not CLOSED confirmation",
    };
  }
  const closed =
    candle.closeState === "CLOSED"
    || candleEv!.candleState === "CLOSED";
  if (!closed) {
    return {
      candidate: null,
      warnings,
      diagnostics: "CLOSED candle rejection required at range boundary",
    };
  }

  let direction: MifOpportunityDirection = "UNKNOWN";
  const rejectUp =
    candle.reject === "UP"
    || candle.reject === "REJECT_UP"
    || candle.reject === "BULLISH";
  const rejectDown =
    candle.reject === "DOWN"
    || candle.reject === "REJECT_DOWN"
    || candle.reject === "BEARISH";

  if (range.position === "NEAR_LOWER" && rejectUp) {
    direction = "BUY";
  } else if (range.position === "NEAR_UPPER" && rejectDown) {
    direction = "SELL";
  } else {
    return {
      candidate: null,
      warnings,
      diagnostics:
        `position=${range.position} reject=${candle.reject} does not form a range-edge opportunity`,
    };
  }

  if (candle.accepted === false) {
    return {
      candidate: null,
      warnings: [...warnings, "rejection acceptance failed"],
      diagnostics: "boundary rejection not accepted",
    };
  }

  const mtfEv =
    findEvidenceById(context, "rg.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
  const conflictingEvidenceIds: string[] = [];
  if (mtf.hasConflict || mtf.relation === "CONFLICT" || mtf.relation === "PARTIAL_ALIGNMENT") {
    if (mtfEv) conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push(`conflicting/partial MTF retained: ${mtf.relation}`);
  }
  const htfConflict =
    (direction === "BUY" && mtf.higherDirection === "DOWN")
    || (direction === "SELL" && mtf.higherDirection === "UP");
  if (htfConflict) {
    if (mtfEv && !conflictingEvidenceIds.includes(mtfEv.evidenceId)) {
      conflictingEvidenceIds.push(mtfEv.evidenceId);
    }
    warnings.push("higher-timeframe direction conflicts with range-edge side");
  }
  if (mtf.relation === "POTENTIAL_REVERSAL" || mtf.relation === "ALIGNMENT") {
    // ALIGNMENT with HTF trend may mean local range is only consolidation — preserve as warning.
    if (mtf.relation === "ALIGNMENT" && (mtf.higherDirection === "UP" || mtf.higherDirection === "DOWN")) {
      warnings.push("higher-timeframe trend context preserved — local range may be consolidation");
      if (mtfEv && !conflictingEvidenceIds.includes(mtfEv.evidenceId) && htfConflict) {
        conflictingEvidenceIds.push(mtfEv.evidenceId);
      }
    }
  }

  const structureEv = findEvidenceByFamily(context, "MARKET_STRUCTURE");
  const strong =
    candle.accepted === true
    || rejectUp
    || rejectDown;

  const mtfNeedsConfirmation =
    htfConflict
    || mtf.hasConflict
    || mtf.relation === "CONFLICT"
    || mtf.relation === "POTENTIAL_REVERSAL"
    || mtf.relation === "PARTIAL_ALIGNMENT";

  const status =
    !strong || mtfNeedsConfirmation
      ? "NEEDS_CONFIRMATION"
      : "DETECTED";

  const supportingEvidenceIds = ["rg.regime", "rg.range", "rg.quality"].filter(
    (id) => isPresentUsable(findEvidenceById(context, id)) || id === "rg.quality",
  );
  for (const e of [rangeEv, candleEv, structureEv, mtfEv]) {
    if (e && isPresentUsable(e) && !supportingEvidenceIds.includes(e.evidenceId)) {
      supportingEvidenceIds.push(e.evidenceId);
    }
  }

  const thesis =
    direction === "BUY"
      ? "Potential bullish range-edge reaction near lower boundary"
      : "Potential bearish range-edge reaction near upper boundary";
  const rationale = [
    `Range upperId=${range.upperId} lowerId=${range.lowerId} state=${range.rangeState ?? "VALID"} (RANGE_STRUCTURE PARTIAL).`,
    `Position=${range.position}; reject=${candle.reject}; closeState=${candle.closeState}.`,
    `Regime structure=${regime.structure} direction=${regime.direction}.`,
    mtf.source !== "absent" ? `MTF relation=${mtf.relation}.` : "MTF optional evidence not supplied.",
    "Mid-range / FORMING / Fibonacci-only / confirmed breakout never produce edge candidates.",
    "Does not claim mean reversion or win probability.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_RANGE_DETECTOR_ID,
    detectorVersion: MIF_RANGE_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["rg.boundary_reject"],
    invalidationConditions: ["rg.range_break"],
    knownLimitations: [
      "RANGE_STRUCTURE / boundaries are PARTIAL (notes + optional regime.rangeEvidence).",
      "Does not invent pip/ATR proximity thresholds — position must be evidenced.",
      "Confirmed breakouts are owned by STEP 5 BREAKOUT detector, not RANGE.",
      "Analytical candidate only — not executable; not a win probability.",
    ],
    timeframeRoles: ["INTERMEDIATE_STRUCTURE", "SETUP_DEVELOPMENT"],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics:
      `range candidate direction=${direction} status=${status} position=${range.position}`,
  };
}

export const mifRangeDetector: MifOpportunityDetector = {
  detectorId: MIF_RANGE_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_RANGE_DETECTOR_VERSION,
  policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
  availabilityStatus: "ACTIVE",
  supportedTimeframeRoles: [
    "INTERMEDIATE_STRUCTURE",
    "SETUP_DEVELOPMENT",
    "OPPORTUNITY_FORMATION",
    "LOWER_TIMEFRAME_CONFIRMATION",
  ],
  supportedSymbols: null,
  notes:
    "Phase 5D Step 7 — range edge; requires RANGING + validated boundaries + CLOSED rejection; analytical only.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluateRange,
};
